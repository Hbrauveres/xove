# Theater-mode room with ambilight — spec

- Issue: #104
- Status: Approved (2026-10-06)
- Owner: Henrique
- Design: [design.html](design.html), the final clickable draft (round nine), also at https://claude.ai/artifact/ApGRGoL1y5JuLbb8JrsGHV. The look, sizes, colours, animations and behaviour in it are the reference: the app matches it, not just its layout.

## Problem

The room page doesn't use the screen well and says too much at once:

- **Wasted space:** on monitors above 1080p, the stage sits in a narrow column with wide empty bands at the sides and the bottom.
- **A cluttered header:** the app name, the address, the connection, the people count, the avatar, the name, Admin and Sign out all compete side by side.
- **A permanent sidebar:** "Here now" and "Activity" take room all the time, though activity is only needed now and then.
- **Thumbnails without context:** the other live streams sit in a strip that says little about who is live and how many places are left.

## Who it's for

Everyone in the room: what they watch, how they see who's here and what happened, and how much of the screen goes to the stream.

## Functional requirements

**Layout**

- **FR-1** The stage is as big as the window allows at 16:9: the window's width minus a 24 px margin on each side, or what the height allows once the header, the info row and the footer are placed, whichever is smaller. No more narrow column.
- **FR-2** The stage and the info row under it form one centred column exactly as wide as the stage, so their edges line up.
- **FR-3** The header and the footer span the whole window, with the same 24 px side margins. They have no background and no separating lines: the page and its light show through, and every element sits on top of the light.

**Ambilight**

- **FR-4** Behind the stage, ambilight: about 200 LEDs around the frame (64 along the top and the bottom, 36 down each side) take the colours of the picture's own edges and glow outward.
  - The glow reaches about 40% of the stage's height beyond the frame.
  - It fades on a soft curve with a long tail, never cutting off suddenly.
  - Each LED glows from its own spot on the frame.
- **FR-5** The light follows the picture smoothly: updated about 12 times a second, each LED easing towards its new colour so it breathes instead of flickering.
- **FR-6** The ambilight is light on the computer: it costs about the same on a 1080p, 2K or 4K monitor (no page-sized blur), well under a millisecond per update. It stops while the tab is hidden or nothing is playing, and there's no light when the stage is empty.
- **FR-6a** Each person controls the ambilight from the account menu (FR-14):
  - an on/off switch;
  - a brightness slider for the glow's intensity.

  The browser remembers both. With reduced motion, the light updates slowly instead of following every frame.

**Header**

- **FR-7** Left: the "xovê." logo, larger and bolder than today (Bricolage Grotesque 800, about 1.75 rem). Centre: the activity pill. Right: the people button and the account button. The address, the connection text, the name, Admin and Sign out leave the header.

**Activity: one place for everything that happens**

- **FR-8** The activity pill shows the latest event, always current:
  - a bell, the person's avatar, the event, how long ago, and a count of events not yet seen;
  - a new event slides in;
  - it is frosted, so it reads over the light.
- **FR-9** Events cover everything in the room: people joining and leaving, shares starting and stopping, cameras turning on and off, and the connection coming back. The last 30 are kept.
- **FR-10** When the connection drops, the pill turns amber with a spinner and says "Connection dropped. Reconnecting…". When it's back, a "Reconnected" event appears. Nothing else on the page shows the connection, except the dot on the account button (FR-14).
- **FR-11** Clicking the pill opens the activity list, without a title:
  - events newest first, each with an icon (screen and camera in the accent colour; joins and leaves neutral), the event and the time;
  - unseen events are highlighted.
- **FR-12** An event about a stream that is still live can be clicked. On hover or focus its time becomes "WATCH"; clicking it puts that stream on the stage and closes the list. The stream being watched shows "WATCHING". Events about ended streams, or about people, are plain text.

**People**

- **FR-13** The people button shows a people icon and the number in the room, with no word ("4 people here" for screen readers). It opens the people panel, without a title, in three sections:
  - **Seats:** "N of 20 · M free", with a green bar.
  - **Who's here:** each person with their avatar (an accent ring when sharing), name and "(you)", and screen and camera icons. Under the name: what they share ("Sharing screen and camera") or whose stream they're watching ("Watching Ana"), kept current within a few seconds.
  - **The queue:** "Nobody is waiting for a seat", or how many are waiting.

**Account**

- **FR-14** The account button is the avatar, with a dot: green when connected, amber while reconnecting. It opens a menu in three sections:
  - the avatar, the name, the role (Admin or Member), and the connection's state;
  - the ambilight's switch and brightness (FR-6a);
  - Admin (for admins only) and Sign out.
- **FR-14a** The room knows which stream each person is watching: whenever someone's stage changes, everyone's people panel shows it within a few seconds. Someone with an empty stage, or still loading, shows as "In the room".

**Dropdowns (activity, people, account)**

- **FR-15** Every dropdown is a stack of frosted sections, see-through but strongly blurred and dark enough to read over bright light, with bright, bold text.
  - The sections are separated by a 2 px clear cut that runs edge to edge. Through it the page behind shows, sharp: the divider is a cut, not a drawn line.
  - The outer corners are rounded (16 px), with a faint light edge.
- **FR-16** Every dropdown unrolls downward when it opens and rolls back up when it closes, in about a quarter of a second, keeping its blur while it moves. With reduced motion it opens and closes at once.
- **FR-17** No scrollbar appears while a dropdown unrolls. A list only scrolls when it's taller than the screen allows, with a thin scrollbar styled to match.
- **FR-18** Only one dropdown is open at a time. A click outside or Escape closes it. Each one works with the keyboard and has names for screen readers.

