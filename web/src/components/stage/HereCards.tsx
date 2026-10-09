import { useEffect, useState } from "react";
import type { Friend } from "../../types";
import { Avatar } from "../ui/Avatar";
import { hereFor } from "./hereFor";
import styles from "./HereCards.module.css";

type Props = {
  /** Everyone in the room, me included. */
  people: Friend[];
  meId: string;
  /** When each person arrived, by id (spec 0158); missing for someone the API doesn't list. */
  arrivedAt: Record<string, number>;
};

/** "here N min" moves on by the minute: a 30 s tick is enough. */
const TICK_MS = 30_000;

/**
 * Under the phone's empty stage (spec 0158): everyone in the room on a soft card, how long
 * they've been here, me first, the others waiting for someone to go live.
 */
export function HereCards({ people, meId, arrivedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const ordered = [...people.filter((p) => p.id === meId), ...people.filter((p) => p.id !== meId)];
  return (
    <section className={styles.here} aria-labelledby="here-now">
      <h2 id="here-now" className={styles.head}>
        <span>Here</span>
        <span className={styles.count}>{people.length}</span>
      </h2>
      <ul className={styles.list}>
        {ordered.map((p) => {
          const mine = p.id === meId;
          const since = arrivedAt[p.id];
          return (
            <li key={p.id} className={styles.card}>
              <Avatar person={p} size={30} />
              <div className={styles.text}>
                <h3 className={styles.name}>{mine ? `${p.name} (you)` : p.name}</h3>
                {since !== undefined && <p className={styles.since}>{hereFor(since, now)}</p>}
              </div>
              {!mine && <span className={styles.waiting}>WAITING</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
