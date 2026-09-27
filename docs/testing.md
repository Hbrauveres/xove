# Testing

Every change is tested automatically in the [pipeline](pipeline.md) before it can be merged, and you can run the same tests locally.

## At a glance

| Where | Tool | What it covers | Run it |
| --- | --- | --- | --- |
| API | JUnit 5, AssertJ, MockMvc, spring-security-test, Testcontainers | Business rules, HTTP endpoints, security, database constraints | `cd api && ./mvnw test` |
| Web | Vitest, Testing Library, jsdom | Pages, routing, hooks, the room's behaviour | `cd web && npm test` |
| Build | Docker, Compose | The images build and the stack starts healthy | Pipeline stage 2 |
| Security | Trivy, Semgrep | Known vulnerabilities, risky code patterns | Pipeline stage 3 |

## API tests

Three kinds, from fastest to slowest:

- **Plain unit tests**, no Spring and no database. Example: `ScreenSlotTest` checks the slot rules (takeover, only the holder releases, releasing an empty slot is a no-op) with a clock the test controls, so nothing sleeps. `LiveKitTokensTest` checks a token's signature, claims and expiry.
- **Web layer tests** with MockMvc and `spring-security-test`. They send real HTTP requests through the whole Spring Security filter chain as a signed-in user (`oidcLogin()`), with or without a CSRF token (`csrf()`), and check status codes and JSON. Example: `ScreenControllerTest`, `AccessFlowTest`.
- **Persistence tests** against a real PostgreSQL started by Testcontainers. They check what only a real database can: unique emails, "one pending request per user", migrations applying cleanly.

Docker must be running for Testcontainers. The first run downloads the `postgres:17-alpine` image.

```bash
cd api
./mvnw test                          # everything
./mvnw test -Dtest='Screen*'         # one area
./mvnw test -Dtest=AccessFlowTest    # one class
```

Most Spring tests are `@Transactional`, so each one rolls back its data and they can run in any order. A test that changes Spring's configuration (like `CsrfCookieTest`) gets its own application context with `@DirtiesContext`.

## Web tests

Tests render real pages at a URL, like the browser would, and interact the way a person does (`userEvent.click`, finding elements by role and label). Two fakes make that possible:

- **`test/fakeApi.ts`** replaces `fetch` with a tiny in-memory version of the API. A test sets its state (`server.me`, `server.screenHolder`, forced failures) and checks the requests the app sent (`server.calls`), including the CSRF header.
- **`test/fakeLiveKit.ts`** replaces the `livekit-client` package (jsdom has no WebRTC). A test can play the other people: `lastRoom().join("user-7", "Bruno")`, `publishScreen(...)`, or `browserStopsMyShare()`.

```bash
cd web
npm test                 # once, like CI
npm run test:watch       # re-runs on every save
npm run build            # type-check + production build
```

The room page accepts a short poll interval in tests, so nothing waits 2 seconds.

## What a good test here looks like

- Named after the behaviour, as a sentence: `someoneElseCannotStopTheShare`, `"frees the slot when the browser's own Stop sharing bar is used"`.
- Arrange, act, assert, separated by blank lines.
- Asserts on what a user or client sees (text, status codes, JSON), not on internals.
- No sleeps: inject a clock, use `findBy…` and `waitFor` for async UI.

## Before opening a pull request

```bash
(cd api && ./mvnw test) && (cd web && npm test && npm run build)
```

If that's green, the pipeline's unit test and build stages will be too.
