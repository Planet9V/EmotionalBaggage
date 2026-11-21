import { afterAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { DELETE as removeItem } from "@/app/api/items/[id]/route";
import { PUT as putPins } from "@/app/api/items/[id]/pins/route";
import { GET as listPins } from "@/app/api/projects/[id]/pins/route";
import { GET as erc } from "@/app/api/projects/[id]/erc/route";
import { POST as duplicate } from "@/app/api/projects/[id]/duplicate/route";
import { DELETE as removeConcept } from "@/app/api/projects/[id]/route";
import { ercForProject } from "@/lib/parts/server";
import { anonymous, ctx, json, read, SEEDED } from "./helpers";

type ItemBody = { item: { id: number; data: Record<string, unknown> } };
type PinsBody = { pins: { id: number; itemId: number; name: string; kind: string | null; voltage?: { min?: number; max?: number }; bus?: { type: string; line: string }; optional?: boolean }[] };

const made: number[] = [];
afterAll(async () => {
  await q("DELETE FROM items WHERE title LIKE 'test-pins:%'");
  await pool().end();
});

async function part(title: string, data: Record<string, unknown>) {
  const r = await read<ItemBody>(await addItem(json("POST", { section: "design/bom", title: `test-pins: ${title}`, data }), ctx(SEEDED)));
  expect(r.status).toBe(201);
  made.push(r.body.item.id);
  return r.body.item;
}

describe("pins of a part", () => {
  it("needs a session", async () => {
    expect((await putPins(anonymous("PUT", { pins: [] }), ctx("1"))).status).toBe(401);
    expect((await listPins(anonymous("GET"), ctx(SEEDED))).status).toBe(401);
  });

  it("stores a part's own pins, lists them, records before and after, and replaces them as a whole", async () => {
    const p = await part("sensor", { ref: "TP901", kind: "sensor" });
    const r = await read<PinsBody>(
      await putPins(
        json("PUT", { pins: [{ name: "VCC", kind: "power_in", voltage: { min: 3, max: 5.5 } }, { name: "SDA", kind: "bidirectional", bus: { type: "i2c", line: "SDA" }, optional: true }, { name: "X" }] }),
        ctx(String(p.id))
      )
    );
    expect(r.status).toBe(200);
    expect(r.body.pins.map((x) => [x.name, x.kind])).toEqual([["VCC", "power_in"], ["SDA", "bidirectional"], ["X", null]]);
    expect(r.body.pins[0].voltage).toEqual({ min: 3, max: 5.5 });
    expect(r.body.pins[1].bus).toEqual({ type: "i2c", line: "SDA" });
    expect(r.body.pins[1].optional).toBe(true);
    const all = await read<PinsBody>(await listPins(json("GET"), ctx(SEEDED)));
    expect(all.body.pins.filter((x) => x.itemId === p.id)).toHaveLength(3);
    const ev = await q<{ summary: string; data: { before: { pins: unknown[] }; after: { pins: { name: string }[] } } }>("SELECT summary, data FROM events WHERE kind='pins.replaced' AND data->>'itemId'=$1 ORDER BY id DESC LIMIT 1", [String(p.id)]);
    expect(ev[0].summary).toContain("Set 3 pins");
    expect(ev[0].data.before.pins).toEqual([]);
    expect(ev[0].data.after.pins.map((x) => x.name)).toEqual(["VCC", "SDA", "X"]);
    const audit = await q<{ action: string }>("SELECT action FROM audit_log WHERE action='pins.replaced' ORDER BY id DESC LIMIT 1");
    expect(audit).toHaveLength(1);

    const again = await read<PinsBody>(await putPins(json("PUT", { pins: [{ name: "GND", kind: "ground" }] }), ctx(String(p.id))));
    expect(again.body.pins.map((x) => x.name)).toEqual(["GND"]);
    const cleared = await read<PinsBody>(await putPins(json("PUT", { pins: [] }), ctx(String(p.id))));
    expect(cleared.body.pins).toEqual([]);
  });

  it("refuses repeated names, an unknown kind, a bad bus line, a backwards range and a row that is not a part", async () => {
    const p = await part("refusals", { ref: "TP902" });
    const bad = async (pins: unknown) => (await putPins(json("PUT", { pins }), ctx(String(p.id)))).status;
    expect(await bad([{ name: "A" }, { name: "A" }])).toBe(400);
    expect(await bad([{ name: "A", kind: "flux" }])).toBe(400);
    expect(await bad([{ name: "A", bus: { type: "i2c", line: "MOSI" } }])).toBe(400);
    expect(await bad([{ name: "A", voltage: { min: 5, max: 3 } }])).toBe(400);
    expect(await bad([{ name: " " }])).toBe(400);
    const brief = await read<ItemBody>(await addItem(json("POST", { section: "concept/brief", title: "test-pins: not a part" }), ctx(SEEDED)));
    const r = await read<{ error: string }>(await putPins(json("PUT", { pins: [{ name: "A" }] }), ctx(String(brief.body.item.id))));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/bill of materials/);
    expect((await putPins(json("PUT", { pins: [] }), ctx("99999999"))).status).toBe(404);
  });

  it("deleting the part deletes its pins", async () => {
    const p = await part("gone", { ref: "TP903" });
    await putPins(json("PUT", { pins: [{ name: "1" }] }), ctx(String(p.id)));
    await removeItem(json("DELETE"), ctx(String(p.id)));
    expect(await q("SELECT 1 FROM pins WHERE item_id=$1", [p.id])).toHaveLength(0);
  });

  it("a part row refuses an unknown kind or library entry, and a wire refuses a part in series", async () => {
    const r1 = await addItem(json("POST", { section: "design/bom", title: "test-pins: odd", data: { kind: "flux-capacitor" } }), ctx(SEEDED));
    expect(r1.status).toBe(400);
    const r2 = await addItem(json("POST", { section: "design/bom", title: "test-pins: odd", data: { library: "nope" } }), ctx(SEEDED));
    expect(r2.status).toBe(400);
    const r3 = await read<{ issues?: { problem: string }[] }>(await addItem(json("POST", { section: "design/wiring", title: "test-pins: via", data: { from: "U1", fromPin: "A", to: "U2", toPin: "B", via: "R1" } }), ctx(SEEDED)));
    expect(r3.status).toBe(400);
    expect(JSON.stringify(r3.body)).toMatch(/its own part/);
  });

  it("duplicating a concept copies the parts' pins", async () => {
    const p = await part("copied", { ref: "TP904" });
    await putPins(json("PUT", { pins: [{ name: "IN", kind: "input" }, { name: "OUT", kind: "output" }] }), ctx(String(p.id)));
    const d = await read<{ project: { id: string } }>(await duplicate(json("POST", { name: "zz pins copy" }), ctx(SEEDED)));
    expect(d.status).toBe(201);
    const copied = await q<{ name: string }>(
      "SELECT pn.name FROM pins pn JOIN items i ON i.id = pn.item_id WHERE pn.project_id=$1 AND i.data->>'ref'='TP904' ORDER BY pn.sort",
      [d.body.project.id]
    );
    expect(copied.map((x) => x.name)).toEqual(["IN", "OUT"]);
    await removeConcept(json("DELETE", { confirm: "zz pins copy" }), ctx(d.body.project.id));
  });
});

describe("electrical checks of a concept", () => {
  it("answers the example's findings, worst first, each with a link", async () => {
    const r = await read<{ ok: boolean; errors: number; findings: { severity: string; link: string; rule: string }[] }>(await erc(json("GET"), ctx(SEEDED)));
    expect(r.status).toBe(200);
    expect(r.body.findings.length).toBeGreaterThan(0);
    for (const f of r.body.findings) expect(f.link).toContain(`concept=${SEEDED}`);
    const sev = r.body.findings.map((f) => ["error", "warning", "info"].indexOf(f.severity));
    expect(sev).toEqual([...sev].sort((a, b) => a - b));
    const direct = await ercForProject(SEEDED);
    expect(direct.findings.length).toBe(r.body.findings.length);
  });

  it("answers 404 for an unknown concept", async () => {
    expect((await erc(json("GET"), ctx("no-such-concept"))).status).toBe(404);
  });
});
