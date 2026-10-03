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

  const whose = (e: ActivityEvent) => (e.actorId === meId ? "your" : "their");

  const describe = (e: ActivityEvent) => {
    const actor = nameOf(e.actorId);
    switch (e.kind) {
      case "joined":
        return `${actor} joined`;
      case "left":
        return `${actor} left`;
      case "started":
        return e.stream === "camera" ? `${actor} turned on ${whose(e)} camera` : `${actor} started sharing`;
      case "stopped":
        return e.stream === "camera" ? `${actor} turned off ${whose(e)} camera` : `${actor} stopped sharing`;
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
