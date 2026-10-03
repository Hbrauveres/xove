# Architecture

## Components

```mermaid
flowchart LR
  B[Browser<br/>React app] -->|HTTPS 443| P[Reverse proxy<br/>TLS + routing]
  P -->|/api/*| A[API<br/>Spring Boot]
  P -->|everything else| W[web<br/>Caddy + static build]
  A -->|JDBC, private network| D[(PostgreSQL)]
  B -->|WSS 443, signaling| P
  P -->|signaling| L[LiveKit]
  B -.->|media over UDP,<br/>TCP fallback| L
```

| Component | What it does | Tech |
| --- | --- | --- |
| **web** | The single-page app: home, request access, room, admin | React 19, TypeScript, Vite, React Router, CSS modules, `livekit-client`; served by Caddy built from source on the latest Go, running as a non-root user |
| **api** | Login, sessions, access requests, admin actions, the screen slot, LiveKit tokens | Java 21, Spring Boot 4 (Web MVC, Security, Data JPA, Actuator), Maven |
| **db** | Users, access requests, sessions | PostgreSQL 17, schema managed by Flyway |
| **livekit** | Receives each shared screen once and forwards it to every viewer | LiveKit server (a WebRTC SFU), one per environment, run from the `infra` repo; each environment has its own room (staging `xove-stage`, production `xove`) |
| **reverse proxy** | HTTPS certificates, routing by hostname and path | Caddy, shared by every app on the server; configured in a separate private repository |

The database is only reachable by the API, on a private Docker network. Only the proxy and LiveKit's media ports face the internet.

**Signaling vs media.** Joining the room, knowing who's there and which tracks exist happens over a WebSocket that goes through the proxy. The video itself travels over UDP straight to LiveKit (with a TCP fallback for networks that block UDP). The API never touches media.

## Repository layout

```
api/                  Spring Boot application
  src/main/java/dev/hbrauveres/xove/
    access/           access requests and member management
    admin/            admin endpoints
    auth/             login success handling, /api/me, the current user
    config/           security and application settings
    livekit/          LiveKit token issuing
    screen/           the screen slot
    user/             users
  src/main/resources/db/migration/   Flyway migrations (V1, V2, …)
web/                  React application
  src/api/            HTTP client and API types
  src/auth/           session state and route guards
  src/hooks/          useScreenSlot, useLiveKitRoom, useRoomSession
  src/media/          how screens are sent (presets, modes, sound) and remembered choices
  src/components/     UI components grouped by area (stage, controls, …), each with its CSS module
  src/pages/          Home, RequestAccess, Room, Admin
  src/test/           test helpers: fake API, fake LiveKit
compose.yaml          how the app's services run together (web, api, db); LiveKit runs from the infra repo
.github/workflows/    commit checks (ci.yml), stage release (stage.yml)
docs/                 this wiki
```

## Who gets in

```mermaid
flowchart TD
  H["/ Home<br/>Continue with Google"] --> G[Google login]
  G --> C{API callback<br/>account status?}
  C -->|member| R["/room"]
  C -->|new or pending| Q["/request-access"]
  C -->|declined| X["/request-access<br/>declined state"]
  Q -->|Request access| P[Pending request]
  P -->|admin approves in /admin| R
```

| Route | Who sees it | What it shows |
| --- | --- | --- |
| `/` | Signed out | What Xovê is, "Continue with Google" |
| `/request-access` | Signed in, not a member | "You need access", optional message, request button; a pending state that checks every 20 s and moves you in when approved; a declined state that allows asking again |
| `/room` | Members | Stage, share controls, people, activity feed |
| `/admin` | Admins | Pending requests (approve, decline), members (remove) |

Every sign-in gets a session, even for non-members; it just can't reach member-only endpoints.

## Sharing a screen

The API owns **who** is sharing (the screen slot). LiveKit carries **what** is shared (the video).

