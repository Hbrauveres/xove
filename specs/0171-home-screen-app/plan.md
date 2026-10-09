# Phones and tablets use the home-screen app, with a full-screen view — plan

- Spec: [spec.md](spec.md) (approved 2026-10-10)
- Status: Approved (2026-10-10)

## Approach

Web only, plus the web manifest.

**Is it the home-screen app? (FR-1, FR-4, FR-5)**
- A new `useInstalled()` hook answers true when Xovê runs from the home screen:
  - `(display-mode: fullscreen)` or `(display-mode: standalone)` matches (Android, and iOS 16.4+);
  - or `navigator.standalone` is true (older iOS).
- A touch device is spec 0160's rule: `TOUCH_QUERY` (`pointer: coarse`), tablets included.
- `App` renders `InstallPage` for every route when the device is touch-first and not installed. Otherwise it renders the routes as today. Desktops never see it (FR-5).

**The install screen (FR-2, FR-3).**
- `InstallPage` follows the design:
  - the wordmark (`XoveMark`) and the icon (`XoveIcon`) in a rounded tile;
  - the headline with its small "i" (a button with `aria-expanded`, showing and hiding the "why" line);
  - the line under it, the device's action, and "Already added? …".
- **The action**, chosen by `installKindOf()`:
  - **Apple** (iPhone, iPod, or iPad, including iPads that say "MacIntel" with touch): the three Share steps, with Safari's icons drawn inline.
  - **Anything else** (Android): the "Get Xovê" button and the menu line.
- **The browser's install prompt.**
  - Chrome fires `beforeinstallprompt` once, early, often before React has rendered. A tiny module, `install/prompt.ts`, is imported first in `main.tsx`. It catches the event, calls `preventDefault()`, and keeps it.
  - "Get Xovê" calls its `prompt()`.
  - With no event kept (another browser, or already installed in another profile), the button opens the menu line's hint instead: it highlights the line. Nothing breaks.
- **When installed,** Chrome fires `appinstalled`: the screen then shows "Open Xovê from your home screen" in place of the action.

**The manifest (FR-4).** `site.webmanifest` gets the fields Chrome checks before it offers an install:
- `start_url: "/"`, `scope: "/"`, `id: "/"`;
- the icons as they are, plus a 512 px `maskable` one (the phone icon has room for it).

`display` stays `fullscreen` (from spec 0160).

**The full-screen view (FR-6 to FR-8).**
- `Room` keeps a `fullView` flag (per visit).
- The stage's layout becomes:
  - `sideways` when the phone is sideways, as today;
  - `sideways` when upright with `fullView` on;
  - `phone` (upright) otherwise.

  Turning the phone doesn't touch the flag, so turning upright again returns to the full view or the upright view, whichever it was (FR-7).
