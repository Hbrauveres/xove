# Testing

Every change is tested automatically in the [pipeline](../.github/workflows/ci.yml) before it can be merged, and you can run the same tests locally.

## At a glance

| Where | Tool | What it covers | Run it |
| --- | --- | --- | --- |
| Web | Vitest, Testing Library, jsdom | Pages, routing, hooks, the room's behaviour | `cd app && npm test` |
| Build | Docker, Compose | The image builds and starts healthy | Pipeline stage 2 |
| Security | Trivy, Semgrep | Known vulnerabilities, risky code patterns | Pipeline stage 3 |

The API's tests are in [`xove-api`](https://github.com/Hbrauveres/xove-api/blob/main/docs/testing.md).

## Web tests

Tests render real pages at a URL, like the browser would, and interact the way a person does (`userEvent.click`, finding elements by role and label). Two fakes make that possible:

- **`test/fakeApi.ts`** replaces `fetch` with a tiny in-memory version of the API. A test sets its state (`server.me`, `server.screenHolder`, forced failures) and checks the requests the app sent (`server.calls`), including the CSRF header.
- **`test/fakeLiveKit.ts`** replaces the `livekit-client` package (jsdom has no WebRTC). A test can play the other people: `lastRoom().join("user-7", "Bruno")`, `publishScreen(...)`, or `browserStopsMyShare()`.

```bash
cd app
npm test                 # once, like CI
npm run test:watch       # re-runs on every save
npm run build            # type-check + production build
```

The room page accepts a short poll interval in tests, so nothing waits 2 seconds.

## What a good test here looks like

- Named after the behaviour, as a sentence: `"ends the stream when the browser's own Stop sharing bar is used"`.
- Arrange, act, assert, separated by blank lines.
- Asserts on what a user or client sees (text, status codes, JSON), not on internals.
- No sleeps: use `findBy…` and `waitFor` for async UI, and fake timers when time matters.
- A call the app makes after a render (a fake's `toHaveBeenCalled…`) is checked inside the `waitFor`, next to what it waits for, not once right after it: on a slow CI runner the call can land a moment later.

## Before opening a pull request

```bash
cd app && npm test && npm run build
```

If that's green, the pipeline's unit test and build stages will be too.
