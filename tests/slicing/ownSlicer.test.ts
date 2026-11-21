// D8: no slicer set up on the install. A print job is still queued with its model, the person slices it in
// their own slicer and attaches the result with the time and grams typed in, and the job then goes on: Send
// for a connected printer (a stand-in behind setPortFactory), the file-only path for the rest. The
// not-set-up sentence is one sentence, the same from the API and on the page.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { GET as slicerState } from "@/app/api/slicer/route";
import { GET as plan } from "@/app/api/print-jobs/[id]/plan/route";
import { POST as slice } from "@/app/api/print-jobs/[id]/slice/route";
import { POST as attach } from "@/app/api/print-jobs/[id]/attach/route";
import { POST as send } from "@/app/api/print-jobs/[id]/send/route";
import { POST as result } from "@/app/api/print-jobs/[id]/result/route";
import { setPortFactory, FileOnlyPort, type PortCapabilities, type PrinterPort } from "@/lib/slicing/printerPort";
import { SLICER_NOT_SET_UP } from "@/lib/slicing/messages";
import { ctx, form, json, read, SEEDED } from "../api/helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
type Item = { id: number; status: string; data: Loose; title: string };

const NAME = `test-own-${Date.now()}`;
let printerId = 0;
let fileId = 0;
let restore: () => void = () => {};
const savedEnv = process.env.SLICER_URL;

class Connected implements PrinterPort {
  readonly family = "stub";
  readonly capabilities: PortCapabilities = { status: true, upload: true, start: true, pause: true, resume: true, cancel: true, fileTypes: [".gcode"], notes: [] };
  uploads: string[] = [];
  async test() { return { ok: true, message: "ok" }; }
  async status() { return { state: "idle" as const, file: null }; }
  async upload(_f: unknown, name: string) { this.uploads.push(name); return { name, message: "uploaded" }; }
  async start() { return { ok: true as const, message: "started" }; }
  async pause() { return { ok: true as const, message: "" }; }
  async resume() { return { ok: true as const, message: "" }; }
  async cancel() { return { ok: true as const, message: "" }; }
}

beforeAll(async () => {
  delete process.env.SLICER_URL;
  await q("DELETE FROM settings WHERE key='slicer.url'");
  printerId = Number((await q<{ id: string }>("INSERT INTO printers (name, family, model, address) VALUES ($1,'file-only','Generic','') RETURNING id", [NAME]))[0].id);
  fileId = Number((await q<{ id: string }>("INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes) VALUES ($1,'test-own-case.stl','model/stl','stl',5,'x',$2) RETURNING id", [SEEDED, Buffer.from("solid")]))[0].id);
});
afterAll(async () => {
  await q("DELETE FROM items WHERE title LIKE 'test-own:%'");
  await q("DELETE FROM files WHERE name LIKE 'test-own%'");
  await q("DELETE FROM printers WHERE name=$1", [NAME]);
  if (savedEnv) process.env.SLICER_URL = savedEnv;
  await pool().end();
});
beforeEach(() => { restore = setPortFactory(() => new FileOnlyPort()); });
afterEach(() => restore());

/** A job as New print job makes it with no slicer: no slicer profile (no printerMaker or printerModel). */
async function job(): Promise<Item> {
  const r = await read<{ item: Item }>(await addItem(json("POST", { section: "prototype/printing", title: "test-own: case", status: "queued", data: { fileId, fileName: "test-own-case.stl", printerId, printerName: NAME, material: "PETG", layerHeight: 0.2, infill: 20, supports: false } }), ctx(SEEDED)));
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.item;
}

function attachment(name: string, fields: Record<string, string>) {
  const fd = new FormData();
  fd.append("file", new File([`; sliced elsewhere\nG28\n`], name, { type: "text/plain" }));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return form("POST", fd);
}

describe("print jobs with no slicer set up", () => {
  it("the API says the slicer is not set up in the one sentence the page shows", async () => {
    const r = await read<{ configured: boolean; message: string }>(await slicerState(json("GET")));
    expect(r.body.configured).toBe(false);
    expect(r.body.message).toBe(SLICER_NOT_SET_UP);
    // slicing here is refused with the same sentence
    const j = await job();
    const s = await read<{ error: string }>(await slice(json("POST"), ctx(String(j.id))));
    expect(s.status).toBe(409);
  });

  it("queues a job with its model and no slicer profile, takes the file sliced elsewhere with typed time and grams, and labels them", async () => {
    const j = await job();
    expect(j.status).toBe("queued");
    const bad = await read<{ error: string }>(await attach(attachment("test-own-x.stl", { slicer: "PrusaSlicer", minutes: "42", grams: "13.5" }), ctx(String(j.id))));
    expect(bad.status).toBe(422);
    const noTime = await read<{ error: string }>(await attach(attachment("test-own-x.gcode", { slicer: "PrusaSlicer", minutes: "", grams: "13.5" }), ctx(String(j.id))));
    expect(noTime.status).toBe(400);

    const r = await read<{ item: Item }>(await attach(attachment("test-own-case.gcode", { slicer: "PrusaSlicer", minutes: "42", grams: "13.5" }), ctx(String(j.id))));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.item.status).toBe("sliced");
    expect(r.body.item.data.slice).toMatchObject({ seconds: 2520, filamentG: 13.5, byHand: { slicer: "PrusaSlicer" }, projectFileId: null });
    const ev = await q<{ summary: string }>("SELECT summary FROM events WHERE kind='print.sliced-elsewhere' AND data->>'itemId'=$1", [String(j.id)]);
    expect(ev[0].summary).toMatch(/entered by hand/);

    // a printer with no connection: the plan offers the attached file to download, and the result can be recorded
    const p = await read<Loose>(await plan(json("GET"), ctx(String(j.id))));
    expect(p.body.fileOnly).toBe(true);
    expect(p.body.download.gcodeFileId).toBe(r.body.item.data.slice.gcodeFileId);
    const done = await read<{ item: Item }>(await result(json("POST", { outcome: "good", photoFileIds: [] }), ctx(String(j.id))));
    expect(done.status).toBe(200);
    expect(done.body.item.status).toBe("done");
  });

  it("sends the attached G-code to a connected printer after the confirm", async () => {
    const port = new Connected();
    restore();
    restore = setPortFactory(() => port);
    const j = await job();
    expect((await attach(attachment("test-own-lid.gcode", { slicer: "Bambu Studio", minutes: "10", grams: "4" }), ctx(String(j.id)))).status).toBe(201);
    const p = await read<Loose>(await plan(json("GET"), ctx(String(j.id))));
    expect(p.body.fileOnly).toBe(false);
    const r = await read<{ item: Item }>(await send(json("POST", { confirm: { printer: NAME, file: p.body.send.name } }), ctx(String(j.id))));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.item.status).toBe("sent");
    expect(port.uploads).toEqual([p.body.send.name]);
  });

  it("a job sliced elsewhere can take a newer file, which replaces the numbers", async () => {
    const j = await job();
    await attach(attachment("test-own-a.gcode", { slicer: "Cura", minutes: "30", grams: "9" }), ctx(String(j.id)));
    const r = await read<{ item: Item }>(await attach(attachment("test-own-b.gcode", { slicer: "Cura", minutes: "25", grams: "8" }), ctx(String(j.id))));
    expect(r.status).toBe(201);
    expect(r.body.item.data.slice).toMatchObject({ seconds: 1500, filamentG: 8 });
  });
});
