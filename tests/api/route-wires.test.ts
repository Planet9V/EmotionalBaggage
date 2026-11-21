// Wire routing and the harness drawing through the app's API, against the real planner service
// (started by tests/plan/planner.setup.ts) and a real PostgreSQL. The degraded paths use a closed
// port, a refusing stand-in and a stand-in that never answers.
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, inject } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as routeWires } from "@/app/api/projects/[id]/route-wires/route";
import { POST as harness } from "@/app/api/projects/[id]/harness/route";
import { cutLengthMm } from "@/components/buildsheet/derive";
import { GET as getItems } from "@/app/api/projects/[id]/items/route";
import { PUT as setPins } from "@/app/api/items/[id]/pins/route";
import { routePartsOf } from "@/lib/geometry/pins3d";
import { pinsOfProject } from "@/lib/parts/server";
import { anonymous, ctx, json, read } from "./helpers";
import { add, events, newConcept, patch } from "../trace/helpers";
import { buildRouteRequest, routeState } from "@/lib/geometry/routing";
import { toPart, toWire } from "@/lib/domain";
import { estimateLength, routeFingerprints, partMap, toWires, cutList, sequence } from "@/components/buildsheet/derive";
import type { Item } from "@/lib/types";

type Err = { error: string; detail?: { reason?: string; skipped?: unknown[] } };
type Outcome = { routed: number; failed: { wireId: number; name: string; reasons: string[] }[]; skipped: { wireId: number; reason: string }[]; faceEnds: number; cell: number; requestedCell: number; cells: number; plannerMs: number };

const before = process.env.PLANNER_URL;
const beforeSeconds = process.env.ROUTE_PLANNER_SECONDS;
let project = "";
let wireIds: number[] = [];
let batteryId = 0;
const servers: Server[] = [];

const box = (size: number[], pos: number[]) => ({ shape: "box", size, pos, basis: "typical" });
const post = (body: unknown = {}) => routeWires(json("POST", body), ctx(project));

async function items(section: string) {
  const r = await read<{ items: Item[] }>(await getItems(json("GET", undefined, `http://t/api/projects/${project}/items?section=${encodeURIComponent(section)}`), ctx(project)));
  return r.body.items;
}

beforeAll(async () => {
  project = await newConcept("route wires");
  await add(project, "design/bom", "Enclosure", { data: { ref: "ENC", geometry: { shape: "shell", size: [80, 42, 60], pos: [0, 21, 0], basis: "typical", print: true } } });
  await add(project, "design/bom", "Controller", { data: { ref: "U1", geometry: box([10, 6, 10], [-28, 5, 0]) } });
  await add(project, "design/bom", "Speaker", { data: { ref: "SP1", geometry: box([10, 6, 10], [28, 5, 0]) } });
  // a tall battery between the two, so a straight line is blocked
  const b = await add(project, "design/bom", "Battery", { data: { ref: "BAT1", geometry: box([8, 30, 40], [0, 17, 0]) } });
  batteryId = b.body.item.id;
  await add(project, "design/bom", "No shape yet", { data: { ref: "X1" } });
  const w1 = await add(project, "design/wiring", "Speaker plus", { data: { from: "U1", fromPin: "OUT", to: "SP1", toPin: "+", netClass: "audio", net: "AUDIO", order: 1 } });
  const w2 = await add(project, "design/wiring", "Speaker minus", { data: { from: "U1", fromPin: "GND", to: "SP1", toPin: "-", netClass: "ground", net: "GND", order: 2 } });
  const w3 = await add(project, "design/wiring", "To a part with no shape", { data: { from: "U1", fromPin: "A", to: "X1", toPin: "1", order: 3 } });
  wireIds = [w1.body.item.id, w2.body.item.id, w3.body.item.id];
});

afterEach(() => {
  if (before === undefined) delete process.env.PLANNER_URL;
  else process.env.PLANNER_URL = before;
  if (beforeSeconds === undefined) delete process.env.ROUTE_PLANNER_SECONDS;
  else process.env.ROUTE_PLANNER_SECONDS = beforeSeconds;
});

