import { Link } from "react-router";
import type { ConnectionState, Friend } from "../../types";
import { Avatar } from "../ui/Avatar";
import styles from "./AppHeader.module.css";

type Props = {
  me: Friend;
  connection: ConnectionState;
  onlineCount: number;
  onSignOut: () => void;
  isAdmin?: boolean;
};

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Video offline",
};

export function AppHeader({ me, connection, onlineCount, onSignOut, isAdmin = false }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.wordmark}>
          xovê<span className={styles.dot}>.</span>
        </span>
        <span className={styles.domain}>xove.app</span>
      </div>

      <div className={styles.meta}>
        <span
          className={`${styles.status} ${connection === "connected" ? styles.ok : styles.warn}`}
          role="status"
        >
          <span className={styles.statusDot} aria-hidden="true" />
          {CONNECTION_LABEL[connection]}
        </span>
        <span className={styles.count}>{onlineCount} here</span>
        <span className={styles.user}>
          <Avatar person={me} size={28} />
          <span className={styles.userName}>{me.name}</span>
        </span>
        {isAdmin && (
          <Link to="/admin" className={styles.adminLink}>
            Admin
          </Link>
        )}
        <button type="button" className={styles.signOut} onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
