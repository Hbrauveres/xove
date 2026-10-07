# The new Xovê mark, and a red, white, black and grey palette — spec

- Issue: #111
- Status: Approved (2026-10-07)
- Owner: Henrique
- Design: [design.html](design.html), the final draft (also at https://claude.ai/artifact/Jgsv3cDXn6FogBPDHsEgGb). The mark's shapes, proportions and colours in it are the reference.

## Problem

Xovê has no mark of its own. Every page shows the word "xovê." in the display font, and the browser tab has no icon. The app's accent is amber, which no longer matches the identity Henrique chose: a record button in a camera's viewfinder, in red.

## Who it's for

Everyone who opens Xovê: the tab, the room's header, the home, request-access and admin pages.

## Functional requirements

**The mark**

- **FR-1** The wordmark is [XOVE] in capitals inside a viewfinder, as in the design:
  - X, O, V and E share one cap height and one slim stroke;
  - the X's strokes end square, with no pointed tips;
  - the O is a record button: a white ring as thick as the letters, and a big red dot inside it;
  - the viewfinder is four corners as slim as the letters, and the top-right corner is red. It stands in for the ^ of Xovê.
- **FR-2** The icon is the record O alone inside the same four corners, with the red top-right corner. It reads at 16 px.
- **FR-3** The wordmark replaces "xovê." everywhere it appears today: the room's header, the home page, the request-access page and the admin page (where "admin" stays beside it).
  - It is drawn, not typed, so it looks the same on every device.
  - Screen readers hear "Xovê".
- **FR-4** The symbol (the icon from FR-2) is Xovê's favicon: the browser tab and bookmarks show it, and a phone that adds Xovê to its home screen shows it as the app icon. Today there's none.

**The animation**

- **FR-4a** Pointing at the wordmark (or focusing it with the keyboard) plays it once, as in the design. Nothing zooms; only the corners and the dot move:
  1. the frame's corners slide in horizontally from the left and the right, erasing the letters as they pass, and reach the O at the same moment;
  2. the top and bottom corners close in vertically, until the O and its corners look exactly like the icon (FR-2);
  3. the red dot does a quick, surprised double blink, like an eye: it squashes shut fast and opens a little slower; the second time it springs slightly wide and settles;
  4. everything moves back, and the full [XOVE] returns.

  It takes about three seconds. A new hover doesn't restart it while it plays. With reduced motion it doesn't play.

**The palette**

- **FR-5** The app's preferred palette is red, white, black and grey. It isn't monochrome: colours that carry a meaning keep it.
  - **Red** is the one accent, the same red as LIVE (#ef4b4b). It does what amber does today: the on-air rings, active and pressed buttons, the unseen count, links, focus rings, sliders and switches, the dropdowns' highlights. LIVE stays distinct by its filled badge.
  - **Black** is the ground, and **white and neutral greys** are for text, lines and surfaces, without today's blue tint.
- **FR-6** Common visual indicators keep their own colours: green for connected and the seats bar, yellow for reconnecting. Each person's avatar keeps its own colour.
- **FR-7** Everything stays readable: text and controls keep at least today's contrast against their backgrounds.
- **FR-8** Only the logo and the palette change. The fonts stay: Bricolage Grotesque for headings, IBM Plex for text.

## Acceptance criteria

- **AC-1** The room's header, the home, request-access and admin pages show the drawn mark instead of "xovê.", and a screen reader names it "Xovê" (automated test).
- **AC-1a** Pointing at the wordmark plays the slide, the settle, the double blink and the way back once; it doesn't restart while playing, and doesn't play with reduced motion (automated test); on staging it looks like the design's (manual).
- **AC-2** The page has a favicon and a home-screen icon, both the icon from FR-2 (automated check of `index.html` and the files it points to).
- **AC-3** No amber accent is left and the greys are neutral: the accent tokens are red, no stylesheet uses the old amber or the old blue-tinted greys, and the status colours (green, yellow) and avatar colours are unchanged (automated check over the CSS).
- **AC-4** On staging, every page and every dropdown, button and badge in the room reads in the new palette; the mark looks like the design at header size and the icon in the tab (manual, written in the PR).

## Out of scope

- The ambilight's colours, which come from the picture.
- New pages, layouts or copy: only the mark and the colours change.
- Printed or social-media versions of the mark.

## Decisions

Made with Henrique on 2026-10-07:

- **The mark** came out of fifteen rounds of drafts: no eye or face; [XOVE] in a viewfinder; the O a record button; the ^ carried by the red top-right corner instead of a mark on the E; one slim stroke (weight 10) for letters, ring and frame; the X with square ends.
- **One red** for the accent and LIVE.
- **Status colours stay:** green and yellow where they mean connected, seats or reconnecting.
- **Neutral greys**, without the blue tint.
- **Avatars keep a colour per person.** The app has a preferred palette; it isn't monochrome.
- **Fonts stay.** Only the logo and the palette change.
- **A hover animation:** the corners slide in to the O and close in until it's the icon (no zoom, which cut the corners), the dot double-blinks like a surprised eye, and it moves back. The wordmark and the icon keep their own spacing.

## Open questions

None.
