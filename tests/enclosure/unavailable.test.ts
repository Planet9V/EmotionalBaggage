// The degraded state: the planner is not there, has no OpenSCAD, or is too slow. The screen is told why, in words.
import { createServer, type Server } from "node:http";
import { afterAll, describe, expect, it } from "vitest";
import { runGenerator } from "@/lib/enclosure/run";
import { buildSpec } from "@/lib/enclosure/spec";
import { generateYapp, GeneratorUnavailable } from "@/lib/enclosure/yapp";
import { exampleParts } from "./helpers";

const spec = buildSpec({ items: exampleParts() });
const servers: Server[] = [];
afterAll(() => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))));

function stub(status: number, detail: string) {
  return new Promise<string>((resolve) => {
    const s = createServer((_req, res) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ detail }));
    });
    servers.push(s);
    s.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(s.address() as { port: number }).port}`));
  });
}

describe("YAPP_Box when the planner cannot do it", () => {
  it("no planner address: says where to set it", async () => {
    await expect(generateYapp(spec, { url: null })).rejects.toMatchObject({ code: "not-configured", message: expect.stringMatching(/Admin|PLANNER_URL/) });
  });
  it("planner not reachable", async () => {
    const r = await runGenerator("yapp", spec, { plannerUrl: "http://127.0.0.1:1" });
    expect(r).toMatchObject({ ok: false, code: "unreachable" });
    if (!r.ok) expect(r.error).toMatch(/not reachable/);
  });
  it("planner without OpenSCAD (503)", async () => {
    const r = await runGenerator("yapp", spec, { plannerUrl: await stub(503, "OpenSCAD is not installed in the planner container.") });
    expect(r).toMatchObject({ ok: false, code: "no-openscad" });
  });
  it("OpenSCAD out of time (504)", async () => {
    const r = await runGenerator("yapp", spec, { plannerUrl: await stub(504, "OpenSCAD did not finish within 10 seconds.") });
    expect(r).toMatchObject({ ok: false, code: "timeout" });
  });
  it("planner refuses the file (422)", async () => {
    const r = await runGenerator("yapp", spec, { plannerUrl: await stub(422, "OpenSCAD refused the file: x") });
    expect(r).toMatchObject({ ok: false, code: "refused" });
  });
  it("the error type is exported for callers", () => {
    expect(new GeneratorUnavailable("timeout", "x").code).toBe("timeout");
  });
});
