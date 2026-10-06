import { useRef, useState } from "react";
import type { RoomSeatsState } from "../../api/types";
import type { Friend, StreamKind } from "../../types";
import { Avatar } from "../ui/Avatar";
import { Dropdown, DropdownSection } from "../ui/Dropdown";
import styles from "./PeopleButton.module.css";

type Props = {
  /** Everyone in the room, me first. */
  people: Friend[];
  meId: string;
  /** What each person shares, by their id. */
  sharing: Record<string, { screen: boolean; camera: boolean }>;
  /** Whose stream each person has on their stage, by their id (spec 0104). */
  watchingOf: Record<string, { sharerId: string; kind: StreamKind }>;
  /** The room's seats, or null when the API doesn't say. */
  seats: RoomSeatsState | null;
};

const icon = {
  screen: "M3 4.5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM7 17.5h6M10 14.5v3",
  camera: "M3 6h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM13 9l5-3v8l-5-3",
};

/**
 * Who's here (spec 0104): a people icon and the number; it opens the seats, everyone with
 * what they share or whose stream they watch, and the queue.
 */
export function PeopleButton({ people, meId, sharing, watchingOf, seats }: Props) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const count = people.length;
  const nameOf = (id: string) => (id === meId ? "you" : (people.find((p) => p.id === id)?.name ?? "someone"));

  const noteOf = (p: Friend) => {
    const shares = sharing[p.id];
    if (shares?.screen && shares.camera) return "Sharing screen and camera";
    if (shares?.screen) return "Sharing their screen";
    if (shares?.camera) return "Sharing their camera";
    const watch = watchingOf[p.id];
    return watch ? `Watching ${nameOf(watch.sharerId)}` : "In the room";
  };

  const waiting = seats?.waiting ?? 0;
  const queue =
    waiting === 0
      ? "Nobody is waiting for a seat."
      : waiting === 1
        ? "1 person is waiting for a seat."
        : `${waiting} people are waiting for a seat.`;

  return (
    <div ref={anchor} className={styles.wrap}>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-label={`${count} ${count === 1 ? "person" : "people"} here`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle cx="7.5" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M2 16c.6-2.8 2.8-4.3 5.5-4.3S12.4 13.2 13 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="14" cy="6.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M14.5 11.3c1.9.3 3.1 1.6 3.5 3.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span className={styles.count}>{count}</span>
      </button>

      <Dropdown
        open={open}
        label="Here now"
        anchor={anchor}
        onClose={(returnFocus) => {
          setOpen(false);
          if (returnFocus) button.current?.focus();
        }}
      >
        {seats && (
          <DropdownSection className={styles.head}>
            <div className={styles.line}>
              <span>Seats</span>
              <span>
                <b>{seats.taken}</b> of {seats.total} · {Math.max(0, seats.total - seats.taken)} free
              </span>
            </div>
            <div
              className={styles.bar}
              role="progressbar"
              aria-label="Seats taken"
              aria-valuemin={0}
              aria-valuemax={seats.total}
              aria-valuenow={seats.taken}
            >
              <i style={{ width: `${Math.min(100, (seats.taken / seats.total) * 100)}%` }} />
            </div>
          </DropdownSection>
        )}
        <DropdownSection scroll>
          <ul className={styles.people}>
            {people.map((p) => {
              const shares = sharing[p.id];
              return (
                <li key={p.id} className={styles.person}>
                  <Avatar person={p} size={30} onAir={Boolean(shares?.screen || shares?.camera)} />
                  <span className={styles.who}>
                    <b>{p.name}</b>
                    {p.id === meId && <span className={styles.you}> (you)</span>}
                    <small>{noteOf(p)}</small>
                  </span>
                  <span className={styles.icons}>
                    {(["screen", "camera"] as const)
                      .filter((kind) => shares?.[kind])
                      .map((kind) => (
                        <span
                          key={kind}
                          className={styles.icon}
                          role="img"
                          aria-label={kind === "screen" ? "Screen" : "Camera"}
                        >
                          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
                            <path
                              d={icon[kind]}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </DropdownSection>
        {seats && <DropdownSection className={styles.foot}>{queue}</DropdownSection>}
      </Dropdown>
    </div>
  );
}
