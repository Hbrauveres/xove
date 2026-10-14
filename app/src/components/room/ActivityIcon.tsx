import type { ActivityEvent } from "../../types";

/** The small icon in front of an event: a screen or a camera for streams, a door for people. */
export function ActivityIcon({ event }: { event: ActivityEvent }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  let path;
  if (event.kind === "started" || event.kind === "stopped") {
    path =
      event.stream === "camera" ? (
        <path d="M3 6h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM13 9l5-3v8l-5-3" {...stroke} />
      ) : (
        <path
          d="M3 4.5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM7 17.5h6M10 14.5v3"
          {...stroke}
        />
      );
  } else if (event.kind === "left") {
    path = <path d="M17 10H8M12 6l-4 4 4 4M12 3h4v14h-4" {...stroke} />;
  } else if (event.kind === "reconnected") {
    path = <path d="M16 6a7 7 0 1 0 1.5 6M16 2.5V6h-3.5" {...stroke} />;
  } else {
    path = <path d="M8 10h9M13 6l4 4-4 4M8 3H4v14h4" {...stroke} />;
  }
  return (
    <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
      {path}
    </svg>
  );
}
