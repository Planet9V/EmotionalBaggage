// The print flow against real PostgreSQL, a fake slicer over real HTTP, and a stand-in printer behind setPortFactory.
// What this proves: the state machine and the confirms. What it cannot prove: that OrcaSlicer or a real printer behaves so
// (the slicer's own tests run the real OrcaSlicer; no real printer was available).
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { GET as plan } from "@/app/api/print-jobs/[id]/plan/route";
import { POST as slice } from "@/app/api/print-jobs/[id]/slice/route";
import { POST as send } from "@/app/api/print-jobs/[id]/send/route";
import { POST as start } from "@/app/api/print-jobs/[id]/start/route";
import { POST as control } from "@/app/api/print-jobs/[id]/control/route";
import { GET as track } from "@/app/api/print-jobs/[id]/track/route";
import { POST as result } from "@/app/api/print-jobs/[id]/result/route";
import { GET as listJobs } from "@/app/api/projects/[id]/print-jobs/route";
import { setPortFactory, FileOnlyPort, type PortCapabilities, type PortState, type PrinterPort } from "@/lib/slicing/printerPort";
import { ctx, json, read, SEEDED } from "../api/helpers";

// Row data read back from the database: shape checked by the assertions, not by the type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

type Item = { id: number; status: string; data: Loose; title: string };
type Body = { item: Item; error?: string };

const JOB_ID = "a".repeat(32);
const GCODE = "; total estimated time: 19m 51s\nG28\nG1 X10\n";
let slicerMode: "ok" | "refuse" = "ok";
let sliceCalls = 0;
let server: Server;
let printerId = 0;
let fileId = 0;
const NAME = `test-printer-${Date.now()}`;

const caps = (extra: Partial<PortCapabilities> = {}): PortCapabilities => ({ status: true, upload: true, start: true, pause: true, resume: true, cancel: true, fileTypes: [".gcode"], notes: [], ...extra });

