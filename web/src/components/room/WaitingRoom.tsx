import type { RoomSeat } from "../../hooks/useRoomSeat";
import { Button } from "../ui/Button";
import { SeatOffer } from "./SeatOffer";
import styles from "./WaitingRoom.module.css";

type Props = {
  seat: RoomSeat;
  onSignOut: () => void;
};

/**
 * The room is full (20 people, spec 0060): my place in the queue, in order of arrival.
 * When a seat frees, a popup offers it to me.
 */
export function WaitingRoom({ seat, onSignOut }: Props) {
  const status = seat.status;

  const body = () => {
    if (status === null) return <p className={styles.text}>Looking for a seat…</p>;
    if (status.status === "left") {
      return (
        <>
          <h1 className={styles.title}>You left the queue</h1>
          <p className={styles.text}>Join it again whenever you like: you'll go to the end of the line.</p>
          <div className={styles.actions}>
            <Button onClick={seat.rejoin}>Join the queue again</Button>
          </div>
        </>
      );
    }
    const place = status.status === "waiting" ? status.place : 1;
    return (
      <>
        <h1 className={styles.title}>The room is full</h1>
        <p className={styles.text}>
          {place === 1 ? "You're next in line." : `You're number ${place} in line.`} Keep this page open: when a seat
          frees, a popup asks you to enter.
        </p>
      </>
    );
  };

  return (
    <main className={styles.wrap}>
      <section className={styles.card} role="status" aria-live="polite">
        {body()}
        {seat.error && <p className={styles.error}>{seat.error}</p>}
      </section>
      <button type="button" className={styles.signOut} onClick={onSignOut}>
        Sign out
      </button>
      {status?.status === "offered" && <SeatOffer until={status.until} onEnter={seat.accept} onCancel={seat.cancel} />}
    </main>
  );
}
