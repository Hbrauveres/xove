# Phones and tablets use the home-screen app, with a full-screen view — spec

- Issue: #171
- Status: Approved (2026-10-10)
- Owner: Henrique
- Design: [design.html](design.html), the install screen (also at https://claude.ai/artifact/BtE925Hf6VemGRFBJR9QFM). The full-screen view is spec 0160's sideways layout ([its design](../0160-phone-sideways/design.html)).

## Problem

In a phone's browser tab, the address bar takes a big part of a short screen, and a page can't keep it away: fullscreen only starts on a tap, and the back button drops it (spec 0160 tried it and removed it). The home-screen app has no browser bar at all, but nothing leads people there, and they keep using Xovê in a tab, the wrong way.

Also, on a phone held upright, the stage's fullscreen button shows only the bare player, without the top bar, the streams row or the light.

## Who it's for

Everyone on a phone or tablet.

## Functional requirements

**Only from the home screen**

- **FR-1** On a phone or tablet (touch first, as spec 0160 defines them), when Xovê isn't opened from the home screen, every page shows the install screen instead, signing in included. Nothing else is reachable from the tab.
- **FR-2** The install screen (the design) is the same on every device, short and to the point:
  - the wordmark and the app's icon;
  - the headline "Xovê works best from your home screen.", with a small "i" next to it that shows or hides why: "Opened from your home screen, Xovê fills the whole screen: no address bar or browser buttons in the way, just the stage.";
  - under it, "Start watching and sharing moments with your friends.";
  - the one action for the device, and at the end "Already added? Open Xovê from your home screen."
- **FR-3** The one action:
  - **Android:** a single button, "Get Xovê", that opens the browser's own install prompt. Under it, one small line for when the browser offers no prompt, or after it was used once (a browser offers its prompt only once): "No prompt? In the browser's menu, choose Install app." ("Create shortcut" would open a plain tab, which shows this screen again.)
  - **iPhone and iPad:** three steps, "Tap Share in Safari's bar", "Choose Add to Home Screen", "Open Xovê from your home screen", with Safari's icons (there's no prompt to open there).
- **FR-4** Opened from the home screen, Xovê works as today, with no browser bar (the manifest, from spec 0160): sign-in, the request for access, the room (upright and sideways), the admin page.
- **FR-5** Desktops and laptops are unchanged: no install screen.

**The full-screen view**

- **FR-6** On a phone, and on a tablet held upright, the stage's fullscreen button opens the full-screen view: the sideways layout of spec 0160 (the stage filling the screen, the top bar, the round buttons, the dots, the streams row, the light, fading, swipes), in whatever direction the phone is held. Nothing locks or turns the screen.
- **FR-7** The same button leaves it, back to the upright view. Turned sideways, the room always shows the sideways layout (as today); turned upright again, it returns to the full-screen view or the upright view, whichever it was in before.
- **FR-8** On desktop, and on a tablet held sideways (which uses the desktop layout, spec 0160), the fullscreen button keeps today's player fullscreen.

## Acceptance criteria

- **AC-1** On a touch phone or tablet, outside the home-screen app, every route shows the install screen and nothing else; inside the app, the routes work; on a desktop, no install screen (automated test).
- **AC-2** The install screen shows the shared texts on every device, and the "i" shows and hides why; on Android, the "Get Xovê" button opens the browser's prompt, with the menu line under it; on iPhone and iPad, the Share steps (automated test).
- **AC-3** On a phone, upright, the fullscreen button shows the sideways layout without turning the phone, and again leaves it; turning sideways and back returns to where it was (automated test).
- **AC-4** On desktop, the fullscreen button still makes the player fullscreen (existing tests).
- **AC-5** On staging, with a real Android phone and an iPhone: the tab shows the install screen; Android's Install button installs; iPhone's steps work; opened from the home screen, Xovê signs in with Google (and staging's gate), and the room works upright, sideways and in the full-screen view (manual, written in the PR).

## Out of scope

- An offline app, notifications, or anything else a service worker would bring.
- Store apps (Play Store, App Store).
- Locking or forcing the screen's orientation.

## Decisions

Made with Henrique, 2026-10-10:

- **Every page,** sign-in included, shows the install screen in a phone's tab, so the session is made inside the app, where it'll be used.
- **The card,** short: no list of reasons. The same on every device; only the action differs: one button on Android, the Share steps on iPhone and iPad.
- **The install screen's layout** (2026-10-10, after comparing with the top-aligned draft): the card centred on the screen, a soft red glow from the top that fades out before the wordmark, so it never meets the icon tile's glow, and "Already added?" right under the action.
- **The full-screen view follows how the phone is held:** a portrait stream is best watched upright, a wide one sideways.
- **The button toggles the full-screen view;** turning sideways always shows it, and turning back returns to where it was.

## Open questions

None.
