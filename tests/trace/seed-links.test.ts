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
    // since the engineering batch of 22 Nov the battery-life estimate also rests on the sleep current
    expect(checks("Sleep current")).toEqual(["Power", "Battery life"]);
    // four bench checks entered from the build guide on 22 Nov name no requirement in the documents, so they are linked to
    // none; the fifth (Power rail voltage) is linked to Power by the engineering batch, with the tests that batch added
    expect(t.orphanTests.map((x) => x.title).sort()).toEqual(["3.3 V rail", "Events appear in the log", "First power-on: no heat", "No shorts on the rails"]);
  });

  it("requirements nobody has written a test for stay untested: the gaps are real", async () => {
    const t = traceOf(await rows());
    expect(t.untested.map((r) => r.title).sort()).toEqual(
      [
        "Controls", "Detect: Inverted", "Enclosure", "Governor",
        // entered from the documents on 22 Nov, with no test written for them
        "Audio command interface", "Content ships independently of firmware", "Feature extraction", "Idle false positives under one a day", "Radios off", "Rigid sensor mount", "Service and debug port",
        // entered with the 2 x AA design on 22 Nov, with no bench test of their own
        "Logging mode for tuning", "Sensor configuration",
        // (Free-fall, Carousel, Conveyor, the firmware build and the loudness limit each have a test since that batch)
      ].sort()
    );
  });

  it("parts are needed where the requirement's text names them; the board's support parts stay unneeded", async () => {
    const t = traceOf(await rows());
    // the Rev D batch retired the 2 x AA design's parts and their links; its own parts are linked with its requirements
    // what is left unneeded is the board's support: crystals, inductors, the other passives and the assembly
    expect(t.unusedParts.map((p) => p.data.ref).sort()).toEqual(["L1", "L3", "PAS", "PCBA", "Y1"]);
    const needs = (ref: string) => t.requirements.filter((r) => t.linksOf(r).parts.includes(String(ref).toLowerCase())).map((r) => r.title);
    expect(needs("S2")).toEqual(["Controls"]);
    expect(needs("BAT").sort()).toEqual(["Battery life", "Lithium within the checked-baggage limit", "Power"]);
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
