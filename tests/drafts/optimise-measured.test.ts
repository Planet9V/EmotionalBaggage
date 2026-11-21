// F4: each of the three optimisation actions on a seeded concept, with a measured before and after.
// Parts with duplicate fasteners for "Check the design for assembly"; a print job sliced at two settings through
// the real slice route against a fake slicer (its time depends on the layer height it is sent) for "Propose
// faster print settings"; a priced parts list for "Propose cheaper substitutes". Every figure is read from rows.
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET as STATE, POST as OPTIMISE } from "@/app/api/drafts/optimise/route";
import { POST as slice } from "@/app/api/print-jobs/[id]/slice/route";
import { POST as addRow } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import type { RunResult } from "@/lib/ai/drafts/shared";
import type { OptimiseState } from "@/lib/ai/drafts/service";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { ctx, json, read } from "../api/helpers";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { addItem, approve, itemsOf, makeConcept, scriptedModel, type Script } from "./helpers";

const P = "zz-opt-measured";
const NAME = `zz-opt-printer-${Date.now()}`;
const JOB = "b".repeat(32);
let s: StandIn<OpenAIOptions>;
let server: Server;
const script: Script = {};
const ids: Record<string, number> = {};
const sent: string[] = [];

/** Seconds the fake slicer reports: 0.2 mm layers take 2 h 10 min, 0.28 mm take 1 h 25 min. */
const SECONDS: Record<string, number> = { "0.2": 7800, "0.28": 5100 };

