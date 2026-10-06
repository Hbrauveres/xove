import styles from "./EmptyStage.module.css";

/** Nobody is sharing: the round buttons over the stage start a share (spec 0098). */
export function EmptyStage() {
  return (
    <div className={styles.empty}>
      <div className={styles.test} aria-hidden="true">
        {["#e7ebf1", "#e0b341", "#3fbf7f", "#6fc3df", "#b47ad1", "#ef4b4b", "#4c6fe0"].map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
      </div>
      <div className={styles.body}>
        <p className={styles.title}>Nobody is sharing right now</p>
        <p className={styles.copy}>Share your screen or turn on your camera with the buttons below.</p>
      </div>
    </div>
  );
}
