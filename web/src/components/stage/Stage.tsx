import { useCallback, useEffect, useRef, useState } from "react";
import { loadWatchPrefs, saveWatchPrefs, type SharePrefs, type WatchPrefs } from "../../media/preferences";
import { effectiveQuality, viewerQualities } from "../../media/shareSettings";
import type { ConnectionState, LiveFeed, Sharer, StreamKind } from "../../types";
import { ShareSettingsFields } from "../share/ShareSettingsFields";
import { EmptyStage } from "./EmptyStage";
import { PlayerControls } from "./PlayerControls";
import { ScreenVideo } from "./ScreenVideo";
import { StageNotice } from "./StageNotice";
import { StageOverlay } from "./StageOverlay";
import styles from "./Stage.module.css";

type Props = {
  /** Everyone with a live stream, the longest sharing first. */
  sharers: Sharer[];
  connection: ConnectionState;
  onStartSharing: () => void;
  /** My own quality and mode for each of my streams, changed from my player's bar. */
  prefs: Record<StreamKind, SharePrefs>;
  onPrefsChange: (kind: StreamKind, prefs: SharePrefs) => void;
};

/** How long the player's labels and bars stay after the mouse stops moving. */
export const CHROME_IDLE_MS = 2500;

/** iPhones and iPads ignore a page's volume (only their buttons change it). */
const canSetVolume = () =>
  !/iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const what = (feed: LiveFeed) => (feed.kind === "camera" ? "camera" : "shared screen");

/** The 16:9 area where the big stream plays. */
export function Stage({ sharers, connection, onStartSharing, prefs, onPrefsChange }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [watch, setWatch] = useState<WatchPrefs>(loadWatchPrefs);

  // The longest sharing person is shown big.
  const big = sharers[0] ?? null;
  const main = big ? (big.screen ?? big.camera ?? null) : null;

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
  const playing = Boolean(main && (big?.isMe ? main.local : main.remote));
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  const changeWatch = (next: WatchPrefs) => {
    setWatch(next);
    saveWatchPrefs(next);
  };

  // Ask for the chosen quality as soon as the big video arrives, and whenever it or
  // its sharer's cap changes. A remembered quality this stream doesn't offer counts
  // as Auto, and Auto never asks for more than the sharer's cap (so LiveKit stops
  // sending layers above it).
  const remote = big?.isMe ? undefined : main?.remote;
  const setQuality = remote?.setQuality;
  const cap = main?.settings.quality;
  const offered = viewerQualities(remote?.height ?? 0, remote?.layers, cap);
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
    if (!big || !main) return <EmptyStage onStartSharing={onStartSharing} />;

    // My own stream as everyone sees it, without its sound (it would echo). Sharing
    // the whole screen shows the page inside itself: sharing a tab or window avoids it.
    const content = big.isMe ? (
      main.local ? (
        <>
          <ScreenVideo video={main.local} label={`Your ${what(main)}`} />
          <div className={styles.player}>
            <div className={styles.bar}>
              <ShareSettingsFields
                kind={main.kind}
                prefs={prefs[main.kind]}
                onChange={(next) => onPrefsChange(main.kind, next)}
                look="bar"
              />
            </div>
          </div>
        </>
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
          />
        </div>
      </>
    ) : (
      <StageNotice spinner title={`Loading ${big.person.name}'s ${main.kind}…`} text="The video starts in a moment." />
    );

    return (
      <>
        {content}
        <StageOverlay
          sharer={big.person}
          startedAt={big.since}
          stats={null}
          isMeSharing={big.isMe}
          onFullscreen={goFullscreen}
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
