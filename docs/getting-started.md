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

## Settings from 1Password

Local settings come from the `infra` repo (`config/dev.yaml`, next to this repo's
folder) and secrets from the 1Password vault `Xove App`, the same way the servers
get theirs. Once per machine:

1. Install the 1Password CLI **for Windows** and turn on **Settings → Developer →
   Integrate with 1Password CLI** in the 1Password app (unlocks with the app).
2. In WSL, make it reachable as `op`, and check it:

   ```bash
   mkdir -p ~/.local/bin && ln -sf "$(command -v op.exe)" ~/.local/bin/op
   op vault list                   # shows Xove App among your vaults
   ```

3. Python 3 with PyYAML (`python3 -c "import yaml"`).

Then, in every new terminal where you run Xovê:

```bash
eval "$(../infra/ops/build-env dev --export)"
```

It exports every variable in `config/dev.yaml`, secrets resolved from the vault,
into that terminal only. Nothing is written to disk.

## Run the API

**1. A database**, a throwaway container with the dev password from the vault:

```bash
docker run -d --name xove-dev-db -p 5432:5432 \
  -e POSTGRES_DB="$POSTGRES_DB" -e POSTGRES_USER="$POSTGRES_USER" -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  postgres:17-alpine
```

An older `xove-dev-db` made with the password `dev` won't accept the vault's
password: remove it first (`docker rm -f xove-dev-db`).

**2. Start it:**

```bash
cd api && ./mvnw spring-boot:run          # http://localhost:8080/api/health
```

Flyway creates the tables on the first start. Your email in `ADMIN_EMAILS` makes you an admin and a member. The Google client is the staging one; it also allows `http://localhost:5173`.

Open http://localhost:5173, sign in with Google, and you land in the room.

**3. Video (optional).** Sharing needs a LiveKit server. Run one in development mode with the dev key pair from the vault:

```bash
docker run -d --name xove-dev-livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server:v1.13.7 --dev --bind 0.0.0.0 \
  --keys "$LIVEKIT_API_KEY: $LIVEKIT_API_SECRET"
```

Restart the API after starting it. Without LiveKit everything works except video, and the room shows "Video offline". This dev server sends no webhooks, so a sharer who closes the tab keeps the slot until someone takes over. On the servers, LiveKit runs from the `infra` repo, one per environment, with webhooks.

## Run the whole stack in Docker

The same `compose.yaml` the servers use, with the variables exported above:

```bash
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
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | api | The pair shared with that environment's LiveKit (run from `infra`): the API signs tokens with it, LiveKit checks them and signs its webhooks. Secret ≥ 32 characters |
| `LIVEKIT_ROOM` | api | This environment's room (staging `xove-stage`, production `xove`); defaults to `xove` |
| `XOVE_ROOM_SEATS` | api | People in the room at once, sharers included: 1 to 20 (production 20, staging 3); defaults to 20. Anything else stops the API at start-up |

Their values live in the `infra` repo, one file per environment (`config/dev.yaml`, `stage.yaml`…), with secrets as 1Password references. There's no `.env` in this repo; see [operations](operations.md) for how the servers build theirs.

## Next

- Run the tests: [Testing](testing.md)
- Open a pull request: [Contributing](contributing.md)
