# The cozy dark-blue palette, and a bare, larger favicon — spec

- Issue: #113
- Status: Approved (2026-10-07)
- Owner: Henrique
- Design: [design.html](design.html), the mark's board with the new animation (also at https://claude.ai/artifact/Jgsv3cDXn6FogBPDHsEgGb). Its colours are the reference palette, and its animation the reference motion.

## Problem

Spec 0111 moved the app to a neutral black and neutral greys. On staging it feels cold: the dark bluish greys from before gave a cozier feel, more in line with a room for watching screens at night. The board the mark was designed on already has those colours, with the red accent, and looks right.

The favicon is a small symbol on a dark tile, so in the browser tab it reads as a dark square with a little mark inside.

## Who it's for

Everyone who opens Xovê: every page, and the browser tab.

## Functional requirements

**The palette**

- **FR-1** The app's palette is the board's:
  - ground `#0b0e13`;
  - panels and surfaces `#10141b`, and raised surfaces (inputs, hovered rows, the round buttons) `#181f2a`, the same blue family;
  - lines `#222b38`;
  - text `#e7ebf1`, muted text `#8b96a8`, faint text `#667083`;
  - the red accent and its ink, unchanged from spec 0111 (`#ef4b4b`, `#3a0808`).
- **FR-2** The see-through "glass" backgrounds (the round buttons, the facecam, the pill, the dropdowns, the dialogs' backdrops) take the same blue-tinted dark, instead of neutral black.
- **FR-3** Everything else from spec 0111 stays:
  - the mark, and the animation's timing and blink;
  - red as the one accent;
  - green and yellow for status;
  - a colour per avatar;
  - the fonts.
- **FR-4** Text keeps at least 4.5:1 against its background, on every surface. Faint text, used only for minor labels, keeps at least 3:1. The raised surface and the faint grey are nudged within their hue for this (from the board's `#1c2430` and `#5d6778`):

  | | Ground | Panel | Raised |
  | --- | --- | --- | --- |
  | Text `#e7ebf1` | 16.2 | 15.4 | 13.8 |
  | Muted `#8b96a8` | 6.5 | 6.2 | 5.5 |
  | Faint `#667083` | 3.9 | 3.7 | 3.3 |
  | Red `#ef4b4b` | 5.3 | 5.1 | 4.6 |

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
- **FR-6a** The favicon follows the browser's mode: white on a dark browser, dark blue (`#0b0e13`) on a light one. The red is the same in both.
- **FR-6b** The phone home-screen icons keep a background, since phones fill transparency with black: the dark blue ground (`#0b0e13`), with the large version of the symbol at about 70% of the square.

## Acceptance criteria

- **AC-1** The palette's tokens are the board's colours (FR-1). No stylesheet uses the neutral greys or neutral glass from spec 0111. The accent, status and avatar colours are unchanged (automated test).
- **AC-1a** The animation keeps the left corners still, slides the letters left and the right corners in, then settles, blinks and plays back (automated test); on staging it looks like the design (manual).
- **AC-2** The favicon has no background shape, uses the small version (filling its square, heavier strokes), and its strokes switch between white and dark blue with the browser's mode (automated test of `favicon.svg`). The phone icons have the dark blue ground and the large version with its margin (automated check of the files; manual look on a phone).
- **AC-3** On staging: the pages feel like the board (dark blue, cozy), and the favicon is the bare symbol, readable in the tab (manual, written in the PR).

## Out of scope

- The mark's shapes (spec 0111).
- Layouts, copy and fonts.

## Decisions

Made with Henrique on 2026-10-07, on the board:

- **The board's colours are the palette:** dark blue, cozy. Raised surfaces use the same blue family. Henrique asked for every pair to pass accessibility without leaving the palette, so the raised surface is `#181f2a` (a touch darker than `#1c2430`) and the faint grey `#667083` (a touch lighter than `#5d6778`), both on the same hue.
- **The animation ends on the left:** the left corners stay, the word slides behind them, and the right corners close in.
- **The favicon is bare** and follows the browser's mode: white when dark, dark blue when light, red in both.
- **Phone icons keep a dark blue ground**, with the symbol at about 70%.
- **The symbol has two weights:** slim with room around it from 64 px up; heavier and filling its square at 32 px and under, so the favicon reads from afar.

## Open questions

None.