beforeAll(async () => {
  s = await scriptedModel(script);
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const done = (status: number, body: string | Buffer, type = "application/json") => { res.writeHead(status, { "content-type": type }); res.end(body); };
      const url = req.url ?? "";
      if (req.method === "POST" && url === "/slice") {
        const form = Buffer.concat(chunks).toString("latin1");
        const layer = /name="layer_height"\r\n\r\n([^\r]+)/.exec(form)?.[1] ?? "?";
        sent.push(layer);
        const seconds = SECONDS[layer];
        if (!seconds) return done(422, JSON.stringify({ detail: `No profile for ${layer} mm layers.` }));
        return done(200, JSON.stringify({
          id: JOB, orca: { version: "2.5.0", profileCommit: "abc" },
          profile: { machine: "Bambu Lab A1 0.4 nozzle", process: `${layer}mm @BBL A1`, filament: "Generic PLA @BBL A1", note: "" },
          settings: { layerHeight: Number(layer), infill: 15, supports: false, material: "PLA" },
          result: { seconds, filamentMm: 3000, filamentG: 40, filamentCm3: 30, supportG: null, layers: 200, readFrom: "statistics.json" },
          warnings: [],
          files: { gcode: { name: "shell.gcode", url: `/jobs/${JOB}/gcode` }, project: null, statistics: null },
        }));
      }
      if (req.method === "GET" && url === `/jobs/${JOB}/gcode`) return done(200, "; fake\nG28\n", "text/plain");
      if (req.method === "DELETE") return done(200, "{}");
      return done(404, "{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.SLICER_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  await makeConcept(P, "ZZ Measured", "electronics", "A desk timer");
  ids.board = await addItem(P, "design/bom", "Dev board", { ref: "U1", qty: 1, line: 9.5 });
  ids.shell = await addItem(P, "design/bom", "Printed shell", { ref: "ENC1", qty: 1, line: 2 });
  ids.screwsA = await addItem(P, "design/bom", "M3 x 8 screws", { ref: "HW1", qty: 4, kind: "fastener", line: 0.4 });
  ids.screwsB = await addItem(P, "design/bom", "M3 x 10 screws", { ref: "HW2", qty: 4, kind: "fastener", line: 0.4 });
  ids.nuts = await addItem(P, "design/bom", "M3 nuts", { ref: "HW3", qty: 8, kind: "fastener", line: 0.3 });
  const printer = await q<{ id: string }>("INSERT INTO printers (name, family, model, address) VALUES ($1,'octoprint','A1','http://x') RETURNING id", [NAME]);
  const file = await q<{ id: string }>("INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes) VALUES ($1,'zz-shell.stl','model/stl','stl',5,'x',$2) RETURNING id", [P, Buffer.from("solid")]);
  const made = await read<{ item: { id: number } }>(await addRow(json("POST", {
    section: "prototype/printing", title: "Shell", status: "queued",
    data: { fileId: Number(file[0].id), fileName: "zz-shell.stl", printerId: Number(printer[0].id), printerName: NAME, printerMaker: "Bambu Lab", printerModel: "A1", material: "PLA", layerHeight: 0.2, infill: 15, supports: false },
  }), ctx(P)));
  ids.job = made.body.item.id;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  delete process.env.SLICER_URL;
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await q("DELETE FROM printers WHERE name=$1", [NAME]);
  await s.close();
  await pool().end();
});

beforeEach(async () => {
  await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-drafter" });
});

const state = async () => (await read<{ actions: OptimiseState[] }>(await STATE(json("GET", undefined, `http://t/x?projectId=${P}`)))).body.actions;
const go = async (action: string) => read<RunResult & { error?: string }>(await OPTIMISE(json("POST", { projectId: P, action })));
const byId = async (a: string) => (await state()).find((x) => x.id === a)!;

describe("check the design for assembly: duplicate fasteners", () => {
  it("before 5 parts, 18 pieces, 16 fasteners; merging the two screw sizes and dropping the nuts measures 3 parts, 6 pieces, 4 fasteners", async () => {
    expect((await byId("parts")).now.text).toBe("5 parts, 18 pieces, 16 fasteners");
    script["optimise-parts"] = {
      rows: [
        { action: "merge", replaces: ids.screwsA, mergeWith: [ids.screwsB], title: "M3 x 8 screws (one size)", spec: "One screw length for every joint", reason: "Two lengths of the same screw do the same job" },
        { action: "remove", replaces: ids.nuts, reason: "Heat-set inserts in the printed shell take the screws" },
      ],
    };
    const r = await go("parts");
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const a = await byId("parts");
    expect(a.last!.before.text).toBe("5 parts, 18 pieces, 16 fasteners");
    expect(a.last!.ifApproved.text).toBe("3 parts, 6 pieces, 4 fasteners");
    for (const d of r.body.drafts) expect((await approve(d.id)).status).toBe(200);
    const after = await byId("parts");
    expect(after.now.text).toBe("3 parts, 6 pieces, 4 fasteners");
    expect(after.last!.before.text).toBe("5 parts, 18 pieces, 16 fasteners");
  });
});

describe("propose faster print settings: sliced at two settings", () => {
  it("sliced at 0.2 mm the job takes 2 h 10 min; the proposal to 0.28 mm is approved, the job goes back to queued, and sliced again it takes 1 h 25 min", async () => {
    expect((await byId("print")).now.text).toBe("Not sliced yet (1 print jobs, none with a print time)");
    const first = await slice(json("POST"), ctx(String(ids.job)));
    expect(first.status).toBe(200);
    expect((await byId("print")).now.text).toBe("2 h 10 min over 1 of 1 print jobs");

    script["optimise-print"] = { rows: [{ replaces: ids.job, layerHeight: 0.28, infill: 15, reason: "Taller layers: fewer layers to print; the shell is not seen up close" }] };
    const r = await go("print");
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const d = r.body.drafts[0];
    expect(d.data).toMatchObject({ layerHeight: 0.28, infill: 15, estimate: "" });
    expect(d.data.slice).toBeUndefined();
    let a = await byId("print");
    expect(a.last!.before.text).toBe("2 h 10 min over 1 of 1 print jobs");
    expect(a.last!.ifApproved.text).toBe("Not sliced yet (1 print jobs, none with a print time)");

    expect((await approve(d.id)).status).toBe(200);
    const job = (await itemsOf(P, "prototype/printing"))[0];
    expect(job.status).toBe("queued");
    expect(job.data.layerHeight).toBe(0.28);

    expect((await slice(json("POST"), ctx(String(ids.job)))).status).toBe(200);
    expect(sent).toEqual(["0.2", "0.28"]);
    a = await byId("print");
    expect(a.now.text).toBe("1 h 25 min over 1 of 1 print jobs");
    expect(a.last!.before.text).toBe("2 h 10 min over 1 of 1 print jobs");
  });

  it("a job the printer has is not changed under it", async () => {
    await q("UPDATE items SET status='printing' WHERE id=$1", [ids.job]);
    script["optimise-print"] = { rows: [{ replaces: ids.job, layerHeight: 0.2, reason: "x" }] };
    const r = await go("print");
    expect(r.body.drafts).toHaveLength(0);
    expect(r.body.dropped[0].reason).toContain("printing");
    await q("UPDATE items SET status='queued' WHERE id=$1", [ids.job]);
  });
});

describe("propose cheaper substitutes", () => {
  it("before 11.90 for 3 parts; the substitute is unpriced until a price is entered, then 7.40 for 3 parts", async () => {
    expect((await byId("cost")).now.text).toBe("11.90 for 3 parts");
    script["optimise-cost"] = { rows: [{ replaces: ids.board, title: "Bare microcontroller module", spec: "The same chip on a module", reason: "No USB bridge; programming needs an adapter" }] };
    const r = await go("cost");
    const d = r.body.drafts[0];
    expect((await byId("cost")).last!.ifApproved.text).toBe("Not priced (2 of 3 parts have a cost, adding up to 2.40; 1 substitute has no cost yet, was 9.50)");
    expect((await approve(d.id)).status).toBe(200);
    expect((await patchItem(json("PATCH", { data: { line: 5 } }), ctx(String(ids.board)))).status).toBe(200);
    const a = await byId("cost");
    expect(a.now.text).toBe("7.40 for 3 parts");
    expect(a.last!.before.text).toBe("11.90 for 3 parts");
    expect((await itemsOf(P, "design/bom")).find((x) => Number(x.id) === ids.board)!.data.wasLine).toBe(9.5);
  });
});