afterAll(async () => {
  for (const s of servers) await new Promise((r) => s.close(r));
  await q("DELETE FROM projects WHERE id=$1", [project]);
  await pool().end();
});

function listen(handler: Parameters<typeof createServer>[1]) {
  return new Promise<string>((resolve) => {
    const s = createServer(handler).listen(0, "127.0.0.1", () => {
      servers.push(s);
      resolve(`http://127.0.0.1:${(s.address() as { port: number }).port}`);
    });
  });
}

describe("routing against the real planner", () => {
  it("routes the wires around the battery, stores each length and path on its row, and records it", async () => {
    process.env.PLANNER_URL = inject("plannerUrl");
    const r = await read<Outcome & Err>(await post({ cell: 2, wallMm: 2 }));
    expect(r.status).toBe(200);
    expect(r.body.routed).toBe(2);
    expect(r.body.skipped).toEqual([{ wireId: wireIds[2], name: "To a part with no shape", reason: "X1 has no position in the model; place it in Physical layout" }].map((s) => expect.objectContaining({ wireId: s.wireId, reason: s.reason, fix: { href: "/s/design/layout", label: "Physical layout" } })));
    expect(r.body.failed).toEqual([]);
    expect(r.body.cell).toBe(2);
    expect(r.body.plannerMs).toBeGreaterThanOrEqual(0);
    expect(r.body.faceEnds).toBe(4); // no pin positions yet: every end is on a face

    const rows = await items("design/wiring");
    const w1 = rows.find((i) => i.id === wireIds[0]) as Item;
    expect(typeof w1.data.routedLengthMm).toBe("number");
    // a straight line is 36 mm between the facing faces; the battery forces a detour
    expect(w1.data.routedLengthMm as number).toBeGreaterThan(40);
    expect(w1.data.routedCellMm).toBe(2);
    expect(typeof w1.data.routedAt).toBe("string");
    const path = w1.data.routedPath as number[][];
    expect(path.length).toBeGreaterThanOrEqual(2);
    // the path never passes through the battery (x -4..4, y 2..32, z -20..20)
    const inside = (p: number[]) => p[0] > -4 && p[0] < 4 && p[1] > 2 && p[1] < 32 && p[2] > -20 && p[2] < 20;
    for (let i = 0; i < path.length - 1; i++) {
      for (let t = 0; t <= 1; t += 0.05) {
        const p = [0, 1, 2].map((k) => path[i][k] + (path[i + 1][k] - path[i][k]) * t);
        expect(inside(p)).toBe(false);
      }
    }
    // and it stays inside the shell's cavity
    for (const p of path) {
      expect(p[0]).toBeGreaterThanOrEqual(-40);
      expect(p[0]).toBeLessThanOrEqual(40);
      expect(p[1]).toBeLessThanOrEqual(42);
    }
    // the wire with a part that has no shape is left untouched
    const w3 = rows.find((i) => i.id === wireIds[2]) as Item;
    expect(w3.data.routedLengthMm).toBeUndefined();

    const ev = (await events(project)).filter((e) => e.kind === "wiring.routed");
    expect(ev).toHaveLength(1);
    expect(ev[0].data).toMatchObject({ routed: 2, cellMm: 2 });
  });

  it("the build sheet uses the routed length, and the estimate is the labelled fallback", async () => {
    const partRows = await items("design/bom");
    const wireRows = await items("design/wiring");
    const parts = partMap(partRows);
    const wires = toWires(wireRows);
    const fps = routeFingerprints(parts, wires);
    const w1 = wires.find((w) => w.item.id === wireIds[0])!;
    const routed = estimateLength(w1, parts, 1.5, 20, fps.get(w1.item.id));
    expect(routed?.source).toBe("routed");
    expect(routed?.straight).toBe(w1.routed!.lengthMm);
    expect(routed?.raw).toBeCloseTo(w1.routed!.lengthMm + 20, 6);
    expect(routed!.mm % 5).toBe(0);
    expect(routed!.mm).toBeGreaterThanOrEqual(routed!.raw);
    // the unrouted wire has a centre-to-centre estimate only if both parts have geometry: X1 has none
    const rows = cutList(sequence(wires), parts, 1.5, 20);
    expect(rows.find((r) => r.wire.item.id === wireIds[0])?.length?.source).toBe("routed");
    expect(rows.find((r) => r.wire.item.id === wireIds[2])?.length).toBeNull();
    // with nothing routed the same wire falls back to the estimate
    const bare = { ...w1, routed: null };
    expect(estimateLength(bare, parts, 1.5, 20)?.source).toBe("estimate");
  });

  it("moving a part makes the stored route out of date, and the build sheet says estimate again", async () => {
    await patch(batteryId, { data: { geometry: box([8, 30, 40], [3, 17, 0]) } });
    const partRows = await items("design/bom");
    const wireRows = await items("design/wiring");
    const parts = partMap(partRows);
    const wires = toWires(wireRows);
    const w1 = wires.find((w) => w.item.id === wireIds[0])!;
    const fp = routeFingerprints(parts, wires).get(w1.item.id) as string;
    expect(routeState({ routedLengthMm: w1.routed!.lengthMm, routedFingerprint: w1.routed!.fingerprint }, fp)).toBe("stale");
    const len = estimateLength(w1, parts, 1.5, 20, fp);
    expect(len?.source).toBe("estimate");
    expect(len?.stale).toBe(true);
    // routing again makes it current
    process.env.PLANNER_URL = inject("plannerUrl");
    expect((await post()).status).toBe(200);
    const again = toWires(await items("design/wiring")).find((w) => w.item.id === wireIds[0])!;
    const fp2 = routeFingerprints(partMap(await items("design/bom")), [again]).get(again.item.id) as string;
    expect(again.routed?.fingerprint).toBe(fp2);
  });

  it("a wire that cannot be routed loses its old length instead of keeping a wrong one", async () => {
    process.env.PLANNER_URL = inject("plannerUrl");
    // bury the second speaker pin: a part that fills the whole cavity leaves no free cell
    await patch(batteryId, { data: { geometry: box([76, 38, 56], [0, 21, 0]) } });
    const r = await read<Outcome>(await post());
    expect(r.status).toBe(200);
    expect(r.body.routed).toBe(0);
    expect(r.body.failed.length).toBe(2);
    expect(r.body.failed[0].reasons.join(" ")).toMatch(/buried|no free/);
    const w1 = (await items("design/wiring")).find((i) => i.id === wireIds[0]) as Item;
    expect(w1.data.routedLengthMm).toBeUndefined();
    expect(w1.data.routedPath).toBeUndefined();
    await patch(batteryId, { data: { geometry: box([8, 30, 40], [0, 17, 0]) } });
  });
});

