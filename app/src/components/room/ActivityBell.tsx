import { useRef, useState } from "react";
import type { ActivityEvent, Friend, StreamKind } from "../../types";
import { Dropdown, DropdownSection } from "../ui/Dropdown";
import { ActivityList } from "./ActivityList";
import styles from "./ActivityBell.module.css";

type Props = {
  /** Oldest first. */
  events: ActivityEvent[];
  people: Friend[];
  meId: string;
  isLive: (personId: string, kind: StreamKind) => boolean;
  watching: { personId: string; kind: StreamKind } | null;
  onWatch: (personId: string, kind: StreamKind) => void;
};

const NOTHING_NEW: ReadonlySet<string> = new Set();

/**
 * The phone's activity (spec 0158): a plain bell in the top bar that opens the same list as
 * the desktop's pill. It never counts or marks what's new.
 */
export function ActivityBell({ events, people, meId, isLive, watching, onWatch }: Props) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };

  return (
    <div ref={anchor} className={styles.wrap}>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-label="Activity"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path
            d="M5 13V9a5 5 0 0 1 10 0v4l1.5 2h-13zM8 17a2 2 0 0 0 4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown open={open} label="Activity" anchor={anchor} onClose={close}>
        <DropdownSection scroll>
          <ActivityList
            events={events}
            people={people}
            meId={meId}
            unseen={NOTHING_NEW}
            isLive={isLive}
            watching={watching}
            onWatch={(personId, kind) => {
              onWatch(personId, kind);
              close(true);
            }}
          />
        </DropdownSection>
      </Dropdown>
    </div>
  );
}