```mermaid
sequenceDiagram
  participant S as Sharer's browser
  participant A as API
  participant L as LiveKit
  participant V as Viewer's browser
  S->>A: POST /api/livekit/token
  A-->>S: signed token (room, identity, allowed sources)
  S->>L: connect with the token
  Note over S: clicks "Share my screen", picks a window
  S->>L: publish screen track
  S->>A: POST /api/screen/take (its connection and track ids)
  V->>A: GET /api/screen (every 2 s)
  A-->>V: holder = sharer
  L-->>V: screen track
  Note over V: plays the holder's track on the stage
  Note over S: closes the tab
  L->>A: webhook participant_left (signed)
  A-->>V: holder = none on the next poll
```

The rules the room follows:

1. **Share:** the browser's picker opens first (browsers only allow that straight from a click), then the slot is taken. Closing the picker does nothing.
2. **Take over:** after a confirmation, the slot moves to you. The previous sharer's browser notices it's no longer the holder and stops sending.
3. **Stop:** the Stop button or the browser's own bar stops the video and releases the slot. Only the holder can release it.
4. **Reload while sharing:** the page sees it holds the slot but sends nothing, and releases it.
5. **Everyone else** polls the slot every 2 seconds and plays the holder's screen track from LiveKit. The sharer sees their own screen, as viewers do, without its sound.
6. **Sharer leaves** (closes the tab, loses connection, crashes): LiveKit sends the API a signed webhook, and the API frees the slot when it's about the connection or screen track that is sharing. A closed tab frees the stage within a few seconds; a lost connection as soon as LiveKit gives up on it (tens of seconds). Only one connection per person: opening the room on a second device disconnects the first. Spec: [`specs/0038-stale-slot`](../specs/0038-stale-slot/spec.md).

The slot lives in the API's memory: one API instance, a handful of people, nothing worth persisting. A restart frees it.

### Video and sound quality

How a screen is sent is decided in one place, `web/src/media/shareSettings.ts` ([spec 0086](../specs/0086-stream-quality/spec.md)). LiveKit's defaults suit slides and voice calls; these suit games and videos.

- **The sharer picks a quality:** 1080p (the default), 720p or 480p, all at 30 fps. The screen is sent in VP9 as one layer per quality, from the chosen one down to 480p: about 2.5, 1.2 and 0.6 Mbit/s. Browsers that can't send VP9 (Firefox) send VP8 instead.
- **And a mode:**
  - **Smooth** (the default): marked as motion. When the connection is tight, the picture gets softer and the frame rate holds.
  - **Sharp:** marked as detail. The picture keeps its detail and the frame rate drops.
- **Changing them mid-share:** the same capture is published again with the new settings, and the API is told the new track before the old one goes, so the slot isn't freed. Viewers see a reload of a second or two.
- **Sound** is captured without the microphone filters (echo cancellation, noise suppression, automatic volume), in stereo, and sent at 128 kbit/s without silence skipping. Chrome gives sound only from a tab, or from the whole screen on Windows; Firefox and Safari give none, and the sharer sees a notice.
- **Viewers** have a bar over the player:
  - The speaker icon mutes, and unmutes back to the same volume.
  - The volume slider is hidden on iPhones and iPads, which ignore a page's volume.
  - The quality menu offers "Auto" (adaptive stream: what fits the player and the connection) or a fixed quality from the sharer's down to 480p. A fixed quality asks the server for that size, so the viewer really downloads less.
- **Each browser remembers** its choices in `localStorage` (`xove.share.*`, `xove.watch.*`).

To check a share on staging, open `chrome://webrtc-internals` in the viewer's or the sharer's browser. It shows the codec, frame rate, resolution, bitrate, and why quality drops: "cpu" means the sharer's computer can't keep up, "bandwidth" means the connection can't.

**LiveKit webhooks.** Each environment's LiveKit posts every room event to its own API (`http://xove-<env>-api:8080/api/livekit/webhook`), signed with that environment's API key (a JWT with a hash of the body). The API refuses anything whose signature doesn't check out, ignores events from any room other than its own, and only acts on `participant_left` and `track_unpublished` (screen share).