class StubPort implements PrinterPort {
  readonly family = "stub";
  capabilities: PortCapabilities;
  calls: string[] = [];
  state: PortState = "idle";
  constructor(c: Partial<PortCapabilities> = {}) { this.capabilities = caps(c); }
  async test() { return { ok: true, message: "ok" }; }
  async status() { this.calls.push("status"); return { state: this.state, file: null }; }
  async upload(_f: unknown, name: string) { this.calls.push(`upload:${name}`); return { name, message: "uploaded" }; }
  async start(name: string) { this.calls.push(`start:${name}`); return { ok: true as const, message: "started" }; }
  async pause() { this.calls.push("pause"); return { ok: true as const, message: "paused" }; }
  async resume() { this.calls.push("resume"); return { ok: true as const, message: "resumed" }; }
  async cancel() { this.calls.push("cancel"); return { ok: true as const, message: "cancelled" }; }
}
let port: StubPort;
let restore: () => void;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? "";
    const done = (status: number, body: string | Buffer, type = "application/json") => { res.writeHead(status, { "content-type": type }); res.end(body); };
    req.resume();
    req.on("end", () => {
      if (req.method === "POST" && url === "/slice") {
        sliceCalls++;
        if (slicerMode === "refuse") return done(422, JSON.stringify({ detail: "No 0.05 mm layer height profile for this printer." }));
        return done(200, JSON.stringify({
          id: JOB_ID, orca: { version: "2.5.0", profileCommit: "abc" },
          profile: { machine: "Bambu Lab A1 0.4 nozzle", process: "0.20mm Standard @BBL A1", filament: "Generic PLA @BBL A1", note: "" },
          settings: { layerHeight: 0.2, infill: 15, supports: false, material: "PLA" },
          result: { seconds: 1191.2, filamentMm: 1221.41, filamentG: 3.7, filamentCm3: 2.9, supportG: null, layers: 100, readFrom: "statistics.json" },
          warnings: [],
          files: { gcode: { name: "cube.gcode", url: `/jobs/${JOB_ID}/gcode` }, project: { name: "cube.gcode.3mf", url: `/jobs/${JOB_ID}/project` }, statistics: null },
        }));
      }
      if (req.method === "GET" && url === `/jobs/${JOB_ID}/gcode`) return done(200, GCODE, "text/plain");
      if (req.method === "GET" && url === `/jobs/${JOB_ID}/project`) return done(200, Buffer.from("PK-fake-3mf"), "application/octet-stream");
      if (req.method === "DELETE") return done(200, "{}");
      return done(404, "{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.SLICER_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  printerId = Number((await q<{ id: string }>("INSERT INTO printers (name, family, model, address) VALUES ($1,'octoprint','A1','http://x') RETURNING id", [NAME]))[0].id);
  fileId = Number((await q<{ id: string }>(
    "INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes) VALUES ($1,'test-cube.stl','model/stl','stl',4,'x',$2) RETURNING id", [SEEDED, Buffer.from("solid")]))[0].id);
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  await q("DELETE FROM items WHERE title LIKE 'test:%'");
  await q("DELETE FROM files WHERE name LIKE 'test-%' OR name LIKE 'cube.%' OR meta->>'slicer' LIKE 'OrcaSlicer%'");
  await q("DELETE FROM printers WHERE name=$1", [NAME]);
  delete process.env.SLICER_URL;
  await pool().end();
});

beforeEach(() => { slicerMode = "ok"; sliceCalls = 0; port = new StubPort(); restore = setPortFactory(() => port); });
afterEach(() => restore());

async function job(data: Record<string, unknown> = {}): Promise<Item> {
  const r = await read<Body>(await addItem(json("POST", { section: "prototype/printing", title: "test: lid", status: "queued", data: { fileId, fileName: "test-cube.stl", printerId, printerName: NAME, printerMaker: "Bambu Lab", printerModel: "A1", material: "PLA", layerHeight: 0.2, infill: 15, supports: false, ...data } }), ctx(SEEDED)));
  expect(r.status).toBe(201);
  return r.body.item;
}
const act = (h: typeof slice, id: number, payload?: unknown) => h(json("POST", payload), ctx(String(id)));
const get = async (id: number) => (await q<{ status: string; data: Loose }>("SELECT status, data FROM items WHERE id=$1", [id]))[0];
const events = async (kind: string, id: number) => (await q<{ n: string }>("SELECT count(*) n FROM events WHERE kind=$1 AND data->>'itemId'=$2", [kind, String(id)]))[0].n;

async function sliced() {
  const j = await job();
  expect((await act(slice, j.id)).status).toBe(200);
  return j;
}
const nameOf = async (id: number) => (await read<{ send: { name: string } }>(await plan(json("GET"), ctx(String(id))))).body.send.name;

describe("slicing", () => {
  it("stores what the slicer made and keeps the slicer's own numbers", async () => {
    const j = await job();
    const r = await read<Body>(await act(slice, j.id));
    expect(r.status).toBe(200);
    expect(r.body.item.status).toBe("sliced");
    const d = (await get(j.id)).data;
    expect(d.slice).toMatchObject({ seconds: 1191.2, filamentG: 3.7, filamentMm: 1221.41, orcaVersion: "2.5.0", profile: { machine: "Bambu Lab A1 0.4 nozzle" } });
    expect(d.slice.gcodeSha256).toMatch(/^[0-9a-f]{64}$/);
    const files = await q<{ kind: string; size: string }>("SELECT kind, size FROM files WHERE id = ANY($1::bigint[])", [[d.slice.gcodeFileId, d.slice.projectFileId]]);
    expect(files.map((f) => f.kind).sort()).toEqual(["gcode", "gcode3mf"]);
    expect(await events("print.sliced", j.id)).toBe("1");
    expect(sliceCalls).toBe(1);
  });

  it("puts the job back to queued with the slicer's own words when it refuses", async () => {
    slicerMode = "refuse";
    const j = await job({ layerHeight: 0.05 });
    const r = await read<Body>(await act(slice, j.id));
    expect(r.status).toBe(422);
    expect(r.body.error).toContain("0.05 mm");
    const now = await get(j.id);
    expect(now.status).toBe("queued");
    expect(now.data.sliceError).toContain("0.05 mm");
    expect(now.data.slice).toBeUndefined();
    expect(await events("print.slice-failed", j.id)).toBe("1");
  });

  it("says the slicer is not set up, and leaves the job queued, when there is no address", async () => {
    const was = process.env.SLICER_URL;
    delete process.env.SLICER_URL;
    try {
      const j = await job();
      const r = await read<Body>(await act(slice, j.id));
      expect(r.status).toBe(503);
      expect(r.body.error).toMatch(/not set up/);
      expect((await get(j.id)).status).toBe("queued");
    } finally {
      process.env.SLICER_URL = was;
    }
  });

  it("refuses a job with no file, printer or model before it asks the slicer", async () => {
    for (const bad of [{ fileId: null }, { printerId: null }, { printerModel: "" }]) {
      const j = await job(bad);
      expect((await act(slice, j.id)).status).toBe(409);
      expect((await get(j.id)).status).toBe("queued");
    }
    expect(sliceCalls).toBe(0);
  });

  it("cannot slice a job that is already sent", async () => {
    const j = await sliced();
    await act(send, j.id, { confirm: { printer: NAME, file: await nameOf(j.id) } });
    expect((await get(j.id)).status).toBe("sent");
    expect((await act(slice, j.id)).status).toBe(409);
  });
});

describe("nothing is sent or started without a confirm that names the printer and the file", () => {
  it("refuses Send with no confirm, the wrong printer, or the wrong file, and uploads nothing", async () => {
    const j = await sliced();
    const file = await nameOf(j.id);
    for (const payload of [undefined, {}, { confirm: { printer: NAME } }, { confirm: { printer: "Other", file } }, { confirm: { printer: NAME, file: "other.gcode" } }]) {
      const r = await read<Body>(await act(send, j.id, payload));
      expect(r.status).toBe(400);
    }
    expect(port.calls).toEqual([]);
    expect((await get(j.id)).status).toBe("sliced");
  });

  it("sends once the confirm matches, uploading the planned name and recording it", async () => {
    const j = await sliced();
    const file = await nameOf(j.id);
    expect(file).toBe(`test_lid-${j.id}.gcode`);
    const r = await read<Body>(await act(send, j.id, { confirm: { printer: NAME, file } }));
    expect(r.status).toBe(200);
    expect(r.body.item.status).toBe("sent");
    expect(port.calls).toEqual([`upload:${file}`]);
    expect((await get(j.id)).data.sentName).toBe(file);
    expect(await events("print.sent", j.id)).toBe("1");
  });

  it("refuses Send when the stored G-code no longer matches what was sliced", async () => {
    const j = await sliced();
    const d = (await get(j.id)).data;
    await q("UPDATE files SET bytes = $2 WHERE id=$1", [d.slice.gcodeFileId, Buffer.from("G1 X999 ; tampered")]);
    await q("UPDATE files SET sha256='0' WHERE id=$1", [d.slice.gcodeFileId]);
    const r = await read<Body>(await act(send, j.id, { confirm: { printer: NAME, file: await nameOf(j.id) } }));
    expect(r.status).toBe(409);
    expect(port.calls).toEqual([]);
  });

  it("refuses Start on a job that is only sliced, whatever the confirm says", async () => {
    const j = await sliced();
    const r = await read<Body>(await act(start, j.id, { confirm: { printer: NAME, file: await nameOf(j.id) } }));
    expect(r.status).toBe(409);
    expect(port.calls).toEqual([]);
  });

  it("refuses Start with no confirm or a wrong one, and moves nothing", async () => {
    const j = await sliced();
    const file = await nameOf(j.id);
    await act(send, j.id, { confirm: { printer: NAME, file } });
    port.calls.length = 0;
    for (const payload of [undefined, { confirm: { printer: NAME, file: "x.gcode" } }, { confirm: { printer: "Other", file } }]) {
      expect((await act(start, j.id, payload)).status).toBe(400);
    }
    expect(port.calls).toEqual([]);
    expect((await get(j.id)).status).toBe("sent");
  });

  it("starts with a matching confirm, and records who and what", async () => {
    const j = await sliced();
    const file = await nameOf(j.id);
    await act(send, j.id, { confirm: { printer: NAME, file } });
    const r = await read<Body>(await act(start, j.id, { confirm: { printer: NAME, file } }));
    expect(r.status).toBe(200);
    expect(r.body.item.status).toBe("printing");
    expect(port.calls).toContain(`start:${file}`);
    expect((await get(j.id)).data.startedAt).toBeTruthy();
    expect(await events("print.started", j.id)).toBe("1");
  });

  it("will not start a second time", async () => {
    const j = await sliced();
    const file = await nameOf(j.id);
    await act(send, j.id, { confirm: { printer: NAME, file } });
    await act(start, j.id, { confirm: { printer: NAME, file } });
    expect((await act(start, j.id, { confirm: { printer: NAME, file } })).status).toBe(409);
    expect(port.calls.filter((c) => c.startsWith("start:"))).toHaveLength(1);
  });

  it("makes cancelling a running print as deliberate as starting it", async () => {
    const j = await sliced();
    const file = await nameOf(j.id);
    await act(send, j.id, { confirm: { printer: NAME, file } });
    await act(start, j.id, { confirm: { printer: NAME, file } });
    expect((await act(control, j.id, { action: "cancel" })).status).toBe(400);
    expect(port.calls).not.toContain("cancel");
    const r = await read<Body>(await act(control, j.id, { action: "cancel", confirm: { printer: NAME, file } }));
    expect(r.body.item.status).toBe("cancelled");
    expect(port.calls).toContain("cancel");
  });

  it("pauses and resumes a running print", async () => {
    const j = await sliced();
    const file = await nameOf(j.id);
    await act(send, j.id, { confirm: { printer: NAME, file } });
    await act(start, j.id, { confirm: { printer: NAME, file } });
    expect((await act(control, j.id, { action: "pause" })).status).toBe(200);
    expect((await act(control, j.id, { action: "resume" })).status).toBe(200);
    expect(port.calls).toEqual(expect.arrayContaining(["pause", "resume"]));
  });

  it("cancels an unsent job without any printer call", async () => {
    const j = await sliced();
    const r = await read<Body>(await act(control, j.id, { action: "cancel" }));
    expect(r.body.item.status).toBe("cancelled");
    expect(port.calls).toEqual([]);
  });

  it("refuses to use a printer that was switched off in Admin", async () => {
    const j = await sliced();
    const file = await nameOf(j.id);
    await q("UPDATE printers SET enabled=false WHERE id=$1", [printerId]);
    try {
      expect((await act(send, j.id, { confirm: { printer: NAME, file } })).status).toBe(409);
    } finally {
      await q("UPDATE printers SET enabled=true WHERE id=$1", [printerId]);
    }
    expect(port.calls).toEqual([]);
  });
});

describe("a printer with no adapter gets the file and the steps", () => {
  it("offers the download and refuses to send or start", async () => {
    restore();
    restore = setPortFactory(() => new FileOnlyPort());
    const j = await sliced();
    const p = await read<{ fileOnly: boolean; download: { gcodeFileId: number; projectFileId: number | null } | null }>(await plan(json("GET"), ctx(String(j.id))));
    expect(p.body.fileOnly).toBe(true);
    expect(p.body.download?.gcodeFileId).toBeGreaterThan(0);
    const r = await read<Body>(await act(send, j.id, { confirm: { printer: NAME, file: "x" } }));
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/Download the file/);
    expect((await get(j.id)).status).toBe("sliced");
  });
});

