# Xovê

A private room where invited friends share their screens and cameras and watch each other live: up to 6 streams at once, 20 people in the room, with a queue when it's full. Live at [xove.app](https://xove.app), by invitation.

This repo is the web app: React 19 and TypeScript, talking to [`xove-api`](https://github.com/Hbrauveres/xove-api) for everything about who's in the room, and to a [LiveKit](https://livekit.io) server for the video.

<p align="center">
  <img src="docs/images/design/room-desktop.png" alt="The room on a desktop: one screen big on the stage with ambilight, the other live streams as previews" width="72%">
  &nbsp;
  <img src="docs/images/design/room-phone-upright.png" alt="The room on a phone held upright: the stage on top, the other streams as a feed" width="20%">
</p>

## What it does

- **Share a screen, a window or a tab**, with its sound, and a camera on top of it or on its own. Never a microphone: voice happens wherever the group already talks.
- **Watch in theater mode:** the picked stream fills the stage in its own shape, with ambilight around it; the others play silently as previews.
- **On a phone,** as an installed home-screen app: the stage on top and a feed upright, full screen with a row of streams sideways, swipes to change who's on the stage.
- **Invited only:** sign in with Google, ask for access, an admin approves.

## The UI

| | |
| --- | --- |
| ![Nobody live on a desktop: colour bars on the stage](docs/images/design/room-empty-desktop.png) | **The room, nobody live.** Colour bars on the stage, lit by the ambilight, "The stage is yours." and the round buttons to start a share |
| ![A phone held sideways, with the streams row open](docs/images/design/room-phone-sideways.png) | **A phone held sideways.** The stage fills the screen; the controls fade while a stream plays; a swipe up opens the other streams |
| ![The install screen on Android](docs/images/design/install-android.png) | **The install screen.** On a phone or tablet in a browser tab, Xovê asks to be installed: it's used from the home screen |

Every screen, on every device, is in the [design sheet](docs/design.md).

## The design

- **Black, greys and one red.** A soft black ground, neutral greys for panels and text, and red only for the brand and what's live. Pure black only behind the video, as the picture's own frame. Every text colour reaches 4.5:1 contrast on every surface (3:1 for faint labels), and a test checks it.
- **Quiet controls:** white sliders like a video player's, a grey switch that turns red only when on, round buttons over the stage that fade with the player's labels.
- **The mark:** [XOVE] in a viewfinder, the O a record button, with a hover animation.
- **Tokens, not values:** colours, sizes and type are CSS variables in `app/src/styles/global.css`; each component's CSS module uses them. The [design sheet](docs/design.md) is the reference for all of it, with pictures shot from the real app.

## The modules

```
app/src/
  api/          the HTTP client and the API's types
  auth/         who is signed in, and the route guards
  pages/        one per route (home, request access, room, admin), and the install screen
  hooks/        the room's state: the seat, the streams, the LiveKit connection, the layout
  media/        sending screens and cameras, the ambilight, who is big
  components/   stage, room, share, ui, brand: each with its CSS module
  install/      phones and tablets: the device, the install prompt
  styles/       the design tokens and their tests
  test/         a fake API and a fake LiveKit for the tests
```

Pages put the room together, components draw it, hooks hold the state and talk to the API and LiveKit, and `media/` keeps the rules as plain, tested functions. More in [Architecture](docs/architecture.md) and [Media](docs/media.md).

## The stack

React 19, TypeScript, Vite, React Router, CSS modules and `livekit-client`, tested with Vitest and Testing Library, and served as a static build by Caddy, built from source.

## Design choices

- **Polling, not a socket, for the room's state.** Every open room asks the API every 2 seconds; LiveKit already carries the live media, and polling keeps the API simple to restart and the page simple to resume.
- **LiveKit tuned for screens.** VP9 in three layers, a quality cap instead of tight bitrate limits, adaptive stream and dynacast, so each viewer downloads only what fits the player and the sharer's upload drops when nobody watches the top layer ([Media](docs/media.md)).
- **The ambilight on the graphics pipeline.** A small canvas, drawn from the picture's edges, blurred and stretched, with no pixel reads: a 4K monitor costs the same, and protected streams light too.
- **One room, a layout per device.** Chosen from the pointer and the screen's size, switched on turning without moving the stage, so the video and a share never reload; a home-screen app on phones.
- **Tested like a person uses it.** Pages rendered at a URL with an in-memory fake API and a fake LiveKit, found by role and label; the design sheet's pictures shot from the real app ([Testing](docs/testing.md)).

## Run it and test it

```bash
cd app && npm install && npm run dev      # http://localhost:5173, with a local API from xove-api
cd app && npm test && npm run build       # the tests, then a type-checked build
docker compose -f app/compose.yaml up --build   # the image
```

Details in [Getting started](docs/getting-started.md) and [Testing](docs/testing.md).

## How changes are made

Every change starts as a written spec with numbered requirements and acceptance criteria, then a plan and small tasks; the pull request proves each criterion with tests, and every commit runs the checks: the build, the image starting healthy, the tests, a vulnerability scan and a static analysis. A merge releases to a test environment, and a version tag to production. See [CONTRIBUTING.md](CONTRIBUTING.md).
