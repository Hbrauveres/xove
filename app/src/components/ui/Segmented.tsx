import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import styles from "./Segmented.module.css";

export type SegmentOption<T extends string> = { value: T; label: string; title?: string };

type Props<T extends string> = {
  /** Its name for screen readers. */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/**
 * The app's segmented control (Quality, Mode): a radio group drawn as a track with a dark
 * pill that slides to the chosen option. An option pointed at gets a soft horizontal light;
 * the chosen one doesn't react. The arrow keys move the choice, with one tab stop.
 */
export function Segmented<T extends string>({ label, options, value, onChange, disabled = false }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = Math.max(0, options.findIndex((o) => o.value === value));

  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (at + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={styles.seg}
      style={{ "--n": options.length, "--i": at } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <span className={styles.pill} aria-hidden="true" />
      {options.map((o, i) => {
        const chosen = i === at;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={chosen}
            tabIndex={chosen ? 0 : -1}
            title={o.title}
            disabled={disabled}
            onClick={() => {
              if (!chosen) onChange(o.value);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
