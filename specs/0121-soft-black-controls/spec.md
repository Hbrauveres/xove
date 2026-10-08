# Soft black ground, white sliders and a red-knob switch — spec

- Issue: #121
- Status: Approved (2026-10-07)
- Owner: Henrique
- Design: [design.html](design.html), the identity board with its new Controls section (also at https://claude.ai/artifact/Jgsv3cDXn6FogBPDHsEgGb). Its black palette and its Controls section are the reference.

## Problem

Spec 0113 moved the ground to pure black (`#000000`). Living with it, pure black next to the red reads stark, closer to a video site than to Xovê. The identity board's black palette, with its soft black ground, is the one that feels right.

The controls are loud: the ambilight switch is a red pill when on, and the sliders (the ambilight's brightness and the volumes) are red bars with a red knob. With red already marking the brand and what's live, red controls compete with them.

## Who it's for

Everyone who opens Xovê: every page, the account menu, the player's volume, the previews' volume and the room's footer.

## Functional requirements

**The ground**

- **FR-1** The ground is the identity board's soft black, `#0c0c0d`, instead of pure black. Everything that follows the ground follows it too:
  - the app's background;
  - the browser's theme colour and the web manifest's colours;
  - the favicon's strokes on a light browser;
  - the phone home-screen icons' background.
- **FR-2** Everything else in spec 0113's palette stays as it is:
  - panels `#161617`, raised `#1b1b1d`, lines `#2c2c2f`;
  - text `#ebebec`, muted `#9a9a9f`, faint `#66666b`;
  - the red `#ef4b4b` and its ink `#3a0808`;
  - the glass, status and avatar colours.
- **FR-3** Text keeps at least 4.5:1 on the new ground, and faint text at least 3:1:

  | On `#0c0c0d` | Ratio |
  | --- | --- |
  | Text `#ebebec` | 16.4 |
  | Muted `#9a9a9f` | 7.0 |
  | Faint `#66666b` | 3.4 |
  | Red `#ef4b4b` | 5.4 |

  The panel and raised ratios are unchanged from spec 0113.

**The sliders**

- **FR-4** Every slider is white, like a video player's: the ambilight's brightness, the stage's volume and a preview's volume.
  - The track is 3 px thick, with round ends.
  - The filled part, up to the knob, is white `#ffffff`.
  - The rest of the track is the text colour `#ebebec` at 22%.
  - The knob is a white `#ffffff` circle, 12 px across, growing to 14 px on hover or keyboard focus.
- **FR-5** The sliders keep how they work today: keyboard arrows, a visible focus ring, and a dimmed look when disabled. The stage's volume stays vertical.

**The switch**

- **FR-6** The switch (today, the ambilight's in the account menu) is a slim track with a bigger knob that overhangs it:
  - the track is 36 × 14 px, grey `#3a3a3d`, the same when off and on;
  - the knob is a 20 px circle with a soft shadow, light grey `#bdbdc0` when off and red `#ef4b4b` when on;
  - the knob slides from left to right in 180 ms; with reduced motion it moves without sliding.
- **FR-7** The switch keeps how it works today: click or Space toggles it, it's announced as a switch with its state, and it shows a visible focus ring.

**The footer**

- **FR-8** "Buy me a coffee" in the room's footer is white (the text colour `#ebebec`) instead of red. The other footer links stay muted.

## Acceptance criteria

- **AC-1** The ground token is `#0c0c0d`. The theme colour, the manifest, the favicon's light-mode strokes and the phone icons use it. No stylesheet or icon keeps pure black as the page's ground (automated tests).
- **AC-2** The palette test checks the FR-3 contrast on the new ground, and the other tokens are unchanged (automated test).
- **AC-3** The three sliders are styled as in FR-4: white fill and knob, faint rest of the track, no red (automated test of the styles). They still respond to the keyboard (existing tests).
- **AC-4** The switch is styled as in FR-6: grey track in both states, knob grey off and red on, overhanging the track. It keeps its role, state and keyboard toggle (automated tests).
- **AC-5** "Buy me a coffee" uses the text colour, not the red (automated test of the styles).
- **AC-6** On staging, the room, the account menu, the stage's volume and a preview's volume look like the board's Controls section, the ground is soft black, and "Buy me a coffee" is white (manual, written in the PR).

## Out of scope

- The mark, the animation, the favicon's and icons' shapes (specs 0111 and 0113).
- Other uses of red: the main buttons, LIVE, the speaker's ring, the menu's hover, and the share button when on.
- Layouts, copy and fonts.

## Decisions

Made with Henrique on 2026-10-07:

- **The video keeps pure black behind it.** The stage, the previews, the facecam and the share preview keep `#000000` behind the picture: it's the picture's own frame, as on video players, and the stage reads as a screen on the soft black page.

## Open questions

None.
