import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { loadWatchPrefs, saveWatchPrefs, type WatchPrefs } from "../../media/preferences";
import { effectiveQuality, viewerQualities } from "../../media/shareSettings";
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
import { WatchSettings } from "./WatchSettings";
import { AlsoLive } from "./AlsoLive";
import { Ambilight } from "./Ambilight";
import { NowWatching, STREAM_PLACES } from "./NowWatching";
// The component, not the type of the same name from ../../types.
import { LiveFeed as LiveNowFeed } from "./LiveFeed";
import { HereCards } from "./HereCards";
import { MUTED, type PreviewSound } from "./previewSound";
import { useVideoShape } from "../../hooks/useVideoShape";
import { useStageSwipe } from "../../hooks/useStageSwipe";
import { stepOnStage } from "../../media/stagePick";
import { StageDots } from "./StageDots";
import { StreamsRow } from "./StreamsRow";
import { gridFor } from "../../media/ambilight";
import styles from "./Stage.module.css";

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
  const [facecamPlace, setFacecamPlace] = useState<FacecamPlace>({ x: 0.74, y: 0.72 });
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
  const onSettingsOpen = useCallback((open: boolean) => hold("settings", open), [hold]);
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

  // Ask for the chosen quality as soon as the big video arrives, and whenever it or
  // its sharer's cap changes. A remembered quality this stream doesn't offer counts
  // as Auto, and Auto never asks for more than the sharer's cap (so LiveKit stops
  // sending layers above it).
  const remote = big?.isMe ? undefined : main?.remote;
  // A new function arrives with every LiveKit update; the video it's about is what matters.
  const setQuality = useRef(remote?.setQuality);
  useEffect(() => {
    setQuality.current = remote?.setQuality;
  });
  const bigVideo = remote?.video;
  const cap = main?.settings.quality;
  const offered = viewerQualities(remote?.height ?? 0, remote?.layers, cap);
  const chosen = effectiveQuality(watch.quality, offered);
  const request = chosen === "auto" && cap && cap !== "1080p" ? offered[0] : chosen;
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
        {fullView ? (
          <StageOverlay view fullscreen={fullView.on} onFullscreen={fullView.toggle} hidden={fullView.hidden} />
        ) : (
          <StageOverlay fullscreen={fullscreen} onFullscreen={toggleFullscreen} />
        )}
      </>
    );
  };

  return (
    <section
      className={styles.stage}
      data-layout={layout}
      data-chrome={sideways ? chrome : undefined}
      aria-label="Shared screen"
      {...(sideways ? gestures : {})}
    >
      <div
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

          {/* Always there: over the empty stage they never fade; over a stream, with the bars. */}
          <div className={styles.controls} data-no-swipe>
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
              onMenuChange={onMenuChange}
              // Watching someone else: their volume first and the quality last (spec 0101).
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
                  />
                )
              }
              after={
                remote && (
                  <WatchSettings
                    sharerHeight={remote.height ?? 0}
                    layers={remote.layers}
                    cap={cap}
                    prefs={watch}
                    onChange={changeWatch}
                    onOpenChange={onSettingsOpen}
                  />
                )
              }
            />
          </div>
        </div>
      </div>

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
