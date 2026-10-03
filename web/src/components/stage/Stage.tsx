import { useRef } from "react";
import type { ConnectionState, Friend, MediaTrack, ScreenTracks, ShareState } from "../../types";
import { EmptyStage } from "./EmptyStage";
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
};

/** The 16:9 area where the shared screen plays. */
export function Stage({ share, sharer, screen, myScreen, isMeSharing, connection, onStartSharing }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);

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
        <ScreenVideo screen={{ video: myScreen }} label="Your shared screen" />
      ) : (
        <StageNotice spinner title="Starting your share…" text="Your screen shows here in a moment." />
      )
    ) : screen?.video ? (
      <ScreenVideo screen={screen} label={`${sharer.name}'s shared screen`} />
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
      <div ref={frameRef} className={`${styles.frame} ${isMeSharing ? styles.onAir : ""}`}>
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
