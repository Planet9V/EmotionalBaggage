// Plan 5.7 to 5.9 "done when": both generators make a watertight base and lid for the example concept, the openings line up,
// the parts fit and the lid closes, all worked out on the result. YAPP_Box runs in the planner with OpenSCAD; it is skipped,
// with the reason, where the planner or OpenSCAD is missing.
import { beforeAll, describe, expect, inject, it } from "vitest";
import { buildSpec } from "@/lib/enclosure/spec";
import { runGenerator, type GeneratorResult } from "@/lib/enclosure/run";
import { type LidType } from "@/lib/enclosure/types";
import { exampleParts } from "./helpers";

const LIDS: LidType[] = ["slip", "snap", "screw"];

function expectAllMet(r: GeneratorResult) {
  if (!r.ok) throw new Error(`${r.key} did not run: ${r.error}`);
  const failing = r.checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`);
  expect(failing).toEqual([]);
  expect(r.checks.map((c) => c.key).sort()).toEqual(["lid-closes", "openings-line-up", "parts-fit", "watertight-base", "watertight-lid"]);
}

describe("CaseMaker on the example", () => {
  it.each(LIDS)("%s lid: watertight, parts fit, openings line up, lid closes", async (lidType) => {
    const spec = buildSpec({ items: exampleParts(), params: { lidType } });
    expect(spec.openings.length).toBe(3);
    const r = await runGenerator("casemaker", spec);
    expectAllMet(r);
    if (r.ok) {
      expect(r.source.filename).toMatch(/casemaker\.json$/);
      expect(JSON.parse(r.source.text).board).toBeTruthy();
    }
  }, 90_000);
});

const plannerUrl = inject("plannerUrl");
const health = await fetch(`${plannerUrl}/enclosure/health`, { signal: AbortSignal.timeout(3000) })
  .then((r) => r.json() as Promise<{ openscad?: string | null }>)
  .catch(() => ({ openscad: null }));
const haveOpenscad = !!health.openscad;

describe.skipIf(!haveOpenscad)("YAPP_Box on the example (needs OpenSCAD in the planner; skipped otherwise)", () => {
  const out: Partial<Record<LidType, GeneratorResult>> = {};
  beforeAll(async () => {
    // Two renders at a time; each takes about a minute with OpenSCAD 2021.01.
    await Promise.all(
      (["snap", "screw"] as LidType[]).map(async (lidType) => {
        out[lidType] = await runGenerator("yapp", buildSpec({ items: exampleParts(), params: { lidType } }), { plannerUrl, timeoutSeconds: 240 });
      })
    );
  }, 300_000);
  it.each(["snap", "screw"] as LidType[])("%s lid: watertight, parts fit, openings line up, lid closes", (lidType) => {
    expectAllMet(out[lidType]!);
  });
  it("hands back the .scad that makes it", () => {
    const r = out.snap!;
    expect(r.ok && r.source.text).toContain("YAPPgenerator_v3.scad");
  });
});

describe.skipIf(haveOpenscad)("YAPP_Box without OpenSCAD", () => {
  it("is reported as not available, not as a failure of the request", async () => {
    const r = await runGenerator("yapp", buildSpec({ items: exampleParts() }), { plannerUrl });
    expect(r).toMatchObject({ ok: false, code: "no-openscad" });
  });
});