describe("a printer with no adapter: the result is how the job learns it was printed", () => {
  it("records a hand-carried print through sent and printing to done, and logs the hand-over", async () => {
    restore();
    restore = setPortFactory(() => new FileOnlyPort());
    const j = await sliced();
    const r = await read<Body>(await act(result, j.id, { outcome: "good", actualG: 3.9, photoFileIds: [] }));
    expect(r.status).toBe(200);
    expect(r.body.item.status).toBe("done");
    const d = (await get(j.id)).data;
    expect(d.handedOver).toBe(true);
    expect(d.sentName).toBe(`test_lid-${j.id}.gcode`);
    expect(await events("print.handed-over", j.id)).toBe("1");
  });

  it("keeps a bad photo from leaving the job half moved", async () => {
    restore();
    restore = setPortFactory(() => new FileOnlyPort());
    const j = await sliced();
    expect((await act(result, j.id, { outcome: "good", photoFileIds: [999999999] })).status).toBe(400);
    expect((await get(j.id)).status).toBe("sliced");
  });
});

describe("the plain row route cannot reach the hardware", () => {
  const patch = (id: number, payload: unknown) => patchItem(json("PATCH", payload), ctx(String(id)));

  it.each(["slicing", "sliced", "sent", "printing", "done"])("refuses to move a job to %s by hand", async (to) => {
    const j = await job();
    const r = await read<Body>(await patch(j.id, { status: to }));
    expect(r.status).toBe(400);
    expect((await get(j.id)).status).toBe("queued");
  });

  it("refuses to write what the slicer or the printer reports", async () => {
    const j = await job();
    for (const data of [{ slice: { seconds: 1 } }, { sentName: "x.gcode" }, { sentAt: "2026-01-01" }, { result: { outcome: "good" } }]) {
      expect((await patch(j.id, { data })).status).toBe(400);
    }
  });

  it("refuses to create a job that is already printing, or that carries a fake slice", async () => {
    const a = await addItem(json("POST", { section: "prototype/printing", title: "test: x", status: "printing" }), ctx(SEEDED));
    expect(a.status).toBe(400);
    const b = await addItem(json("POST", { section: "prototype/printing", title: "test: y", data: { slice: { seconds: 1 } } }), ctx(SEEDED));
    expect(b.status).toBe(400);
  });

  it("refuses to change the file of a sliced job, and allows queued again", async () => {
    const j = await sliced();
    expect((await patch(j.id, { data: { infill: 60 } })).status).toBe(409);
    expect((await patch(j.id, { status: "queued" })).status).toBe(200);
    expect((await patch(j.id, { data: { infill: 60 } })).status).toBe(200);
  });
});

