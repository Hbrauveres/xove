# Getting started

How to run Xovê on your own machine. On Windows, do all of this inside WSL.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Git | any recent | |
| Node.js | 22 (via [nvm](https://github.com/nvm-sh/nvm)) | The web app; Vite 8 needs Node 22 |
| JDK | 21 (Temurin recommended) | The API. The Maven wrapper (`./mvnw`) downloads Maven itself |
| Docker | Docker Desktop with WSL integration, or Docker Engine on Linux | API tests start a real PostgreSQL with Testcontainers; the full stack runs in Compose |

## Clone

```bash
git clone <repository-url> xove
cd xove
```

## Run the web app alone

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

Vite forwards every `/api` request to `http://localhost:8080`, so the web app talks to a local API without any CORS setup. Without the API running, you'll see the home page and a failed sign-in.

## Run the API

The API needs a PostgreSQL database and Google OAuth credentials.

**1. A database.** The quickest way is a throwaway container:

```bash
docker run -d --name xove-dev-db -p 5432:5432 \
  -e POSTGRES_DB=xove -e POSTGRES_USER=xove -e POSTGRES_PASSWORD=dev \
  postgres:17-alpine
```

**2. Google OAuth credentials.** In the Google Cloud console, an OAuth client of type "Web application" with this authorized redirect URI:

```
http://localhost:5173/api/login/oauth2/code/google
```

Ask the maintainer for the development client, or create your own.

**3. Start it:**

```bash
cd api
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/xove
export SPRING_DATASOURCE_USERNAME=xove
export SPRING_DATASOURCE_PASSWORD=dev
export GOOGLE_CLIENT_ID=<client id>
export GOOGLE_CLIENT_SECRET=<client secret>
export ADMIN_EMAILS=<your google email>
./mvnw spring-boot:run          # http://localhost:8080/api/health
```

Flyway creates the tables on the first start. Your email in `ADMIN_EMAILS` makes you an admin and a member.

Open http://localhost:5173, sign in with Google, and you land in the room.

**4. Video (optional).** Sharing needs a LiveKit server. Run one in development mode with a key pair of your own (the API needs a secret of at least 32 characters, longer than LiveKit's built-in dev secret):

```bash
docker run -d --name xove-dev-livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server:v1.13.7 --dev --bind 0.0.0.0 \
  --keys "devkey: dev-secret-at-least-32-characters-long"

export LIVEKIT_URL=ws://localhost:7880
export LIVEKIT_API_KEY=devkey
export LIVEKIT_API_SECRET=dev-secret-at-least-32-characters-long
```

Restart the API after setting these. Without LiveKit everything works except video, and the room shows "Video offline". This dev server sends no webhooks, so a sharer who closes the tab keeps the slot until someone takes over; the full stack (`docker compose up`) has them.

## Run the whole stack in Docker

The same `compose.yaml` the servers use:

```bash
cp .env.example .env            # fill in the values
docker network create web       # once; shared with the reverse proxy on servers
docker compose up -d --build
docker compose ps
```

Locally there's no reverse proxy in front, so this is mainly useful to check that the images build and start. For day-to-day work, run the API and the web app directly as above.

## Environment variables

| Name | Used by | Meaning |
| --- | --- | --- |
| `APP_ENV` | Compose | `stage`, `prod`, or anything locally; goes into container names |
| `IMAGE_TAG` | Compose | Which published image version to run; set by the deploy script. Unset means "build locally" |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | db, api | Database name and credentials |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | api | Google OAuth client |
| `ADMIN_EMAILS` | api | Comma-separated admin emails |
| `LIVEKIT_URL` | api | Address browsers use to reach LiveKit (`wss://…` on servers) |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | api, livekit | Shared pair; the API signs tokens with it, LiveKit checks them. Secret ≥ 32 characters |

`.env.example` in the repository lists them all. The real `.env` is never committed.

## Next

- Run the tests: [Testing](testing.md)
- Open a pull request: [Contributing](contributing.md)
