# Production environment and release from a tag — spec

- Issues: #46, and #45 (folded in: the production release is needed to test production the way it will really run)
- Status: Approved (2026-09-29)
- Owner: Henrique

## Problem

`xove.app` only shows a "coming soon" page. The real app runs only on staging, which sits behind an extra password and is meant for testing. Before friends can use Xovê, production needs its own settings, database and sign-in, and the address `xove.app` must lead to it.

There's also no way to release to production yet. Staging gets every merge automatically; production should get only the versions Henrique chooses, by creating a tag, with nobody deploying by hand. The server also doesn't install security updates by itself today.

## Who it's for

- Friends, who will use `https://xove.app`.
- Henrique, who decides what goes to production (the tag is his approval) and runs the server.

## Functional requirements

**Production itself**

- **FR-1** `https://xove.app` serves the real app: the page loads, and people can sign in with Google, request access, share and watch. There's no extra password in front of it, and search engines may index it. `https://www.xove.app` redirects to `https://xove.app`.
- **FR-2** Production is fully separate from staging. It has its own database and its own secrets: database password, and its own Google sign-in client (a new OAuth client and secret, allowed only for `xove.app`). Nothing from staging can read or change production, and the other way round.
- **FR-3** Production uses its own LiveKit server, already running since #44 and dedicated to production only: `rtc.xove.app`, with its own key pair, media ports and room `xove`. Production's app connects only to that server, and staging's app only to its own (`rtc-stage.xove.app`, room `xove-stage`).
- **FR-4** Production's settings come from the same place as staging's: public values in `infra/config/prod.yaml`, secrets in the `Xove App` vault. Nothing is written by hand on the server.
- **FR-5** Production starts with an empty database, and Henrique is its admin.
- **FR-6** Staging keeps working, unchanged, next to production.

**Releasing to production**

- **FR-7** Production has its own pipeline, the **production release**, separate from the stage release. Its stages are named for production (for example "Deploy production", "Check production", "Roll back production"); nothing in it is called "stage".
- **FR-8** Pushing a version tag (`vX.Y.Z`, for example `v0.1.0`) on a commit of `main` runs the production release for that commit. This is the only way production gets deployed: no one deploys it by hand.
- **FR-9** A release uses the exact images staging already ran for that commit, never a rebuild. A tag on a commit that never passed a stage release fails, and production doesn't change.
- **FR-10** The release deploys through the same deploy tool as staging, with a separate key that can only deploy production. If the new version isn't healthy, production goes back to the previous version by itself, as staging does.
- **FR-11** After deploying, the release checks production from the internet (`https://xove.app` answers and the API says it's up).
- **FR-12** The production release has a rollback stage, "Roll back production". It puts back the last version that was released successfully before the current one. It runs by itself when the check from the internet fails, and Henrique can also run it by hand from GitHub Actions. It's the only other way production changes, and it goes through the same key and tool.
- **FR-13** Every release and every rollback posts its result to Discord, success or failure. Every successful release creates a GitHub Release with notes of what changed.

**The server**

- **FR-14** The server installs security updates by itself. When an update needs a restart, the server restarts by itself at 04:00 (offline for about a minute), and everything comes back up on its own.
- **FR-15** The docs say how production is set up, how to release, and how to check it.

## Acceptance criteria

- **AC-1** Opening `https://xove.app` shows the app's sign-in page, with a valid certificate and no password prompt; `https://www.xove.app` lands on `https://xove.app` (manual).
- **AC-2** Henrique signs in with Google on `xove.app` and sees the admin page. A second account requests access, gets approved, and shares a screen while Henrique watches, with video and sound (manual).
- **AC-3** Production's app talks only to production's LiveKit: the browser connects to `rtc.xove.app` in room `xove`, and production's LiveKit log shows the join (manual).
- **AC-4** Staging and production use different secrets: every secret in `config/prod.yaml` points to a production item in the vault, never a staging one (review). Production's users don't show up on staging (manual).
- **AC-5** `https://stage.xove.app` still asks for its password and works as before (manual).
- **AC-6** Pushing a version tag on a commit that ran on staging runs the production release (its own pipeline, with production-named stages) and deploys it to production. Production runs the same image digests as staging did for that commit, the check from the internet passes, a GitHub Release exists, and Discord shows ✅ (manual, written in the PR).
- **AC-7** A tag on a commit that never passed a stage release fails the release, production keeps running what it ran, and Discord shows ❌ (manual).
- **AC-8** The production key can't deploy staging, and staging's key can't deploy production (manual check with both keys).
- **AC-9** With two releases done (`v0.0.1`, then `v0.0.2`), running the "Roll back production" stage by hand puts the first one back, production works, and Discord shows the result (manual).
- **AC-10** When the check from the internet fails, the release runs the same "Roll back production" job that AC-9 proves by hand (review of the pipeline; no failure is caused on purpose).
- **AC-11** Security updates are turned on, with automatic restart at 04:00: the server's update service is enabled and its log shows a run (manual).
- **AC-12** The docs describe production's settings, how to release with a tag, and how to check production. No doc tells you to deploy production by hand (review).
- **AC-13** The spec ends with a real release: tag `v0.0.1` is live on `xove.app` through the release workflow, and everything above has been checked on it (manual).

## Out of scope

- Backups: future work (#42). `v0.0.1` is a test release, since there are no backups yet.
- Inviting friends and announcing the launch (#47).
- Moving the pipeline into shared templates (#68).

## Open questions

None. Decided with Henrique on 2026-09-29: test release `v0.0.1` at the end of this spec; production has its own release pipeline, with a rollback stage that runs automatically when the release's check fails and can be run by hand; no backups yet; production gets its own Google OAuth client; automatic restart at 04:00; `www.xove.app` redirects to `xove.app`.
