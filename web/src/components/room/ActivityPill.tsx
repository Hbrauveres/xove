import { useEffect, useRef, useState } from "react";
import type { ActivityEvent, ConnectionState, Friend, StreamKind } from "../../types";
import { Avatar } from "../ui/Avatar";
import { Dropdown, DropdownSection } from "../ui/Dropdown";
import { ActivityList } from "./ActivityList";
import { describeEvent, shortAgo } from "./activityText";
import styles from "./ActivityPill.module.css";

type Props = {
  /** Oldest first. */
  events: ActivityEvent[];
  people: Friend[];
  meId: string;
  connection: ConnectionState;
  isLive: (personId: string, kind: StreamKind) => boolean;
  watching: { personId: string; kind: StreamKind } | null;
  onWatch: (personId: string, kind: StreamKind) => void;
};

/**
 * The middle of the header (spec 0104): the latest thing that happened, always current, with
 * a count of new ones. While the connection is down it says so instead. A click opens the list.
 */
export function ActivityPill({ events, people, meId, connection, isLive, watching, onWatch }: Props) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // The newest event seen in the list; everything after it is new.
  const [seenId, setSeenId] = useState<string | null>(null);
  // The ones that were new when the list opened: they stay highlighted while it's open.
  const [newWhenOpened, setNewWhenOpened] = useState<ReadonlySet<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const latest = events.at(-1);
  const seenAt = seenId === null ? -1 : events.findIndex((e) => e.id === seenId);
  const unseen = seenId !== null && seenAt === -1 ? events.length : events.length - 1 - seenAt;
  const fresh = open ? 0 : unseen;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Someone";
  const actor = latest ? (people.find((p) => p.id === latest.actorId) ?? null) : null;
  const reconnecting = connection === "reconnecting";

  // Opening shows what's new; closing marks everything seen, events that came in meanwhile too.
  const close = (returnFocus: boolean) => {
    setSeenId(events.at(-1)?.id ?? null);
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };
  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    setNewWhenOpened(new Set(unseen > 0 ? events.slice(-unseen).map((e) => e.id) : []));
    setSeenId(latest?.id ?? null);
    setOpen(true);
  };

  let label: string;
  let content;
  if (reconnecting) {
    label = "Connection dropped. Reconnecting";
    content = (
      <span className={`${styles.tick} ${styles.enter}`}>
        <span className={styles.spin} aria-hidden="true" />
        <span className={styles.what}>Connection dropped. Reconnecting…</span>
      </span>
    );
  } else if (latest) {
    const text = describeEvent(latest, nameOf, meId);
    const ago = shortAgo(latest.at, now);
    label = `Activity: ${text}, ${ago === "now" ? "just now" : `${ago} ago`}${fresh ? `, ${fresh} new` : ""}`;
    content = (
      <span key={latest.id} className={`${styles.tick} ${styles.enter}`}>
        {actor && <Avatar person={actor} size={22} />}
        <span className={styles.what}>{text}</span>
        <time className={styles.time}>{ago}</time>
      </span>
    );
  } else {
    label = "Activity: nothing new yet";
    content = (
      <span className={styles.tick}>
        <span className={styles.what}>Nothing new yet</span>
      </span>
    );
  }

  return (
    <div ref={anchor} className={styles.wrap}>
      <button
        ref={button}
        type="button"
        className={`${styles.pill} ${reconnecting ? styles.warn : ""}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        {!reconnecting && (
          <svg className={styles.bell} viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path
              d="M5 13V9a5 5 0 0 1 10 0v4l1.5 2h-13zM8 17a2 2 0 0 0 4 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {content}
        {fresh > 0 && !reconnecting && <span className={styles.new}>{fresh}</span>}
        <svg className={styles.chev} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <Dropdown
        open={open}
        label="Activity"
        align="center"
        anchor={anchor}
        onClose={close}
      >
        <DropdownSection scroll>
          <ActivityList
            events={events}
            people={people}
            meId={meId}
            unseen={newWhenOpened}
            isLive={isLive}
            watching={watching}
            onWatch={(personId, kind) => {
              onWatch(personId, kind);
              // The list closes; the keyboard stays on the pill.
              close(true);
            }}
          />
        </DropdownSection>
      </Dropdown>
    </div>
  );
}
