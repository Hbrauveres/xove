# Getting started

How to run the web app on your own machine. On Windows, do all of this inside WSL.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Git | any recent | |
| Node.js | 22 (via [nvm](https://github.com/nvm-sh/nvm)) | The web app; Vite 8 needs Node 22 |
| Docker | Docker Desktop with WSL integration, or Docker Engine on Linux | To build and run the image as the servers do (optional) |

## Clone

```bash
git clone https://github.com/Hbrauveres/xove.git
cd xove
```

## Run the web app

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

Vite forwards every `/api` request to `http://localhost:8080`, so the web app talks to a local API without any CORS setup. Without the API running, you'll see the home page and a failed sign-in.

## Run the API next to it

The API lives in [`xove-api`](https://github.com/Hbrauveres/xove-api). Its [Getting started](https://github.com/Hbrauveres/xove-api/blob/main/docs/getting-started.md) runs it on `http://localhost:8080` with a database (and, for video, a LiveKit server in development mode). Then open http://localhost:5173, sign in with Google, and you land in the room.

## Run the image in Docker

`compose.yaml` includes `web/compose.yaml`, the file the servers deploy. It builds the image and checks it's healthy, as the commit checks do:

```bash
docker network create web          # once; shared with the reverse proxy on servers
APP_ENV=dev docker compose up -d --build
docker compose ps
```

There's no reverse proxy and no API in front of it locally, so this only shows the image builds and serves its page. For day-to-day work, run the web app directly as above.

## Environment variables

| Name | Used by | Meaning |
| --- | --- | --- |
| `APP_ENV` | Compose | `stage`, `prod`, or anything locally; goes into the container's name |
| `IMAGE_TAG` | Compose | Which published image version to run; set by the deploy, per app. Unset means "build locally" |

The web app reads no other setting and holds no secret: everything else comes from the API at run time.

## Next

- Run the tests: [Testing](testing.md)
- Open a pull request: [Contributing](../CONTRIBUTING.md)
