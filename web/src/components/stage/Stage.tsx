import { useRef } from "react";
import type { ConnectionState, Friend, ScreenTracks, ShareState } from "../../types";
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
  isMeSharing: boolean;
  connection: ConnectionState;
  onStartSharing: () => void;
};

/** The 16:9 area where the shared screen plays. */
export function Stage({ share, sharer, screen, isMeSharing, connection, onStartSharing }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);

  const goFullscreen = () => {
    frameRef.current?.requestFullscreen?.().catch(() => {
      /* Not allowed here (some phones and app views). The stage stays inline. */
    });
  };

  const body = () => {
    if (!share || !sharer) return <EmptyStage onStartSharing={onStartSharing} />;

    // No preview of my own screen: it would show the stage inside the stage, forever.
    const content = isMeSharing ? (
      <StageNotice title="You're sharing your screen" text="Everyone here sees it. Stop from the button below or from your browser's bar." />
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
