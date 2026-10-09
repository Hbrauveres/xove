/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** A stylesheet from src/, read from disk (the test runner stubs CSS imports). */
const sheet = (path: string) => readFileSync(`${__dirname}/../${path}`, "utf8");
/** The first rule whose selector is exactly `selector`, its body only. */
const rule = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("}", at));
};

describe("the room on a phone held upright (spec 0158)", () => {
  const room = sheet("pages/RoomPage.module.css");
  const stage = sheet("components/stage/Stage.module.css");

  it("stays one screen high: the page itself never scrolls", () => {
    expect(rule(room, ".theater")).toMatch(/height:\s*100dvh/);
    expect(rule(room, ".theater")).toMatch(/overflow:\s*hidden/);
    expect(rule(room, '.theater[data-layout="phone"] .middle')).toMatch(/padding:\s*0/);
  });

  it("runs the stage edge to edge, hugging the picture, never taller than 60% of the screen", () => {
    const box = rule(stage, '.stage[data-layout="phone"] .box');
    expect(box).toMatch(/width:\s*min\(100cqw, 60dvh \* var\(--shape\)\)/);
    expect(box).toMatch(/height:\s*min\(100cqw \/ var\(--shape\), 60dvh\)/);
    expect(rule(stage, '.stage[data-layout="phone"] .frame')).toMatch(/border-radius:\s*0/);
  });

  it("keeps the stage and its info row in place: only the block under them scrolls", () => {
    expect(rule(stage, '.stage[data-layout="phone"] .box')).toMatch(/flex:\s*none/);
    expect(rule(stage, '.stage[data-layout="phone"] .info')).toMatch(/flex:\s*none/);
    const below = rule(stage, ".below");
    expect(below).toMatch(/flex:\s*1/);
    expect(below).toMatch(/overflow-y:\s*auto/);
  });
});

describe("the empty stage's colour bars (spec 0158)", () => {
  it("are at full colour, on desktop and phone", () => {
    const empty = sheet("components/stage/EmptyStage.module.css");
    expect(rule(empty, ".test")).not.toMatch(/opacity/);
  });
});

describe("the phone's feed (spec 0158)", () => {
  it("keeps each video inside its card: the picture box positions it", () => {
    // The video is absolutely positioned (ScreenVideo); without this it covered the whole page.
    expect(rule(sheet("components/stage/LiveFeed.module.css"), ".picture")).toMatch(/position:\s*relative/);
  });
});

describe("the room on a phone sideways, and tablets (spec 0160)", () => {
  const stage = sheet("components/stage/Stage.module.css");

  it("fills the screen height first, hugging the picture", () => {
    const box = rule(stage, '.stage[data-layout="sideways"] .box');
    expect(box).toMatch(/width:\s*min\(100cqw, 100dvh \* var\(--shape\)\)/);
    expect(box).toMatch(/height:\s*min\(100dvh, 100cqw \/ var\(--shape\)\)/);
  });

  it("fades the top bar and the row's tab with the controls", () => {
    expect(rule(stage, '.stage[data-layout="sideways"][data-chrome="hidden"] [data-fades]')).toMatch(/opacity:\s*0/);
  });

  it("centres what's under the stage in a 640 px column on a wider screen held upright", () => {
    const column = rule(stage, '.stage[data-layout="phone"] .info,\n.below > *');
    expect(column).toMatch(/max-width:\s*640px/);
    expect(column).toMatch(/margin-inline:\s*auto/);
  });
});
