import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import styles from "./DropUp.module.css";

/** How long the pointer rests on the button before the drop-up unrolls. */
export const OPEN_DELAY_MS = 120;
/** A slip of the pointer outside shorter than this doesn't close it. */
export const LEAVE_GRACE_MS = 300;

/** Whether this device has a pointer that can rest on things (a mouse), not only touch. */
function canHover() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(hover: hover)").matches;
}

type Props = {
  /** Its name for screen readers. */
  label: string;
  /** Only while its stream is live. */
  enabled: boolean;
  /** The round button it belongs to; a click on it does what it always does. */
  trigger: ReactNode;
  /** Told when it closes because the pointer left (a picker inside closes too). */
  onLeave?: () => void;
  children: ReactNode;
};

/**
 * Quick access over a live round button (the Player controls design, decision 3): resting
 * the pointer on the button unrolls one frosted pill above it, centred, after a short pause.
 * Moving up into it keeps it open (the gap is bridged); leaving closes it, even right after a
 * click, with a short grace for a slip. The keyboard's focus opens it too. Never on a touch
 * screen: there, the settings panel has the same controls.
 */
export function DropUp({ label, enabled, trigger, onLeave, children }: Props) {
  const [open, setOpen] = useState(false);
  const [hover] = useState(canHover);
  const opening = useRef<number | undefined>(undefined);
  const leaving = useRef<number | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);

  const clear = () => {
    window.clearTimeout(opening.current);
    window.clearTimeout(leaving.current);
  };
  useEffect(() => clear, []);

  // The stream stopped: nothing to show.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    if (!enabled) setOpen(false);
  }

  if (!hover || !enabled) return <>{trigger}</>;

  const close = () => {
    clear();
    setOpen(false);
    onLeave?.();
  };
  const onPointerEnter = () => {
    window.clearTimeout(leaving.current);
    if (open) return;
    opening.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };
  const onPointerLeave = () => {
    window.clearTimeout(opening.current);
    leaving.current = window.setTimeout(close, LEAVE_GRACE_MS);
  };
  // Only the keyboard's focus opens it: a click's focus doesn't keep it open.
  const onFocus = (e: FocusEvent) => {
    let keyboard = false;
    try {
      keyboard = (e.target as Element).matches(":focus-visible");
    } catch {
      keyboard = false;
    }
    if (keyboard) setOpen(true);
  };
  const onBlur = (e: FocusEvent) => {
    if (!root.current?.contains(e.relatedTarget as Node | null) && !root.current?.matches(":hover")) setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !open) return;
    // Back to the button first: its focus would otherwise open it again.
    root.current?.querySelector<HTMLElement>("[data-dropup-trigger] button")?.focus();
    close();
  };

  return (
    <div
      ref={root}
      className={styles.wrap}
      data-dropup
      data-open={open}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <div className={styles.trigger} data-dropup-trigger>
        {trigger}
      </div>
      <div className={styles.dropup} role="group" aria-label={label} inert={!open || undefined}>
        {children}
      </div>
    </div>
  );
}
