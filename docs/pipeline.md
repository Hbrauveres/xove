# Pipeline

Xovê's CI/CD runs on GitHub Actions. It turns every change into a Docker image that has been built once, started, tested and scanned, and only then published and deployed.

## The three pipelines

| Pipeline | File | Runs on | Stages |
| --- | --- | --- | --- |
| **Commit checks** | [`ci.yml`](../.github/workflows/ci.yml) | Every push to any branch except `main` | 1 · Build → 2 · Validate → 3 · Tests and scans |
| **Stage release** | [`stage.yml`](../.github/workflows/stage.yml) | Every push to `main` (a merged pull request) | The same commit checks, then 4 · Publish → 5 · Deploy stage → 6 · Cleanup on failure, and an email on any failure |
| **Production release** | `release.yml` (planned) | A version tag `v*` | Promote the tested images → deploy production |

The commit checks are one reusable workflow: the stage release calls it instead of repeating it, so "what a commit must pass" is defined in one place.

**Every commit is checked**, not only pull requests. Push a branch and its run shows up in the Actions tab and next to the commit, before any pull request exists. When you open the pull request, its required checks are these same runs: GitHub matches checks by commit, so nothing runs twice.

## Stages

```mermaid
flowchart LR
  subgraph S1[1 · Build]
    BA[api image]
    BW[web image]
  end
  subgraph S2[2 · Validate build]
    V[start db + api + web<br/>health check]
  end
  subgraph S3[3 · Test and scan]
    TA[Unit tests api]
    TW[Unit tests web]
    VS[Vulnerability scan]
    SA[SAST]
  end
  subgraph S4[4 · Publish]
    P[push images<br/>sha-&lt;commit&gt;]
  end
  subgraph S5[5 · Deploy stage]
    D[deploy + health check<br/>auto-rollback]
  end
  subgraph S6[6 · On failure]
    C[remove failed images]
  end
  S1 --> S2 --> S3 --> S4 --> S5
  S5 -.->|deploy failed| S6
```

