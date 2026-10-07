import type { ReactNode } from "react";
import { XoveMark } from "../brand/XoveMark";
import styles from "./RoomHeader.module.css";

/**
 * The room's header (spec 0104), full width and see-through: the mark (spec 0111) on the left, the
 * activity pill in the middle, people and my account on the right.
 */
export function RoomHeader({ middle, right }: { middle: ReactNode; right: ReactNode }) {
  return (
    <header className={styles.header}>
      <span className={styles.logo}>
        <XoveMark height={32} />
      </span>
      <div className={styles.middle}>{middle}</div>
      <div className={styles.right}>{right}</div>
    </header>
  );
}
