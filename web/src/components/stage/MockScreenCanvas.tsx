import { useEffect, useRef } from "react";
import type { ScreenScene } from "../../types";
import styles from "./MockScreenCanvas.module.css";

type Props = {
  scene: ScreenScene;
  label: string;
};

const W = 1280;
const H = 720;

/**
 * Draws a fake screen so the stage has something moving on it.
 * In the real app this component is replaced by LiveKit's <VideoTrack />.
 */
export function MockScreenCanvas({ scene, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      // rAF timestamps can be slightly earlier than `start`; never let time go negative
      const t = Math.max(0, (now - start) / 1000);
      if (scene === "editor") drawEditor(ctx, t);
      else if (scene === "game") drawGame(ctx, t);
      else drawDesktop(ctx, t);
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scene]);

  return <canvas ref={ref} width={W} height={H} className={styles.canvas} role="img" aria-label={label} />;
}

/* ---------- scenes ---------- */

const CODE_COLORS = ["#c792ea", "#82aaff", "#c3e88d", "#f78c6c", "#89ddff", "#a6accd"];

// Deterministic "code": each line is a list of [indent, [tokenWidth, colorIndex]...].
const CODE_LINES = Array.from({ length: 80 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const indent = [0, 1, 1, 2, 2, 3, 1, 0][seed % 8];
  const count = 1 + (seed % 5);
  const tokens = Array.from({ length: count }, (_, j) => {
    const s = (seed * (j + 3)) % 997;
    return [30 + (s % 110), s % CODE_COLORS.length] as const;
  });
  return { indent, tokens, blank: seed % 9 === 0 };
});

