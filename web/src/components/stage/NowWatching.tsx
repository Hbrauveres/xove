import { useElapsed } from "../../hooks/useElapsed";
import type { Sharer } from "../../types";
import { Avatar } from "../ui/Avatar";
import styles from "./NowWatching.module.css";

/** What a person shares, in two words. */
const whatOf = (s: Sharer) => (s.screen && s.camera ? "Screen with camera" : s.screen ? "Screen" : "Camera");

/**
 * The left of the info row (spec 0104): who is on the stage, LIVE, what they share and for
 * how long, like YouTube's title row. Or that nobody is sharing.
 */
export function NowWatching({ sharer }: { sharer: Sharer | null }) {
  const elapsed = useElapsed(sharer?.since ?? null);
  if (!sharer) {
    return (
      <div className={styles.now}>
        <h2 className={`${styles.name} ${styles.quiet}`}>Nobody is sharing right now</h2>
      </div>
    );
  }
  const name = sharer.isMe ? "You" : sharer.person.name;
  return (
    <div className={styles.now}>
      <Avatar person={sharer.person} size={44} onAir />
      <div className={styles.text}>
        <h2 className={styles.name}>{name}</h2>
        <p className={styles.meta}>
          <span className={styles.live}>LIVE</span>
          <span>{whatOf(sharer)}</span>
          <span className={styles.elapsed}>{elapsed}</span>
        </p>
      </div>
    </div>
  );
}