| # | Job | What it does | Fails when |
| --- | --- | --- | --- |
| 1 | **Build (api)**, **Build (web)** | Builds each Docker image from its `Dockerfile` (the Java build and the React build happen inside). Layers are cached between runs, except that the web image rebuilds Caddy from source on the latest Go once a day (the build gets today's date as `REFRESH`). Each image is saved as an artifact for the next stages | The code doesn't compile, TypeScript has type errors, the Docker build breaks |
| 2 | **Validate build** | Loads both images and starts db, api and web with Compose, exactly as a server would. Waits for the API health endpoint and the web page, and checks that the API refuses anonymous requests (401) | An image doesn't start, a migration fails, the app crashes on boot, security isn't wired |
| 3 | **Unit tests (api)** | `./mvnw verify`: JUnit with a real PostgreSQL from Testcontainers | Any test fails (reports are attached to the run) |
| 3 | **Unit tests (web)** | `npm ci` and `npm test` (Vitest) | Any test fails |
| 3 | **Vulnerability scan** | Trivy scans both images (OS packages and the Java libraries inside the jar) and the web dependencies (`package-lock.json`) | A HIGH or CRITICAL vulnerability **with a fix available** is found |
| 3 | **SAST** | Semgrep scans the source with its default, Java, TypeScript, React, secrets and Dockerfile rules | Any finding |
| 4 | **Publish images** | Pushes both images to GitHub Container Registry as `xove-api:sha-<12 chars of the commit>` and `xove-web:sha-…` | Registry errors |
| 5 | **Deploy stage** | Asks the staging server over SSH to deploy that commit (see [Deployment](deployment.md)), checks staging from the internet, then tags the images `:stage` | The new version isn't healthy (the server rolls back by itself first) |
| 6 | **Remove failed images** | Deletes the images of a commit whose deploy failed, so nobody runs them by mistake | — |

Jobs in the same stage run in parallel. Each job starts on a fresh machine, which is why images travel between stages as artifacts.

**Build once, promote.** The image deployed to staging is the one that was built in stage 1 and tested in stages 2 and 3, not a rebuild. Production will reuse that same image with a version tag.

## When it runs

| Event | Pipeline | Stages | Why |
| --- | --- | --- | --- |
| Push to a branch (any commit) | Commit checks | 1 → 3 | Every commit is validated; the pull request's **required checks** come from here |
| Push to `main` (a merged PR) | Stage release | 1 → 5 (6 on failure) | Checks the merged result again, then publishes and deploys to staging |
| Tag `v*` (planned) | Production release | Promote → deploy | Ships a build that already runs on staging |
| Manual ("Run workflow" button) | Either | Same as above | Re-run on demand |

A new push to a branch cancels that branch's older run. Stage releases always finish and run one at a time, in merge order.

## Required checks

The `main` branch only accepts changes through a pull request whose checks pass:

- `1 · Build (api)`, `1 · Build (web)`
- `2 · Validate build`
- `3 · Unit tests (api)`, `3 · Unit tests (web)`, `3 · Vulnerability scan`, `3 · SAST`

They come from the **Commit checks** runs on the pull request's last commit. (Inside a stage release the same jobs show as `Checks / 1 · Build (api)` and so on, because they're called from the `Checks` job; those names aren't used by the ruleset.)

Renaming a job changes its check name. When that happens, update the branch ruleset (Settings → Rules → Rulesets), or merges wait forever for a check that no longer exists.

## When something fails

| Failed job | Where to look | Typical fix |
| --- | --- | --- |
| Build | The job log, near the end | Fix the compile or type error; run `npm run build` or `./mvnw package` locally |
| Validate build | "Show logs" step: last 200 lines of every container | Usually a startup error: a missing setting, a bad migration |
| Unit tests (api) | Log, plus the `api-test-reports` artifact | Run the failing class locally: `./mvnw test -Dtest=ClassName` |
| Unit tests (web) | Log | `npm test` locally |
| Vulnerability scan | Log, one group per target | Upgrade the library or base image named in the table (see policy below) |
| SAST | Log: file, line and rule | Fix the code; if it's a false positive, add a `# nosemgrep: <rule-id>` comment with the reason |
| Deploy stage | Log shows the server's own output, including the rollback | Staging is already back on the previous version. Fix forward with a new PR |

To retry a flaky job: open the run and click **Re-run failed jobs** (or `gh run rerun <run-id> --failed`).

**Failure email.** When a stage release fails at any point (checks, publish or deploy), its last job, **Email on failure**, sends an email over SMTP with the commit, which stage failed, and a link to the run. Commit checks on branches don't email: you're watching those as you push.

## Vulnerability policy

The scan blocks on HIGH and CRITICAL vulnerabilities that have a fixed version, because those can be acted on right away.

1. **Upgrade.** Bump the library, or rebuild on a newer base image. For a library that comes with Spring Boot, override its version property in `api/pom.xml` (for example `<tomcat.version>`) until Spring Boot ships the fix, with a comment saying when to remove it.
2. **If there's no way to upgrade yet** and the vulnerability doesn't affect Xovê, add its ID to `.trivyignore` with a comment: why it doesn't apply, and a date to check again. Never ignore without a reason and a date.

Dependabot (`.github/dependabot.yml`) opens weekly pull requests for Maven, npm, Docker base images and the actions themselves. Each one goes through this same pipeline, so a green Dependabot PR is safe to merge. A new version waits 7 days before Dependabot proposes it (security updates don't wait), and every action in the workflows is pinned to a full commit SHA with its version in a comment (`@<sha> # v4.4.0`), so a moved tag can't change what runs; Dependabot updates the SHA and the comment together. Semgrep enforces both.

## Secrets the pipeline uses

Stored in the repository's Actions secrets (Settings → Secrets and variables → Actions). Values are never printed in logs.

| Secret | Used by | What it is |
| --- | --- | --- |
| `DEPLOY_SSH_KEY` | Deploy stage | Private key that can only run the deploy script on the staging server |
| `DEPLOY_KNOWN_HOSTS` | Deploy stage | The server's host key, so the runner is sure it reaches the real server |
| `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER` | Deploy stage | Where and as whom to connect |
| `STAGE_COOKIE` | Deploy stage | Lets the post-deploy check pass the staging gate |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` | Email on failure | The mailbox that sends alerts (SMTP over TLS on port 465) |
| `ALERT_TO` | Email on failure | Who receives them |
| `GITHUB_TOKEN` | Publish, deploy, cleanup | Created by GitHub for each run; used to push and delete images |

## Adding a stage or a job

Stages aren't a GitHub keyword: order comes from `needs:`. Checks that every commit should pass go in `ci.yml`; steps that only make sense after a merge (publishing, deploying, DAST against staging) go in `stage.yml`. To add a job to stage 3, add it to `ci.yml` with `needs: validate` and name it `3 · Something`. To add a whole stage between two others, point its `needs:` at the earlier stage's jobs and point the later stage at the new one. Then add any new blocking job to the required checks.

Ideas already on the list: DAST (OWASP ZAP against staging, after stage 5) and performance tests.

## Production (planned)

The production release workflow will run on version tags (`v1.2.0`): take the `sha-…` images already tested and deployed to staging, tag them with the version, and deploy them to production with the same script and rollback. See [Deployment](deployment.md).
