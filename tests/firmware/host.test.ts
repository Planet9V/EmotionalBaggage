// The Baggage Claims MK1 detection core (seed/concepts/baggage-claims/files/bc_detect.{h,cpp}) is plain C++.
// This builds its host tests with g++ and runs them: synthetic traces of a throw, a drop, a set-down, carousels,
// a conveyor, a handle grab and a weigh-in, and the events each must (and must not) produce. Skipped where
// there is no g++. It says nothing about the sketch on the board: that needs arduino-cli and the esp32 core.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hasGpp = spawnSync("g++", ["--version"]).status === 0;

describe.skipIf(!hasGpp)("the detection core, on this machine", () => {
  it("builds without a warning and passes every host test", () => {
    const out = execFileSync("bash", ["scripts/firmware-check.sh", "host"], { encoding: "utf8", timeout: 120_000 });
    const m = /(\d+) tests, (\d+) failed/.exec(out);
    expect(m, out.slice(-400)).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(23);
    expect(Number(m![2])).toBe(0);
  });
});

describe("the detection core's source", () => {
  it("includes no Arduino header, so it can be built anywhere", () => {
    for (const f of ["bc_detect.h", "bc_detect.cpp"]) {
      const src = readFileSync(`seed/concepts/baggage-claims/files/${f}`, "utf8");
      expect(/#include\s*<(Arduino|Wire|esp_)/.test(src), f).toBe(false);
    }
  });
});
