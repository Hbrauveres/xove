# Testing

How the web app is tested, with a real example of each kind, and how to run the tests. Every push runs them in the commit checks ([`ci.yml`](../.github/workflows/ci.yml)), with the build, a check that the image starts, a vulnerability scan and a static analysis.

## At a glance

| Kind | What it proves | Example |
| --- | --- | --- |
| [Rules as plain functions](#rules-as-plain-functions) | The decisions, with no browser: which layout, which quality, how the ambilight is laid out, who is big | `useRoomLayout.test.ts`, `media/*.test.ts`, `brand/*.test.ts` |
| [Components](#components) | One component's output for given props | `components/**/*.test.tsx` |
| [Pages, used like a person](#pages-used-like-a-person) | Whole flows: a page at a URL, with a fake API and a fake LiveKit | `pages/*.test.tsx`, `App.test.tsx`, `hooks/*.test.ts` |
| [The look's values](#the-looks-values) | The design tokens and controls: colours, contrast, sizes | `styles/*.test.ts` |
| [Pictures and sizes](#pictures-and-sizes) | Each screen on every device size | The design sheet's pictures |

All of it runs with Vitest, Testing Library and jsdom (a browser's page model in Node, without WebRTC or real layout).

## Rules as plain functions

Anything that decides something is a plain function, so its tests need no rendering and cover every case. From `hooks/useRoomLayout.test.ts`:

```ts
it("gives a tablet the upright view held upright, the desktop layout sideways", () => {
  expect(layoutFor({ ...tablet, portrait: true, narrowUpright: false })).toBe("upright");
  expect(layoutFor({ ...tablet, portrait: false, narrowUpright: false })).toBe("desktop");
});
```

The same goes for the share presets and their cap (`media/shareSettings.ts`), the ambilight's grid and mask (`media/ambilight.ts`), who is big by default (`media/stagePick.ts`), and the mark's geometry and animation (`brand/`): a test fails if the favicon drifts from the geometry.

## Components

A component rendered alone, checked by what a person sees and hears from a screen reader. From `components/stage/NowWatching.test.tsx`:

```tsx
it("names who is on the stage, live, what they share and for how long", () => {
  render(<NowWatching sharer={bruno(true)} />);

  expect(screen.getByRole("heading", { name: "Bruno" })).toBeInTheDocument();
  expect(screen.getByText("LIVE")).toBeInTheDocument();
  expect(screen.getByText("Screen with camera")).toBeInTheDocument();
  expect(screen.getByText("12:40")).toBeInTheDocument();
});
```

## Pages, used like a person

Most tests render a real page, or the whole app at a URL (`test/renderApp.tsx`), and use it the way a person does: `userEvent.click`, finding things by role and label. Two fakes stand in for the outside world:

- **`test/fakeApi.ts`** replaces `fetch` with a small in-memory API. A test sets its state (who I am, who's sharing, a forced failure), and checks the requests the app sent (`server.calls`), headers included, so the CSRF token is tested too.
- **`test/fakeLiveKit.ts`** replaces `livekit-client` (jsdom has no WebRTC). A test plays the other people: someone joins (`lastRoom().join(...)`), starts a screen (`publishScreen(...)`), or the browser's own "Stop sharing" bar is used (`browserStopsMyShare()`).

The room page takes a short poll interval in tests, so nothing waits 2 seconds. From `pages/RoomPage.test.tsx`:

```tsx
it("stops the video and ends the stream", async () => {
  const server = installFakeApi({ me: member });
  const user = await readyRoom();
  await startSharing(user);

  await user.click(within(controls()).getByRole("button", { name: /stop sharing/i }));

  expect(await screen.findByText("0 of 6 live")).toBeInTheDocument();
  expect(lastRoom().localParticipant.isScreenShareEnabled).toBe(false);
  expect(myLiveStream(server)).toBeUndefined();
});
```

The page, the hooks, the client and the room's logic all run for real; only the network and the video are fake. Hooks with logic of their own (the LiveKit connection, the room session, swipes) also have tests that render them alone (`renderHook`).

## The look's values

The design sheet's values are tested where they live, in the stylesheets: the palette and its contrast (`styles/palette.test.ts`), the sliders and the switch (`styles/controls.test.ts`), the layout's sizes (`styles/layout.test.ts`). From the palette's test, every text colour on every surface:

```ts
for (const bg of ["ground", "surface", "surface-raised"]) {
  for (const [fg, min] of [["text", 4.5], ["text-muted", 4.5], ["accent", 4.5], ["text-faint", 3]] as const) {
    expect(ratio(token(fg)!, token(bg)!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
  }
}
```

## Pictures and sizes

jsdom has no real layout, so how each screen looks is checked in a real headless browser: the [design sheet](design.md)'s pictures are shot from the running app, with fake people and moving pictures, at every size the design sheet lists (desktops, vertical monitors, phones upright and sideways, tablets). A visual change retakes them in the same pull request, and compares them with the design it was drawn from. What a headless browser can't do (gestures, the install prompt, Safari, real fullscreen) is checked by hand on real phones.

## Running them

```bash
cd app
npm test                 # once, as the checks do
npm run test:watch       # again on every save
npm run build            # type check, then the production build
```

## What a good test here looks like

- Named after the behaviour, as a sentence: `"ends the stream when the browser's own Stop sharing bar is used"`.
- Arrange, act, assert, separated by blank lines.
- Asserts on what a person sees (text, roles, names) or on what the app sent, not on internals.
- No sleeps: `findBy…` and `waitFor` for what comes later, fake timers when time matters.
- A call the app makes after a render (a fake's `toHaveBeenCalled…`) is checked inside the `waitFor`, next to what it waits for, not right after it: on a slow machine it can land a moment later.

## Before opening a pull request

```bash
cd app && npm test && npm run build
```

If that passes, the checks' unit test and build stages will too.
