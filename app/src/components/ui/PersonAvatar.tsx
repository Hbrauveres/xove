import { useState } from "react";
import styles from "./PersonAvatar.module.css";

type Props = {
  name: string | null;
  email: string;
  src: string | null;
  size?: number;
};

/** A real user's Google photo, falling back to their initial. */
export function PersonAvatar({ name, email, src, size = 36 }: Props) {
  const [broken, setBroken] = useState(false);
  const label = name || email;
  const initial = label.charAt(0).toUpperCase();

  if (src && !broken) {
    return (
      <img
        className={styles.avatar}
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className={`${styles.avatar} ${styles.initial}`} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {initial}
    </span>
  );
}