describe("routing when things are wrong", () => {
  it("says so when no planner address is set", async () => {
    delete process.env.PLANNER_URL;
    const r = await read<Err>(await post());
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/planner service is not set up/);
    expect(r.body.detail?.reason).toBe("not-configured");
  });

  it("says the planner is not reachable, and changes nothing", async () => {
    const stamp = (await q<{ n: string }>("SELECT max(updated_at)::text AS n FROM items WHERE project_id=$1 AND section='design/wiring'", [project]))[0].n;
    const port = await new Promise<number>((resolve) => {
      const s = createServer().listen(0, "127.0.0.1", () => {
        const a = s.address();
        s.close(() => resolve(typeof a === "object" && a ? a.port : 9));
      });
    });
    process.env.PLANNER_URL = `http://127.0.0.1:${port}`;
    const r = await read<Err>(await post());
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/not reachable/);
    expect(r.body.error).toMatch(/Nothing was changed/);
    expect(r.body.detail?.reason).toBe("unreachable");
    const now = (await q<{ n: string }>("SELECT max(updated_at)::text AS n FROM items WHERE project_id=$1 AND section='design/wiring'", [project]))[0].n;
    expect(now).toBe(stamp);
  });

  it("says the planner refused, with its status", async () => {
    process.env.PLANNER_URL = await listen((_req, res) => {
      res.statusCode = 500;
      res.end("boom");
    });
    const r = await read<Err>(await post());
    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/refused the routing request \(500\)/);
  });

  it("gives up after the time limit instead of waiting for ever", async () => {
    process.env.ROUTE_PLANNER_SECONDS = "0.4";
    process.env.PLANNER_URL = await listen(() => {
      /* never answers */
    });
    // the limit is read when the module loads in production; here the handler reads it per call
    const t0 = Date.now();
    const r = await read<Err>(await post());
    expect(Date.now() - t0).toBeLessThan(5000);
    expect([r.status, r.body.detail?.reason]).toEqual([504, "timeout"]);
    expect(r.body.error).toMatch(/did not answer within/);
  }, 15_000);

  it("refuses nothing to route, a bad body, an unknown concept and a signed-out caller", async () => {
    process.env.PLANNER_URL = inject("plannerUrl");
    const empty = await newConcept("route nothing");
    expect((await read<Err>(await routeWires(json("POST", {}), ctx(empty)))).body.error).toMatch(/no wires to route/);
    await add(empty, "design/bom", "A", { data: { ref: "A1" } });
    await add(empty, "design/wiring", "w", { data: { from: "A1", to: "B1" } });
    const r = await read<Err>(await routeWires(json("POST", {}), ctx(empty)));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/no space to route in|nothing to route/);
    await q("DELETE FROM projects WHERE id=$1", [empty]);
    expect((await post({ cell: 0.01 })).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    expect((await routeWires(json("POST", {}), ctx("nope"))).status).toBe(404);
    expect((await routeWires(anonymous("POST", {}), ctx(project))).status).toBe(401);
  });
});