**Where LiveKit runs** ([spec 0044](../specs/0044-livekit-in-infra/spec.md)). One LiveKit server per environment, both defined once in the `infra` repo (`livekit/compose.yaml`) and fed by that environment's generated settings: staging at `rtc-stage.xove.app` with media on 7881/tcp and 7882/udp, production at `rtc.xove.app` with 7883/tcp and 7884/udp. Each has its own key pair, shared only with its own API, so nothing signed for one environment is accepted by the other. This app only needs `LIVEKIT_URL`, the key pair and `LIVEKIT_ROOM`.

## Data model

| Table | Columns |
| --- | --- |
| `users` | id, email (unique, lowercase), name, avatar_url, google_subject (unique), status (`NONE`, `PENDING`, `MEMBER`, `DECLINED`), created_at |
| `access_requests` | id, user_id, message (≤ 500 characters), status (`PENDING`, `APPROVED`, `DECLINED`), created_at, decided_at, decided_by; at most one pending request per user |
| `spring_session`, `spring_session_attributes` | Server-side sessions (Spring Session JDBC) |

Every schema change is a new Flyway migration. A migration that already ran is never edited.

## API

| Method + path | Who | Does |
| --- | --- | --- |
| `GET /api/health` | Anyone | Liveness |
| `GET /api/oauth2/authorization/google` | Anyone | Starts Google login |
| `GET /api/login/oauth2/code/google` | Anyone | Google callback; redirects to `/room` or `/request-access` |
| `POST /api/auth/logout` | Signed in | Ends the session |
| `GET /api/me` | Signed in | `{ email, name, avatarUrl, status, admin }` and the CSRF cookie |
| `POST /api/access-requests` | Signed in, not a member | Creates a request with an optional message |
| `GET /api/admin/access-requests` | Admin | Pending requests |
| `POST /api/admin/access-requests/{id}/approve` | Admin | Makes the user a member |
| `POST /api/admin/access-requests/{id}/decline` | Admin | Declines; the user can ask again |
| `GET /api/admin/members` | Admin | Members |
| `DELETE /api/admin/members/{id}` | Admin | Removes a member and ends all their sessions |
| `GET /api/screen` | Member | `{ holder: { userId, name, avatarUrl, since } or null, mine }` |
| `POST /api/screen/take` | Member | Takes the slot (takes over if someone holds it). Body `{ participantSid, trackSid }`: the LiveKit connection and screen track the share comes from, never shown to anyone; 400 without them |
| `POST /api/screen/release` | Member | Frees the slot; 409 if it isn't yours |
| `POST /api/livekit/token` | Member | `{ url, room, identity, token }` to join the video room |
| `POST /api/livekit/webhook` | LiveKit (signature, no login) | Room events; frees the slot when the sharing connection leaves or its screen track stops. 401 on a bad signature |

Errors follow RFC 9457 (problem details); the web app shows their `detail` field.

## Security model

- **Authentication:** Google sign-in through Spring Security (state, PKCE and session fixation handled by the framework). Accounts whose Google email isn't verified are turned away.
- **Sessions:** stored server-side in PostgreSQL, so removing a member can end their sessions immediately. The cookie is `HttpOnly`, `Secure` and `SameSite=Lax`.
- **CSRF:** every state-changing request carries a token read from a cookie and echoed in a header.
- **Authorization:** member and admin checks happen on the server for every request. The API never trusts an id sent by the browser.
- **LiveKit tokens:** signed by the API with a secret LiveKit shares. A token names one room and one identity, allows publishing only screen and screen audio (never camera or microphone), and expires after one hour. The secret never reaches the browser.
- **Network:** the database has no public port. The app's containers publish no ports; only the proxy (80/443) and each LiveKit's two media ports face the internet.
- **Supply chain:** every change passes a vulnerability scan of the images and dependencies and a static analysis of the code before it can be published (see [Pipeline](pipeline.md)).

**Trust boundary to know about:** any member's token may publish a screen; the one-sharer rule is enforced by the web app. That's acceptable for a small group of friends. Server-side enforcement (granting publish rights only to the slot holder) is on the roadmap.
