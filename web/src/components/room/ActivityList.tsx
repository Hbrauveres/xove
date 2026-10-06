import { useEffect, useState } from "react";
import type { ActivityEvent, Friend, StreamKind } from "../../types";
import { ActivityIcon } from "./ActivityIcon";
import { describeEvent, shortAgo } from "./activityText";
import styles from "./ActivityList.module.css";

type Props = {
  /** Oldest first, as the room keeps them; shown newest first. */
  events: ActivityEvent[];
  people: Friend[];
  meId: string;
  /** How many of the newest ones weren't seen yet: highlighted. */
  unseen: number;
  /** Whether that person's stream is still live. */
  isLive: (personId: string, kind: StreamKind) => boolean;
  /** What's on my stage. */
  watching: { personId: string; kind: StreamKind } | null;
  onWatch: (personId: string, kind: StreamKind) => void;
};

/**
 * Everything that happened in the room, newest first (spec 0104). An event about a stream
 * that's still live is a button: WATCH puts it on the stage, WATCHING marks the one there.
 */
export function ActivityList({ events, people, meId, unseen, isLive, watching, onWatch }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Someone";
  const newestFirst = [...events].reverse();

  return (
    <ul className={styles.list}>
      {newestFirst.map((e, i) => {
        const text = describeEvent(e, nameOf, meId);
        const kind: StreamKind = e.stream ?? "screen";
        const isStream = e.kind === "started" || e.kind === "stopped";
        const icon = (
          <span className={styles.icon} data-stream={isStream || undefined}>
            <ActivityIcon event={e} />
          </span>
        );
        const time = <time className={styles.time}>{shortAgo(e.at, now)}</time>;
        const unseenMark = i < unseen ? { "data-unseen": true } : {};
        if (e.kind === "started" && isLive(e.actorId, kind)) {
          const here = watching?.personId === e.actorId && watching.kind === kind;
          return (
            <li key={e.id}>
              <button
                type="button"
                className={`${styles.row} ${styles.link}`}
                aria-label={`${text}: ${here ? "watching" : "watch"}`}
                data-watching={here || undefined}
                onClick={() => onWatch(e.actorId, kind)}
                {...unseenMark}
              >
                {icon}
                <span className={styles.text}>{text}</span>
                <span className={styles.act}>{here ? "WATCHING" : "WATCH"}</span>
                {time}
              </button>
            </li>
          );
        }
        return (
          <li key={e.id}>
            <div className={styles.row} {...unseenMark}>
              {icon}
              <span className={styles.text}>{text}</span>
              {time}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
