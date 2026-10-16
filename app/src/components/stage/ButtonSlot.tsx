import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./PlayerButtons.module.css";

/** A slot's width and gap change in this long; its fade follows the design (spec 0106). */
export const SLOT_MS = 220;

type Phase = "in" | "entering" | "leaving";

/**
 * A round button that comes and goes (the volume and the settings while watching someone,
 * the microphone while sharing): its width and its gap open or close in 220 ms while it
 * fades in or out, so its neighbours slide instead of jumping. While it goes it stays drawn,
 * out of reach. The row holds the button under the pointer still while it does
 * (`usePinnedRow`).
 */
export function ButtonSlot({ shown, side, children }: {
  shown: boolean;
  /** Which edge of the row it sits at: its gap closes on the other side. */
  side: "start" | "end";
  children: ReactNode;
}) {
  const [present, setPresent] = useState(shown);
  const [phase, setPhase] = useState<Phase>("in");
  const [open, setOpen] = useState(shown);
  const [width, setWidth] = useState<number | null>(null);
  const kept = useRef<ReactNode>(children);
  const inner = useRef<HTMLDivElement>(null);
  // The value it last acted on: a repeated effect (React's StrictMode) isn't a change.
  const last = useRef(shown);
  if (shown) kept.current = children;

  useLayoutEffect(() => {
    if (last.current === shown) return;
    last.current = shown;
    if (shown) {
      setPresent(true);
      setPhase("entering");
      setOpen(false);
    } else {
      setWidth(inner.current?.offsetWidth ?? null);
      setPhase("leaving");
      setOpen(true);
    }
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
