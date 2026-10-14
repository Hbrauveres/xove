import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import type { SeatStatus } from "../api/types";

/** How often the waiting screen asks for its place. The poll also tells the API it's still there. */
export const SEAT_POLL_MS = 2000;

export type RoomSeat = {
  /** Null until the API answers; "left" after Cancel. */
  status: SeatStatus | { status: "left" } | null;
  /** Message from the last failed request, safe to show. */
  error: string | null;
  /** "Enter room" on the popup. */
  accept: () => void;
  /** "Cancel" on the popup: leaves the queue. */
  cancel: () => void;
  /** Joins the queue again after leaving it. */
  rejoin: () => void;
  /**
   * The API forgot my seat (it restarted): ask again, staying in the room if there's one.
   * The video connection, when there is one, confirms the seat.
   */
  reenter: (participantSid?: string) => void;
};

/**
 * My seat in the room, or my place in the queue (spec 0060). The room has 20 seats;
 * whoever comes next waits here, polling, until a seat is offered to them.
 */
export function useRoomSeat(pollMs: number = SEAT_POLL_MS): RoomSeat {
  const [status, setStatus] = useState<RoomSeat["status"]>(null);
  const [error, setError] = useState<string | null>(null);
  // The poll on its way, if any: Cancel waits for it, so it can't put me back in the queue.
  const asking = useRef<Promise<void> | null>(null);
  // Bumped by Enter room and Cancel: an answer already on its way is out of date.
  const generation = useRef(0);

  const enter = useCallback(async (participantSid?: string) => {
    if (asking.current) return;
    const askedIn = generation.current;
    const ask = (async () => {
      try {
        const answer = await api.room.enter(participantSid);
        if (askedIn === generation.current) setStatus(answer);
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't reach the room. Trying again…");
      }
    })();
    asking.current = ask;
    await ask;
    asking.current = null;
  }, []);

  const waiting = status === null || status.status === "waiting" || status.status === "offered";

  // Ask once, then keep asking while waiting: the answer moves me up the queue.
  useEffect(() => {
    if (!waiting) return;
    void enter();
    const timer = window.setInterval(() => void enter(), pollMs);
    return () => window.clearInterval(timer);
  }, [waiting, enter, pollMs]);

  // Closing the waiting tab keeps my place for 30 seconds (instead of 60 after the last poll).
  useEffect(() => {
    if (status?.status !== "waiting" && status?.status !== "offered") return;
    const leaving = () => void api.room.leave().catch(() => undefined);
    window.addEventListener("pagehide", leaving);
    return () => window.removeEventListener("pagehide", leaving);
  }, [status?.status]);

  const accept = useCallback(async () => {
    generation.current += 1;
    try {
      setStatus(await api.room.accept());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      void enter();
    }
  }, [enter]);

  const cancel = useCallback(async () => {
    generation.current += 1;
    setStatus({ status: "left" });
    await asking.current;
    await api.room.cancel().catch(() => undefined);
  }, []);

  const rejoin = useCallback(() => setStatus(null), []);
  const reenter = useCallback((participantSid?: string) => void enter(participantSid), [enter]);

  return {
    status,
    error,
    accept: () => void accept(),
    cancel: () => void cancel(),
    rejoin,
    reenter,
  };
}
