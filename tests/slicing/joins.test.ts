// The printing joins (integration item 8): the file type sent follows the adapter's own list, the
// enclosure goes to printing as stored files, the slicer address is set in Admin with a Test, and a
// print job linked to a build is listed for that build.
import { createServer, type Server } from "node:http";
import { afterAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import type { ItemRow } from "@/lib/db";
import { planSend } from "@/lib/slicing/flow";
import type { PrinterPort } from "@/lib/slicing/printerPort";
import { GET as storedPrint, POST as toPrint } from "@/app/api/projects/[id]/enclosure/print/route";
import { GET as getSettings, PUT as putSettings } from "@/app/api/admin/settings/route";
import { POST as testConnection } from "@/app/api/admin/test/route";
import { GET as listJobs } from "@/app/api/projects/[id]/print-jobs/route";
import { slicerAddress } from "@/lib/slicing/config";
import { parseStl } from "@/lib/enclosure/stl";
import { ctx, json, read, SEEDED } from "../api/helpers";

const servers: Server[] = [];
afterAll(async () => {
  await q("DELETE FROM settings WHERE key='slicer.url'");
  await q("DELETE FROM files WHERE project_id=$1 AND name LIKE 'enclosure-%'", [SEEDED]);
  await q("DELETE FROM items WHERE project_id=$1 AND (section='design/enclosure' OR title LIKE 'zz join%')", [SEEDED]);
  for (const s of servers) s.close();
  await pool().end();
});

const port = (fileTypes: string[]) => ({ capabilities: { status: true, upload: true, start: true, pause: true, resume: true, cancel: true, fileTypes, notes: [] } }) as unknown as PrinterPort;
const job = (slice: Record<string, unknown>) => ({ id: "5", project_id: "p", section: "prototype/printing", title: "Lid", body: "", status: "sliced", sort: 1, data: { slice: { seconds: 1, filamentG: 1, filamentMm: 1, orcaVersion: "2", profile: { machine: "m", process: "p", filament: "f" }, warnings: [], slicedAt: "2026-11-21", gcodeSha256: "x", ...slice } } }) as unknown as ItemRow;

describe("planSend follows the adapter's file types, in its order", () => {
  it("a Bambu printer (.3mf first) gets the sliced project when there is one, else the G-code", () => {
    expect(planSend(job({ gcodeFileId: 1, projectFileId: 2 }), port([".3mf", ".gcode"]))).toMatchObject({ fileId: 2, kind: "project", name: expect.stringMatching(/\.gcode\.3mf$/) });
    expect(planSend(job({ gcodeFileId: 1, projectFileId: null }), port([".3mf", ".gcode"]))).toMatchObject({ fileId: 1, kind: "gcode" });
  });
  it("a G-code printer gets the G-code even when a project exists; a printer that takes neither is refused", () => {
    expect(planSend(job({ gcodeFileId: 1, projectFileId: 2 }), port([".gcode", ".bgcode"]))).toMatchObject({ fileId: 1, kind: "gcode" });
    expect(() => planSend(job({ gcodeFileId: 1 }), port([".stl"]))).toThrow(/neither/);
    expect(() => planSend(job({ gcodeFileId: 1, projectFileId: null }), port([".3mf"]))).toThrow(/project file/);
  });
});

describe("Send to printing from the Enclosure page", () => {
  it("needs a saved choice, then stores the base and the lid as Z-up STL files and one 3MF, named with the generator and parameter hash, and records them", async () => {
    await q("DELETE FROM items WHERE project_id=$1 AND section='design/enclosure'", [SEEDED]);
    const none = await read<{ error: string }>(await toPrint(json("POST"), ctx(SEEDED)));
    expect(none.status).toBe(409);
    await q("INSERT INTO items (project_id, section, title, data) VALUES ($1,'design/enclosure','Enclosure settings',$2)", [SEEDED, JSON.stringify({ enclosureGenerator: "casemaker", params: { wallThickness: 3, floorThickness: 2.4, lidThickness: 1.6, cornerRadius: 4, clearance: 0.3, openingMargin: 0.3 } })]);
    const r = await read<{ files: { id: number; name: string }[]; generator: string }>(await toPrint(json("POST"), ctx(SEEDED)));
    expect(r.status).toBe(201);
    const names = r.body.files.map((f) => f.name);
    expect(names).toHaveLength(3);
    expect(names[0]).toMatch(/^enclosure-casemaker-[0-9a-f]{8}-base\.stl$/);
    const stem = names[0].replace(/-base\.stl$/, "");
    expect(names).toEqual([`${stem}-base.stl`, `${stem}-lid.stl`, `${stem}.3mf`]);
    const kinds = await q<{ kind: string; mime: string }>("SELECT kind, mime FROM files WHERE id=$1", [r.body.files[2].id]);
    expect(kinds[0]).toEqual({ kind: "3mf", mime: "model/3mf" });
    const base = (await q<{ bytes: Buffer; kind: string }>("SELECT bytes, kind FROM files WHERE id=$1", [r.body.files[0].id]))[0];
    expect(base.kind).toBe("stl");
    const m = parseStl(new Uint8Array(base.bytes));
    let minZ = Infinity, maxZ = -Infinity, maxY = -Infinity, minY = Infinity;
    for (let i = 0; i < m.positions.length; i += 3) {
      minY = Math.min(minY, m.positions[i + 1]); maxY = Math.max(maxY, m.positions[i + 1]);
      minZ = Math.min(minZ, m.positions[i + 2]); maxZ = Math.max(maxZ, m.positions[i + 2]);
    }
    // the example shell is the Rev D tag, 62 x 12.8 x 92 (x, height, depth): Z up, the base stands on z = 0 and its depth runs along y
    expect(Math.round(minZ)).toBe(0);
    expect(maxZ).toBeLessThanOrEqual(12.81);
    expect(Math.round(maxY - minY)).toBe(92);
    const ev = await q("SELECT 1 FROM events WHERE project_id=$1 AND kind='file.stored' AND (data->>'fileId')::bigint = $2", [SEEDED, r.body.files[1].id]);
    expect(ev).toHaveLength(1);
    // the checks of this build are kept on the saved choice, where the Design gate reads them
    const savedRow = (await q<{ data: { checked?: Record<string, { checks: unknown[] }> } }>("SELECT data FROM items WHERE project_id=$1 AND section='design/enclosure'", [SEEDED]))[0];
    expect(savedRow.data.checked?.casemaker.checks.length).toBeGreaterThanOrEqual(5);

    // the lid is Z up too, on z = 0
    const lid = parseStl(new Uint8Array((await q<{ bytes: Buffer }>("SELECT bytes FROM files WHERE id=$1", [r.body.files[1].id]))[0].bytes));
    let lidMin = Infinity;
    for (let i = 2; i < lid.positions.length; i += 3) lidMin = Math.min(lidMin, lid.positions[i]);
    expect(Math.abs(lidMin)).toBeLessThan(0.01);

    // reloading the Enclosure page reads the last stored set back, with the checks measured on that build
    const got = await read<{ stored: { generator: string; paramsHash: string; checks: { ok: boolean }[]; files: { id: number; piece: string }[] } }>(await storedPrint(json("GET"), ctx(SEEDED)));
    expect(got.status).toBe(200);
    expect(got.body.stored.generator).toBe("casemaker");
    expect(stem.endsWith(got.body.stored.paramsHash)).toBe(true);
    expect(got.body.stored.checks).toHaveLength(5);
    expect(got.body.stored.files.map((f) => f.piece)).toEqual(["base", "lid", "both"]);

    // the same build again keeps the same three files
    const again = await read<{ files: { id: number }[] }>(await toPrint(json("POST"), ctx(SEEDED)));
    expect(again.body.files.map((f) => f.id)).toEqual(r.body.files.map((f) => f.id));
    expect(await q("SELECT 1 FROM files WHERE project_id=$1 AND name LIKE 'enclosure-%'", [SEEDED])).toHaveLength(3);
  }, 120_000);
});

describe("the slicer address in Admin", () => {
  it("is saved, used before SLICER_URL, and tested against the slicer's /health", async () => {
    const srv = createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(req.url === "/health" ? JSON.stringify({ ok: true, slicerInstalled: true, orcaVersion: "2.3.1" }) : "{}");
    });
    servers.push(srv);
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
    const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
    const before = process.env.SLICER_URL;
    process.env.SLICER_URL = "http://env-slicer:8000";
    try {
      expect(await slicerAddress()).toEqual({ url: "http://env-slicer:8000", source: "environment" });
      const put = await read<{ settings: { slicerUrl: string; slicerEffective: { url: string; source: string } } }>(await putSettings(json("PUT", { slicerUrl: `${url}/` })));
      expect(put.status).toBe(200);
      expect(put.body.settings.slicerEffective).toEqual({ url, source: "admin" });
      expect((await read<{ settings: { slicerUrl: string } }>(await getSettings(json("GET")))).body.settings.slicerUrl.replace(/\/$/, "")).toBe(url);
      const t = await read<{ ok: boolean; message: string }>(await testConnection(json("POST", { kind: "slicer" })));
      expect(t.body).toMatchObject({ ok: true, message: "The slicer answered (OrcaSlicer 2.3.1)." });
      const line = await q<{ detail: { provider: string } }>("SELECT detail FROM audit_log WHERE action='credential.tested' OR action='tested' ORDER BY id DESC LIMIT 1");
      expect(JSON.stringify(line[0]?.detail ?? {})).toContain("slicer");
      expect((await putSettings(json("PUT", { slicerUrl: "not an address" }))).status).toBe(400);
      await putSettings(json("PUT", { slicerUrl: null }));
      expect((await slicerAddress()).source).toBe("environment");
    } finally {
      if (before === undefined) delete process.env.SLICER_URL;
      else process.env.SLICER_URL = before;
    }
  });
});

describe("a print job linked to a build shows on that build", () => {
  it("lists only that build's jobs", async () => {
    await q("INSERT INTO items (project_id, section, title, data, status) VALUES ($1,'prototype/printing','zz join A',$2,'queued'), ($1,'prototype/printing','zz join B',$3,'queued')", [SEEDED, JSON.stringify({ buildKey: "zz-build-1" }), JSON.stringify({ buildKey: "zz-build-2" })]);
    const r = await read<{ jobs: { title: string }[] }>(await listJobs(json("GET", undefined, "http://t/x?buildKey=zz-build-1"), ctx(SEEDED)));
    expect(r.body.jobs.map((j) => j.title)).toEqual(["zz join A"]);
  });
});
