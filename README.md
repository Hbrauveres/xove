# Xovê

A private web app where invited friends share their screens and cameras and watch each other live: up to 6 streams at once, 20 people in the room, with a queue when it's full. Live at [xove.app](https://xove.app) (by invitation).

## Stack

| Part | Tech |
| --- | --- |
| API (`api/`) | Java 21, Spring Boot 4 (Web MVC, Security, Data JPA), PostgreSQL 17 with Flyway, Spring Session JDBC, Google sign-in |
| Web (`web/`) | React 19, TypeScript, Vite, CSS modules, `livekit-client` |
| Video | A self-hosted [LiveKit](https://livekit.io) server (WebRTC SFU) |
| Delivery | GitHub Actions: build, validate the stack, unit tests, Trivy and Semgrep, publish to GHCR, deploy to staging on merge and to production on a version tag, with automatic rollback |

## Run it

```bash
cd web && npm install && npm run dev          # the web app, on its own
cd api && ./mvnw spring-boot:run              # the API (needs PostgreSQL and its settings)
docker compose up                             # the whole stack
```

## Test it

```bash
cd api && ./mvnw test                         # JUnit, MockMvc, Testcontainers (Docker needed)
cd web && npm test && npm run build           # Vitest + Testing Library, then a type-checked build
```

## How it's built

Every change starts as a written spec with numbered requirements and acceptance criteria, then a plan and small tasks, and a pull request that proves each criterion with tests. The specs, plans, architecture decisions and operations docs are kept in a private workspace repository; the commit history and the pull requests here show the result.
