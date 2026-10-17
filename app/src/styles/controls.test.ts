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

describe("the white slider, like a video player's (spec 0121, FR-4)", () => {
  const range = sheet("components/ui/Range.module.css");

  it("has a 3 px round track: white up to the knob, the text colour at 22% after", () => {
    const track = rule(range, ".range::-webkit-slider-runnable-track");
    expect(track).toMatch(/height:\s*3px/);
    expect(track).toMatch(/border-radius:\s*999px/);
    expect(track).toMatch(/#ffffff 0 var\(--fill/);
    expect(track).toMatch(/rgba\(235, 235, 236, 0\.22\) var\(--fill/);
    const moz = rule(range, ".range::-moz-range-track");
    expect(moz).toMatch(/height:\s*3px/);
    expect(moz).toMatch(/rgba\(235, 235, 236, 0\.22\)/);
    expect(rule(range, ".range::-moz-range-progress")).toMatch(/background:\s*#ffffff/);
  });

  it("has a 12 px white knob that grows to 14 px on hover or keyboard focus", () => {
    for (const thumb of [".range::-webkit-slider-thumb", ".range::-moz-range-thumb"]) {
      const css = rule(range, thumb);
      expect(css, thumb).toMatch(/width:\s*12px/);
      expect(css, thumb).toMatch(/height:\s*12px/);
      expect(css, thumb).toMatch(/background:\s*#ffffff/);
    }
    expect(range).toMatch(/\.range:hover::-webkit-slider-thumb,\s*\.range:focus-visible::-webkit-slider-thumb \{[^}]*width:\s*14px/);
    expect(range).toMatch(/\.range:hover::-moz-range-thumb,\s*\.range:focus-visible::-moz-range-thumb \{[^}]*width:\s*14px/);
  });

  it("keeps a focus ring and the dimmed disabled look, and has no red", () => {
    expect(rule(range, ".range:focus-visible")).toMatch(/outline:\s*2px solid var\(--text\)/);
    expect(rule(range, ".range:disabled")).toMatch(/opacity:\s*0\.4/);
    expect(range).not.toMatch(/--accent|accent-color/);
  });

  it("keeps each browser's rules apart, so one browser doesn't drop the other's", () => {
    for (const [, selectors] of range.matchAll(/([^{}]+)\{/g)) {
      const vendors = new Set([...selectors.matchAll(/::-(webkit|moz)-/g)].map(([, v]) => v));
      expect(vendors.size, selectors.trim()).toBeLessThanOrEqual(1);
    }
  });
});

describe("the three sliders use the white slider (spec 0121, FR-4)", () => {
  const uses = [
    ["components/room/AccountButton", "the ambilight's brightness"],
    ["components/stage/VolumeButton", "the stage's volume"],
    ["components/stage/AlsoLive", "a preview's volume"],
  ] as const;

  it("draws them with Range, with no red of their own", () => {
    for (const [path, what] of uses) {
      const tsx = sheet(`${path}.tsx`);
      expect(tsx, what).toMatch(/<Range\b/);
      expect(tsx, what).not.toMatch(/type="range"/);
      expect(sheet(`${path}.module.css`), what).not.toMatch(/accent-color/);
    }
  });
});

describe("the switch: a slim grey track, a bigger knob that lights red (spec 0121, FR-6)", () => {
  const css = sheet("components/room/AccountButton.module.css");

  it("keeps a 36 × 20 px button to click, with no fill of its own", () => {
    const button = rule(css, ".switch");
    expect(button).toMatch(/width:\s*36px/);
    expect(button).toMatch(/height:\s*20px/);
    expect(button).toMatch(/background:\s*transparent/);
    expect(css).not.toMatch(/\.switch\[aria-checked="true"\] \{/);
  });

  it("draws a 36 × 14 px grey track, the same off and on", () => {
    const track = rule(css, ".switch::before");
    expect(track).toMatch(/width:\s*36px/);
    expect(track).toMatch(/height:\s*14px/);
    expect(track).toMatch(/background:\s*#3a3a3d/);
  });

  it("has a 20 px knob with a soft shadow: grey off, red on, sliding in 180 ms", () => {
    const knob = rule(css, ".switch i");
    expect(knob).toMatch(/width:\s*20px/);
    expect(knob).toMatch(/height:\s*20px/);
    expect(knob).toMatch(/box-shadow:/);
    expect(knob).toMatch(/background:\s*#bdbdc0/);
    expect(knob).toMatch(/transition:[^;]*0\.18s/);
    const on = rule(css, '.switch[aria-checked="true"] i');
    expect(on).toMatch(/background:\s*var\(--accent\)/);
    expect(knob).toMatch(/left:\s*-2px/);
    expect(on).toMatch(/translateX\(20px\)/);
  });

  it("moves without sliding when the system asks for reduced motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.switch i[^{]*\{\s*transition:\s*none/);
  });

  it("shows its focus in the text colour", () => {
    expect(rule(css, ".switch:focus-visible")).toMatch(/outline:\s*2px solid var\(--text\)/);
  });
});

describe("the footer's coffee link (spec 0121, FR-8)", () => {
  it("is white, in the text colour, not red", () => {
    const coffee = rule(sheet("components/room/RoomFooter.module.css"), ".coffee");
    expect(coffee).toMatch(/color:\s*var\(--text\)/);
    expect(coffee).not.toMatch(/--accent/);
  });
});

describe("the picker: one box with its pill, floating (the Player controls design; spec 0111)", () => {
  const picker = sheet("components/ui/Picker.module.css");

  it("opens with no gap, floating: the list sits right on the pill, in the pill's own colour", () => {
    const list = rule(picker, ".list");
    expect(list).toMatch(/background:\s*var\(--pick-bg\)/);
    expect(list).toMatch(/position:\s*absolute/);
    expect(list).toMatch(/top:\s*100%/);
    expect(rule(picker, ".picker[data-opens=\"up\"] .list")).toMatch(/bottom:\s*100%/);
    expect(picker).not.toMatch(/calc\(100% \+ 4px\)/);
  });

  it("has rows as tall as the pill, and scrolls after three and a half with the app's slim scrollbar", () => {
    expect(rule(picker, ".option")).toMatch(/min-height:\s*var\(--ctl/);
    const list = rule(picker, ".list");
    expect(list).toMatch(/max-height:\s*calc\(var\(--ctl, 38px\) \* 3\.5\)/);
    expect(list).not.toMatch(/scrollbar-width:\s*none/);
    expect(rule(picker, ".list::-webkit-scrollbar")).toMatch(/width:\s*4px/);
    expect(rule(picker, ".list::-webkit-scrollbar-track")).toMatch(/margin-block:\s*6px/);
  });

  it("unrolls from the pill in 220 ms and rolls back in 150 ms, its options fading in by their distance", () => {
    expect(rule(picker, ".list")).toMatch(/clip-path:\s*inset\(0 0 100% 0\)/);
    expect(rule(picker, ".list[data-unroll]")).toMatch(/transition:\s*clip-path 220ms/);
    expect(rule(picker, ".list")).toMatch(/transition:\s*clip-path 150ms/);
    expect(rule(picker, ".list[data-unroll] .option")).toMatch(/calc\(30ms \+ var\(--k, 0\) \* 40ms\)/);
  });

  it("keeps each row's hover light inside the row, so a short list never scrolls", () => {
    expect(rule(picker, ".option::before")).toMatch(/inset:\s*0;/);
  });

  it("is never wider than its box: long names end in \"…\", on one line (spec 0114)", () => {
    expect(rule(picker, ".picker")).toMatch(/min-width:\s*0/);
    expect(rule(picker, ".pill")).toMatch(/min-width:\s*0/);
    // The pill's name and each option's share one rule.
    const r = rule(picker, ".chosen,\n.name");
    expect(r).toMatch(/min-width:\s*0/);
    expect(r).toMatch(/text-overflow:\s*ellipsis/);
    expect(r).toMatch(/white-space:\s*nowrap/);
  });
});

describe("the drop-up (the Player controls design, decision 3)", () => {
  const dropup = sheet("components/ui/DropUp.module.css");

  it("bridges the gap to its button, and slides without animating any blur", () => {
    expect(rule(dropup, ".dropup::after")).toMatch(/top:\s*100%/);
    const moving = rule(dropup, ".dropup");
    expect(moving).toMatch(/transition:[\s\S]*opacity[\s\S]*transform/);
    expect(moving).not.toMatch(/backdrop-filter|filter/);
  });

  it("is one frosted pill, like the round buttons", () => {
    const row = rule(dropup, ".row");
    expect(row).toMatch(/background:\s*var\(--glass\)/);
    expect(row).toMatch(/backdrop-filter:\s*blur\(8px\)/);
    expect(row).toMatch(/0 4px 16px rgba\(0, 0, 0, 0\.35\)/);
  });
});

describe("the fullscreen button has one place (spec 0111, design decision 2)", () => {
  const overlay = sheet("components/stage/StageOverlay.module.css");
  const stage = sheet("components/stage/Stage.module.css");

  it("sits at the bottom right on every layout, its centre level with the round buttons' row", () => {
    const o = rule(overlay, ".overlay");
    expect(o).toMatch(/justify-content:\s*flex-end/);
    expect(o).toMatch(/padding-bottom:\s*calc\(12px \+ \(var\(--btn, 48px\) - 34px\) \/ 2\)/);
    expect(rule(overlay, ".top")).toMatch(/justify-content:\s*flex-end/);
    // The row's button size per layout, nothing else of its own.
    expect(rule(stage, '.stage[data-layout="phone"] [data-overlay]')).toMatch(/--btn:\s*44px/);
    expect(stage).not.toMatch(/\[data-overlay\]\s*\{[^}]*justify-content/);
  });
});
