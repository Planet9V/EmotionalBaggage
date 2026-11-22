import { describe, expect, it } from "vitest";
import { SLOW_MS, WARM_FRAMES, filmMode, measure, newMeter, paceVerdict } from "@/components/welcome/scenes/pace";

describe("the origin film on a slow device", () => {
  it("keeps the film while frames average within the limit", () => {
    expect(paceVerdict(16, true, "normal")).toBe("keep");
    expect(paceVerdict(SLOW_MS, true, "normal")).toBe("keep");
  });

  it("first gives up sharpness, then the film, when frames average past the limit", () => {
    expect(paceVerdict(SLOW_MS + 1, true, "normal")).toBe("soften");
    expect(paceVerdict(SLOW_MS + 1, false, "normal")).toBe("stills");
    expect(paceVerdict(120, false, "normal")).toBe("stills");
  });

  it("can be pushed either way from the address, for testing", () => {
    expect(paceVerdict(500, false, "force")).toBe("keep");
    expect(paceVerdict(8, true, "slow")).toBe("soften");
    expect(paceVerdict(8, false, "slow")).toBe("stills");
  });

  it("reads the mode from the query", () => {
    expect(filmMode("?film=force")).toBe("force");
    expect(filmMode("?film=slow&x=1")).toBe("slow");
    expect(filmMode("?film=fast")).toBe("normal");
    expect(filmMode("")).toBe("normal");
  });
});

describe("the pace measure", () => {
  const run = (deltas: number[]) => {
    const m = newMeter();
    return deltas.map((d) => measure(m, d)).filter((v): v is number => v !== null);
  };

  it("averages two seconds of frames, after leaving out the frames just after a cut", () => {
    const out = run([...Array(WARM_FRAMES).fill(0.5), ...Array(130).fill(1 / 60)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBeCloseTo(1000 / 60, 0);
  });

  it("counts slow frames in full, so a device far too slow for the film does fall back", () => {
    // four frames a second: every one of them is longer than the old 0.3 s cut-off
    const out = run(Array(WARM_FRAMES + 12).fill(0.4));
    expect(out.length).toBeGreaterThan(0);
    expect(paceVerdict(out[0]!, false, "normal")).toBe("stills");
  });

  it("leaves out a long gap (the tab hidden), not the frames around it", () => {
    const out = run([...Array(WARM_FRAMES).fill(0), 5, ...Array(125).fill(1 / 60)]);
    expect(out[0]).toBeCloseTo(1000 / 60, 0);
  });
});
