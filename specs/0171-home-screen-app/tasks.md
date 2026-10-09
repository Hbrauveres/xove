# Phones and tablets use the home-screen app, with a full-screen view — tasks

- Plan: [plan.md](plan.md)

Each task is small enough for one commit, leaves the build green, and says which requirements it serves and how it's verified. Tick a task only when its verification passes.

Nothing to do outside the repo before starting. Henrique's part: merging the PR, the checks on two phones on staging (T8), and the release tag.

## Core

- [x] **T1** `install/prompt.ts`, imported first in `main.tsx`:
  - it keeps `beforeinstallprompt` (with its default prevented) and notes `appinstalled`;
  - `installPrompt()` returns the kept prompt;
  - `onInstalled()` notifies when the app is installed.

  `prompt.test.ts`.
  - · covers FR-3 · verify: `prompt.test.ts`
  - Done: `install/prompt.ts` (`listenForInstall`, `installPrompt`, `onInstalled`), started first in `main.tsx`.
- [x] **T2** `useInstalled()`: true from the home screen (`display-mode` fullscreen or standalone, or `navigator.standalone`). `useInstalled.test.ts`. · covers FR-1, FR-4 · verify: `useInstalled.test.ts`
  - Done: `useInstalled` with `INSTALLED_QUERY` and `navigator.standalone`.
- [x] **T3** The manifest:
  - `start_url`, `scope`, `id`;
  - a 512 px maskable icon, rendered from the phone icon and listed;
  - `brand.test.ts` checks the fields and that the icon is shipped.
  - · covers FR-4 · verify: `brand.test.ts`
  - Done: `id`, `start_url`, `scope`; `icon-maskable-512.png` (`brand-icons.mjs --maskable`, the mark inside the 80% safe circle).

## Pieces and wiring

- [ ] **T4** `InstallPage`, following the design:
  - the wordmark, the icon tile, the headline with its "i" (showing and hiding why), the line under it, "Already added? …";
  - Apple devices get the three Share steps;
  - others get "Get Xovê" (opening the kept prompt, or highlighting the menu line without one) and the menu line;
  - after `appinstalled`, "Open Xovê from your home screen".

  `InstallPage.test.tsx`.
  - · covers FR-2, FR-3 · verify: `InstallPage.test.tsx`
- [ ] **T5** `App`: on a touch device outside the app, the install screen for every route; installed or on a desktop, the routes as today. `App.test.tsx`. · covers FR-1, FR-4, FR-5 · verify: `App.test.tsx`
- [ ] **T6** The full-screen view:
  - `Room` keeps `fullView`;
  - the stage's layout is sideways when the phone is sideways, or upright with `fullView`;
  - on a touch device, the stage's fullscreen button toggles `fullView` ("Full-screen view" or "Exit full-screen view") and is hidden sideways;
  - on desktop, the player's fullscreen as today.

  `RoomPage.test.tsx` (touch, upright):
  - on and off;
  - the same `<video>`;
  - turning sideways and back returns to where it was;
  - no button sideways.

  Existing fullscreen tests pass.
  - · covers FR-6, FR-7, FR-8 · verify: `cd web && npm test && npm run build`

## Docs and review

- [ ] **T7** Docs:
  - `docs/architecture.md`: "Who gets in" and "On a phone or tablet" cover the install screen, the app and the full view;
  - `docs/decisions.md`: decision 44;
  - `CLAUDE.md`: test counts.
  - Checked in the local Playwright harness: the install screen (Android, iPhone), and the full view upright.
  - · verify: the pages describe the new behaviour; the harness matches the design
- [ ] **T8** Review every AC (`/review`), then the PR with `Closes #171`. Henrique checks AC-5 on staging, with an Android phone and an iPhone. · verify: no gaps left; AC-5 written in the PR

## Coverage

| Requirement | Task |
| --- | --- |
| FR-1 | T2, T5 |
| FR-2 | T4 |
| FR-3 | T1, T4 |
| FR-4 | T2, T3, T5 |
| FR-5 | T5 |
| FR-6, FR-7, FR-8 | T6 |
| AC-1 | T2, T5 |
| AC-2 | T1, T4 |
| AC-3 | T6 |
| AC-4 | T6 |
| AC-5 | T8 (manual on staging) |

Nothing uncovered.
