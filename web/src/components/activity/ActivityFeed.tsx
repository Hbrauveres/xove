import { useEffect, useState } from "react";
import type { ActivityEvent, Friend } from "../../types";
import { timeAgo } from "../../hooks/useElapsed";
import styles from "./ActivityFeed.module.css";

type Props = {
  events: ActivityEvent[];
  people: Friend[];
  meId: string;
};

/** Recent comings and goings, newest first. Fed by LiveKit webhooks in the real app. */
export function ActivityFeed({ events, people, meId }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const nameOf = (id: string | undefined) => {
    if (id === meId) return "You";
    return people.find((p) => p.id === id)?.name ?? "Someone";
  };

  const describe = (e: ActivityEvent) => {
    const actor = nameOf(e.actorId);
    switch (e.kind) {
      case "joined":
        return `${actor} joined`;
      case "left":
        return `${actor} left`;
      case "started":
        return `${actor} started sharing`;
      case "stopped":
        return `${actor} stopped sharing`;
      case "took": {
        const target = e.targetId === meId ? "you" : nameOf(e.targetId);
        return `${actor} took the screen from ${target}`;
      }
    }
  };

  const recent = [...events].reverse().slice(0, 8);

  return (
    <section className={styles.panel} aria-labelledby="activity-title">
      <h2 id="activity-title" className={styles.heading}>
        Activity
      </h2>
      <ol className={styles.list}>
        {recent.map((e) => (
          <li key={e.id} className={styles.item} data-kind={e.kind}>
            <span className={styles.text}>{describe(e)}</span>
            <time className={styles.time} dateTime={new Date(e.at).toISOString()}>
              {timeAgo(e.at, now)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
