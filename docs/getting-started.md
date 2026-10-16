# Getting started

How to run the web app on your own machine. On Windows, do all of this inside WSL.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Git | any recent | |
| Node.js | 22 (via [nvm](https://github.com/nvm-sh/nvm)) | The web app; Vite 8 needs Node 22 |
| Docker | Docker Desktop with WSL integration, or Docker Engine on Linux | To build and run the image (optional) |

## Clone

```bash
git clone https://github.com/Hbrauveres/xove-web.git
cd xove-web
```

## Run the web app

```bash
cd app
npm install
npm run dev          # http://localhost:5173
```

Vite forwards every `/api` request to `http://localhost:8080`, so the web app talks to a local API without any CORS setup. It keeps the browser's address, so the API's redirects, Google's sign-in callback included, come back to `http://localhost:5173`. Without the API running, you'll see the home page and a failed sign-in.

## Run the API next to it

The API lives in [`xove-api`](https://github.com/Hbrauveres/xove-api). Its [Getting started](https://github.com/Hbrauveres/xove-api/blob/main/docs/getting-started.md) runs it on `http://localhost:8080` with a database (and, for video, a LiveKit server in development mode). Then open http://localhost:5173, sign in with Google, and you land in the room.

## Run the image in Docker

`app/compose.yaml` builds the image (the static build, served by Caddy) and checks it's healthy, as the commit checks do:

```bash
docker network create web          # once: the network the compose file joins
APP_ENV=dev docker compose -f app/compose.yaml up -d --build
docker compose -f app/compose.yaml ps
```

There's no reverse proxy and no API in front of it locally, so this only shows the image builds and serves its page. For day-to-day work, run the web app directly as above.

## Environment variables

| Name | Used by | Meaning |
| --- | --- | --- |
| `APP_ENV` | Compose | The environment's name; anything locally. It goes into the container's name |
| `IMAGE_TAG` | Compose | Which published image to run. Unset means "build it locally" |

The web app reads no other setting and holds no secret: everything else comes from the API at run time.

## Next

- Run the tests: [Testing](testing.md)
- Open a pull request: [Contributing](../CONTRIBUTING.md)
