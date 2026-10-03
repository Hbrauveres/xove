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
  /** The API forgot my seat (it restarted): ask again, staying in the room if there's one. */
  reenter: () => void;
};

/**
 * My seat in the room, or my place in the queue (spec 0060). The room has 20 seats;
 * whoever comes next waits here, polling, until a seat is offered to them.
 */
export function useRoomSeat(pollMs: number = SEAT_POLL_MS): RoomSeat {
  const [status, setStatus] = useState<RoomSeat["status"]>(null);
  const [error, setError] = useState<string | null>(null);
  const asking = useRef(false);
  // Bumped by Cancel: an answer already on its way is about the queue I just left.
  const generation = useRef(0);

  const enter = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    const askedIn = generation.current;
    try {
      const answer = await api.room.enter();
      if (askedIn === generation.current) setStatus(answer);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach the room. Trying again…");
    } finally {
      asking.current = false;
    }
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
    await api.room.cancel().catch(() => undefined);
  }, []);

  const rejoin = useCallback(() => setStatus(null), []);
  const reenter = useCallback(() => void enter(), [enter]);

  return {
    status,
    error,
    accept: () => void accept(),
    cancel: () => void cancel(),
    rejoin,
    reenter,
  };
}