describe("the harness drawing", () => {
  it("draws through WireViz in the planner, with routed lengths only where a route is current", async () => {
    process.env.PLANNER_URL = inject("plannerUrl");
    expect((await post()).status).toBe(200);
    const r = await read<{ svg: string; yaml: string; bom: Record<string, string>[]; seconds: number; wireviz: string; problems: string[]; withLength: number; withoutLength: number } & Err>(await harness(json("POST", {}), ctx(project)));
    expect(r.status, JSON.stringify(r.body).slice(0, 300)).toBe(200);
    expect(r.body.svg).toContain("<svg");
    expect(r.body.yaml).toContain("W1");
    expect(r.body.withLength).toBe(2);
    expect(r.body.withoutLength).toBe(1); // the wire to the part with no shape
    expect(r.body.bom.length).toBeGreaterThan(0);
    expect(r.body.wireviz).toMatch(/^WireViz/);
    // the drawing carries the cut length (the routed run plus 20 mm, rounded up to 5 mm), the same as the cut list
    const w1 = toWires(await items("design/wiring")).find((w) => w.item.id === wireIds[0])!;
    expect(r.body.yaml).toContain(`length: ${cutLengthMm(w1.routed!.lengthMm, 20).toFixed(1)} mm`);
    expect(r.body.yaml).not.toContain(`length: ${w1.routed!.lengthMm.toFixed(1)} mm`);
    expect((r.body as unknown as { allowanceMm: number }).allowanceMm).toBe(20);
    // with the build sheet's own allowance
    const r30 = await read<{ yaml: string; allowanceMm: number }>(await harness(json("POST", { allowanceMm: 30 }), ctx(project)));
    expect(r30.body.allowanceMm).toBe(30);
    expect(r30.body.yaml).toContain(`length: ${cutLengthMm(w1.routed!.lengthMm, 30).toFixed(1)} mm`);
  });

  it("an unrouted wire is drawn with no length", async () => {
    process.env.PLANNER_URL = inject("plannerUrl");
    await patch(batteryId, { data: { geometry: box([8, 30, 40], [5, 17, 0]) } });
    const r = await read<{ yaml: string; withLength: number; withoutLength: number }>(await harness(json("POST", {}), ctx(project)));
    expect([r.body.withLength, r.body.withoutLength]).toEqual([0, 3]);
    expect(r.body.yaml).not.toContain("length:");
  });

  it("says so when the planner is missing or unreachable", async () => {
    delete process.env.PLANNER_URL;
    expect((await read<Err>(await harness(json("POST", {}), ctx(project)))).status).toBe(503);
    process.env.PLANNER_URL = "http://127.0.0.1:9";
    const r = await read<Err>(await harness(json("POST", {}), ctx(project)));
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/not reachable/);
  });

  it("passes on the planner's own reason when WireViz is missing", async () => {
    process.env.PLANNER_URL = await listen((_req, res) => {
      res.statusCode = 503;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ detail: "WireViz is not installed in the planner, so the harness cannot be drawn." }));
    });
    const r = await read<Err>(await harness(json("POST", {}), ctx(project)));
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/WireViz is not installed/);
  });

  it("refuses a concept with no wires and a signed-out caller", async () => {
    process.env.PLANNER_URL = inject("plannerUrl");
    const empty = await newConcept("harness nothing");
    expect((await harness(json("POST", {}), ctx(empty))).status).toBe(400);
    await q("DELETE FROM projects WHERE id=$1", [empty]);
    expect((await harness(anonymous("POST", {}), ctx(project))).status).toBe(401);
  });
});

