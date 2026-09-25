import { useRef } from "react";
import type { ConnectionState, Friend, ShareState, StreamStats } from "../../types";
import { SCENE_LABEL } from "../../mock/mockData";
import { EmptyStage } from "./EmptyStage";
import { MockScreenCanvas } from "./MockScreenCanvas";
import { StageOverlay } from "./StageOverlay";
import styles from "./Stage.module.css";

type Props = {
  share: ShareState;
  sharer: Friend | null;
  stats: StreamStats | null;
  isMeSharing: boolean;
  connection: ConnectionState;
  onStartSharing: () => void;
};

/** The 16:9 area where the shared screen plays. */
export function Stage({ share, sharer, stats, isMeSharing, connection, onStartSharing }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);

  const goFullscreen = () => {
    frameRef.current?.requestFullscreen?.().catch(() => {
      /* Not allowed here (some phones and app views). The stage stays inline. */
    });
  };

  return (
    <section className={styles.stage} aria-label="Shared screen">
      <div ref={frameRef} className={`${styles.frame} ${isMeSharing ? styles.onAir : ""}`}>
        {share && sharer ? (
          <>
            <MockScreenCanvas
              scene={share.scene}
              label={`${isMeSharing ? "Your" : `${sharer.name}'s`} shared screen: ${SCENE_LABEL[share.scene]}`}
            />
            <StageOverlay
              sharer={sharer}
              startedAt={share.startedAt}
              stats={stats}
              isMeSharing={isMeSharing}
              onFullscreen={goFullscreen}
            />
          </>
        ) : (
          <EmptyStage onStartSharing={onStartSharing} />
        )}

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
