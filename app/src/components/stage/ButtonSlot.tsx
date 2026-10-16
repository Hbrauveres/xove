import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./PlayerButtons.module.css";

/** A slot's width and gap change in this long; its fade follows the design (spec 0106). */
export const SLOT_MS = 220;

type Phase = "in" | "entering" | "leaving";

/**
 * A round button that comes and goes (the volume and the settings while watching someone,
 * the microphone while sharing): its width and its gap open or close in 220 ms while it
 * fades in or out, so its neighbours slide instead of jumping. While it goes it stays drawn,
 * out of reach. `onChange` tells the row a change is starting, so it can hold the button
 * under the pointer still.
 */
export function ButtonSlot({ shown, side, onChange, children }: {
  shown: boolean;
  /** Which edge of the row it sits at: its gap closes on the other side. */
  side: "start" | "end";
  onChange?: () => void;
  children: ReactNode;
}) {
  const [present, setPresent] = useState(shown);
  const [phase, setPhase] = useState<Phase>("in");
  const [open, setOpen] = useState(shown);
  const [width, setWidth] = useState<number | null>(null);
  const kept = useRef<ReactNode>(children);
  const inner = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  if (shown) kept.current = children;

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChange?.();
    if (shown) {
      setPresent(true);
      setPhase("entering");
      setOpen(false);
    } else {
      setWidth(inner.current?.offsetWidth ?? null);
      setPhase("leaving");
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a change of `shown` starts one
  }, [shown]);

  // One frame later the slot opens (or closes) to its measured width; then it settles.
  useLayoutEffect(() => {
    if (phase === "in") return;
    if (phase === "entering") setWidth(inner.current?.offsetWidth ?? null);
    const next = requestAnimationFrame(() => setOpen(phase === "entering"));
    const done = window.setTimeout(() => {
      if (phase === "leaving") setPresent(false);
      setPhase("in");
    }, SLOT_MS);
    return () => {
      cancelAnimationFrame(next);
      window.clearTimeout(done);
    };
  }, [phase]);

  if (!present) return null;
  const leaving = phase === "leaving";
  return (
    <div
      className={styles.slot}
      data-slot={phase}
      data-side={side}
      data-open={open || undefined}
      style={phase === "in" ? undefined : { width: open ? (width ?? undefined) : 0 }}
      aria-hidden={leaving || undefined}
      inert={leaving || undefined}
    >
      <div ref={inner} className={styles.slotInner}>
        {kept.current}
      </div>
    </div>
  );
}
