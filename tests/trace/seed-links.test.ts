// Process review 6: the seeded example has real links between its requirements, tests and parts, written at both
// ends and recorded as history lines that say why. Nothing is linked that the rows' own texts do not support.
import { afterAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { traceOf } from "@/lib/trace/coverage";
import { SEED_LINKS } from "@/lib/seed";
import { SEEDED } from "../api/helpers";
import { GET as getItems } from "@/app/api/projects/[id]/items/route";
import { ctx, json, read } from "../api/helpers";
import type { Item } from "@/lib/types";

afterAll(async () => {
  await pool().end();
});

const rows = async () => (await read<{ items: Item[] }>(await getItems(json("GET"), ctx(SEEDED)))).body.items;

describe("the seeded example's links", () => {
  it("each of the five acceptance tests checks the requirement its own text names", async () => {
    const t = traceOf(await rows());
    const checks = (test: string) => t.requirements.filter((r) => t.testsOf(r).some((x) => x.title === test)).map((r) => r.title);
    expect(checks("Drop")).toEqual(["Detect: Hard impact"]);
    expect(checks("Weigh-in")).toEqual(["Detect: Weigh-in"]);
    expect(checks("Carry")).toEqual(["Detect: Handle grab"]);
    expect(checks("Idle")).toEqual(["Detect: Dark idle"]);
    expect(checks("Sleep current")).toEqual(["Power"]);
    expect(t.orphanTests).toHaveLength(0);
  });

  it("requirements nobody has written a test for stay untested: the gaps are real", async () => {
    const t = traceOf(await rows());
    expect(t.untested.map((r) => r.title).sort()).toEqual(
      ["Controls", "Detect: Carousel", "Detect: Conveyor", "Detect: Free-fall", "Detect: Inverted", "Enclosure", "Firmware sketch compiles", "Governor"].sort()
    );
  });

  it("parts are needed where the requirement's text names them; three parts stay unneeded", async () => {
    const t = traceOf(await rows());
    expect(t.unusedParts.map((p) => p.data.ref).sort()).toEqual(["PCB1", "R1", "W1"]);
    const needs = (ref: string) => t.requirements.filter((r) => t.linksOf(r).parts.includes(String(ref).toLowerCase())).map((r) => r.title);
    expect(needs("S2")).toEqual(["Controls"]);
    expect(needs("BAT")).toEqual(["Power"]);
  });

  it("the links are written at both ends: tests and parts name their requirements too", async () => {
    const all = await rows();
    const drop = all.find((r) => r.section === "prototype/tests" && r.title === "Drop")!;
    const reqs = (drop.data.requirements as string[]) ?? [];
    expect(reqs).toHaveLength(1);
    const req = all.find((r) => r.section === "design/requirements" && r.title === "Detect: Hard impact")!;
    expect(req.data.key).toBe(reqs[0]);
    expect(req.data.tests).toEqual([drop.data.key]);
  });

  it("is recorded as history lines that say why, once", async () => {
    const lines = await q<{ summary: string; detail: Record<string, unknown> }>("SELECT summary, detail FROM audit_log WHERE project_id=$1 AND detail->>'seeded'='true'", [SEEDED]);
    expect(lines.length).toBeGreaterThanOrEqual(SEED_LINKS.filter((l) => l.tests.length || l.parts.length).length);
    const drop = lines.find((l) => l.summary.startsWith('"Detect: Hard impact"'))!;
    expect(drop.detail.reason).toContain("Drop test");
    expect(drop.detail.before).toMatchObject({ "data.tests": [] });
    expect((await q("SELECT 1 FROM events WHERE project_id=$1 AND kind='seed.links'", [SEEDED])).length).toBe(1);
    // the Activity page of the example is no longer empty
    expect((await q("SELECT 1 FROM audit_log WHERE project_id=$1 AND action='item.edited'", [SEEDED])).length).toBeGreaterThan(20);
  });
});
