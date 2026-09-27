# <Title> — plan

- Spec: [spec.md](spec.md) (approved <date>)
- Status: Draft | Approved (<date>)

## Approach

How the requirements will be met, in a few paragraphs. Name the alternatives considered and why this one wins.

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| API | `api/src/main/java/…` | … |
| Web | `web/src/…` | … |
| Database | `api/src/main/resources/db/migration/V<n>__….sql` | … (must work with the previous code: rollbacks don't undo migrations) |
| Config / infra | `compose.yaml`, `livekit/…`, `infra/…` | … |
| Docs | `docs/…` | … |

## API and data

New or changed endpoints, request and response shapes, error cases, tables and columns.

## Risks

What could go wrong (security, data, rollout, performance) and how the plan handles it.

## Test plan

Which test proves which AC.

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `…Test#…` | unit / web layer / persistence / web UI / manual |

## Rollout

How it reaches staging and production, any setting or secret to add, and how to roll back.
