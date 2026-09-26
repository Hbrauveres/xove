import type { ReactNode } from "react";
import styles from "./FullPageMessage.module.css";

export function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <main className={styles.wrap} role="status">
      {children}
    </main>
  );
}
