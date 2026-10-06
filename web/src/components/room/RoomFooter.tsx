import styles from "./RoomFooter.module.css";

/** The room's slim footer (spec 0104). Not clickable yet: the links come later. */
export function RoomFooter() {
  return (
    <footer className={styles.footer}>
      <span className={styles.made}>xovê · Made by Hbrauveres</span>
      <span className={styles.links}>
        <span className={styles.coffee}>☕ Buy me a coffee</span>
        <span>GitHub</span>
        <span>LinkedIn</span>
      </span>
    </footer>
  );
}
