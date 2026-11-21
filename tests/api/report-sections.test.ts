// The report and the overview add the twelve features' sections where the concept holds rows for them
// (integration item 10): economics, compliance, builds, enclosure choice and checks, electrical checks,
// launch plan dates and campaign verdicts. Tables and sentences only.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET as sections } from "@/app/api/projects/[id]/report-sections/route";
import { sectionsToBlocks } from "@/components/plan/computedSections";
import { toMarkdown } from "@/components/plan/report";
import type { ReportSection } from "@/lib/report/sections";
import { ctx, json, read } from "./helpers";

const P = "zz-report-sections";
const add = async (section: string, title: string, data: Record<string, unknown>, status = "open") =>
  Number((await q<{ id: string }>("INSERT INTO items (project_id, section, title, data, status) VALUES ($1,$2,$3,$4,$5) RETURNING id", [P, section, title, JSON.stringify(data), status]))[0].id);
const get = async (id = P) => read<{ sections: ReportSection[] }>(await sections(json("GET"), ctx(id)));

beforeAll(async () => {
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await q("INSERT INTO projects (id, name, one_liner, currency) VALUES ($1,'ZZ Report','A test','EUR')", [P]);
});
afterAll(async () => {
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await pool().end();
});

describe("computed report sections", () => {
  it("show nothing for a concept with no rows to work from", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.body.sections).toEqual([]);
  });

  it("add each section once its rows exist, worked out by its feature", async () => {
    await add("design/bom", "Board", { ref: "U1", qty: 1, unit: 6 });
    await add("production/economics", "Assembly", { kind: "labour", labourMinutes: 10, rate: 24 });
    await add("sales/channels", "Direct", { price: 20, platformPercent: 0 }, "active");
    await add("production/compliance", "Batteries", { check: "Read the cell's documents" }, "to check");
    await add("production/compliance", "Radio", { check: "x" }, "draft");
    await add("prototype/tests", "Lights up", { key: "t1" }, "pass");
    await add("prototype/builds", "Alpha", { key: "alpha", tests: ["t1"], criteria: [{ text: "Fits the case", met: false }] }, "open");
    await add("design/wiring", "Signal", { from: "U1", fromPin: "TX", to: "U9", toPin: "RX" });
    await add("marketing/launch", "Kickstarter", { kind: "launch", launchKey: "ks", channel: "Kickstarter", launchDate: "2027-03-01" });
    await add("marketing/launch", "Prelaunch page", { kind: "step", launch: "ks", daysBefore: 14 });
    const ad = await add("marketing/ads", "Ad A", { channel: "meta" }, "draft");
    const camp = await add("marketing/campaigns", "Spring", { kind: "campaign", creative: [{ section: "marketing/ads", itemId: ad }], rule: { stopAboveMinor: 500, afterSpendMinor: 1000 } }, "running");
    await q("INSERT INTO campaign_results (project_id, campaign_id, day, spend_minor, clicks, orders) VALUES ($1,$2,'2027-03-02',2000,500,1)", [P, camp]);

    const r = await get();
    const by = Object.fromEntries(r.body.sections.map((s) => [s.id, s]));
    expect(Object.keys(by).sort()).toEqual(["computed-builds", "computed-campaigns", "computed-compliance", "computed-economics", "computed-electrical", "computed-launch"].sort());
    // economics: 6.00 board + 10 min x 24.00 / 60 labour = 10.00, in the concept's currency
    const econ = JSON.stringify(by["computed-economics"].blocks);
    expect(econ).toContain("€10.00");
    expect(econ).toContain("Direct");
    // compliance: confirmed rows only, with the not-advice sentence
    expect(JSON.stringify(by["computed-compliance"].blocks)).toContain("Batteries");
    expect(JSON.stringify(by["computed-compliance"].blocks)).not.toContain("Radio\"");
    // builds: criteria and tests worked out by the builds feature
    const build = by["computed-builds"].blocks.find((b) => b.t === "table")!;
    expect(build.t === "table" && build.rows[0].slice(0, 4)).toEqual(["Alpha", "open", "0 of 1", "1 of 1"]);
    // electrical: the wire to a part that is not in the list is an error
    expect((by["computed-electrical"].blocks[0] as { text: string }).text).toMatch(/^1 error/);
    // launch: a step 14 days before 1 March 2027
    expect(JSON.stringify(by["computed-launch"].blocks)).toContain("2027-02-15");
    // campaigns: 20.00 spent for 1 order is above the 5.00 stop line: stop
    const camps = by["computed-campaigns"].blocks.find((b) => b.t === "table")!;
    expect(camps.t === "table" && camps.rows[0].slice(0, 4)).toEqual(["Spring", "stop", "€20.00", "1"]);
    // only sentences and tables
    for (const s of r.body.sections) for (const b of s.blocks) expect(["p", "table"]).toContain(b.t);
  });

  it("the enclosure section reads the saved choice and whether its checks still count", async () => {
    await add("design/bom", "Shell", { ref: "E1", geometry: { shape: "shell", size: [80, 42, 60], pos: [0, 21, 0], basis: "typical" } });
    await add("design/enclosure", "Enclosure settings", { enclosureGenerator: "yapp", params: { lidType: "snap" } });
    const r = await get();
    const enc = r.body.sections.find((s) => s.id === "computed-enclosure")!;
    expect((enc.blocks[0] as { text: string }).text).toContain("YAPP_Box");
    expect((enc.blocks[1] as { text: string }).text).toMatch(/do not count yet/);
  });

  it("go into the printed report and its Markdown under one heading", async () => {
    const r = await get();
    const blocks = sectionsToBlocks(r.body.sections);
    expect(blocks[0]).toMatchObject({ t: "h2", text: "Worked out from the rows" });
    const md = toMarkdown({ id: P, name: "ZZ Report", oneLiner: "" }, "now", blocks);
    expect(md).toContain("### Unit economics");
    expect(md).toContain("### Campaign verdicts");
    expect(sectionsToBlocks([], "")).toEqual([]);
    expect(sectionsToBlocks(undefined, "Network down")[1]).toMatchObject({ t: "p", text: "Could not be loaded: Network down" });
  });
});
