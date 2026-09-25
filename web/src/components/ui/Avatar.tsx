import type { Friend } from "../../types";
import styles from "./Avatar.module.css";

type Props = {
  person: Friend;
  size?: number;
  /** Amber ring when this person is on air. */
  onAir?: boolean;
};

export function Avatar({ person, size = 32, onAir = false }: Props) {
  const initial = person.name.charAt(0).toUpperCase();
  return (
    <span
      className={`${styles.avatar} ${onAir ? styles.onAir : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `hsl(${person.hue} 32% 28%)`,
        color: `hsl(${person.hue} 70% 82%)`,
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
