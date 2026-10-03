import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamSettings } from "../../api/types";
import { loadWatchPrefs, saveWatchPrefs, type SharePrefs, type WatchPrefs } from "../../media/preferences";
import { effectiveQuality, viewerQualities } from "../../media/shareSettings";
import type { ConnectionState, Friend, MediaTrack, ScreenTracks, ShareState } from "../../types";
import { ShareSettingsFields } from "../share/ShareSettingsFields";
import { EmptyStage } from "./EmptyStage";
import { PlayerControls } from "./PlayerControls";
import { ScreenVideo } from "./ScreenVideo";
import { StageNotice } from "./StageNotice";
import { StageOverlay } from "./StageOverlay";
import styles from "./Stage.module.css";

type Props = {
  share: ShareState;
  sharer: Friend | null;
  /** The sharer's tracks, once they arrive. Null when it's me or nothing yet. */
  screen: ScreenTracks | null;
  /** My own screen while I share: the preview, played without its sound. */
  myScreen?: MediaTrack;
  isMeSharing: boolean;
  connection: ConnectionState;
  onStartSharing: () => void;
  /** What the current share is sent with, as the API says: caps what viewers can pick. */
  streamSettings: StreamSettings | null;
  /** My own quality and mode while I share, changed from my player's bar. */
  sharePrefs: SharePrefs;
  onSharePrefsChange: (prefs: SharePrefs) => void;
};

/** How long the player's labels and bars stay after the mouse stops moving. */
export const CHROME_IDLE_MS = 2500;

/** iPhones and iPads ignore a page's volume (only their buttons change it). */
const canSetVolume = () =>
  !/iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** The 16:9 area where the shared screen plays. */
export function Stage({
  share,
  sharer,
  screen,
  myScreen,
  isMeSharing,
  connection,
  onStartSharing,
  streamSettings,
  sharePrefs,
  onSharePrefsChange,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [watch, setWatch] = useState<WatchPrefs>(loadWatchPrefs);

  // The LIVE label, the name and the bars show while the mouse moves over the player
  // (or after a tap), and fade when it stops, like YouTube.
  const [chromeShown, setChromeShown] = useState(false);
  const idleTimer = useRef<number | undefined>(undefined);
  // Nothing fades while a control has the keyboard focus.
  const focusInside = () => frameRef.current?.contains(document.activeElement) ?? false;
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
  const playing = isMeSharing ? Boolean(myScreen) : Boolean(screen?.video);
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  const changeWatch = (next: WatchPrefs) => {
    setWatch(next);
    saveWatchPrefs(next);
  };

  // Ask for the chosen quality as soon as someone's screen arrives, and whenever it
  // or the sharer's cap changes. A remembered quality this sharer doesn't offer
  // counts as Auto, and Auto never asks for more than the sharer's cap (so LiveKit
  // stops sending layers above it).
  const setQuality = screen?.setQuality;
  const cap = streamSettings?.quality;
  const offered = viewerQualities(screen?.height ?? 0, screen?.layers, cap);
  const chosen = effectiveQuality(watch.quality, offered);
  const request = chosen === "auto" && cap && cap !== "1080p" ? offered[0] : chosen;
  useEffect(() => {
    setQuality?.(request);
  }, [setQuality, request]);

  const goFullscreen = () => {
    frameRef.current?.requestFullscreen?.().catch(() => {
      /* Not allowed here (some phones and app views). The stage stays inline. */
    });
  };

  const body = () => {
    if (!share || !sharer) return <EmptyStage onStartSharing={onStartSharing} />;

    // My own screen as everyone sees it, without its sound (it would echo). Sharing
    // the whole screen shows the page inside itself: sharing a tab or window avoids it.
    const content = isMeSharing ? (
      myScreen ? (
        <>
          <ScreenVideo screen={{ video: myScreen }} label="Your shared screen" />
          <div className={styles.player}>
            <div className={styles.bar}>
              <ShareSettingsFields prefs={sharePrefs} onChange={onSharePrefsChange} look="bar" />
            </div>
          </div>
        </>
      ) : (
        <StageNotice spinner title="Starting your share…" text="Your screen shows here in a moment." />
      )
    ) : screen?.video ? (
      <>
        <ScreenVideo
          screen={screen}
          label={`${sharer.name}'s shared screen`}
          volume={watch.volume}
          muted={watch.muted}
        />
        <div className={styles.player}>
          <PlayerControls
            sharerHeight={screen.height ?? 0}
            layers={screen.layers}
            cap={cap}
            prefs={watch}
            onChange={changeWatch}
            canSetVolume={canSetVolume()}
          />
        </div>
      </>
    ) : (
      <StageNotice spinner title={`Loading ${sharer.name}'s screen…`} text="The video starts in a moment." />
    );

    return (
      <>
        {content}
        <StageOverlay
          sharer={sharer}
          startedAt={share.startedAt}
          stats={null}
          isMeSharing={isMeSharing}
          onFullscreen={goFullscreen}
        />
      </>
    );
  };

  return (
    <section className={styles.stage} aria-label="Shared screen">
      <div
        ref={frameRef}
        className={`${styles.frame} ${isMeSharing ? styles.onAir : ""}`}
        // Only over a playing video: notices and the empty stage never fade.
        data-chrome={playing ? (chromeShown ? "shown" : "hidden") : undefined}
        onPointerMove={showChrome}
        onPointerDown={showChrome}
        onPointerLeave={leaveChrome}
        onFocus={showChrome}
      >
        {body()}

        {connection === "reconnecting" && (
          <div className={styles.reconnecting} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            Connection dropped. Reconnecting…
          </div>
        )}
      </div>
    </section>
  );
}
