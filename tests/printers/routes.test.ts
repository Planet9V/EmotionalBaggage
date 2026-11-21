// The printer routes on a real PostgreSQL, with the real adapters talking to stand-ins: start and cancel need a confirm, every action
// is in the audit log without a secret, upload never starts, the status list backs off for a dead printer, and no response, audit line
// or stored error carries a key or access code.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as addPrinter } from "@/app/api/admin/printers/route";
import { PATCH as patchPrinter } from "@/app/api/admin/printers/[id]/route";
import { POST as actions } from "@/app/api/printers/[id]/actions/route";
import { POST as uploadRoute } from "@/app/api/printers/[id]/upload/route";
import { GET as statusAll } from "@/app/api/printers/status/route";
import { GET as statusOne } from "@/app/api/printers/[id]/status/route";
import { GET as modelsRoute } from "@/app/api/printers/models/route";
import { closeAllBambuSessions } from "@/lib/printers/bambu";
import { resetReadings } from "@/lib/printers/readings";
import type { PrinterView } from "@/lib/admin/printers";
import * as octoprint from "../standins/octoprint";
import * as prusalink from "../standins/prusalink";
import * as duet from "../standins/duet";
import { clearAdmin, restore, snapshot } from "../admin/fixture";
import { anonymous, ctx, form, json, read } from "../api/helpers";

type Snap = Awaited<ReturnType<typeof snapshot>>;
let snap: Snap;
const closers: (() => Promise<unknown>)[] = [];
const OCTO_KEY = "route-octo-KEY-5150";
const PRUSA_PW = "route-prusa-PW-6062";
const DUET_PW = "route-duet-PW-7073";
const SECRETS = [OCTO_KEY, PRUSA_PW, DUET_PW];

beforeAll(async () => {
  snap = await snapshot();
});
afterAll(async () => {
  await closeAllBambuSessions();
  await Promise.all(closers.map((c) => c()));
  await q("DELETE FROM printers WHERE name LIKE 'ZZ Route %'");
  await restore(snap);
  await pool().end();
});
beforeEach(async () => {
  await clearAdmin();
  resetReadings();
});

const add = async (body: Record<string, unknown>) => (await read<{ printer: PrinterView }>(await addPrinter(json("POST", body)))).body.printer;
const act = async (id: number | string, body: Record<string, unknown>) => read<{ ok?: boolean; message?: string; error?: string }>(await actions(json("POST", body), ctx(String(id))));
const auditFor = async (action: string) => q<{ action: string; summary: string; detail: unknown }>("SELECT action, summary, detail FROM audit_log WHERE action=$1 ORDER BY id", [action]);
const noSecrets = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  for (const k of SECRETS) expect(s).not.toContain(k);
};

