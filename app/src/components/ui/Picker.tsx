import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import styles from "./Picker.module.css";

export type PickerOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  /** Its name for screen readers; the pill reads "<label>: <chosen>". */
  label: string;
  options: readonly PickerOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * In a panel the list opens in place, pushing what's under it down, in the pill's own
   * colour; over the video it grows upward, floating, in the pill's glass.
   */
  opens?: "in-place" | "up";
  look?: "panel" | "glass";
  disabled?: boolean;
  /** Told when the list opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** True closes the list (its drop-up was left). */
  closed?: boolean;
};

/**
 * The app's picker (the Player controls design, decisions 4 and 5): a pill showing the
 * chosen option that grows into one box with the other options, no gap and no separate
 * floating box. The chosen option stays in the pill and isn't repeated. Rows are as tall as
 * the pill; after three and a half the list scrolls, with no scrollbar.
 */
export function Picker<T extends string>({
  label,
  options,
  value,
  onChange,
  opens = "in-place",
  look = "panel",
  disabled = false,
  onOpenChange,
  closed = false,
}: Props<T>) {
  const [open, setOpenState] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const chosen = options.find((o) => o.value === value) ?? options[0];
  const others = options.filter((o) => o !== chosen);

  const setOpen = setOpenState;

  // Tells whoever listens each time it opens or closes, however it happened (its drop-up
  // left, a press outside), and that it's closed when it goes away open.
  const told = useRef(false);
  const tell = useRef(onOpenChange);
  useEffect(() => {
    tell.current = onOpenChange;
  });
  useEffect(() => {
    if (open === told.current) return;
    told.current = open;
    tell.current?.(open);
  }, [open]);
  useEffect(
    () => () => {
      if (told.current) tell.current?.(false);
      told.current = false;
    },
    [],
  );

  // Closed from outside (its drop-up was left).
  const [wasClosed, setWasClosed] = useState(closed);
  if (closed !== wasClosed) {
    setWasClosed(closed);
    if (closed && open) setOpenState(false);
  }

  // A press anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenState(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const optionsIn = () => [...(root.current?.querySelectorAll<HTMLButtonElement>("[role=radio]") ?? [])];

  // Opened upward: no taller than the room above it, up to whatever clips it (a short stage
  // on a phone); the rest scrolls, as always.
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = list.current;
    if (!open || opens !== "up" || !el) return;
    let clip: Element | null = root.current?.parentElement ?? null;
    while (clip && getComputedStyle(clip).overflow === "visible" && getComputedStyle(clip).overflowY === "visible") clip = clip.parentElement;
    const top = clip ? clip.getBoundingClientRect().top : 0;
    const room = (root.current?.getBoundingClientRect().top ?? 0) - top - 8;
    el.style.maxHeight = room > 0 ? `min(${Math.floor(room)}px, calc(var(--ctl, 38px) * 3.5))` : "";
  }, [open, opens]);

  // Opened by the keyboard: its first option takes the focus once it's drawn.
  const focusFirst = useRef(false);
  useEffect(() => {
    if (!open || !focusFirst.current) return;
    focusFirst.current = false;
    optionsIn()[0]?.focus();
  });


  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      pill.current?.focus();
      return;
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    if (!open) {
      setOpen(true);
      focusFirst.current = true;
      return;
    }
    const all = optionsIn();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    all[Math.min(all.length - 1, Math.max(0, at + step))]?.focus();
  };

  const pick = (next: T) => {
    setOpen(false);
    onChange(next);
    pill.current?.focus();
  };

  return (
    <div
      ref={root}
      className={styles.picker}
      data-picker
      data-opens={opens}
      data-look={look}
      data-open={open || undefined}
      onKeyDown={onKeyDown}
    >
      <button
        ref={pill}
        type="button"
        className={styles.pill}
        aria-label={`${label}: ${chosen?.label ?? ""}`}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.chosen}>{chosen?.label}</span>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className={styles.chevron}>
          <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div ref={list} id={listId} role="radiogroup" aria-label={label} className={styles.list}>
          {others.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked="false" className={styles.option} onClick={() => pick(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
