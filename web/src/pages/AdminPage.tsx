import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../api/client";
import type { AccessRequestView, MemberView } from "../api/types";
import { Button } from "../components/ui/Button";
import { PersonAvatar } from "../components/ui/PersonAvatar";
import { timeAgo } from "../hooks/useElapsed";
import styles from "./AdminPage.module.css";

type Data = { requests: AccessRequestView[]; members: MemberView[] };

/** Who's waiting to get in, and who's in. Only admins reach this page. */
export function AdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [requests, members] = await Promise.all([api.admin.pendingRequests(), api.admin.members()]);
      setData({ requests, members });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the admin data.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Runs one action, shows its error if any, then reloads both lists. */
  const act = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    } finally {
      setBusyKey(null);
      setConfirmRemove(null);
      await load();
    }
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          kryora<span className={styles.dot}>.</span> <span className={styles.section}>admin</span>
        </span>
        <Link to="/room" className={styles.back}>
          Back to the room
        </Link>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!data ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <div className={styles.columns}>
          <section aria-labelledby="requests-title">
            <h2 id="requests-title" className={styles.heading}>
              Waiting for access <span className={styles.count}>{data.requests.length}</span>
            </h2>
            {data.requests.length === 0 ? (
              <p className={styles.empty}>No one is waiting right now.</p>
            ) : (
              <ul className={styles.list}>
                {data.requests.map((r) => (
                  <li key={r.id} className={styles.request}>
                    <div className={styles.person}>
                      <PersonAvatar name={r.name} email={r.email} src={r.avatarUrl} />
                      <div className={styles.who}>
                        <span className={styles.name}>{r.name ?? r.email}</span>
                        <span className={styles.email}>{r.email}</span>
                      </div>
                      <time className={styles.time} dateTime={r.createdAt}>
                        {timeAgo(Date.parse(r.createdAt))}
                      </time>
                    </div>
                    {r.message && <p className={styles.message}>“{r.message}”</p>}
                    <div className={styles.actions}>
                      <Button
                        size="sm"
                        onClick={() => act(`approve-${r.id}`, () => api.admin.approve(r.id))}
                        disabled={busyKey !== null}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => act(`decline-${r.id}`, () => api.admin.decline(r.id))}
                        disabled={busyKey !== null}
                      >
                        Decline
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="members-title">
            <h2 id="members-title" className={styles.heading}>
              Members <span className={styles.count}>{data.members.length}</span>
            </h2>
            <ul className={styles.list}>
              {data.members.map((m) => (
                <li key={m.id} className={styles.member}>
                  <PersonAvatar name={m.name} email={m.email} src={m.avatarUrl} size={32} />
                  <div className={styles.who}>
                    <span className={styles.name}>{m.name ?? m.email}</span>
                    <span className={styles.email}>{m.email}</span>
                  </div>
                  {m.admin ? (
                    <span className={styles.badge}>Admin</span>
                  ) : confirmRemove === m.id ? (
                    <span className={styles.confirm}>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => act(`remove-${m.id}`, () => api.admin.removeMember(m.id))}
                        disabled={busyKey !== null}
                      >
                        Remove {m.name?.split(" ")[0] ?? "member"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(m.id)}>
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <p className={styles.hint}>Removing someone signs them out everywhere. They can ask for access again.</p>
          </section>
        </div>
      )}
    </div>
  );
}
