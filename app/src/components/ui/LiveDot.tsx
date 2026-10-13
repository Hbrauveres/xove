import styles from "./LiveDot.module.css";

/** Small pulsing red dot used next to "LIVE". */
export function LiveDot() {
  return <span className={styles.dot} aria-hidden="true" />;
}
