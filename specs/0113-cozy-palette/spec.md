# The black palette, the animation on the left, and a bare, larger favicon — spec

- Issue: #113
- Status: Approved (2026-10-07; palette changed to black the same day, see Decisions)
- Owner: Henrique
- Design: [design.html](design.html), the mark's board with the new animation (also at https://claude.ai/artifact/Jgsv3cDXn6FogBPDHsEgGb). Its black palette is the reference, and its animation the reference motion. The comparison of palettes is at https://claude.ai/artifact/S4d315m8aGp14AQ4F8Hcnm.

## Problem

Spec 0111 moved the app to a neutral black. On staging a dark blue felt cozier at first, but compared side by side with graphite and other greys (on the real room, home page and mark), the black is the one that fits Xovê: the red record light reads best on it, it's the camera's and the cinema's colour, and it leaves the stream and its ambilight the colour. What 0111's black lacked is contrast on raised surfaces: red and faint text fell just short there.

The favicon is a small symbol on a dark tile, so in the browser tab it reads as a dark square with a little mark inside.

## Who it's for

Everyone who opens Xovê: every page, and the browser tab.

## Functional requirements

**The palette**

- **FR-1** The app's palette is black, neutral greys and red:
  - ground pure black, `#000000`;
  - panels and surfaces `#161617`, and raised surfaces (inputs, hovered rows, the round buttons) `#1b1b1d`;
  - lines `#2c2c2f`;
  - text `#ebebec`, muted text `#9a9a9f`, faint text `#66666b`;
  - the red accent and its ink, unchanged from spec 0111 (`#ef4b4b`, `#3a0808`).
- **FR-2** The see-through "glass" backgrounds (the round buttons, the facecam, the pill, the dropdowns, the dialogs' backdrops) are a neutral dark, with no blue tint.
- **FR-3** Everything else from spec 0111 stays:
  - the mark, and the animation's timing and blink;
  - red as the one accent;
  - green and yellow for status;
  - a colour per avatar;
  - the fonts.
- **FR-4** Text keeps at least 4.5:1 against its background, on every surface. Faint text, used only for minor labels, keeps at least 3:1. For this the raised surface is a touch darker than 0111's (`#1b1b1d`, was `#1e1e20`):

  | | Ground | Panel | Raised |
  | --- | --- | --- | --- |
  | Text `#ebebec` | 17.6 | 15.2 | 14.4 |
  | Muted `#9a9a9f` | 7.5 | 6.5 | 6.1 |
  | Faint `#66666b` | 3.7 | 3.2 | 3.0 |
  | Red `#ef4b4b` | 5.8 | 5.0 | 4.7 |

**The animation**

- **FR-7** The hover animation keeps every step of spec 0111, but ends at the logo's left, where the mark starts, instead of in the middle of the word:
  1. the left corners stay put;
  2. the word slides left behind them until the X is gone and the O sits where the icon has it, while the right corners close in from the right until they reach the O, at the same pace;
  3. the corners settle into the icon, and the dot double-blinks as before;
  4. it all plays back in reverse.

**The favicon**

- **FR-5** The favicon is only the symbol: the four corners and the record O, with no tile or background behind them.
- **FR-6** The symbol is drawn for its size, as in the design:
  - **Small (32 px and under, so the favicon):** at 32 px it fills about 84% of its square with slightly heavier strokes; at 16 px (the tab) it runs edge to edge, like other sites' tab icons, with strokes heavy enough to survive the pixel grid and a bigger dot.
  - **Large (64 px and up):** the slim strokes, with room to breathe around it (about 70% of the square).
- **FR-6a** The favicon follows the browser's mode: white on a dark browser, black (`#000000`) on a light one. The red is the same in both.
- **FR-6b** The phone home-screen icons keep a background, since phones fill transparency with black: the black ground (`#000000`), with the large version of the symbol at about 70% of the square.

## Acceptance criteria

- **AC-1** The palette's tokens are the black palette (FR-1). No stylesheet uses the blue-tinted greys or glass (before 0111, or this spec's first version). The accent, status and avatar colours are unchanged (automated test).
- **AC-1a** The animation keeps the left corners still, slides the letters left and the right corners in, then settles, blinks and plays back (automated test); on staging it looks like the design (manual).
- **AC-2** The favicon has no background shape, uses the small version (filling its square, heavier strokes), and its strokes switch between white and the black ground colour with the browser's mode (automated test of `favicon.svg`). The phone icons have the black ground and the large version with its margin (automated check of the files; manual look on a phone).
- **AC-3** On staging: the pages look like the board in black, and the favicon is the bare symbol, readable in the tab (manual, written in the PR).

## Out of scope

- The mark's shapes (spec 0111).
- Layouts, copy and fonts.

## Decisions

Made with Henrique on 2026-10-07, on the board and the palette lab:

- **Black is the palette.** The spec first chose the board's dark blue. Compared with black, graphite, charcoal, slate, ink and smoke on the real pages, Henrique committed to black: 0111's colours, with the raised surface a touch darker so red and faint text pass on it.
- **The animation ends on the left:** the left corners stay, the word slides behind them, and the right corners close in.
- **The favicon is bare** and follows the browser's mode: white when dark, the black ground colour when light, red in both.
- **Phone icons keep the black ground**, with the symbol at about 70%.
- **The ground is pure black** (`#000000`), after Henrique tried it on staging: it looks much nicer around the stream. Panels and surfaces stay just above it.
- **The symbol has two weights:** slim with room around it from 64 px up; heavier and filling its square at 32 px and under, so the favicon reads from afar.

## Open questions

None.
