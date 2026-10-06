import { useCallback, useEffect, useRef, useState } from "react";
import { loadWatchPrefs, saveWatchPrefs, type WatchPrefs } from "../../media/preferences";
import { effectiveQuality, viewerQualities } from "../../media/shareSettings";
import { stagePick } from "../../media/stagePick";
import type { ConnectionState, LiveFeed, Sharer } from "../../types";
import { EmptyStage } from "./EmptyStage";
import { Facecam, type FacecamPlace } from "./Facecam";
import { PlayerControls } from "./PlayerControls";
import { ScreenVideo } from "./ScreenVideo";
import { StageNotice } from "./StageNotice";
import { StageOverlay } from "./StageOverlay";
import { StreamButtons, type StreamControls } from "./StreamButtons";
import { MUTED, Thumbnails, type ThumbnailSound } from "./Thumbnails";
import styles from "./Stage.module.css";

type Props = {
  /** Everyone with a live stream, the longest sharing first. */
  sharers: Sharer[];
  connection: ConnectionState;
  /** My screen and camera: the round buttons over the bottom of the stage (spec 0098). */
  controls: StreamControls;
};

/** How long the player's labels and bars stay after the mouse stops moving. */
export const CHROME_IDLE_MS = 2500;

/** iPhones and iPads ignore a page's volume (only their buttons change it). */
const canSetVolume = () =>
  !/iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const what = (feed: LiveFeed) => (feed.kind === "camera" ? "camera" : "shared screen");

/** The 16:9 area where the big stream plays. */
export function Stage({ sharers, connection, controls }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [watch, setWatch] = useState<WatchPrefs>(loadWatchPrefs);

  // Each viewer picks who is big; by default, and when that person stops, the
  // longest sharing person is.
  const [picked, setPicked] = useState<string | null>(null);
  // A pick holds while that person shares: if they stop and share again later, the
  // longest sharing person is big again.
  const pickedSharing = picked !== null && sharers.some((s) => s.person.id === picked);
  useEffect(() => {
    if (picked !== null && !pickedSharing) setPicked(null);
  }, [picked, pickedSharing]);
  const bigId = stagePick(
    sharers.map((s) => s.person.id),
    picked,
  );
  const big = sharers.find((s) => s.person.id === bigId) ?? null;

  // Screen and camera together: the screen big, the camera in the facecam over it,
  // unless the viewer swapped them (for that person). Remembered for this visit only.
  const [swappedFor, setSwappedFor] = useState<Record<string, boolean>>({});
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
  // Nothing fades while a control has the keyboard focus, or a stream's menu is open.
  const menuOpen = useRef(false);
  const focusInside = () => menuOpen.current || (frameRef.current?.contains(document.activeElement) ?? false);
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
    window.clearTimeout(idleTimer.current);
    setChromeShown(false);
  }, []);
  const onMenuChange = useCallback(
    (open: boolean) => {
      menuOpen.current = open;
      if (open) showChrome();
    },
    [showChrome],
  );
  const playing = Boolean(main && (big?.isMe ? main.local : main.remote));
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  // Only the big person's sound plays, plus any thumbnail this viewer unmuted. The
  // others aren't downloaded at all.
  const [thumbnailSound, setThumbnailSound] = useState<Record<string, ThumbnailSound>>({});
  useEffect(() => {
    for (const s of sharers) {
      if (s.isMe || !s.setSoundOn) continue;
      s.setSoundOn(s.person.id === bigId || (thumbnailSound[s.person.id] ?? MUTED).muted === false);
    }
  }, [sharers, bigId, thumbnailSound]);

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
    const follow = () => setFullscreen(document.fullscreenElement != null && document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", follow);
    return () => document.removeEventListener("fullscreenchange", follow);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {
        /* Already left. */
      });
      return;
    }
    frameRef.current?.requestFullscreen?.().catch(() => {
      /* Not allowed here (some phones and app views). The stage stays inline. */
    });
  };

  const body = () => {
    if (!big || !main) return <EmptyStage />;

    // My own stream as everyone sees it, without its sound (it would echo). Sharing
    // the whole screen shows the page inside itself: sharing a tab or window avoids it.
    const content = big.isMe ? (
      main.local ? (
        // My quality and mode are in my buttons' menus (spec 0098).
        <ScreenVideo video={main.local} label={`Your ${what(main)}`} />
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
        />
        <div className={styles.player}>
          <PlayerControls
            sharerHeight={main.remote.height ?? 0}
            layers={main.remote.layers}
            cap={cap}
            prefs={watch}
            onChange={changeWatch}
            canSetVolume={canSetVolume()}
            // Only a screen can be shared without sound; a camera never has any to lock.
            hasSound={!big.screen || Boolean(big.hasSound)}
          />
        </div>
      </>
    ) : (
      <StageNotice spinner title={`Loading ${big.person.name}'s ${main.kind}…`} text="The video starts in a moment." />
    );

    return (
      <>
        {content}
        {small && (
          <Facecam
            video={big.isMe ? small.local : small.remote?.video}
            label={big.isMe ? `Your ${what(small)}` : `${big.person.name}'s ${what(small)}`}
            place={facecamPlace}
            collapsed={facecamCollapsed}
            onSwap={() => setSwappedFor((prev) => ({ ...prev, [big.person.id]: !prev[big.person.id] }))}
            onMove={setFacecamPlace}
            onCollapse={setFacecamCollapsed}
          />
        )}
        <StageOverlay
          sharer={big.person}
          startedAt={big.since}
          stats={null}
          isMeSharing={big.isMe}
          fullscreen={fullscreen}
          onFullscreen={toggleFullscreen}
        />
      </>
    );
  };

  return (
    <section className={styles.stage} aria-label="Shared screen">
      <div
        ref={frameRef}
        className={`${styles.frame} ${big?.isMe ? styles.onAir : ""}`}
        // Only over a playing video: notices and the empty stage never fade.
        data-chrome={playing ? (chromeShown ? "shown" : "hidden") : undefined}
        onPointerMove={showChrome}
        onPointerDown={showChrome}
        onPointerLeave={leaveChrome}
        onFocus={showChrome}
      >
        {body()}

        {/* Always there: over the empty stage they never fade; over a stream, with the bars. */}
        <div className={styles.controls}>
          <StreamButtons {...controls} onMenuChange={onMenuChange} />
        </div>

        {connection === "reconnecting" && (
          <div className={styles.reconnecting} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            Connection dropped. Reconnecting…
          </div>
        )}
      </div>

      <Thumbnails
        sharers={sharers.filter((s) => s !== big)}
        onPick={setPicked}
        sound={thumbnailSound}
        onSoundChange={(id, sound) => setThumbnailSound((prev) => ({ ...prev, [id]: sound }))}
        canSetVolume={canSetVolume()}
      />
    </section>
  );
}
