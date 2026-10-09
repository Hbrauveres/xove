# The room upright on a phone — spec

- Issue: #158
- Status: Approved (2026-10-08)
- Owner: Henrique
- Design: [design.html](design.html), the clickable phone draft (also at https://claude.ai/artifact/BhUv6HajAfQW6xMv6pG8MU). For this spec, its **upright** phone is the reference: "2 · Feed" when someone is live, and "Nobody live" with "E2 · Chosen". The sideways phone, the swipe, the dots and multi-view belong to later issues (#159 to #162).

## Problem

On a phone, the room is the desktop theater squeezed into a narrow window:

- the stage is small;
- the info row is stacked under it;
- the other streams are tiny previews in a sideways strip;
- the header crowds the logo, the activity pill and two buttons on one line;
- the footer takes a line of its own.

It works, but it doesn't feel made for a phone. Watching is cramped, and it's hard to see what else is live.

## Who it's for

Everyone who opens the room on a phone held upright.

## Functional requirements

**When it applies**

- **FR-1** The phone view applies to any window up to 760 px wide that is taller than it is wide, whether it's a phone or a narrow desktop window. Anything else keeps today's layout, unchanged.
- **FR-2** Turning the phone (or resizing the window) switches between the phone view and today's layout at once. Nothing restarts: what's playing keeps playing, and a share keeps going.

**The top bar**

- **FR-3** One line along the top:
  - the wordmark on the left ([XOVE] in its viewfinder, spec 0111), as tall as my avatar and lined up with the right side;
  - on the right, by use: the people button (an icon and how many are in the room), the **bell**, then my avatar (the account menu, with its connection dot) at the far right.
- **FR-4** The bell opens the activity list, as the activity pill does today. It never shows a count or a dot.
- **FR-5** The people panel, the account menu and the activity list open full width under the top bar, as dropdowns do on a phone today.
- **FR-6** There's no footer on the phone. Its items ("Made by Hbrauveres", Buy me a coffee, GitHub, LinkedIn) move to the bottom of the account menu, looking as they do in the footer.

**The stage**

- **FR-7** The stage spans the full width of the screen, with no side margins. It hugs the picture as on desktop (spec 0107): a 16:9 picture makes a 16:9 stage. A taller picture (a phone camera, a portrait window) makes a taller stage, never taller than 60% of the screen's height; past that, the picture fits inside it with bars at its sides.
- **FR-8** The ambilight glows around the stage, as on desktop, with its on/off and brightness from the account menu.
- **FR-9** Over the stage, no LIVE badge (it's in the info row, FR-10); the round buttons in one centred row along the bottom, as on desktop: the volume (when watching someone), my **camera** to go live (and my screen where the phone can share one), and the settings; and the facecam when the person shares both. They fade and come back as on desktop. With nobody live they're on the colour bars, as on desktop.

**The info row**

- **FR-10** Under the stage, one block: the avatar of the person on the stage with the red ring inside it; "Name · what they share" in bold ("Marina · Screen"; what is "Screen", "Camera" or "Screen with camera"); under it, the desktop's filled red LIVE badge with its pulsing dot, how long in mono (1:12:40), and "· 7 watching", the time and the count in the same muted grey. The watching count follows spec 0107 (counting me, never the sharer), as words. This is the only LIVE for the stage.

**Live now**

- **FR-11** Under the info row, a heading "Live now", with "N of 6" on the right: how many streams are live, out of the room's limit. When the limit changes, the number follows it.
- **FR-12** Under it, the other live streams (everyone but the one on the stage) as a feed, one under another, scrolling with the page:
  - a full-width picture of the stream, 16:9, with nothing over it;
  - under the picture, the same block as the info row (FR-10): the avatar with its ring, "Name · what", then the LIVE badge, how long and "· N watching".
  - Which picture shows follows today's previews: a person's screen, or their camera when that's all they share.
- **FR-13** The feed is silent: no speaker, and no sound downloaded for it. Only the stage plays sound.
- **FR-14** Tapping a stream in the feed puts it on the stage, as a preview does today.
- **FR-14a** The top bar, the stage and the info row stay in place; only what's under them (the feed, or the "Here" cards) scrolls, like the YouTube app. The stage is always in view.

**Nobody live**

- **FR-15** With nobody live, the stage shows the same picture as on desktop: the colour bars, with the line about how to go live and the round buttons. On a phone that can't share a screen, the line says "Turn on your camera with the button below."
- **FR-16** The colour bars glow with the ambilight, as a live picture does. This is the phone view only; on desktop, the empty stage stays without light, as today.
- **FR-17** Under the stage: "Nobody live" and "0 of 6 · 6 free".
- **FR-18** Then, only while nobody is live, a heading "Here", with how many are in the room. Under it, everyone in the room, each on a soft card with no dividing lines (the design's "H3 · Cards"):
  - their avatar, their name, and under the name how long they've been here: "just arrived" under a minute, then "here N min", then "here 1 h 5 min";
  - me first, as "Name (you)";
  - on the others' cards, "WAITING" on the right.
- **FR-18a** While someone is live, there are no "Here" cards: the feed takes that place, and who's in the room is in the people button's panel, as today.
- **FR-19** How long someone has been here counts from when they entered the room. It keeps counting while they stay, and survives the page reloading. After a server restart (every deploy), it counts again from when the room came back.

## Acceptance criteria

- **AC-1** At 390 × 844 the room shows the phone view; at 760 × 1000 too; at 800 × 1000, and at 844 × 390 (sideways), it shows today's layout. Turning from one to the other doesn't stop the video or a share (automated test of the switch; manual on a phone for the playback).
- **AC-2** The top bar has the logo, then the people button with the count, the bell and, at the far right, my avatar. The bell opens the activity list and shows no count or dot (automated test).
- **AC-3** The phone has no footer; the account menu ends with "Made by Hbrauveres", Buy me a coffee, GitHub and LinkedIn (automated test).
- **AC-4** The stage is the screen's full width. A 16:9 picture gives a 16:9 stage; a portrait picture gives a stage no taller than 60% of the screen. The ambilight glows around it (automated test of the sizes; manual for the light).
- **AC-5** The info row shows the avatar with its ring, "Name · what", the filled LIVE badge, the time and "N watching" in words; the stage has no LIVE badge over it (automated test).
- **AC-6** "Live now" shows "N of 6" and every live stream except the one on the stage, each as a picture with nothing over it, then the avatar, "Name · what", the LIVE badge, the time and "N watching"; the feed has no sound controls and its streams' sound isn't downloaded (automated test).
- **AC-7** Tapping a stream in the feed puts it on the stage; scrolling the feed leaves the top bar, the stage and the info row in place (automated test; manual on a phone for the scrolling).
- **AC-8** With nobody live: the colour bars with the right line and buttons, "Nobody live", "0 of 6 · 6 free", and "Here" with a card for everyone in the room, me first as "(you)", the others with "WAITING" (automated test). On a phone, the bars glow (manual).
- **AC-9** Each card says how long that person has been here: "just arrived", "here N min", "here 1 h 5 min". The time comes from when they entered the room, and a reload doesn't reset it (automated tests, web and API).
- **AC-10** On staging, on a real phone (Android Chrome and iPhone Safari): the view matches the design's upright phone, live and with nobody live, and nothing scrolls sideways (manual, written in the PR).

## Out of scope

- Swiping the stage, and the dots (#159).
- The phone sideways (#160) and its streams row (#161): sideways keeps today's layout for now.
- Multi-view (#162), and its button on the stage.
- Tablets (#163), and the desktop bell and toasts (#151, #152).
- Real footer links (#147): the items in the account menu stay as the footer has them.
- The standby stage (#117).

## Decisions

Made with Henrique on the drafts, 2026-10-08:

- **Feed, like the YouTube app:** below the stage, the other streams as full-width pictures with their details under them. A grid, a compact list and a people-only list were drafted and dropped.
- **The top right, by use:** people, the bell (no count or dot), then my avatar at the far right. The phone gets the bell now; the desktop gets its own later (#151).
- **No footer on the phone:** its items go to the account menu.
- **A narrow, upright window is a phone,** whatever the device: one rule, easy to test.
- **Tall pictures hug the stage up to 60% of the screen,** so the info row and the feed stay in view.
- **LIVE only under the name,** on the stage's info row and on each feed card; no badge over the pictures, so they stay clean.
- **The info row, a mix** (2026-10-09, compared at https://claude.ai/artifact/E5WdysmJF6bKgmth4SFRM9, "C"): the simple row's sizes, spacing and "Name · what"; the desktop's filled LIVE badge and mono time; the time as bright as "N watching".
- **The stage stays pinned:** only the feed or the cards scroll under it (decided with the plan, 2026-10-08).
- **The feed is silent:** sound comes only from the stage.
- **Nobody live:** the desktop's colour bars, glowing with the ambilight, then "Nobody live" and who's here. A standby viewfinder and a go-live card were drafted and dropped.
- **Who's here as cards:** soft cards with how long each person has been here, and no dividing lines. A plain list with lines, an avatar grid and chips were drafted and dropped. The room starts reporting when each person entered.

## Open questions

None.