describe("the model of the test", () => {
  it("is what the routing code reads", async () => {
    const parts = (await items("design/bom")).map(toPart);
    const wires = (await items("design/wiring")).map(toWire).filter((w) => w !== null);
    const built = buildRouteRequest(
      parts.filter((p) => p.geometry && p.ref).map((p) => ({ id: p.item.id, ref: p.ref, geometry: p.geometry!, pins: p.item.data.pins })),
      wires.map((w) => ({ id: w.item.id, name: w.name, from: w.from, fromPin: w.fromPin, to: w.to, toPin: w.toPin }))
    );
    expect(built.request?.nets).toHaveLength(2);
    expect(built.skipped).toHaveLength(1);
  });
});

describe("wire ends at real pin positions (integration item 4)", () => {
  it("a part's pin rows put its wire ends at the pins; the rest stay on a face, and the count says so", async () => {
    process.env.PLANNER_URL = inject("plannerUrl");
    const sp = (await items("design/bom")).find((i) => i.data.ref === "SP1")!;
    // the speaker's two pins on its top, 3 mm either side of its centre along x
    const put = await setPins(json("PUT", { pins: [{ name: "+", kind: "passive", position: { x: -3, y: 0 } }, { name: "-", kind: "passive", position: { x: 3, y: 0 } }] }), ctx(String(sp.id)));
    expect(put.status).toBe(200);
    const r = await read<Outcome>(await post());
    expect(r.status).toBe(200);
    expect(r.body.faceEnds).toBe(2); // the controller has no pin positions; the speaker's two ends are real
    const parts = (await items("design/bom")).map(toPart);
    const built = buildRouteRequest(routePartsOf(parts, await pinsOfProject(project)), (await items("design/wiring")).map(toWire).filter((w) => w !== null).map((w) => ({ id: w.item.id, name: w.name, from: w.from, fromPin: w.fromPin, to: w.to, toPin: w.toPin })));
    const plus = built.request!.nets.find((n) => n.terminals.some((t) => t.id === "SP1.+"))!;
    // speaker centre (28, 5, 0), size 10 x 6 x 10: the pin is on the top face (y = 8) at x = 25
    expect(plus.terminals.find((t) => t.id === "SP1.+")!.pos).toEqual([25, 8, 0]);
    // the stored route is current against the same pin positions the 3D view uses
    const w = (await items("design/wiring")).find((i) => i.title === "Speaker plus")!;
    expect(routeState({ routedLengthMm: w.data.routedLengthMm as number, routedFingerprint: w.data.routedFingerprint as string }, built.fingerprints.get(w.id)!)).toBe("current");
  });
});
