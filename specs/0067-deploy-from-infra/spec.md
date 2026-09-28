# Deploy xove from infra using the app's own compose — spec

- Issue: #67
- Status: Approved (2026-09-28)
- Owner: Henrique

## Problem

The server runs the app from a git checkout of the public `xove` repo, and the deploy script that runs with server access (`ops/deploy.sh`) comes from that same checkout, at whatever commit is being deployed. Anyone who gets a change merged into `xove` changes the script that runs on the server. The app should only describe itself (its services, in `compose.yaml`); how and where it runs, and with which values, belongs to `infra` (decisions #25 and #26).

## Who it's for

Henrique (operations: one deploy tool, kept in the private repo), and anyone reading `xove` as an app (no server scripts in it).

## Functional requirements

- **FR-1** The server has no checkout of `xove`. The app's code never lives on the server; a deploy only needs the app's published images and its `compose.yaml`.
- **FR-2** A deploy runs the app with exactly the `compose.yaml` of the commit being deployed, and that environment's generated settings (#43). `xove/compose.yaml` stays the only definition of the app's services.
- **FR-3** The deploy tool lives in `infra` and keeps every guarantee of today's: only the pipeline's restricted key can trigger it and only with "deploy a commit", "roll back" or "status"; it builds the settings first; it refuses to run images that don't match the commit; health check; automatic rollback to the previous version; a history of deploys.
- **FR-4** The same tool deploys any app to any environment by name (today `xove` to `stage`; `xove` to `prod` in #46), without code changes.
- **FR-5** Staging keeps its data and its address: the database is the same after the move, and sign-in, sharing and watching work as before.
- **FR-6** The pipeline deploys staging through the new tool on every merge, the same way it does today, and still posts the result to Discord.
- **FR-7** Today's deploy history and running version carry over, so a rollback works from the first deploy after the move.
- **FR-8** The tool refuses to deploy or roll back to a version from before LiveKit left the app (#44), with a message saying why: those versions' `compose.yaml` starts its own LiveKit, which would clash with `infra`'s. Versions from #44 on can be deployed and rolled back to.
- **FR-9** `xove` no longer contains server scripts (`ops/`), and the docs in both repos describe where things run and how to deploy, roll back and check status.

## Acceptance criteria

- **AC-1** On the server, `/srv/apps/xove-stage` no longer exists, and staging runs (manual, written in the PR).
- **AC-2** After the move, a merge to `xove` deploys staging through `infra`'s tool, and the stage release is green with a Discord message (manual).
- **AC-3** The data survives: the users and access requests on staging are the same before and after the move (row counts compared, manual).
- **AC-4** A deploy of a commit whose images don't exist, or whose images don't start healthy, leaves the previous version running (the rollback drill on staging).
- **AC-5** The restricted key can only ask for "deploy <commit>", "rollback" or "status"; anything else is refused (a check with the real key).
- **AC-6** The deployed `compose.yaml` is the one from the deployed commit: a change to `compose.yaml` in a commit reaches the server only when that commit is deployed (the first deploy after the move runs this branch's health checks).
- **AC-7** `git grep ops/` in `xove` finds no server script, and the docs in both repos describe the new deploy (review).
- **AC-8** Right after the move, `status` lists the deploys made before it, and `rollback` goes to the previous one (manual, with the drill).
- **AC-9** Asking to deploy or roll back to a commit from before #44 is refused with a message, and nothing changes; a commit from after #44 but before this change deploys fine (unit test of `infra/ops/check-compose`; the drill rolls back to one).

## Out of scope

- Production's environment and release (#45, #46): the tool supports `prod`, but it's first used there in #46.
- Pipeline templates (#68) and infra's own release flow (#69).
- Backups (#42).

## Open questions

None. Decided with Henrique on 2026-09-28: the deploy history and running version carry over (FR-7, AC-8); versions that can't run with the new tool are refused with a message (FR-8, AC-9); the boundary is #44 (the first version without LiveKit in its compose file), not this change, so the carried-over history stays usable.