**The stage and the info row**

- **FR-19** The stage has rounded corners and no border; the round buttons (specs 0098 and 0101), the facecam and the fullscreen button stay as they are. The "LIVE · X is sharing" label leaves the picture: the info row says it.
- **FR-20** Left of the info row, who is on the stage:
  - their avatar with an accent ring;
  - their name, in the display font;
  - a pulsing red LIVE, what they share ("Screen with camera", "Camera"), and for how long.
- **FR-21** Right of the info row, "Also live" with "N of 6", then the other live streams as small 16:9 previews.
  - Each preview shows a chip with the person's avatar, name and what it is; clicking one puts it on the stage.
  - While places are free, a dashed slot says "N free · share yours".
  - This replaces today's thumbnail strip.
- **FR-21a** Previews keep their own sound control (spec 0060), restyled:
  - they're muted by default, and a muted one's sound isn't downloaded;
  - each preview shows a small round speaker, crossed while muted;
  - clicking it unmutes, or mutes again;
  - while unmuted, pointing at it slides out a small horizontal volume slider beside it, inside the preview;
  - a preview without sound shows no speaker.
- **FR-21b** With nobody live, the stage shows its empty state, with no light. The info row says "Nobody is sharing right now" on the left and keeps "6 free · share yours" on the right.

**Footer**

- **FR-22** A slim footer: "xovê · Made by Hbrauveres" on the left; Buy me a coffee (in the accent colour), GitHub and LinkedIn on the right, as plain text for now. None of it is clickable in this iteration.

**Small screens**

- **FR-23** On a narrow window (phones):
  - the header keeps the logo and the buttons, and the pill fills the space between them;
  - the dropdowns open full width under the header;
  - the info row stacks: who's on the stage, then the other streams.

## Acceptance criteria

- **AC-1** The room has no sidebar and no old header items (address, connection text, name, Admin, Sign out); the header holds the logo, the activity pill, the people button and the account button; the footer holds its text and links (automated test).
- **AC-2** On staging, at 1080p, 2K and a narrow window: the stage fills the space at 16:9 with 24 px margins; the stage and the info row share their edges; the header and footer span the window, see-through, above the light (manual, written in the PR).
- **AC-3** The ambilight takes its LED colours from the picture's edges and eases them; it stops while the tab is hidden, when nothing plays, and on an empty stage (automated test of the sampling and the pause).
- **AC-4** On staging on a 2K monitor, the ambilight looks like the design (wide, smooth, following the picture) and the page stays smooth; Chrome's performance panel shows well under a millisecond per update (manual, written in the PR).
- **AC-5** The activity pill shows the latest event with its count of unseen ones, and follows new ones; it shows the connection drop and adds "Reconnected" (automated test).
- **AC-6** The activity list lists every kind of event, newest first; a live stream's event shows "WATCH" and puts that stream on the stage; the watched one shows "WATCHING"; ended streams and people events can't be clicked (automated test).
- **AC-7** The people button shows the icon and the number with the right name for screen readers; its panel shows the seats, everyone with what they share, and the queue (automated test).
- **AC-8** The account menu shows the name, the role and the connection, Admin only to admins, and Sign out; the avatar's dot follows the connection (automated test).
- **AC-9** Dropdowns: one at a time, closed by a click outside or Escape, usable with the keyboard, with names for screen readers (automated test).
- **AC-10** On staging: the dropdowns are frosted, readable over bright light, cut by clear 2 px gaps edge to edge, unroll and roll back up smoothly with their blur, and show no scrollbar flash (manual, written in the PR).
- **AC-11** The info row shows who is on the stage (avatar, name, LIVE, what, how long) and the other live streams with "N of 6" and the free slot; clicking a preview puts it on the stage (automated test).
- **AC-12** On a narrow window, the header, dropdowns and info row rearrange as in FR-23 (manual on staging).
- **AC-13** The account menu's ambilight switch and brightness change the light at once and are the same after a reload; with the switch off, nothing is sampled (automated test).
- **AC-14** When a person changes what's on their stage, the others' people panels show "Watching <name>" within a few seconds; someone with an empty stage shows "In the room"; it's forgotten when they leave (automated tests, API and web).
- **AC-15** Previews start muted with a crossed speaker and their sound not downloaded; clicking the speaker plays that preview's sound and shows its slider on hover, which sets its own volume; clicking again mutes it; a preview without sound has no speaker (automated test).
- **AC-16** With nobody live: no light, the empty stage, "Nobody is sharing right now" and "6 free · share yours" (automated test).

## Out of scope

- The round buttons, the facecam and fullscreen (specs 0098 and 0101): they move with the stage, unchanged.
- Rotating or zooming the picture (#103).
- Anything the API keeps beyond what the room shows here: the seats, the queue, and who watches which stream.
- The home, admin and waiting room pages: they keep their current look for now.
- Making the footer's links work.

## Open questions

None. Decided with Henrique on 2026-10-06:
- the footer says "Made by Hbrauveres", and nothing in it is clickable yet;
- the ambilight has an on/off switch and a brightness slider in the account menu, remembered by the browser;
- the room tracks who watches which stream, so the people panel can show it;
- previews keep spec 0060's own sound: muted by default with a crossed speaker, a click unmutes, and a horizontal slider on hover;
- an empty stage shows "Nobody is sharing right now" with "6 free · share yours";
- the other pages wait for a later spec.
