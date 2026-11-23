// The Rev D leftovers batch of 22 Nov 2026 (seed/concepts/baggage-claims/content/2026-11-22-revD-2.json): what the first
// Rev D batch left on the page from the retired 2 x AA design: the assembly steps, the listing note, the volume costs and
// the story, brief, FAQ and gate rows that still gave two AA cells, the MPU6050 breakout or an 80 x 60 x 42 mm box.
import { afterAll, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { applyBatches, CONTENT_BATCHES, seededRows } from "@/lib/seedContent";
import { checkContentRow } from "@/lib/seedContentDb";

afterAll(async () => {
  await pool().end();
});

const revD2 = CONTENT_BATCHES.find((b) => b.batch === "2026-11-22-revD-2")!;
const at = CONTENT_BATCHES.indexOf(revD2);
const before = applyBatches(seededRows(), CONTENT_BATCHES.slice(0, at));
// the rows as this batch leaves them (the Rev D wording batch after it is tested in revD3.test.ts)
const after = applyBatches(seededRows(), CONTENT_BATCHES.slice(0, at + 1));
const row = (section: string, title: string) => after.find((x) => x.section === section && x.title === title)!;
const text = (r: { title: string; body: string; data: Record<string, unknown> }) => `${r.title} ${r.body} ${JSON.stringify(r.data.options ?? "")}`;

describe("the Rev D leftovers batch", () => {
  it("is applied after the Rev D batch, adds no row and removes none: it only brings rows up to Rev D", () => {
    expect(CONTENT_BATCHES[at - 1]!.batch).toBe("2026-11-22-revD");
    expect(revD2.rows.every((r) => r.op === "enrich")).toBe(true);
    expect(after).toHaveLength(before.length);
    // every row names the Rev D document it comes from, and passes the checks a row typed in the app passes
    for (const r of revD2.rows) {
      expect(r.sourceFile, r.proposal).toMatch(/RevD|revD/);
      expect(r.sourceLocation.length, r.proposal).toBeGreaterThan(5);
      if (r.op === "enrich") expect(() => checkContentRow(r, before.find((x) => x.section === r.section && (r.match.title ? x.title === r.match.title : x.data.ref === r.match.ref))), r.proposal).not.toThrow();
    }
  });

  it("gives the prototype assembly steps as Rev D's, in the app's phases and dependency order, with no 2 x AA perfboard build", () => {
    const steps = after.filter((r) => r.section === "prototype/assembly" && /^p\d$/.test(String(r.data.key)));
    expect(steps.map((r) => r.data.key).filter((k) => /^p\d$/.test(String(k)))).toEqual(["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]);
    for (const s of steps) expect(s.body, s.title).not.toMatch(/For the 2 x AA design|perfboard|XIAO|MPU-6050|DFPlayer|microSD|clamshell|in this order: \(1\) power/i);
    expect(row("prototype/assembly", "Phase 2 — Electronics").body).toMatch(/Order the assembled board PCB1/);
    expect(row("prototype/assembly", "Phase 1 — Print the enclosure").body).toMatch(/PETG[\s\S]*TPU/);
    const fit = row("prototype/assembly", "Phase 6 — Integration").body;
    // the order the owner gave: speaker and gasket, capacitor, board, cell, back plate, strap
    const at = ["lay the gasket", "lay the supercapacitor", "set the board on its four posts", "drop the CR2032", "close the back plate", "thread the strap"].map((w) => fit.indexOf(w));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(row("prototype/assembly", "Phase 4 — Firmware").body).toMatch(/programming pads[\s\S]*TC2030/);
    expect(row("prototype/assembly", "Phase 7 — Acceptance tests").body).toMatch(/bench check/i);
    // the minutes the steps add up to are labelled estimates in their text
    for (const t of ["Phase 1 — Print the enclosure", "Phase 2 — Electronics", "Phase 6 — Integration"]) expect(row("prototype/assembly", t).body, t).toMatch(/estimate/);
    // the dependency order is the one it was: the steps still wait on the same steps
    for (const s of steps) expect(s.data.after, s.title).toEqual(before.find((x) => x.section === s.section && x.title === s.title)!.data.after);
  });

  it("describes the listing's raw material as the slim tag", () => {
    const l = row("sales/listing", "Amazon listing not started").body;
    expect(l).toContain("62 x 92 x 12.8 mm");
    expect(l).toContain("CR2032");
    expect(l).not.toMatch(/80 x 60|two AA|hangs from the handle, with a name card/);
  });

  it("puts Rev D's cost per tag, from the BOM, where the old design's $64.80, $43.20 and $19.00 were", () => {
    const cogs = (t: string) => row("production/economics", t).data.cogs;
    expect([cogs("Prototype"), cogs("Engineering validation batch"), cogs("Production run")]).toEqual(["$30.01", "$17.67", "$16.00"]);
    expect(row("production/economics", "Prototype").body).toContain("$28.01 a unit for five");
    // the 1,000 figure says it is an assumption, and none says it is a landed cost
    expect(row("production/economics", "Production run").body).toMatch(/assumption/);
    for (const t of ["Prototype", "Engineering validation batch", "Production run"]) expect(row("production/economics", t).body, t).toMatch(/not a landed cost|Parts and filament only/);
    expect(row("production/economics", "Retail run").body).toContain("not been estimated again for Rev D");
    expect(row("concept/decisions", "Scale gate: enough emails before launch?").data.options).toMatchObject([{ outcome: expect.stringContaining("about $16.00") }, { id: "hold" }]);
  });

  it("leaves no live row giving two AA cells, an 80 x 60 x 42 mm box or the MPU6050 breakout as the design, outside the rows marked superseded", () => {
    for (const [section, title] of [["concept/story", "Decided and still open"], ["concept/story", "What it is and how it works"], ["concept/brief", "How it works"], ["concept/faq", "Does it need an app or pairing?"], ["concept/faq", "How long do the batteries last?"]] as const) {
      const r = row(section, title);
      expect(text(r), title).not.toMatch(/two AA alkaline|80 x 60|80 by 60|three AA alkaline|ESP32|DFPlayer|Velcro|hockey/);
    }
    expect(row("concept/story", "Decided and still open").body).toContain("62 x 92 x 12.8 mm");
    expect(row("concept/faq", "How long do the batteries last?").body).toContain("about 9 months");
  });

  it("leaves the rows that are history alone: the superseded rulings and the parts retired by the Rev D batch", () => {
    for (const t of ["Batteries: two AA alkaline cells", "Enclosure: 80 x 60 x 42 mm, a tag on the handle", "Motion sensor: the Adafruit MPU6050 breakout"]) expect(row("concept/questions", t).body).toContain("Superseded on 22 Nov 2026 by the Rev D tag");
    expect(after.filter((r) => r.section === "design/bom").map((r) => r.data.ref)).toEqual(before.filter((r) => r.section === "design/bom").map((r) => r.data.ref));
  });
});

describe("the Rev D leftovers batch, in a database", () => {
  const P = "baggage-claims";
  it("is applied once on a fresh install, nothing left alone, and the rows read as Rev D", async () => {
    await ready();
    const m = (await q<{ data: { enriched: number; skipped: unknown[] } }>(`SELECT data FROM events WHERE project_id='${P}' AND kind='seed.content' AND data->>'batch'=$1`, [revD2.batch]))[0]?.data;
    expect(m?.skipped).toEqual([]);
    expect(m?.enriched).toBe(revD2.rows.length);
    const eco = await q<{ title: string; cogs: string }>(`SELECT title, data->>'cogs' AS cogs FROM items WHERE project_id='${P}' AND section='production/economics' AND title IN ('Prototype','Engineering validation batch','Production run') ORDER BY (data->>'volume')::text`);
    // the Rev D wording batch after this one labels the 1,000-unit figure an estimate in the figure itself
    expect(Object.fromEntries(eco.map((e) => [e.title, e.cogs]))).toEqual({ Prototype: "$30.01", "Engineering validation batch": "$17.67", "Production run": "$16.00 (estimate)" });
    const a = await q<{ body: string }>(`SELECT body FROM items WHERE project_id='${P}' AND section='prototype/assembly' AND title='Phase 2 — Electronics'`);
    expect(a[0].body).toMatch(/Order the assembled board PCB1/);
  });

  it("never overwrites a row a person edited: that row is left alone and says why", async () => {
    await ready();
    const { seedContent } = await import("@/lib/seedContentDb");
    const title = "Production run";
    await q(`UPDATE items SET body='my own note', data = data || '{"cogs":"$12.00"}'::jsonb WHERE project_id='${P}' AND section='production/economics' AND title=$1`, [title]);
    await q(`DELETE FROM events WHERE project_id='${P}' AND kind='seed.content' AND data->>'batch'=$1`, [revD2.batch]);
    await seedContent(pool());
    const m = (await q<{ data: { skipped: { why: string }[] } }>(`SELECT data FROM events WHERE project_id='${P}' AND kind='seed.content' AND data->>'batch'=$1`, [revD2.batch]))[0].data;
    expect(m.skipped.map((s) => s.why)).toContain("the row has been changed since it was seeded");
    const r = await q<{ body: string; cogs: string }>(`SELECT body, data->>'cogs' AS cogs FROM items WHERE project_id='${P}' AND section='production/economics' AND title=$1`, [title]);
    expect(r[0]).toEqual({ body: "my own note", cogs: "$12.00" });
    // put the row back as the batch makes it, for the tests that follow in this database
    const want = applyBatches(seededRows()).find((x) => x.section === "production/economics" && x.title === title)!;
    await q(`UPDATE items SET body=$2, data = data || jsonb_build_object('cogs', $3::text) WHERE project_id='${P}' AND section='production/economics' AND title=$1`, [title, want.body, String(want.data.cogs)]);
  });
});
