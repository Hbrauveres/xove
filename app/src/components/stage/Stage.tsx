import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { loadWatchPrefs, saveWatchPrefs, type WatchPrefs } from "../../media/preferences";
import { viewerQualities } from "../../media/shareSettings";
import type { StagePick } from "../../hooks/useStagePick";
import type { AmbilightPrefs } from "../../media/preferences";
import type { Friend, LiveFeed, Sharer } from "../../types";
import { barsPicture } from "./bars";
import { EmptyStage } from "./EmptyStage";
import { Facecam, type FacecamPlace } from "./Facecam";
import { ScreenVideo } from "./ScreenVideo";
import { StageNotice } from "./StageNotice";
import { StageOverlay } from "./StageOverlay";
import { PlayerButtons, type StreamControls } from "./PlayerButtons";
import { VolumeButton } from "./VolumeButton";
import { liftButtons, makeRoom } from "./makeRoom";
import { AlsoLive } from "./AlsoLive";
import { Ambilight } from "./Ambilight";
import { NowWatching, STREAM_PLACES } from "./NowWatching";
// The component, not the type of the same name from ../../types.
import { LiveFeed as LiveNowFeed } from "./LiveFeed";
import { HereCards } from "./HereCards";
import { Toast } from "../ui/Toast";
import { MUTED, type PreviewSound } from "./previewSound";
import { useVideoShape } from "../../hooks/useVideoShape";
import { useStageSwipe } from "../../hooks/useStageSwipe";
import { stepOnStage } from "../../media/stagePick";
import { StageDots } from "./StageDots";
import { StreamsRow } from "./StreamsRow";
import { gridFor } from "../../media/ambilight";
import styles from "./Stage.module.css";

/** The settings over the cog sit this far above the round buttons (design decision 9). */
const ROW_GAP = 10;

type Props = {
  /** Everyone with a live stream, the longest sharing first. */
  sharers: Sharer[];
  /** My screen and camera: the round buttons over the bottom of the stage (spec 0098). */
  controls: StreamControls;
  /** Who is on the stage, kept by the room (spec 0104). */
  stage: StagePick;
  /** The light around the stage (spec 0104). */
  ambilight: AmbilightPrefs;
  /** Who has the person on the stage on theirs, me included, never that person (spec 0107). */
  watchers?: Friend[];
  /** The others in the room, for an empty stage's invitation (spec 0107). */
  others?: Friend[];
  /**
   * The phone's layouts: upright (spec 0158), the compact info row then the feed or who's here;
   * sideways (spec 0160), the stage filling the screen with a top bar and the streams row.
   */
  layout?: "phone" | "sideways";
  /** Sideways: the people button, the bell and my account, on the right of the top bar. */
  topRight?: ReactNode;
  /**
   * On a phone or tablet (spec 0171): the fullscreen button opens and leaves the full-screen
   * view instead of the player's fullscreen; `hidden` sideways, where the room is already in it.
   */
  fullView?: { on: boolean; toggle: () => void; hidden: boolean };
  /** On the phone: who has this person's stream on their stage, for the feed's cards. */
  watchersOf?: (personId: string) => Friend[];
  /** On the phone, with nobody live: everyone in the room, me included, and when they arrived. */
  people?: Friend[];
  meId?: string;
  arrivedAt?: Record<string, number>;
  /**
   * The settings panel, over the cog (spec 0107): inside the player, so it comes along in
   * fullscreen; sideways on the stage, which is the screen, so it sits above the top bar too.
   */
  settingsPanel?: ReactNode;
  /** The settings sheet is open over the stage: the upright full view makes room for the player. */
  sheetOpen?: boolean;
};

const NOBODY: Friend[] = [];
const NO_ARRIVALS: Record<string, number> = {};
const nobodyWatching = () => NOBODY;

/** How long the player's labels and bars stay after the mouse stops moving. */
export const CHROME_IDLE_MS = 2500;

/** iPhones and iPads ignore a page's volume (only their buttons change it). */
const canSetVolume = () =>
  !/iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** The light's grid for a shape: a new grid starts a fresh light (spec 0107). */
