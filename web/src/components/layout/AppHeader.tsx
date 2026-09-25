import type { ConnectionState, Friend } from "../../types";
import { Avatar } from "../ui/Avatar";
import styles from "./AppHeader.module.css";

type Props = {
  me: Friend;
  connection: ConnectionState;
  onlineCount: number;
  onSignOut: () => void;
};

export function AppHeader({ me, connection, onlineCount, onSignOut }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.wordmark}>
          xovê<span className={styles.dot}>.</span>
        </span>
        <span className={styles.domain}>live.hbrauveres.dev</span>
      </div>

      <div className={styles.meta}>
        <span
          className={`${styles.status} ${connection === "connected" ? styles.ok : styles.warn}`}
          role="status"
        >
          <span className={styles.statusDot} aria-hidden="true" />
          {connection === "connected" ? "Connected" : "Reconnecting…"}
        </span>
        <span className={styles.count}>{onlineCount} here</span>
        <span className={styles.user}>
          <Avatar person={me} size={28} />
          <span className={styles.userName}>{me.name}</span>
        </span>
        <button type="button" className={styles.signOut} onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
