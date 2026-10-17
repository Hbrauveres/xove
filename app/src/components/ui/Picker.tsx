import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import styles from "./Picker.module.css";

export type PickerOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  /** Its name for screen readers; the pill reads "<label>: <chosen>". */
  label: string;
  options: readonly PickerOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * Down, floating over its panel in the pill's own see-through colour (spec 0111), or upward
   * over the video, in the pill's glass. Either way nothing moves when it opens.
   */
  opens?: "down" | "up";
  look?: "panel" | "glass";
  disabled?: boolean;
  /** Told when the list opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** True closes the list (its drop-up was left). */
  closed?: boolean;
};

/** How long the list takes to roll back before it leaves (spec 0111, design decision 9). */
export const CLOSE_MS = 150;
/** The fade under the list, back to fully there (design decision 8). */
const FADE_GAP = 4;
const FADE_PX = 30;

/**
 * The app's picker: a pill showing the chosen option that grows into one box with the other
 * options, no gap. The chosen option stays in the pill and isn't repeated. Rows are as tall as
 * the pill; after three and a half the list scrolls with the app's slim scrollbar (spec 0111).
 * The list floats: in a panel (the nearest `[data-list-host]`), what's right behind it is
 * hidden while it's open and what's just under it fades back in, so it reads as one box with
 * its pill and nothing moves. It unrolls from the pill and rolls back.
 */
export function Picker<T extends string>({
  label,
  options,
  value,
  onChange,
  opens = "down",
  look = "panel",
  disabled = false,
  onOpenChange,
  closed = false,
}: Props<T>) {
  const [open, setOpenState] = useState(false);
  // Drawn while open, and while it rolls back after.
  const [drawn, setDrawn] = useState(false);
  if (open && !drawn) setDrawn(true);
  useEffect(() => {
    if (open || !drawn) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const gone = window.setTimeout(() => setDrawn(false), reduce ? 0 : CLOSE_MS);
    return () => window.clearTimeout(gone);
  }, [open, drawn]);
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
  // Unrolls a frame after it's drawn, so the browser has the rolled-up state to move from.
  const [unrolled, setUnrolled] = useState(false);
  if (!open && unrolled) setUnrolled(false);
  useEffect(() => {
    if (!open) return;
    const next = requestAnimationFrame(() => setUnrolled(true));
    return () => cancelAnimationFrame(next);
  }, [open]);
  // Over its panel: what's right behind the list is masked away while it's open, and what's
  // just under it comes back over 30 px, nearly invisible near the list (design decisions 7, 8).
  // Measured when it opens; kept until it has rolled back, so nothing shows through it on the way.
  const masked = useRef<HTMLElement[]>([]);
  const unmask = () => {
    masked.current.forEach((node) => {
      node.style.maskImage = "";
      node.style.removeProperty("-webkit-mask-image");
    });
    masked.current = [];
  };
  useLayoutEffect(() => {
    const el = list.current;
    const host = root.current?.closest("[data-list-host]");
    if (!open || opens !== "down" || !el || !host || !root.current) return;
    unmask();
    const l = el.getBoundingClientRect();
    // Each sibling it overlaps gets a band across its whole width: fine while the list is as
    // wide as its column, as in the settings. An inline mask of the element's own would be lost.
    const walk = (parent: Element) =>
      [...parent.children].forEach((child) => {
        const node = child as HTMLElement;
        if (node.contains(root.current)) {
          if (node !== root.current) walk(node);
          return;
        }
        const r = node.getBoundingClientRect();
        if (!(r.right > l.left && r.left < l.right && r.bottom > l.top && r.top < l.bottom + FADE_GAP + FADE_PX)) return;
        const top = l.top - r.top;
        const bottom = l.bottom - r.top + FADE_GAP;
        const mask = `linear-gradient(to bottom, #000 ${top}px, transparent ${top}px, transparent ${bottom}px, rgba(0, 0, 0, 0.08) ${bottom + FADE_PX * 0.5}px, rgba(0, 0, 0, 0.35) ${bottom + FADE_PX * 0.75}px, #000 ${bottom + FADE_PX}px)`;
        node.style.maskImage = mask;
        node.style.setProperty("-webkit-mask-image", mask);
        masked.current.push(node);
      });
    walk(host);
  }, [open, opens]);
  useEffect(() => {
    if (!drawn) unmask();
  }, [drawn]);
  useEffect(() => unmask, []);
  // What the masks were measured against changes (the window, the list of options): it closes.
  const optionsKey = options.map((o) => o.value).join("|");
  const [wasKey, setWasKey] = useState(optionsKey);
  if (optionsKey !== wasKey) {
    setWasKey(optionsKey);
    if (open) setOpenState(false);
  }
  useEffect(() => {
    if (!open) return;
    const close = () => setOpenState(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [open]);
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
      data-open={drawn || undefined}
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
      {drawn && (
        <div
          ref={list}
          id={listId}
          role="radiogroup"
          aria-label={label}
          className={styles.list}
          data-unroll={(open && unrolled) || undefined}
          // Rolling back: still drawn, out of reach.
          aria-hidden={!open || undefined}
          inert={!open || undefined}
        >
          {others.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked="false"
              className={styles.option}
              // The nearest to the pill appears first.
              style={{ "--k": opens === "up" ? others.length - 1 - i : i } as CSSProperties}
              onClick={() => pick(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