- The stage keeps its place in the tree, so switching never reloads the video (spec 0158's rule).
- **On a touch device,** `Stage` gets `onFullscreen`, which toggles `fullView` instead of making the player fullscreen. The button's label follows it: "Full-screen view" or "Exit full-screen view".
  - **Sideways,** the button is hidden: the room is already in the full view there.
  - **On desktop,** `onFullscreen` isn't passed, and the player's fullscreen works as today (FR-8).
- The full view upright uses the sideways CSS as it is. The box is height first (`min(100cqw, 100dvh × shape)` wide), so a portrait picture fills the height and a wide one the width, centred on black.

**Rejected:**

| Alternative | Why not |
| --- | --- |
| Detecting the app with a `?source=homescreen` start URL | It's lost on the first navigation (sign-in redirects). The display mode is what the browser actually reports. |
| A service worker, for the install prompt | Chrome on Android offers installing without one since version 108. A worker would also bring caching, which is out of scope and easy to get wrong with deploys. |
| Locking the orientation for the full view | The spec leaves the orientation to the phone (FR-6). |
| Showing the install screen only on the room | The spec puts it on every page, so the session is made inside the app (decision). |

## Changes

| Area | File or component | Change |
| --- | --- | --- |
| Web | `install/prompt.ts` (+ test, new), `main.tsx` | Keep `beforeinstallprompt`; `appinstalled` |
| Web | `hooks/useInstalled.ts` (+ test, new) | From the home screen or not |
| Web | `pages/InstallPage.tsx`, `.module.css` (+ test, new) | The install screen, the "i", the device's action |
| Web | `App.tsx` (+ test) | The install screen for every route on a touch device outside the app |
| Web | `pages/RoomPage.tsx`, `components/stage/Stage.tsx`, `StageOverlay.tsx` | `fullView`; the stage's layout; the button toggling it on touch devices, hidden sideways |
| Web | `public/site.webmanifest`, `public/icon-maskable-512.png` | `start_url`, `scope`, `id`, a maskable icon |
| Web | `brand/brand.test.ts`, `scripts/brand-icons.mjs` | The new fields and the maskable icon |
| Docs | `docs/architecture.md` ("On a phone or tablet", "Who gets in") | The install screen, the app, the full view |
| Docs | `docs/decisions.md`, `CLAUDE.md` | Decision 44; test counts |

## API and data

None.

## Risks

| Risk | How the plan handles it |
| --- | --- |
| **Google sign-in inside the iPhone app.** A home-screen app keeps its own cookies, apart from Safari, so the session has to be made inside it. | The sign-in starts on our own address and redirects (it isn't a link to another site), so iOS keeps it in the app's window. That window shows Google's page with a small bar, and the cookie lands in the app. Checked on a real iPhone (AC-5). If it fails, the fallback is a code flow in a sheet, as a new issue. |
| **Staging's gate inside the app.** The gate is a password page that sets a cookie. | The app asks for it once, in its own window, and keeps the cookie. Checked in AC-5. |
| **Chrome doesn't offer the install prompt** (manifest checks, or the browser decides not to). | The button falls back to highlighting the menu line, which always works. `brand.test.ts` checks the manifest's fields. |
| **Two apps with the same name** (staging and production) on a tester's phone. | Accepted: each opens its own address. Testers can rename the staging icon. |
| **A touch laptop or a desktop with a touch screen.** | `pointer: coarse` describes the main pointer, so they report `fine` and never see the install screen. |
| **Locking out a phone if detection is wrong** (an installed app not recognised). | The display-mode queries and `navigator.standalone` cover Android Chrome, Samsung Internet and iOS. Checked on both phones (AC-5). |

## Test plan

| AC | Test | Kind |
| --- | --- | --- |
| AC-1 | `useInstalled.test.ts`: the display modes and `navigator.standalone`. `App.test.tsx`: on a touch device outside the app, `/`, `/room` and `/admin` all show the install screen; installed, the routes as today; on a desktop, never. | web unit / web UI |
| AC-2 | `InstallPage.test.tsx`: the shared texts; the "i" shows and hides why; Apple shows the Share steps, others the "Get Xovê" button; with a kept prompt the button opens it, without one it points to the menu line; after `appinstalled`, "Open Xovê from your home screen". `prompt.test.ts`: the event is kept and its default prevented. | web UI / web unit |
| AC-3 | `RoomPage.test.tsx` (touch, upright): the fullscreen button shows the sideways layout without turning, and again leaves it; turning sideways and back returns to where it was; sideways the button is hidden. | web UI |
| AC-4 | Existing `RoomPage.test.tsx` fullscreen tests (desktop). | web UI |
| AC-5 | On staging with an Android phone and an iPhone: the tab's install screen, installing, Google sign-in and the gate inside the app, and the room upright, sideways and in the full view. Written in the PR. | manual |

`brand.test.ts` also checks the manifest's new fields and that the maskable icon is listed and shipped.

## Rollout

- Web only: no settings, secrets or migrations.
- **Once merged, phones in a tab on staging see the install screen at once.** Testers install from there. Desktops are unaffected.
- After Henrique checks AC-5, tag a release; production phones then see the install screen too.
- Rollback: redeploy the previous web image, and phones get the tab back.