describe("tracking and the result", () => {
  async function running() {
    const j = await sliced();
    const file = await nameOf(j.id);
    await act(send, j.id, { confirm: { printer: NAME, file } });
    await act(start, j.id, { confirm: { printer: NAME, file } });
    return j;
  }

  it("moves a printing job to done only when the printer says finished", async () => {
    const j = await running();
    port.state = "printing";
    expect((await read<{ job: Item }>(await track(json("GET"), ctx(String(j.id))))).body.job.status).toBe("printing");
    port.state = "finished";
    expect((await read<{ job: Item }>(await track(json("GET"), ctx(String(j.id))))).body.job.status).toBe("done");
  });

  it("says so, and changes nothing, for a printer that reports no status", async () => {
    restore();
    port = new StubPort({ status: false });
    restore = setPortFactory(() => port);
    const j = await running();
    const t = await read<{ job: Item; message: string }>(await track(json("GET"), ctx(String(j.id))));
    expect(t.body.job.status).toBe("printing");
    expect(t.body.message).toMatch(/does not report/);
  });

  it("records the outcome against the build and keeps the planned and the actual numbers apart", async () => {
    const j = await sliced();
    expect((await patchItem(json("PATCH", { data: { buildKey: "evt-1" } }), ctx(String(j.id)))).status).toBe(200);
    const file = await nameOf(j.id);
    await act(send, j.id, { confirm: { printer: NAME, file } });
    await act(start, j.id, { confirm: { printer: NAME, file } });
    const r = await read<Body>(await act(result, j.id, { outcome: "flawed", actualSeconds: 1500, actualG: 4.1, notes: "stringing", photoFileIds: [] }));
    expect(r.status).toBe(200);
    expect(r.body.item.status).toBe("done");
    const d = (await get(j.id)).data;
    expect(d.slice.seconds).toBe(1191.2);
    expect(d.result).toMatchObject({ outcome: "flawed", actualSeconds: 1500, actualG: 4.1, notes: "stringing" });
    const logged = await q<{ data: { buildKey: string | null } }>("SELECT data FROM events WHERE kind='print.result' AND data->>'itemId'=$1", [String(j.id)]);
    expect(logged[0].data.buildKey).toBe("evt-1");
  });

  it("records a failed outcome as failed, and then lets the job be queued again", async () => {
    const j = await sliced();
    const file = await nameOf(j.id);
    await act(send, j.id, { confirm: { printer: NAME, file } });
    expect((await read<Body>(await act(result, j.id, { outcome: "failed", photoFileIds: [] }))).body.item.status).toBe("failed");
    expect((await patchItem(json("PATCH", { status: "queued" }), ctx(String(j.id)))).status).toBe(200);
  });

  it("refuses a result before the file is sent, and a photo that is not in this concept", async () => {
    const j = await sliced();
    expect((await act(result, j.id, { outcome: "good", photoFileIds: [] })).status).toBe(409);
    const file = await nameOf(j.id);
    await act(send, j.id, { confirm: { printer: NAME, file } });
    expect((await act(result, j.id, { outcome: "good", photoFileIds: [999999999] })).status).toBe(400);
  });

  it("lists a concept's jobs, and only those of one build when asked", async () => {
    const a = await job({ buildKey: "evt-9" });
    await job();
    const all = await read<{ jobs: Item[] }>(await listJobs(json("GET", undefined, "http://test.local/api"), ctx(SEEDED)));
    expect(all.body.jobs.length).toBeGreaterThanOrEqual(2);
    const one = await read<{ jobs: Item[] }>(await listJobs(json("GET", undefined, "http://test.local/api?buildKey=evt-9"), ctx(SEEDED)));
    expect(one.body.jobs.map((i) => i.id)).toContain(a.id);
    expect(one.body.jobs.every((i) => i.data.buildKey === "evt-9")).toBe(true);
  });
});

describe("no route places an order", () => {
  it("has no order or buy route in the sourcing API, and research is refused without confirm", async () => {
    const { POST } = await import("@/app/api/projects/[id]/sourcing/research/route");
    const r = await read<{ error: string }>(await POST(json("POST", { partId: 1, kind: "prices", confirm: false }), ctx(SEEDED)));
    expect(r.status).toBe(400);
    const fs = await import("node:fs");
    const dir = "src/app/api/projects/[id]/sourcing";
    expect(fs.readdirSync(dir)).toEqual(["research"]);
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? [e.name, ...walk(`${d}/${e.name}`)] : [e.name]));
    expect(walk(dir).filter((n) => /order|buy|purchase|checkout/i.test(n))).toEqual([]);
  });
});