describe("actions route", () => {
  it("refuses start and cancel without confirm: true (400), and sends nothing to the printer", async () => {
    const s = await octoprint.start({ apiKey: OCTO_KEY });
    closers.push(() => s.close());
    const p = await add({ name: "ZZ Route Octo A", family: "octoprint", access: { address: s.url, apiKey: OCTO_KEY } });
    const before = s.requests.length;
    for (const body of [{ action: "start", name: "a.gcode" }, { action: "start", name: "a.gcode", confirm: false }, { action: "cancel" }, { action: "cancel", confirm: false }]) {
      const r = await act(p.id, body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body.error).toMatch(/confirm/i);
    }
    expect(s.requests.length).toBe(before);
    expect((await auditFor("printer.start")).length + (await auditFor("printer.cancel")).length).toBe(0);
  });

  it("pause and resume need no confirm; start needs a file name; an unknown action is a 400", async () => {
    const s = await octoprint.start({ apiKey: OCTO_KEY });
    closers.push(() => s.close());
    const p = await add({ name: "ZZ Route Octo B", family: "octoprint", access: { address: s.url, apiKey: OCTO_KEY } });
    expect((await act(p.id, { action: "start", confirm: true })).body.error).toMatch(/file name/i);
    expect((await act(p.id, { action: "reboot", confirm: true })).status).toBe(400);
    expect((await act(p.id, { action: "pause" })).status).toBe(409); // nothing is printing: a busy refusal, not a 500
  });

  it("start, pause, resume and cancel go through with a confirm, and each one is audit-logged with the printer, family and file, never a key", async () => {
    const s = await octoprint.start({ apiKey: OCTO_KEY });
    closers.push(() => s.close());
    const p = await add({ name: "ZZ Route Octo C", family: "octoprint", access: { address: s.url, apiKey: OCTO_KEY } });
    const up = new FormData();
    up.append("file", new File(["G28\n"], "route.gcode"));
    const sent = await read<{ ok: boolean; name: string }>(await uploadRoute(form("POST", up), ctx(String(p.id))));
    expect(sent.status).toBe(201);
    expect(sent.body.name).toBe("route.gcode");
    expect(await auditFor("printer.start")).toHaveLength(0); // sending never starts

    expect((await act(p.id, { action: "start", name: "route.gcode", confirm: true })).status).toBe(200);
    expect((await act(p.id, { action: "pause" })).status).toBe(200);
    expect((await act(p.id, { action: "resume" })).status).toBe(200);
    expect((await act(p.id, { action: "cancel", confirm: true })).status).toBe(200);

    for (const a of ["upload", "start", "pause", "resume", "cancel"]) {
      const rows = await q<{ action: string; summary: string; detail: Record<string, unknown> }>("SELECT action, summary, detail FROM audit_log WHERE action=$1 AND detail->>'printerId'=$2", [`printer.${a}`, String(p.id)]);
      expect(rows, a).toHaveLength(1);
      expect(rows[0].detail).toMatchObject({ family: "octoprint", action: a });
      expect(rows[0].summary).toContain("ZZ Route Octo C");
      noSecrets(rows[0]);
    }
    const startRow = (await auditFor("printer.start")).find((r) => String((r.detail as { printerId: unknown }).printerId) === String(p.id))!;
    expect(startRow.detail).toMatchObject({ file: "route.gcode" });
  });

  it("a refused start is answered with a plain sentence and audited as failed, without the key", async () => {
    const s = await octoprint.start({ apiKey: OCTO_KEY });
    closers.push(() => s.close());
    const p = await add({ name: "ZZ Route Octo D", family: "octoprint", access: { address: s.url, apiKey: OCTO_KEY } });
    await uploadRoute(form("POST", (() => { const f = new FormData(); f.append("file", new File(["G28"], "busy.gcode")); return f; })()), ctx(String(p.id)));
    expect((await act(p.id, { action: "start", name: "busy.gcode", confirm: true })).status).toBe(200);
    const again = await act(p.id, { action: "start", name: "busy.gcode", confirm: true });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/busy|already|running/i);
    noSecrets(again.body);
    const failed = (await auditFor("printer.start.failed")).filter((r) => String((r.detail as { printerId: unknown }).printerId) === String(p.id));
    expect(failed).toHaveLength(1);
    noSecrets(failed[0]);
  });

  it("a wrong key is a 502 with a sentence that names no key, and an unreachable printer too", async () => {
    const s = await prusalink.start({ auth: "digest", password: PRUSA_PW });
    closers.push(() => s.close());
    const wrong = await add({ name: "ZZ Route Prusa Wrong", family: "prusalink", access: { address: s.url, username: "maker", password: "this-is-not-it" } });
    const r = await act(wrong.id, { action: "pause" });
    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/refused/i);
    noSecrets(r.body);
    expect(JSON.stringify(r.body)).not.toContain("this-is-not-it");
    const dead = await add({ name: "ZZ Route Dead", family: "octoprint", access: { address: "http://127.0.0.1:1", apiKey: OCTO_KEY } });
    const d = await act(dead.id, { action: "pause" });
    expect(d.status).toBe(502);
    noSecrets(d.body);
    const rows = await q<{ detail: unknown }>("SELECT detail FROM audit_log WHERE action='printer.pause.failed'");
    for (const row of rows) {
      noSecrets(row);
      expect(JSON.stringify(row)).not.toContain("this-is-not-it");
    }
  });

  it("a printer switched off, an unknown id and a file-only printer are refused with their own sentences", async () => {
    const s = await octoprint.start({ apiKey: OCTO_KEY });
    closers.push(() => s.close());
    const p = await add({ name: "ZZ Route Off", family: "octoprint", access: { address: s.url, apiKey: OCTO_KEY } });
    await patchPrinter(json("PATCH", { enabled: false }), ctx(String(p.id)));
    expect((await act(p.id, { action: "pause" })).status).toBe(409);
    expect((await act(987654321, { action: "pause" })).status).toBe(404);
    const hand = await add({ name: "ZZ Route By Hand", family: "file-only" });
    const r = await act(hand.id, { action: "start", name: "x.gcode", confirm: true });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/file|by hand|download/i);
  });

  it("works for a Duet and for PrusaLink through the same route (the adapter is chosen by the saved family)", async () => {
    const d = await duet.start({ mode: "sbc", password: DUET_PW });
    const pl = await prusalink.start({ auth: "digest", password: PRUSA_PW });
    closers.push(() => d.close(), () => pl.close());
    const du = await add({ name: "ZZ Route Duet", family: "duet", access: { address: d.url, password: DUET_PW } });
    const pr = await add({ name: "ZZ Route PL", family: "prusalink", access: { address: pl.url, username: "maker", password: PRUSA_PW } });
    for (const p of [du, pr]) {
      const f = new FormData();
      f.append("file", new File(["G28"], "x.gcode"));
      expect((await uploadRoute(form("POST", f), ctx(String(p.id)))).status).toBe(201);
      expect((await act(p.id, { action: "start", name: "x.gcode", confirm: true })).status).toBe(200);
      expect((await act(p.id, { action: "cancel", confirm: true })).status).toBe(200);
    }
  });
});

