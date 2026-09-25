# Xovê — web (mock)

Clickable mock of the screen-sharing app. No backend, no LiveKit yet: everything
comes from `src/mock/useMockSession.ts`.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

## Structure

```
src/
  main.tsx                    entry point
  App.tsx                     login gate + the room layout
  types.ts                    shared types (Friend, ShareState, StreamStats…)
  styles/global.css           design tokens + base styles
  hooks/useElapsed.ts         live timer and "x min ago"
  mock/
    mockData.ts               fake friends, stats per scene, MAX_SCREENS
    useMockSession.ts         fake session: who's here, who's sharing, actions
  components/
    auth/LoginScreen          "Continue with Google" gate (mocked)
    layout/AppHeader          wordmark, connection status, user
    stage/Stage               16:9 frame, fullscreen, reconnecting overlay
    stage/StageOverlay        LIVE badge, sharer, timer, stream stats
    stage/EmptyStage          "nobody is sharing" state
    stage/MockScreenCanvas    fake moving screen  → becomes <VideoTrack />
    controls/ShareControls    share / take over / stop
    controls/TakeoverConfirm  confirm before stealing the screen
    controls/SourcePicker     stand-in for the browser's share dialog
    viewers/ViewerList        who's here, who's sharing, who's away
    activity/ActivityFeed     joins, leaves, shares
    mock/MockPanel            buttons that fake friends' actions (delete later)
    ui/                       Button, Avatar, LiveDot
```

Each component has its own `.module.css` next to it.

## Swapping the mock for the real thing

Components never talk to the mock directly; they get props from `App.tsx`,
which reads one `Session` object. When the API and LiveKit exist:

1. Write `useLiveSession()` returning the same `Session` shape
   (LiveKit room state + `/api/screen/*` calls).
2. Replace `useMockSession()` with it in `App.tsx`.
3. Replace `MockScreenCanvas` with LiveKit's `<VideoTrack />` and
   `SourcePicker` with `setScreenShareEnabled(true)` (the browser shows its own picker).
4. Delete `MockPanel` and `src/mock/`.
