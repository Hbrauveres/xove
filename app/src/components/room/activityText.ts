import type { ActivityEvent } from "../../types";

/** What happened, in words (spec 0104): "Ana started sharing", "You joined", "Reconnected". */
export function describeEvent(e: ActivityEvent, nameOf: (id: string) => string, meId: string): string {
  const actor = e.actorId === meId ? "You" : nameOf(e.actorId);
  const whose = e.actorId === meId ? "your" : "their";
  switch (e.kind) {
    case "joined":
      return `${actor} joined`;
    case "left":
      return `${actor} left`;
    case "started":
      return e.stream === "camera" ? `${actor} turned on ${whose} camera` : `${actor} started sharing`;
    case "stopped":
      return e.stream === "camera" ? `${actor} turned off ${whose} camera` : `${actor} stopped sharing`;
    case "reconnected":
      return "Reconnected";
  }
}

/** How long ago, short: "now", "2 min", "1 h". */
export function shortAgo(at: number, now = Date.now()): string {
  const sec = Math.floor((now - at) / 1000);
  if (sec < 45) return "now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.round(min / 60)} h`;
}
