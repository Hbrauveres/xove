import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api, ApiError } from "../api/client";
import type { Me } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../components/ui/Button";
import { PersonAvatar } from "../components/ui/PersonAvatar";
import styles from "./RequestAccessPage.module.css";
import { XoveMark } from "../components/brand/XoveMark";

const MAX_MESSAGE = 500;
const POLL_MS = 20_000;

/** "You need access", like Google Drive's: ask once, then wait for the owner. */
export function RequestAccessPage() {
  const { state, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const me = state.status === "signedIn" ? state.me : null;

  // While waiting, check every 20 s so an approval takes the person straight to the room.
  useEffect(() => {
    if (me?.status !== "PENDING") return;
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [me?.status, refresh]);

  if (!me) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <main className={styles.wrap}>
      <section className={styles.card}>
        <p className={styles.brand}>
          <XoveMark height={36} />
        </p>

        {me.status === "PENDING" ? <Waiting /> : <AskForAccess me={me} onSent={refresh} />}

        <div className={styles.account}>
          <PersonAvatar name={me.name} email={me.email} src={me.avatarUrl} size={32} />
          <div className={styles.accountText}>
            <span className={styles.accountLabel}>Signed in as</span>
            <span className={styles.accountEmail}>{me.email}</span>
          </div>
          <button type="button" className={styles.link} onClick={handleSignOut}>
            Use another account
          </button>
        </div>
      </section>
    </main>
  );
}

function AskForAccess({ me, onSent }: { me: Me; onSent: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const declined = me.status === "DECLINED";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.requestAccess(message);
      await onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your request. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <h1 className={styles.title}>{declined ? "Your request was declined" : "You need access"}</h1>
      <p className={styles.copy}>
        {declined
          ? "The owner declined your last request. If you think that was a mistake, you can ask again with a note."
          : "Xovê is invite only. Ask for access and the owner will get your request."}
      </p>

      <form className={styles.form} onSubmit={submit}>
        <label htmlFor="access-message" className={styles.label}>
          Message <span className={styles.optional}>(optional)</span>
        </label>
        <textarea
          id="access-message"
          className={styles.textarea}
          rows={3}
          maxLength={MAX_MESSAGE}
          placeholder="Hey, it's me from…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className={styles.formFooter}>
          <span className={styles.counter}>
            {message.length}/{MAX_MESSAGE}
          </span>
          <Button type="submit" disabled={sending}>
            {sending ? "Sending…" : declined ? "Ask again" : "Request access"}
          </Button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </>
  );
}

function Waiting() {
  return (
    <>
      <h1 className={styles.title}>Request sent</h1>
      <p className={styles.copy}>
        The owner has your request. Keep this page open: it moves you into the room as soon as you're approved.
      </p>
      <p className={styles.waiting} role="status">
        <span className={styles.pulse} aria-hidden="true" />
        Waiting for approval
      </p>
    </>
  );
}