describe("upload route", () => {
  it("needs a file, takes a name override, refuses a bad name, and never starts the print", async () => {
    const s = await octoprint.start({ apiKey: OCTO_KEY });
    closers.push(() => s.close());
    const p = await add({ name: "ZZ Route Upload", family: "octoprint", access: { address: s.url, apiKey: OCTO_KEY } });
    const none = await read<{ error: string }>(await uploadRoute(form("POST", new FormData()), ctx(String(p.id))));
    expect(none.status).toBe(400);
    const f = new FormData();
    f.append("file", new File(["G28"], "orig.gcode"));
    f.append("name", "renamed.gcode");
    const ok = await read<{ name: string }>(await uploadRoute(form("POST", f), ctx(String(p.id))));
    expect(ok.body.name).toBe("renamed.gcode");
    const bad = new FormData();
    bad.append("file", new File(["G28"], "x.gcode"));
    bad.append("name", "../x.gcode");
    expect((await uploadRoute(form("POST", bad), ctx(String(p.id)))).status).toBe(400);
    expect(s.requests.some((r) => r.path === "/api/job" && r.method === "POST")).toBe(false);
  });
});

describe("status routes", () => {
  it("lists each enabled printer with its state and capabilities, and never a secret", async () => {
    const s = await octoprint.start({ apiKey: OCTO_KEY });
    closers.push(() => s.close());
    const p = await add({ name: "ZZ Route Status", family: "octoprint", model: "MK4S", access: { address: s.url, apiKey: OCTO_KEY } });
    await add({ name: "ZZ Route Hand", family: "file-only" });
    const r = await read<{ printers: { printerId: number; ok: boolean; status?: { state: string }; capabilities: { status: boolean }; familyLabel: string }[] }>(await statusAll(json("GET")));
    expect(r.status).toBe(200);
    const mine = r.body.printers.find((x) => x.printerId === p.id)!;
    expect(mine).toMatchObject({ ok: true, status: { state: "idle" }, capabilities: { status: true } });
    expect(r.body.printers.find((x) => x.printerId !== p.id)?.capabilities.status).toBe(false);
    noSecrets(r.body);
    const one = await read<{ printer: { printerId: number } }>(await statusOne(json("GET"), ctx(String(p.id))));
    expect(one.body.printer.printerId).toBe(p.id);
    expect((await statusOne(json("GET"), ctx("987654321"))).status).toBe(404);
  });

  it("reuses a good reading for two seconds, so many open tabs make one call", async () => {
    const s = await octoprint.start({ apiKey: OCTO_KEY });
    closers.push(() => s.close());
    await add({ name: "ZZ Route Cache", family: "octoprint", access: { address: s.url, apiKey: OCTO_KEY } });
    await statusAll(json("GET"));
    const n = s.requests.length;
    await statusAll(json("GET"));
    await statusAll(json("GET"));
    expect(s.requests.length).toBe(n);
  });

  it("backs off a printer that does not answer: the next call is not made, and the answer says when it will be", async () => {
    const p = await add({ name: "ZZ Route Backoff", family: "octoprint", access: { address: "http://127.0.0.1:1", apiKey: OCTO_KEY } });
    type R = { printers: { printerId: number; ok: boolean; error?: string; retryInSeconds?: number }[] };
    const first = (await read<R>(await statusAll(json("GET")))).body.printers.find((x) => x.printerId === p.id)!;
    expect(first.ok).toBe(false);
    expect(first.error).toMatch(/[a-z]{4}/);
    expect(first.retryInSeconds).toBe(5);
    noSecrets(first);
    const second = (await read<R>(await statusAll(json("GET")))).body.printers.find((x) => x.printerId === p.id)!;
    expect(second.ok).toBe(false);
    expect(second.retryInSeconds).toBeLessThanOrEqual(5);
    expect(second.error).toBe(first.error);
  });

  it("a saved change to the printer ends its backoff at once", async () => {
    const p = await add({ name: "ZZ Route Fix", family: "octoprint", access: { address: "http://127.0.0.1:1", apiKey: OCTO_KEY } });
    await statusAll(json("GET"));
    const s = await octoprint.start({ apiKey: OCTO_KEY });
    closers.push(() => s.close());
    await patchPrinter(json("PATCH", { access: { address: s.url } }), ctx(String(p.id)));
    const r = (await read<{ printers: { printerId: number; ok: boolean }[] }>(await statusAll(json("GET")))).body.printers.find((x) => x.printerId === p.id)!;
    expect(r.ok).toBe(true);
  });
});

describe("models route and sign-in", () => {
  it("serves the list by maker with sources and no problems", async () => {
    const r = await read<{ makers: { maker: string; models: { source: string; adapter: string }[] }[]; problems: string[]; fileOnlySteps: { value: string[] } }>(await modelsRoute(json("GET")));
    expect(r.status).toBe(200);
    expect(r.body.problems).toEqual([]);
    expect(r.body.makers.length).toBeGreaterThan(5);
    for (const g of r.body.makers) for (const m of g.models) {
      expect(m.source).toMatch(/^https:/);
      expect(m.adapter).toBeTruthy();
    }
    expect(r.body.fileOnlySteps.value.length).toBeGreaterThan(2);
  });

  it("every printer route needs a signed-in session", async () => {
    expect((await statusAll(anonymous("GET"))).status).toBe(401);
    expect((await modelsRoute(anonymous("GET"))).status).toBe(401);
    expect((await actions(anonymous("POST", { action: "pause" }), ctx("1"))).status).toBe(401);
    expect((await uploadRoute(anonymous("POST", {}), ctx("1"))).status).toBe(401);
    expect((await statusOne(anonymous("GET"), ctx("1"))).status).toBe(401);
  });
});
