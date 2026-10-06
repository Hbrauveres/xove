import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import styles from "./PlayerMenu.module.css";

type Props = {
  id?: string;
  /** Its name for screen readers, like its button's. */
  label: string;
  /** The button's control: a click there isn't "outside". */
  anchor: RefObject<HTMLElement | null>;
  /** Closes it; `returnFocus` when the keyboard closed it (Escape), so focus goes back to its button. */
  onClose: (returnFocus: boolean) => void;
  children: ReactNode;
};

/**
 * A round button's menu (specs 0098 and 0101): opens on its first item, moves with the
 * arrow keys, closes with Escape, Tab or a click anywhere else.
 */
export function PlayerMenu({ id, label, anchor, onClose, children }: Props) {
  const menu = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    menu.current?.querySelector<HTMLElement>("[role^=menuitem]")?.focus();
  }, []);

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !anchor.current?.contains(target)) close.current(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [anchor]);

  const onKeyDown = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose(true);
    } else if (e.key === "Tab") {
      onClose(false);
    }
  };

  return (
    <div ref={menu} id={id} role="menu" aria-label={label} className={styles.menu} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

/** One set of choices, named for screen readers ("Quality", "Mode", "Camera"). */
export function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className={styles.heading} aria-hidden="true">
        {label}
      </p>
      {children}
    </div>
  );
}

type ItemProps = { busy?: boolean; onSelect: () => void; children: string };

/** A choice; while a request is on its way, it waits (spec 0098 FR-14). */
export function MenuRadio({ checked, busy = false, onSelect, children }: ItemProps & { checked: boolean }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      aria-disabled={busy || undefined}
      tabIndex={-1}
      className={styles.item}
      onClick={() => !busy && onSelect()}
    >
      {children}
    </button>
  );
}

/** An action ("Change window", "Stop sharing"). */
export function MenuItem({
  danger = false,
  busy = false,
  describedBy,
  onSelect,
  children,
}: ItemProps & { danger?: boolean; describedBy?: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={busy || undefined}
      aria-describedby={describedBy}
      tabIndex={-1}
      className={`${styles.item} ${danger ? styles.danger : ""}`}
      onClick={() => !busy && onSelect()}
    >
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <hr className={styles.separator} />;
}

/** A line of explanation; read to screen readers through the item it describes. */
export function MenuNote({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className={styles.note} aria-hidden="true">
      {children}
    </p>
  );
}
