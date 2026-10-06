import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import styles from "./Dropdown.module.css";

/** How long the roll takes; the panel leaves the page once it's rolled up. */
const ROLL_MS = 260;
/** Opening one panel closes the others. */
const OPENED = "xove:dropdown-opened";

type Props = {
  open: boolean;
  /** Closes it; `returnFocus` when the keyboard closed it (Escape), so its button gets the focus back. */
  onClose: (returnFocus: boolean) => void;
  /** Its button's wrapper: a click there isn't "outside". */
  anchor: RefObject<HTMLElement | null>;
  /** Its name for screen readers. */
  label: string;
  /** "menu" for a list of actions (account), "dialog" for a panel of content (activity, people). */
  role?: "menu" | "dialog";
  /** Under the end of its button (the right side), or centred under it. */
  align?: "end" | "center";
  className?: string;
  children: ReactNode;
};

/**
 * The room's floating panel (spec 0104): frosted sections with clear cuts between them, that
 * unroll downward and roll back up. One open at a time; a click outside or Escape closes it.
 */
export function Dropdown({ open, onClose, anchor, label, role = "dialog", align = "end", className, children }: Props) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Stays on the page while it rolls up.
  const [mounted, setMounted] = useState(open);
  const [unrolled, setUnrolled] = useState(false);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  if (open && !mounted) setMounted(true);
  if (!open && unrolled) setUnrolled(false);
  const rolledOut = unrolled && open;

  useEffect(() => {
    if (open) {
      // One frame rolled up, then unroll: the height has something to animate from.
      const frame = requestAnimationFrame(() => setUnrolled(true));
      return () => cancelAnimationFrame(frame);
    }
    const timer = window.setTimeout(() => setMounted(false), ROLL_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Opening: tell the others, take the focus, and listen for clicks outside.
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(OPENED, { detail: id }));
    const first = panel.current?.querySelector<HTMLElement>(role === "menu" ? "[role^=menuitem]" : "[data-autofocus]");
    (first ?? panel.current)?.focus();
    const other = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) close.current(false);
    };
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !anchor.current?.contains(target)) close.current(false);
    };
    window.addEventListener(OPENED, other);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener(OPENED, other);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, id, role, anchor]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose(true);
      return;
    }
    if (role !== "menu" || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    const items = [...(panel.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  if (!mounted) return null;
  return (
    <div
      ref={panel}
      id={id}
      role={role}
      aria-label={label}
      tabIndex={-1}
      className={[styles.panel, styles[align], className].filter(Boolean).join(" ")}
      // The roll is the height only: a clip, fade or filter would stop the sections' blur.
      style={{ gridTemplateRows: rolledOut ? "1fr" : "0fr" }}
      data-rolled={rolledOut ? "out" : "up"}
      onKeyDown={onKeyDown}
    >
      <div className={styles.roll}>{children}</div>
    </div>
  );
}

/** One frosted section of a dropdown; `scroll` for a list that may be long. */
export function DropdownSection({
  scroll = false,
  className,
  children,
}: {
  scroll?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={[styles.section, scroll ? styles.scroll : "", className].filter(Boolean).join(" ")}>{children}</div>
  );
}
