import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import styles from "./DropUp.module.css";

/** How long the pointer rests on the button before the drop-up unrolls. */
export const OPEN_DELAY_MS = 120;
/** A slip of the pointer outside shorter than this doesn't close it. */
export const LEAVE_GRACE_MS = 300;
/** By touch: how long a press is held on the button to open it (a long press, as on any phone). */
export const HOLD_MS = 500;
/** By touch: a finger that moves further than this is scrolling, not holding. */
const HOLD_SLOP_PX = 10;
/** A finger or a pen; anything else (a mouse, or a browser that doesn't say) hovers. */
const touchLike = (e: ReactPointerEvent) => e.pointerType === "touch" || e.pointerType === "pen";

type Props = {
  /** Its name for screen readers. */
  label: string;
  /** Only while its stream is live. */
  enabled: boolean;
  /** The round button it belongs to; a click or a tap on it does what it always does. */
  trigger: ReactNode;
  /** Told when it closes because the pointer left (a picker inside closes too). */
  onLeave?: () => void;
  /** Its width, when not the usual 228 px. */
  width?: number;
  /** A new value closes it: its action is done (a camera picked, Change). */
  closeSignal?: number;
  children: ReactNode;
};

/**
 * Quick access over a live round button (the Player controls design, decision 3).
 * With a mouse: resting on the button unrolls one frosted pill above it, centred, after a
 * short pause; moving up into it keeps it open (the gap is bridged); leaving closes it, even
 * right after a click, with a short grace for a slip. The keyboard's focus opens it too.
 * By touch: a press held on the button opens it instead, and it stays until a tap outside,
 * its action done, or the button pressed again. A plain click or tap still does what the
 * button does.
 */
export function DropUp({ label, enabled, trigger, onLeave, width, closeSignal, children }: Props) {
  const [open, setOpen] = useState(false);
  // Opened by a finger: pinned until a tap outside or its action is done.
  const [byTouch, setByTouch] = useState(false);
  const opening = useRef<number | undefined>(undefined);
  const leaving = useRef<number | undefined>(undefined);
  const holding = useRef<{ timer: number; x: number; y: number } | null>(null);
  // The tap that ends a hold (or closes it again) isn't a tap on the button.
  const swallow = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const clear = () => {
    window.clearTimeout(opening.current);
    window.clearTimeout(leaving.current);
    if (holding.current) window.clearTimeout(holding.current.timer);
    holding.current = null;
  };
  useEffect(() => clear, []);

  // The stream stopped, or its action is done: closed.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  const [lastSignal, setLastSignal] = useState(closeSignal);
  if (enabled !== wasEnabled || closeSignal !== lastSignal) {
    setWasEnabled(enabled);
    setLastSignal(closeSignal);
    if (open) {
      setOpen(false);
      setByTouch(false);
    }
  }

  // Pinned open by a finger: a press anywhere else closes it.
  useEffect(() => {
    if (!open || !byTouch) return;
    const away = (e: PointerEvent) => {
      if (root.current?.contains(e.target as Node)) return;
      setOpen(false);
      setByTouch(false);
      onLeave?.();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, byTouch, onLeave]);

  const close = () => {
    clear();
    setOpen(false);
    setByTouch(false);
    onLeave?.();
  };

  // ---- a mouse
  const onPointerEnter = (e: ReactPointerEvent) => {
    if (touchLike(e)) return;
    window.clearTimeout(leaving.current);
    if (open) return;
    opening.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };
  const onPointerLeave = (e: ReactPointerEvent) => {
    if (touchLike(e) || byTouch) return;
    window.clearTimeout(opening.current);
    leaving.current = window.setTimeout(close, LEAVE_GRACE_MS);
  };

  // ---- a finger (or a pen): press and hold the button
  const onTriggerDown = (e: ReactPointerEvent) => {
    if (!touchLike(e)) return;
    if (open && byTouch) {
      // Pressed again: closes, and this tap doesn't stop the stream.
      swallow.current = true;
      close();
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    const timer = window.setTimeout(() => {
      holding.current = null;
      swallow.current = true;
      setByTouch(true);
      setOpen(true);
    }, HOLD_MS);
    holding.current = { timer, x, y };
  };
  const onTriggerMove = (e: ReactPointerEvent) => {
    const hold = holding.current;
    if (!hold || Math.hypot(e.clientX - hold.x, e.clientY - hold.y) <= HOLD_SLOP_PX) return;
    window.clearTimeout(hold.timer);
    holding.current = null;
  };
  const onTriggerUp = () => {
    if (!holding.current) return;
    window.clearTimeout(holding.current.timer);
    holding.current = null;
  };
  const onTriggerClick = (e: ReactMouseEvent) => {
    if (!swallow.current) return;
    swallow.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // ---- the keyboard: only its focus opens it; a click's focus doesn't keep it open
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
    if (byTouch) return;
    if (!root.current?.contains(e.relatedTarget as Node | null) && !root.current?.matches(":hover")) setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !open) return;
    // Back to the button first: its focus would otherwise open it again.
    root.current?.querySelector<HTMLElement>("[data-dropup-trigger] button")?.focus();
    close();
  };

  // Always the same wrapper around the button, so it keeps the keyboard's focus when its
  // stream starts or stops; only the drop-up and its handlers come and go.
  if (!enabled) {
    return (
      <div className={styles.wrap}>
        <div className={styles.trigger} data-dropup-trigger>
          {trigger}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={root}
      className={styles.wrap}
      data-dropup
      data-open={open}
      data-touch={byTouch || undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <div
        className={styles.trigger}
        data-dropup-trigger
        onPointerDown={onTriggerDown}
        onPointerMove={onTriggerMove}
        onPointerUp={onTriggerUp}
        onPointerCancel={onTriggerUp}
        onClickCapture={onTriggerClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {trigger}
      </div>
      <div
        className={styles.dropup}
        role="group"
        aria-label={label}
        inert={!open || undefined}
        style={width ? ({ "--dropup-width": `${width}px` } as CSSProperties) : undefined}
      >
        {children}
      </div>
    </div>
  );
}