function drawEditor(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "#1e2130";
  ctx.fillRect(0, 0, W, H);

  // Sidebar with file tree
  ctx.fillStyle = "#181a26";
  ctx.fillRect(0, 0, 220, H);
  ctx.fillStyle = "#6b7089";
  for (let i = 0; i < 16; i++) {
    const w = 60 + ((i * 37) % 90);
    ctx.globalAlpha = i === 4 ? 1 : 0.55;
    ctx.fillRect(28 + (i % 3 === 0 ? 0 : 16), 70 + i * 30, w, 10);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(130,170,255,0.12)";
  ctx.fillRect(0, 60 + 4 * 30, 220, 30);

  // Tabs
  ctx.fillStyle = "#171925";
  ctx.fillRect(220, 0, W - 220, 44);
  ctx.fillStyle = "#1e2130";
  ctx.fillRect(220, 0, 170, 44);
  ctx.fillStyle = "#a6accd";
  ctx.fillRect(244, 18, 110, 9);
  ctx.fillStyle = "#4b5068";
  ctx.fillRect(414, 18, 90, 9);
  ctx.fillRect(540, 18, 120, 9);

  // Code, scrolling slowly
  const lineH = 26;
  const scroll = (t * 6) % (CODE_LINES.length * lineH - H);
  const firstLine = Math.floor(scroll / lineH);
  const offset = scroll % lineH;
  for (let i = 0; i < 28; i++) {
    const idx = firstLine + i;
    const line = CODE_LINES[idx % CODE_LINES.length];
    const y = 64 + i * lineH - offset;
    if (y < 44 || y > H) continue;
    ctx.fillStyle = "#4b5068";
    ctx.font = "15px monospace";
    ctx.fillText(String(idx + 1).padStart(3, " "), 236, y + 10);
    if (line.blank) continue;
    let x = 300 + line.indent * 32;
    for (const [w, c] of line.tokens) {
      ctx.fillStyle = CODE_COLORS[c];
      ctx.fillRect(x, y, w, 11);
      x += w + 12;
    }
  }

  // Typing line + blinking cursor
  const typed = Math.floor((t * 60) % 420);
  const cy = 64 + 14 * lineH - offset;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(220, cy - 8, W - 220, lineH);
  ctx.fillStyle = "#c3e88d";
  ctx.fillRect(364, cy, typed, 11);
  if (Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = "#ffcc66";
    ctx.fillRect(366 + typed, cy - 4, 2, 20);
  }

  // Status bar
  ctx.fillStyle = "#2b3150";
  ctx.fillRect(0, H - 26, W, 26);
  ctx.fillStyle = "#a6accd";
  ctx.fillRect(16, H - 17, 80, 8);
  ctx.fillRect(W - 180, H - 17, 150, 8);
}

function drawGame(ctx: CanvasRenderingContext2D, t: number) {
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#1b2b52");
  sky.addColorStop(1, "#e0785a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun
  ctx.fillStyle = "rgba(255,214,150,0.9)";
  ctx.beginPath();
  ctx.arc(900, 420, 90, 0, Math.PI * 2);
  ctx.fill();

  // Parallax hills
  const layers = [
    { color: "#3a2f55", speed: 20, amp: 60, base: 470, freq: 0.004 },
    { color: "#2a2244", speed: 55, amp: 45, base: 540, freq: 0.007 },
    { color: "#17142a", speed: 120, amp: 30, base: 610, freq: 0.012 },
  ];
  for (const l of layers) {
    ctx.fillStyle = l.color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) {
      const y = l.base + Math.sin((x + t * l.speed) * l.freq) * l.amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.fill();
  }

  // Player: a hopping square on the front layer
  const px = 360;
  const ground = 610 + Math.sin((px + t * 120) * 0.012) * 30;
  const hop = Math.abs(Math.sin(t * 3)) * 90;
  ctx.fillStyle = "#f2a93b";
  ctx.fillRect(px - 18, ground - 36 - hop, 36, 36);

  // Particles
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 40; i++) {
    const x = (i * 97 - t * (40 + (i % 5) * 20)) % W;
    const y = (i * 53) % 380;
    ctx.fillRect((x + W) % W, y, 2, 2);
  }

  // HUD
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(24, 24, 260, 56);
  ctx.fillStyle = "#3fbf7f";
  ctx.fillRect(40, 40, 180 - (t * 4) % 60, 10);
  ctx.fillStyle = "#82aaff";
  ctx.fillRect(40, 58, 140, 8);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px monospace";
  ctx.fillText(String(12000 + Math.floor(t * 37)).padStart(6, "0"), W - 180, 58);
}

function drawDesktop(ctx: CanvasRenderingContext2D, t: number) {
  // Wallpaper
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#2d3a4f");
  bg.addColorStop(1, "#4d3a3a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Browser window
  drawWindow(ctx, 60, 50, 720, 520, "#f4f5f7");
  ctx.fillStyle = "#e3e6ec";
  ctx.fillRect(60, 86, 720, 34);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(140, 93, 460, 20);
  ctx.fillStyle = "#2d3a4f";
  ctx.fillRect(100, 150, 300, 26);
  ctx.fillStyle = "#b8bfcc";
  for (let i = 0; i < 6; i++) ctx.fillRect(100, 200 + i * 22, 600 - ((i * 57) % 180), 10);
  ctx.fillStyle = "#f2a93b";
  ctx.fillRect(100, 360, 250, 150);
  ctx.fillStyle = "#cfd5df";
  ctx.fillRect(380, 360, 320, 150);

  // Terminal window
  drawWindow(ctx, 700, 250, 520, 360, "#10131a");
  ctx.font = "15px monospace";
  const lines = [
    "$ docker compose up -d",
    "✔ Container livekit   Started",
    "✔ Container api       Started",
    "✔ Container caddy     Started",
    "$ docker compose logs -f api",
    "api  | listening on :3000",
    "api  | POST /api/screen/take 200",
  ];
  const shown = Math.min(lines.length, Math.floor((t % 14) / 1.4) + 1);
  for (let i = 0; i < shown; i++) {
    ctx.fillStyle = lines[i].startsWith("$") ? "#f2a93b" : "#8fe3b0";
    ctx.fillText(lines[i], 724, 310 + i * 26);
  }

  // Taskbar + clock
  ctx.fillStyle = "rgba(10,12,18,0.85)";
  ctx.fillRect(0, H - 44, W, 44);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i === 1 ? "#f2a93b" : "#5d6778";
    ctx.fillRect(24 + i * 44, H - 32, 28, 20);
  }
  const d = new Date();
  ctx.fillStyle = "#e7ebf1";
  ctx.font = "16px monospace";
  ctx.fillText(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, W - 76, H - 16);

  // Mouse cursor wandering
  const mx = 640 + Math.sin(t * 0.7) * 420;
  const my = 330 + Math.sin(t * 1.1) * 220;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.lineTo(mx, my + 22);
  ctx.lineTo(mx + 6, my + 17);
  ctx.lineTo(mx + 12, my + 27);
  ctx.lineTo(mx + 16, my + 25);
  ctx.lineTo(mx + 10, my + 15);
  ctx.lineTo(mx + 17, my + 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, body: string) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 8, y + 10, w, h);
  ctx.fillStyle = "#2b303b";
  ctx.fillRect(x, y, w, 36);
  ctx.fillStyle = body;
  ctx.fillRect(x, y + 36, w, h - 36);
  ["#ef4b4b", "#e0b341", "#3fbf7f"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + 20 + i * 20, y + 18, 6, 0, Math.PI * 2);
    ctx.fill();
  });
}
