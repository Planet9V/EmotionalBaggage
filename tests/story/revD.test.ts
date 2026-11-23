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
  it("comes after the engineering batch, and the revD-2 leftovers and revD-3 wording batches come after it", () => {
    expect(CONTENT_BATCHES.indexOf(revD)).toBeGreaterThan(CONTENT_BATCHES.findIndex((b) => b.batch === "2026-11-22-engineering"));
    expect(CONTENT_BATCHES.slice(CONTENT_BATCHES.indexOf(revD) + 1).map((b) => b.batch)).toEqual(["2026-11-22-revD-2", "2026-11-23-revD-3"]);
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

describe("the Rev D batch: schematic", () => {
  const items = after.map((r, i) => ({ id: i + 1, projectId: "baggage-claims", sort: i, ...r }));
  const parts = items.filter((r) => r.section === "design/bom");
  const wires = items.filter((r) => r.section === "design/wiring");

  it("passes the app's electrical checks with no error and no warning", async () => {
    const { buildCircuit } = await import("@/lib/parts/circuit");
    const { checkCircuit } = await import("@/lib/parts/erc");
    const findings = checkCircuit(buildCircuit(parts, wires, []), {});
    expect(findings.filter((f) => f.severity !== "info").map((f) => `${f.rule}: ${f.text}`)).toEqual([]);
    // no part with pins is left out of the circuit
    expect(findings.filter((f) => f.rule === "idle-part").map((f) => f.refs[0])).toEqual([]);
  });

  it("makes the nets of the Rev D note: the cell rail, the capacitor, the boosted rail and one ground", async () => {
    const { buildCircuit } = await import("@/lib/parts/circuit");
    const c = buildCircuit(parts, wires, []);
    const net = (ref: string, pin: string) => c.netOf.get(`${ref}\u0000${pin}`);
    expect(net("U1", "VDD")?.name).toBe("VCELL");
    expect(net("SC1", "+")?.name).toBe("V_SC");
    expect(net("U5", "VIN")).toBe(net("SC1", "+"));
    expect(net("U4", "VDD")?.name).toBe("3V3A");
    // the cell never drives the speaker: the amplifier's rail is not the cell rail
    expect(net("U4", "VDD")).not.toBe(net("U1", "VDD"));
    const grounds = new Set(["U1", "U2", "U3", "U4", "U5", "SC1", "BT1"].map((r) => net(r, r === "SC1" || r === "BT1" ? "-" : "GND")));
    expect(grounds.size).toBe(1);
    // every wire lands on a part of the Rev D design
    const refs = new Set(parts.map((p) => String(p.data.ref)));
    for (const w of wires) expect(refs.has(String(w.data.from)) && refs.has(String(w.data.to)), w.title).toBe(true);
  });
});

describe("the Rev D batch: requirements and tests", () => {
  const req = (title: string) => row("design/requirements", title)!;
  const test = (title: string) => row("prototype/tests", title)!;

  it("brings the requirements tied to two AA cells to Rev D's figures, each still open", () => {
    expect(req("Power").body).toContain("CR2032");
    expect(req("Battery life").body).toContain("about 9 months");
    expect(req("Loudness limit").body).toContain("about 70 dB at 1 m");
    expect(req("Off switch is a true disconnect").body).toContain("side-actuated slide switch");
    expect(req("Clips from the capacitor buffer").body).toMatch(/about 2\.5 full-level clips.*every about 154 s/);
    expect(req("Lithium within the checked-baggage limit").body).toContain("0.07 g");
    expect(req("Lithium within the checked-baggage limit").body).toContain("0.3 g of lithium metal");
    for (const t of ["Power", "Battery life", "Loudness limit", "Off switch is a true disconnect", "Low battery", "Clips from the capacitor buffer", "Lithium within the checked-baggage limit", "Firmware changes for Rev D", "Firmware sketch compiles"]) expect(req(t).status, t).toBe("open");
    for (const t of ["Power", "Battery life", "Loudness limit", "Clips from the capacitor buffer"]) expect(req(t).body, t).toMatch(/estimate|calculated/i);
  });

  it("lists the firmware changes and rewrites no firmware", () => {
    const fw = req("Firmware changes for Rev D");
    expect((fw.data.changes as string[]).length).toBe(8);
    expect(fw.body).toContain("None is made yet.");
    expect(req("Firmware sketch compiles").body).toContain("Not proved for Rev D.");
    // the batch adds no file: the firmware in Files is still the 2 x AA design's
    expect(revD.rows.some((r) => r.op === "add" && r.section === "concept/files")).toBe(false);
  });

  it("gives the bench tests Rev D's pass marks, all still not run", () => {
    expect(String(test("Sleep current").data.pass)).toContain("12.5 uA");
    expect(String(test("Loudness at 1 m").data.pass)).toContain("about 70 dB");
    expect(String(test("Clip recharge from the capacitor").data.pass)).toContain("154 s");
    for (const t of ["Sleep current", "Awake current", "Loudness at 1 m", "Off switch disconnect", "Clip recharge from the capacitor", "Lithium on paper", "Low battery behaviour"]) expect(test(t).status, t).toBe("not run");
  });
});

describe("the Rev D batch: the enclosure and its print jobs", () => {
  it("records the authored design as the concept's enclosure, with the settings to compare the generator's box", async () => {
    const { authoredOf } = await import("@/lib/enclosure/authored");
    const saved = after.filter((r) => r.section === "design/enclosure");
    expect(saved).toHaveLength(1);
    const a = authoredOf(saved[0].data)!;
    expect(a.model).toBe("BaggageClaims_Tag_RevD_A_assembly.3mf");
    expect(a.printFiles).toEqual(["BaggageClaims_Tag_RevD_A_print_plate_PETG.3mf", "BaggageClaims_Tag_RevD_A_print_plate_TPU.3mf"]);
    expect(a.checks.filter((c) => c.ok)).toHaveLength(20);
    expect(a.checkedBy).toContain("not measured by this app");
    expect(saved[0].data.enclosureGenerator).toBeUndefined();
  });

  it("replaces the clamshell's print jobs with Rev D's two: PETG in the A1 colours and the TPU strap, queued, with estimates", () => {
    const jobs = after.filter((r) => r.section === "prototype/printing");
    expect(jobs.map((j) => j.title)).toEqual(["Rev D tag, job 1: PETG in two colours", "Rev D tag, job 2: TPU strap"]);
    const [petg, tpu] = jobs;
    expect(petg.data).toMatchObject({ material: "PETG", fileName: "BaggageClaims_Tag_RevD_A_print_plate_PETG.3mf", colours: ["Bambu Lab PETG HF Peanut Brown", "Bambu Lab PETG HF Cream"] });
    expect(tpu.data).toMatchObject({ material: "TPU", fileName: "BaggageClaims_Tag_RevD_A_print_plate_TPU.3mf", colours: ["Bambu Lab TPU for AMS Black"] });
    for (const j of jobs) {
      expect(j.status).toBe("queued");
      expect(String(j.data.estimate)).toContain("not sliced");
      expect(typeof j.data.grams).toBe("number");
      expect(typeof j.data.minutes).toBe("number");
    }
  });

  it("gives the welcome page the authored design itself (no generated box): its size, and every one of its own checks met", async () => {
    const { exampleData } = await import("@/components/welcome/exampleData");
    const { authoredOf } = await import("@/lib/enclosure/authored");
    const d = await exampleData();
    const authored = authoredOf(d.enclosureRow?.data);
    expect(authored?.size).toEqual([62, 92, 12.8]);
    expect(authored?.checks.length).toBeGreaterThan(0);
    expect(authored?.checks.filter((c) => !c.ok).map((c) => c.label)).toEqual([]);
    // the Design gate reads the authored design's own checks
    expect(d.gates.design.checks.find((c) => c.id === "design.enclosure")?.met).toBe(true);
  }, 60_000);
});

describe("the Rev D files, in a database", () => {
  it("are in Files, folder Design and build, each file as listed; the renders are images, the 3MFs files to download", async () => {
    await ready();
    const rows = await q<{ title: string; status: string; data: { folder: string; mime: string; extract: { method: string } }; size: number }>(
      "SELECT i.title, i.status, i.data, f.size FROM items i JOIN files f ON f.id = (i.data->>'fileId')::bigint WHERE i.project_id='baggage-claims' AND i.section='concept/files' AND i.title LIKE 'BaggageClaims_Tag_RevD_%' ORDER BY i.sort",
    );
    expect(rows).toHaveLength(12);
    for (const r of rows) {
      expect(r.status, r.title).toBe("stored");
      expect(r.data.folder, r.title).toBe("Design and build");
      expect(r.size, r.title).toBeLessThanOrEqual(25 * 1024 * 1024);
    }
    const by = (t: string) => rows.find((r) => r.title === t)!;
    expect(by("BaggageClaims_Tag_RevD_A1_hero.jpg").data).toMatchObject({ mime: "image/jpeg", extract: { method: "image" } });
    expect(by("BaggageClaims_Tag_RevD_A_assembly.3mf").data).toMatchObject({ mime: "model/3mf", extract: { method: "binary" } });
    expect(by("BaggageClaims_Tag_RevD_Engineering.md").data.extract.method).toBe("text");
    // the authored enclosure names only files that are there
    const { authoredFiles, authoredOf } = await import("@/lib/enclosure/authored");
    const saved = after.find((r) => r.section === "design/enclosure")!;
    for (const f of authoredFiles(authoredOf(saved.data)!)) expect(rows.some((r) => r.title === f), f).toBe(true);
  });

  it("gives each print job the id of its 3MF in Files", async () => {
    await ready();
    // other files in this shared database store the seeded files again under new ids: enter the jobs afresh
    await q("DELETE FROM items WHERE project_id='baggage-claims' AND section='prototype/printing' AND title LIKE 'Rev D tag%'");
    await q("DELETE FROM events WHERE project_id='baggage-claims' AND kind='seed.content' AND data->>'batch'=$1", [revD.batch]);
    await seedContent(pool());
    const jobs = await q<{ title: string; data: { fileId?: number; fileName: string } }>("SELECT title, data FROM items WHERE project_id='baggage-claims' AND section='prototype/printing' AND title LIKE 'Rev D tag%' ORDER BY title");
    expect(jobs).toHaveLength(2);
    for (const j of jobs) {
      const f = await q<{ name: string }>("SELECT name FROM files WHERE id=$1", [j.data.fileId]);
      expect(f[0]?.name, j.title).toBe(j.data.fileName);
    }
  });
});