const gridKey = (shape: number) => {
  const { cols, rows } = gridFor(shape);
  return `${cols}x${rows}`;
};

const what = (feed: LiveFeed) => (feed.kind === "camera" ? "camera" : "shared screen");

/** Where the big stream plays: in a 16:9 box, with the picture's own shape (spec 0107). */
export function Stage({
  sharers,
  controls,
  stage,
  ambilight,
  watchers,
  others,
  layout,
  watchersOf = nobodyWatching,
  people = NOBODY,
  meId = "me",
  arrivedAt = NO_ARRIVALS,
  topRight,
  fullView,
  settingsPanel,
  sheetOpen = false,
}: Props) {
  const phone = layout === "phone";
  const sideways = layout === "sideways";
  const frameRef = useRef<HTMLDivElement>(null);
  const [watch, setWatch] = useState<WatchPrefs>(loadWatchPrefs);

  // Who is big comes from the room (spec 0104), which the previews and the activity can change too.
  const { big, swappedFor, pick, toggleSwap } = stage;
  const bigId = big?.person.id ?? null;

  // Screen and camera together: the screen big, the camera in the facecam over it,
  // unless the viewer swapped them (for that person). Remembered for this visit only.
  const swapped = big ? Boolean(swappedFor[big.person.id]) : false;
  // It starts at the top right (spec 0111), clear of the round buttons and the fullscreen button
  // at the bottom right; under the top bar where one lies over the player.
  // Until it's moved, it follows the layout (turning the phone, the full view keep one stage).
  const [movedFacecam, setFacecamPlace] = useState<FacecamPlace | null>(null);
  const facecamPlace = movedFacecam ?? { x: 0.73, y: layout === "sideways" ? 0.18 : 0.04 };
  const [facecamCollapsed, setFacecamCollapsed] = useState(false);
  const both = Boolean(big?.screen && big?.camera);
  const main = big ? ((both && swapped ? big.camera : big.screen) ?? big.camera ?? null) : null;
  const small = both && big ? (swapped ? big.screen : big.camera) : undefined;

  // The LIVE label, the name and the bars show while the mouse moves over the player
  // (or after a tap), and fade when it stops, like YouTube.
  const [chromeShown, setChromeShown] = useState(false);
  const idleTimer = useRef<number | undefined>(undefined);
  // Nothing fades while a control has the keyboard focus, or a menu or the volume slider is open.
  const held = useRef(new Set<string>());
  // Sideways the top bar is part of it too: its focus, and an open panel (spec 0160).
  const topRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const screenChromeRef = useRef<HTMLDivElement>(null);

  // The upright full view with the settings sheet open (spec 0107, design decision 6; spec 0112):
  // the round buttons and the fullscreen button, at the bottom of the screen, move up together
  // to just above the sheet; the video moves up between the top bar and the sheet at the same
  // size if it fits there, and stays (never shrunk) if not. The sheet's top is read from the
  // sheet itself: the visible screen isn't always the stage's height on a real phone.
  const makingRoom = sideways && Boolean(fullView?.on && !fullView.hidden) && sheetOpen;
  useLayoutEffect(() => {
    const box = boxRef.current;
    const section = stageRef.current;
    if (!box || !section) return;
    const place = () => {
      const buttons = screenChromeRef.current;
      box.style.translate = "";
      if (buttons) buttons.style.translate = "";
      if (!makingRoom) return;
      const sheet = document.querySelector<HTMLElement>('[role="dialog"][data-variant="sheet"]');
      if (!sheet) return;
      // Fixed to the bottom of the visible screen; its height doesn't change while it slides in.
      const sheetTop = window.innerHeight - sheet.offsetHeight;
      const s = section.getBoundingClientRect();
      const top = topRef.current;
      const bar = top
        ? Math.max(0, ...[...top.children].map((c) => (c as HTMLElement).offsetTop + (c as HTMLElement).offsetHeight))
        : 0;
      const lift = makeRoom({ height: s.height, bar, sheet: s.bottom - sheetTop, band: { top: box.offsetTop, height: box.offsetHeight } });
      if (lift) box.style.translate = `0 ${-lift}px`;
      const row = buttons?.querySelector("[data-buttons]");
      if (!buttons || !row) return;
      const up = liftButtons({ rowBottom: row.getBoundingClientRect().bottom, sheetTop });
      if (up) buttons.style.translate = `0 ${-up}px`;
    };
    place();
    window.addEventListener("resize", place);
    // The picture's shape can change with the sheet open (another stream, its real size
    // arriving, the facecam): measure again. A translate doesn't resize, so this can't loop.
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    watch?.observe(box);
    return () => {
      window.removeEventListener("resize", place);
      watch?.disconnect();
    };
  }, [makingRoom]);
  const focusInside = () =>
    held.current.size > 0 ||
    (frameRef.current?.contains(document.activeElement) ?? false) ||
    (topRef.current?.contains(document.activeElement) ?? false) ||
    Boolean(topRef.current?.querySelector('[aria-expanded="true"]'));
  const showChrome = useCallback(() => {
    setChromeShown(true);
    window.clearTimeout(idleTimer.current);
    const fade = () => {
      if (focusInside()) idleTimer.current = window.setTimeout(fade, CHROME_IDLE_MS);
      else setChromeShown(false);
    };
    idleTimer.current = window.setTimeout(fade, CHROME_IDLE_MS);
  }, []);
  // A finger lifting off fires pointerleave at once: on touch, only the timer hides.
  const leaveChrome = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch" || focusInside()) return;
    // Fullscreen, there's nothing outside the player to leave to. Some browsers still send
    // "left" while the mouse moves over it (Chrome on Windows, on a tall monitor), which hid
    // the controls for good: only the idle timer hides them there.
    const frame = frameRef.current;
    if (frame && document.fullscreenElement === frame) return;
    // And a "left" while the pointer is still over the player is ignored too.
    const r = frame?.getBoundingClientRect();
    if (r && e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) return;
    window.clearTimeout(idleTimer.current);
    setChromeShown(false);
  }, []);
  const hold = useCallback(
    (what: string, open: boolean) => {
      if (open) {
        held.current.add(what);
        showChrome();
      } else {
        held.current.delete(what);
      }
    },
    [showChrome],
  );
  const onMenuChange = useCallback((open: boolean) => hold("menu", open), [hold]);
  const onVolumeOpen = useCallback((open: boolean) => hold("volume", open), [hold]);
  // The settings panel keeps the controls shown while it's open: held from the cog's click,
  // let go however it closes (the cog, its ✕, Escape).
  const { settingsOpen, onSettings } = controls;
  const toggleSettings = useCallback(() => {
    hold("settings", !settingsOpen);
    onSettings();
  }, [hold, settingsOpen, onSettings]);
  useEffect(() => {
    if (!settingsOpen) held.current.delete("settings");
  }, [settingsOpen]);
  // The settings open over the cog (design decision 9): centred on it, just above the round
  // buttons. The panel reads where they are from two variables on what holds it.
  useLayoutEffect(() => {
    const host = sideways ? stageRef.current : frameRef.current;
    const controls = controlsRef.current;
    if (!settingsOpen || !host || !controls) return;
    const place = () => {
      const cog = controls.querySelector('button[aria-label="Settings"]');
      const row = controls.querySelector("[data-buttons]");
      const h = host.getBoundingClientRect();
      if (!cog || !row || !h.width) return;
      const c = cog.getBoundingClientRect();
      host.style.setProperty("--cog-x", `${c.left + c.width / 2 - h.left}px`);
      host.style.setProperty("--above-row", `${h.bottom - row.getBoundingClientRect().top + ROW_GAP}px`);
    };
    place();
    window.addEventListener("resize", place);
    // The row changes too (the volume comes and goes with who's on the stage).
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    watch?.observe(host);
    const row = controls.querySelector("[data-buttons]");
    if (row) watch?.observe(row);
    return () => {
      window.removeEventListener("resize", place);
      watch?.disconnect();
    };
  }, [settingsOpen, sideways]);
  const playing = Boolean(main && (big?.isMe ? main.local : main.remote));
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  // Only the big person's sound plays, plus any thumbnail this viewer unmuted. The
  // others aren't downloaded at all.
  const [thumbnailSound, setThumbnailSound] = useState<Record<string, PreviewSound>>({});
  // The big video, for the ambilight to read.
  const [bigVideoEl, setBigVideoEl] = useState<HTMLVideoElement | null>(null);
  // The stage hugs the picture: no bars (spec 0107). 16:9 while empty or loading.
  const shape = useVideoShape(bigVideoEl);
  useEffect(() => {
    for (const s of sharers) {
      if (s.isMe || !s.setSoundOn) continue;
      // The phone's feed is silent (spec 0158): a preview unmuted on desktop isn't downloaded there.
      const preview = !phone && !sideways && (thumbnailSound[s.person.id] ?? MUTED).muted === false;
      s.setSoundOn(s.person.id === bigId || preview);
    }
  }, [sharers, bigId, thumbnailSound, phone, sideways]);

  const changeWatch = (next: WatchPrefs) => {
    setWatch(next);
    saveWatchPrefs(next);
  };

  // Watching is always Auto (spec 0107): the size it's shown at, stepping down when the
  // connection can't keep up. Asked for as soon as the big video arrives, and whenever its
  // sharer's cap changes: Auto never asks for more than the cap, so LiveKit stops sending
  // the layers above it.
  const remote = big?.isMe ? undefined : main?.remote;
  // A new function arrives with every LiveKit update; the video it's about is what matters.
  const setQuality = useRef(remote?.setQuality);
  useEffect(() => {
    setQuality.current = remote?.setQuality;
  });
  const bigVideo = remote?.video;
  const cap = main?.settings.quality;
  const offered = viewerQualities(remote?.height ?? 0, remote?.layers, cap);
  const request = cap && cap !== "1080p" ? offered[0] : "auto";
  useEffect(() => {
    const set = setQuality.current;
    if (!bigVideo || !set) return;
    set(request);
    // Leaving the big player (to a thumbnail): back to Auto, so it comes in small.
    return () => set("auto");
  }, [bigVideo, request]);

  // The same button enters and leaves fullscreen; Esc (the browser's own way out) is followed too.
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const follow = () =>
      setFullscreen(document.fullscreenElement != null && document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", follow);
    return () => document.removeEventListener("fullscreenchange", follow);
  }, []);
  const toggleFullscreen = () => {
    // The whole page may be fullscreen on a phone (spec 0160): only the player's own leaves.
    if (document.fullscreenElement && document.fullscreenElement === frameRef.current) {
      void document.exitFullscreen?.().catch(() => {
        /* Already left. */
      });
      return;
    }
    frameRef.current?.requestFullscreen?.().catch(() => {
      /* Not allowed here (some phones and app views). The stage stays inline. */
    });
  };

  // On the phone, a swipe on the picture goes to the next or previous person live (spec 0159).
  const slideRef = useRef<HTMLDivElement>(null);
  const order = sharers.map((s) => s.person.id);
  const swipe = useStageSwipe(slideRef, {
    // Upright and sideways alike (spec 0160): left and right always changes the stream.
    enabled: (phone || sideways) && order.length > 1,
    onStep: (direction) => {
      const next = stepOnStage(order, bigId, direction);
      if (next) pick(next);
    },
  });

  // Sideways (spec 0160): the streams row, closed at first and each time the phone turns
  // sideways; a swipe up opens it, a swipe down closes it, and it closes with the controls.
  const [rowOpen, setRowOpen] = useState(false);
  const [rowFor, setRowFor] = useState(layout);
  if (rowFor !== layout) {
    setRowFor(layout);
    setRowOpen(false);
  }
  // Nobody live: there's no row to open.
  if (rowOpen && !big) setRowOpen(false);
  if (rowOpen && sideways && playing && !chromeShown) setRowOpen(false);
  const rowSwipe = useStageSwipe(slideRef, {
    enabled: sideways && Boolean(big),
    axis: "vertical",
    onOpen: () => setRowOpen(true),
    onClose: () => setRowOpen(false),
  });
  // Turning sideways shows the controls, so the top bar is there to start with.
  useEffect(() => {
    if (sideways) showChrome();
  }, [sideways, showChrome]);
  // Touches and moves: the frame's, or sideways the whole screen's, so the black at the
  // stage's sides counts too.
  const gestures = {
    onPointerMove: (e: React.PointerEvent) => {
      showChrome();
      swipe.onPointerMove(e);
      rowSwipe.onPointerMove(e);
    },
    onPointerDown: (e: React.PointerEvent) => {
      showChrome();
      // Sideways the whole screen listens, but only a drag that starts on the picture swipes (FR-12).
      if (sideways && !slideRef.current?.contains(e.target as Node)) return;
      swipe.onPointerDown(e);
      rowSwipe.onPointerDown(e);
    },
    onPointerUp: (e: React.PointerEvent) => {
      swipe.onPointerUp(e);
      rowSwipe.onPointerUp(e);
    },
    onPointerCancel: (e: React.PointerEvent) => {
      swipe.onPointerCancel(e);
      rowSwipe.onPointerCancel(e);
    },
  };
  // Only over a playing video: notices and the empty stage never fade.
  const chrome = playing ? (chromeShown ? "shown" : "hidden") : undefined;

  const body = () => {
    if (!big || !main) return <EmptyStage canShareScreen={controls.canShareScreen} />;

    // My own stream as everyone sees it, without its sound (it would echo). Sharing
    // the whole screen shows the page inside itself: sharing a tab or window avoids it.
    const content = big.isMe ? (
      main.local ? (
        // My quality and mode are in my buttons' menus (spec 0098).
        <ScreenVideo video={main.local} label={`Your ${what(main)}`} onVideo={setBigVideoEl} />
      ) : (
        <StageNotice spinner title="Starting your share…" text="Your screen shows here in a moment." />
      )
    ) : main.remote ? (
      <>
        <ScreenVideo
          video={main.remote.video}
          sound={big.sound}
          label={`${big.person.name}'s ${what(main)}`}
          volume={watch.volume}
          muted={watch.muted}
          onVideo={setBigVideoEl}
        />
      </>
    ) : (
      <StageNotice spinner title={`Loading ${big.person.name}'s ${main.kind}…`} text="The video starts in a moment." />
    );

    return (
      <>
        {/* The picture (and its facecam) moves with a swipe; the buttons stay put. */}
        <div ref={slideRef} className={styles.slide}>
          {content}
          {small && (
            <Facecam
              video={big.isMe ? small.local : small.remote?.video}
              label={big.isMe ? `Your ${what(small)}` : `${big.person.name}'s ${what(small)}`}
              place={facecamPlace}
              collapsed={facecamCollapsed}
              onSwap={() => toggleSwap(big.person.id)}
              onMove={setFacecamPlace}
              onCollapse={setFacecamCollapsed}
            />
          )}
        </div>
      </>
    );
  };

  // The fullscreen button and the round buttons. In the upright full view they're the
  // screen's, at its bottom, not the player band's (spec 0112); elsewhere, the player's.
  const onScreen = sideways && Boolean(fullView?.on && !fullView.hidden);
  const chromeLayer = (
    <>
      {/* Over a stream and over the empty stage alike, so stopping the only stream in
          fullscreen never strands you there (spec 0111). */}
      {fullView ? (
        <StageOverlay view fullscreen={fullView.on} onFullscreen={fullView.toggle} hidden={fullView.hidden} />
      ) : (
        <StageOverlay fullscreen={fullscreen} onFullscreen={toggleFullscreen} />
      )}

      {/* Always there: over the empty stage they never fade; over a stream, with the bars. */}
      <div ref={controlsRef} className={styles.controls} data-no-swipe>
        {/* Upright and sideways alike: where you are among the people live (specs 0159, 0160). */}
        {(phone || sideways) && (
          <StageDots
            people={sharers.map((s) => s.person)}
            meId={meId}
            onStage={bigId}
            onPick={(id) => pick(id)}
          />
        )}
        <PlayerButtons
          {...controls}
          onSettings={toggleSettings}
          onMenuChange={onMenuChange}
          // Watching someone else: their volume first (spec 0101).
          before={
            remote &&
            big && (
              <VolumeButton
                prefs={watch}
                onChange={changeWatch}
                canSetVolume={canSetVolume()}
                // Only a screen can be shared without sound; a camera never has any to lock.
                hasSound={!big.screen || Boolean(big.hasSound)}
                onOpenChange={onVolumeOpen}
                // One panel over the buttons at a time: the slider waits while the settings are open.
                closed={settingsOpen}
              />
            )
          }
        />
      </div>
    </>
  );

  return (
    <section
      ref={stageRef}
      className={styles.stage}
      data-layout={layout}
      data-chrome={sideways ? chrome : undefined}
      aria-label="Shared screen"
      {...(sideways ? gestures : {})}
    >
      <div
        ref={boxRef}
        className={styles.box}
        data-shape={shape.toFixed(4)}
        style={{ "--shape": shape } as React.CSSProperties}
      >
        {/* Behind the frame, outside it: the frame clips what's inside it. */}
        {/* One per stream: a stream the browser won't let it read doesn't darken the next one. */}
        <Ambilight
          key={big ? `${big.person.id}|${stage.mainKind}|${gridKey(shape)}` : "none"}
          video={big ? bigVideoEl : null}
          // Nobody live: the colour bars glow too (spec 0158).
          still={big ? null : barsPicture()}
          prefs={ambilight}
          shape={shape}
        />
        <div
          ref={frameRef}
          className={styles.frame}
          data-chrome={chrome}
          {...(sideways ? {} : gestures)}
          onPointerLeave={leaveChrome}
          onFocus={showChrome}
        >
          {body()}
          {!onScreen && chromeLayer}
          {!sideways && settingsPanel}
          {/* A short message to the user, at the top centre of the player (design decision 10). */}
          {!sideways && <Toast />}
        </div>
      </div>

      {/* The upright full view: at the bottom of the screen, moving up together above the sheet. */}
      {onScreen && (
        <div ref={screenChromeRef} className={styles.screenChrome} onFocus={showChrome}>
          {chromeLayer}
        </div>
      )}

      {/* Sideways the stage is the screen: over the top bar as well (design decision 9). */}
      {sideways && settingsPanel}
      {/* Sideways at the top centre of the screen, over the top bar's empty middle. */}
      {sideways && (
        <div className={styles.toastTop}>
          <Toast />
        </div>
      )}

      {sideways ? (
        <>
          {/* Over the top, across the screen: who's on the stage, and my buttons (spec 0160). */}
          <div ref={topRef} className={styles.top} data-fades onFocus={showChrome}>
            <NowWatching compact sharer={big} watchers={watchers} free={controls.free} />
            <div className={styles.topRight} data-no-swipe>
              {topRight}
            </div>
          </div>
          {big && sharers.length > 1 && (
            <StreamsRow
              others={sharers.filter((s) => s !== big)}
              liveCount={STREAM_PLACES - controls.free}
              open={rowOpen}
              onOpen={() => {
                setRowOpen(true);
                showChrome();
              }}
              onClose={() => setRowOpen(false)}
              onPick={(id) => pick(id)}
            />
          )}
        </>
      ) : phone ? (
        <>
          <div className={styles.info}>
            <NowWatching compact sharer={big} watchers={watchers} free={controls.free} />
          </div>
          {/* Only this scrolls on the phone: the stage and its info row stay put (spec 0158). */}
          <div className={styles.below}>
            {big ? (
              <LiveNowFeed
                others={sharers.filter((s) => s !== big)}
                liveCount={STREAM_PLACES - controls.free}
                watchersOf={watchersOf}
                onPick={(id) => pick(id)}
              />
            ) : (
              <HereCards people={people} meId={meId} arrivedAt={arrivedAt} />
            )}
          </div>
        </>
      ) : (
        /* Under the stage, like YouTube's title row (spec 0104). */
        <div className={styles.info}>
          <NowWatching sharer={big} watchers={watchers} others={others} />
          <AlsoLive
            others={sharers.filter((s) => s !== big)}
            liveCount={6 - controls.free}
            free={controls.free}
            onPick={(id) => pick(id)}
            sound={thumbnailSound}
            onSoundChange={(id, sound) => setThumbnailSound((prev) => ({ ...prev, [id]: sound }))}
            canSetVolume={canSetVolume()}
          />
        </div>
      )}
    </section>
  );
}
