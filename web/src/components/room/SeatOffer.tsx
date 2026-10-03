import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import styles from "./SeatOffer.module.css";

type Props = {
  /** Seconds left before the seat goes to the next person, as the API counted them. */
  seconds: number;
  onEnter: () => void;
  onCancel: () => void;
};


/**
 * A seat is free for me (spec 0060): enter within the time, or cancel. With no answer,
 * the API moves me to the end of the queue and offers the seat to the next person.
 */
export function SeatOffer({ seconds, onEnter, onCancel }: Props) {
  const [left, setLeft] = useState(seconds);
  const windowRef = useRef<HTMLDivElement>(null);

  // Counted from when the answer arrived, on this browser's own clock (a wrong clock
  // can't shorten it). Every poll brings the API's count again.
  useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  // The tab may be in the background: its title says it's my turn.
  useEffect(() => {
    const before = document.title;
    document.title = "Your turn — Xovê";
    return () => {
      document.title = before;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    // Modal: Tab moves between its two buttons only.
    const buttons = [...(windowRef.current?.querySelectorAll<HTMLElement>("button") ?? [])];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className={styles.backdrop} onKeyDown={onKeyDown}>
      <div
        ref={windowRef}
        className={styles.window}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seat-offer-title"
        aria-describedby="seat-offer-text"
      >
        <h2 id="seat-offer-title" className={styles.title}>
          It's your turn
        </h2>
        <p id="seat-offer-text" className={styles.text}>
          A seat in the room is free for you. Enter within <strong>{left} seconds</strong>, or it goes to the next
          person and you go to the end of the line.
        </p>
        <div className={styles.actions}>
          <Button autoFocus onClick={onEnter}>
            Enter room
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
