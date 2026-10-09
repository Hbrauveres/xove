import styles from "./RoomFooter.module.css";

/** What the footer says (spec 0104): the room's footer on desktop, the account menu's end on a phone (spec 0158). */
export function FooterItems() {
  return (
    <>
      <span className={styles.made}>xovê · Made by Hbrauveres</span>
      <span className={styles.links}>
        <span className={styles.coffee}>☕ Buy me a coffee</span>
        <span>GitHub</span>
        <span>LinkedIn</span>
      </span>
    </>
  );
}

/** The room's slim footer (spec 0104). Not clickable yet: the links come later. */
export function RoomFooter() {
  return (
    <footer className={styles.footer}>
      <FooterItems />
    </footer>
  );
}
