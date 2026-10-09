import styles from "./EmptyStage.module.css";

/** The broadcast colour bars of an empty stage, left to right. */
export const BARS = ["#e7ebf1", "#e0b341", "#3fbf7f", "#6fc3df", "#b47ad1", "#ef4b4b", "#4c6fe0"] as const;

let picture: HTMLCanvasElement | null | undefined;

/**
 * The bars as a small still picture, for the ambilight to light (spec 0158). Made once; null
 * where the page has no canvas.
 */
export function barsPicture(): HTMLCanvasElement | null {
  if (picture !== undefined) return picture;
  const canvas = document.createElement("canvas");
  canvas.width = BARS.length * 16;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  if (!ctx) return (picture = null);
  BARS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * 16, 0, 16, canvas.height);
  });
  return (picture = canvas);
}

/**
 * Nobody is sharing: the colour bars, at full colour and lit by the ambilight (spec 0158), with
 * the round buttons over the stage to start a share (spec 0098). Only the camera where the
 * browser can't share a screen (phones).
 */
export function EmptyStage({ canShareScreen = true }: { canShareScreen?: boolean }) {
  return (
    <div className={styles.empty}>
      <div className={styles.test} data-bars aria-hidden="true">
        {BARS.map((c) => (
          <span key={c} data-bar style={{ background: c }} />
        ))}
      </div>
      <div className={styles.body}>
        <p className={styles.copy}>
          {canShareScreen
            ? "Share your screen or turn on your camera with the buttons below."
            : "Turn on your camera with the button below."}
        </p>
      </div>
    </div>
  );
}
