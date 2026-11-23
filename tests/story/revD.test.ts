// The Rev D batch of 22 Nov 2026 (seed/concepts/baggage-claims/content/2026-11-22-revD.json): the slim
// leather-look tag the owner approved at 19:00, put into the example as decisions, parts, a schematic,
// requirements and tests, an authored enclosure and its print jobs.
import { afterAll, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { alreadyThere, applyBatches, CONTENT_BATCHES, seededRows, type ContentBatch } from "@/lib/seedContent";
import { seedContent } from "@/lib/seedContentDb";

afterAll(async () => {
  await pool().end();
});

const revD = CONTENT_BATCHES.find((b) => b.batch === "2026-11-22-revD")!;
const after = applyBatches(seededRows());
const row = (section: string, title: string) => after.find((x) => x.section === section && x.title === title);
const APPROVAL = "yes this is perfect, a perfect design";

describe("the Rev D batch: decisions", () => {
  it("is the last batch, after the engineering batch", () => {
    expect(CONTENT_BATCHES.at(-1)).toBe(revD);
    expect(CONTENT_BATCHES.indexOf(revD)).toBeGreaterThan(CONTENT_BATCHES.findIndex((b) => b.batch === "2026-11-22-engineering"));
  });

  it("decides the design, the form factor, the lines on the tag and the cell, each quoting the owner", () => {
    const want: [string, string][] = [
      ["Which enclosure design ships?", "A1"],
      ["Which form factor ships?", "slim-tag"],
      ["Which lines go on the tag?", "talks-back"],
      ["Which cell powers the tag?", "cr2032-supercap"],
      ["Which enclosure build?", "rev-d-tag"],
    ];
    for (const [title, chosen] of want) {
      const r = row("concept/decisions", title)!;
      expect(r.status, title).toBe("decided");
      expect(r.data.chosen, title).toBe(chosen);
      expect(String(r.data.ruling), title).toMatch(/^Owner, 22 Nov 2026/);
      expect(String(r.data.ruling), title).toContain(APPROVAL);
      expect((r.data.options as { id: string }[]).some((o) => o.id === chosen), title).toBe(true);
    }
    expect(row("concept/decisions", "Which lines go on the tag?")!.body).toContain("Your luggage finally talks back.");
    expect(row("concept/decisions", "Which lines go on the tag?")!.body).toContain("FRAGILE — and emotionally unstable.");
  });

  it("quotes the airline rules with their sources on the power decision", () => {
    const note = String(row("concept/decisions", "Which cell powers the tag?")!.data.note);
    for (const s of ["iata.org", "faa.gov/hazmat/packsafe/baggage-with-lithium-batteries", "0.3 g lithium metal", "2.7 Wh", "completely switched off", "Check with the airline"]) expect(note, s).toContain(s);
  });

  it("marks the 2 x AA rulings as superseded and leaves them decided, with the owner's words of the day", () => {
    for (const title of ["Batteries: two AA alkaline cells", "Enclosure: 80 x 60 x 42 mm, a tag on the handle", "Motion sensor: the Adafruit MPU6050 breakout"]) {
      const r = row("concept/questions", title)!;
      expect(r.status).toBe("decided");
      expect(r.body).toContain("Superseded on 22 Nov 2026 by the Rev D tag");
    }
  });
});

describe("the Rev D batch: parts", () => {
  const parts = after.filter((r) => r.section === "design/bom");
  const part = (ref: string) => parts.find((r) => r.data.ref === ref);

  it("retires every part and wire of the 2 x AA design through the retire rule, with the reason", () => {
    const retired = revD.rows.filter((r) => r.op === "retire");
    for (const ref of ["U1", "U2", "U3", "U4", "SPK1", "BT1", "BAT", "S1", "S2", "PCB1", "ENC1", "STR1", "W1", "HW1", "Q1", "C1", "C2", "R2", "R3", "R4", "R5"]) {
      expect(retired.some((r) => r.op === "retire" && r.section === "design/bom" && r.match.ref === ref), ref).toBe(true);
    }
    for (const r of retired) if (r.op === "retire") expect(r.why.length, r.proposal).toBeGreaterThan(20);
    // nothing of the 2 x AA design is left: no breakout board, no AA holder, no XIAO
    expect(parts.some((p) => ["xiao-esp32s3-ext-3v3", "adafruit-mpu6050", "battery-holder-2xaa", "boost-3v3-module", "max98357a-breakout"].includes(String(p.data.library)))).toBe(false);
  });

  it("holds Rev D's parts: the custom board with its components listed, the chips on it, and the printed parts", () => {
    expect(part("U1")?.data.library).toBe("nrf52832-qfn48");
    expect(part("U2")?.data.library).toBe("lsm6dso-class-imu");
    expect(part("SC1")?.data.library).toBe("supercap-1f-2v7");
    expect(part("BAT")?.title).toBe("Coin cell CR2032");
    const board = part("PCB1")!;
    expect(board.data.kind).toBe("circuit board");
    for (const ref of ["U1", "U2", "U3", "U4", "U5", "Q1", "Q2", "S1", "S2", "BT1"]) {
      expect(board.data.components as string[]).toContain(ref);
      expect(part(ref)?.data.insideOf, ref).toBe("PCB1");
    }
    for (const ref of ["ENC1", "ENC2", "ENC3", "ENC4", "STR1"]) {
      const p = part(ref)!;
      expect(p.status, ref).toBe("to print");
      expect(typeof p.data.printGrams, ref).toBe("number");
      expect(p.body, ref).toMatch(/Estimate, not sliced/);
    }
    // every bought part is priced at one, five and a hundred units, and says its prices are estimates or where they were read
    for (const p of parts.filter((x) => x.status === "to buy")) {
      expect(typeof p.data.unit, String(p.data.ref)).toBe("number");
      expect((p.data.priceBreaks as { qty: number }[]).map((b) => b.qty / Number(p.data.qty)), String(p.data.ref)).toEqual([5, 100]);
      expect(p.body, String(p.data.ref)).toMatch(/estimate|read 22 Nov|not costed/i);
    }
  });

  it("adds the electronics up to the Rev D note's $29.02, $27.02 and $16.68 a unit", async () => {
    const { readEconomics } = await import("@/lib/economics/read");
    const { unitCost } = await import("@/lib/economics/compute");
    const items = after.map((r, i) => ({ id: i + 1, projectId: "baggage-claims", sort: i, ...r }));
    const of = (s: string) => items.filter((r) => r.section === s);
    const inputs = readEconomics({ parts: of("design/bom"), economics: of("production/economics"), channels: of("sales/channels"), methods: of("production/methods"), batches: of("production/batches"), printJobs: of("prototype/printing") }, "USD");
    // the printed parts add $0.99 of filament (estimate) at every batch size
    expect([1, 5, 100].map((n) => unitCost(inputs, n).total)).toEqual([2902 + 99, 2702 + 99, 1668 + 99]);
  });

  it("places the parts in the app's layout frame: inside the 62 x 12.8 x 92 shell, apart, the switches through the right-hand wall", async () => {
    const { buildSpec, validateSpec } = await import("@/lib/enclosure/spec");
    const items = after.map((r, i) => ({ id: i + 1, projectId: "baggage-claims", sort: i, ...r }));
    const shell = part("ENC1")!.data.geometry as { size: number[]; pos: number[] };
    expect(shell.size).toEqual([62, 12.8, 92]);
    const spec = buildSpec({ items: items.filter((r) => r.section === "design/bom"), params: { wallThickness: 3, floorThickness: 2.4, lidThickness: 1.6, cornerRadius: 4, clearance: 0.3, openingMargin: 0.3 } });
    expect(validateSpec(spec).filter((i) => i.severity === "error").map((i) => i.message)).toEqual([]);
    expect(spec.parts.filter((p) => p.role === "through").map((p) => p.ref).sort()).toEqual(["S1", "S2"]);
    expect(spec.openings.map((o) => `${o.partRef} ${o.face}`).sort()).toEqual(["S1 left", "S2 left", "SPK1 top"]);
  });
});

describe("the Rev D batch, in a database", () => {
  const P = "baggage-claims";
  const marker = async (batch: string) => (await q<{ data: { added: number; retired: number; skipped: { proposal: string; why: string }[] } }>(`SELECT data FROM events WHERE project_id='${P}' AND kind='seed.content' AND data->>'batch'=$1`, [batch]))[0]?.data;

  it("is applied once on a fresh install: the 2 x AA parts and wires gone, Rev D's in their place, nothing left alone", async () => {
    await ready();
    const m = (await marker(revD.batch))!;
    expect(m.skipped).toEqual([]);
    expect(m.retired).toBe(revD.rows.filter((r) => r.op === "retire").length);
    const refs = (await q<{ ref: string; n: number }>(`SELECT data->>'ref' AS ref, count(*)::int AS n FROM items WHERE project_id='${P}' AND section='design/bom' GROUP BY 1 ORDER BY 1`));
    expect(refs.every((r) => r.n === 1)).toBe(true);
    expect(refs.map((r) => r.ref).sort()).toEqual(after.filter((r) => r.section === "design/bom").map((r) => String(r.data.ref)).sort());
    const printed = await q<{ status: string }>(`SELECT status FROM items WHERE project_id='${P}' AND section='design/bom' AND data->>'ref'='ENC1'`);
    expect(printed[0].status).toBe("to print");
  });

  it("adds no second part of a reference a person kept: the add is left alone and says why", async () => {
    await ready();
    const add: ContentBatch = { batch: "2099-03-01", about: "test", from: "a test", rows: [{ op: "add", section: "design/bom", title: "Another off switch", body: "", data: { ref: "S1", qty: 1 }, status: "to buy", proposal: "D998", sourceFile: "x", sourceLocation: "x" }] };
    expect(alreadyThere(after, add.rows[0] as never)).toBe(true);
    await seedContent(pool(), [...CONTENT_BATCHES, add]);
    expect((await marker("2099-03-01"))!.skipped).toEqual([{ proposal: "D998", why: "a part of that reference is already there" }]);
    expect((await q(`SELECT 1 FROM items WHERE project_id='${P}' AND section='design/bom' AND data->>'ref'='S1'`))).toHaveLength(1);
    await q(`DELETE FROM events WHERE project_id='${P}' AND kind='seed.content' AND data->>'batch'='2099-03-01'`);
  });
});
