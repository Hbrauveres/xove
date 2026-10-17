import type { ReactNode } from "react";

/**
 * The round buttons' icons (spec 0106), drawn as in the approved Player controls design:
 * a 20 × 20 grid, round 1.75 px strokes in the button's colour. One state system: a
 * stream you send shows its plain icon on a red pill; off, its icon is crossed.
 */
function Icon({ name, children, viewBox = "0 0 20 20", strokeWidth = 1.75 }: {
  name: string;
  children: ReactNode;
  viewBox?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      data-icon={name}
      viewBox={viewBox}
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Sharing my screen: the plain monitor. */
export function ScreenOnIcon() {
  return (
    <Icon name="screen-on">
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
      <path d="M7 16.5h6M10 13.5v3" />
    </Icon>
  );
}

/** Not sharing: the monitor, crossed (its outline breaks where the slash crosses it). */
export function ScreenOffIcon() {
  return (
    <Icon name="screen-off">
      <path d="M6 3.5h10a1.5 1.5 0 011.5 1.5v7a1.5 1.5 0 01-1 1.4M13.5 13.5H4A1.5 1.5 0 012.5 12V5c0-.6.3-1 .8-1.3M7 16.5h6M10 13.5v3M3 3l14 14" />
    </Icon>
  );
}

/** What a click does while not sharing: a screen with an arrow up out of it. */
export function ScreenShareIcon() {
  return (
    <Icon name="screen-share">
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
      <path d="M7 16.5h6M10 13.5v3M10 11V6.2M7.8 8.2L10 6l2.2 2.2" />
    </Icon>
  );
}

export function CameraOnIcon() {
  return (
    <Icon name="camera-on">
      <rect x="2.5" y="5" width="11" height="10" rx="1.5" />
      <path d="M13.5 9l4-2.5v7l-4-2.5" />
    </Icon>
  );
}

export function CameraOffIcon() {
  return (
    <Icon name="camera-off">
      <path d="M8 5h4a1.5 1.5 0 011.5 1.5v3.5M13.5 13.5a1.5 1.5 0 01-1.5 1.5H4a1.5 1.5 0 01-1.5-1.5v-7A1.5 1.5 0 014 5M13.5 9l4-2.5v7l-2.2-1.4M3 3l14 14" />
    </Icon>
  );
}

/** Settings: a cog with teeth (on its own 24 × 24 grid, at 2 px, which draws as 1.67 px at 20). */
export function CogIcon() {
  return (
    <Icon name="cog" viewBox="0 0 24 24" strokeWidth={2}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

/** The sound plays: a speaker with its waves. */
export function VolumeIcon() {
  return (
    <Icon name="volume">
      <path d="M3.5 8v4h3l4 3.5v-11l-4 3.5z" />
      <path d="M13.5 7.5a3.5 3.5 0 010 5M15.5 5.5a6.5 6.5 0 010 9" />
    </Icon>
  );
}

/** Muted, or no sound: the speaker, crossed. */
export function VolumeOffIcon() {
  return (
    <Icon name="volume-off">
      <path d="M3.5 8v4h3l4 3.5v-11l-4 3.5z" />
      <path d="M13.5 8l4 4M17.5 8l-4 4" />
    </Icon>
  );
}

/** The window or tab being shared, in the settings. */
export function WindowIcon() {
  return (
    <Icon name="window">
      <rect x="2.5" y="4" width="11" height="8" rx="1.2" />
      <path d="M6.5 16h11v-8" />
    </Icon>
  );
}

/** Closes a panel. */
export function CloseIcon() {
  return (
    <Icon name="close">
      <path d="M5 5l10 10M15 5L5 15" />
    </Icon>
  );
}
