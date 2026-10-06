import type { Friend } from "../../types";
import styles from "./Avatar.module.css";

type Props = {
  person: Friend;
  size?: number;
  /** Amber ring when this person is on air. */
  onAir?: boolean;
  /** Where the ring goes: around the avatar, or inside its edge, so it lines up with what's beside it (spec 0107). */
  ring?: "outside" | "inside";
};

export function Avatar({ person, size = 32, onAir = false, ring = "outside" }: Props) {
  const initial = person.name.charAt(0).toUpperCase();
  return (
    <span
      className={`${styles.avatar} ${onAir ? (ring === "inside" ? styles.onAirInside : styles.onAir) : ""}`}
      data-ring={onAir ? ring : undefined}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        // As in the room's design (spec 0104): a clear colour per person, white initials.
        background: `hsl(${person.hue} 42% 38%)`,
        color: "#fff",
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
