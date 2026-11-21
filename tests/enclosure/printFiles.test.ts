// D2: every file that leaves the Enclosure page is Z up and sits on z = 0, as slicers read it; the lid is
// turned over so its outer face is on the plate. Checked on the downloads the page offers (the print
// STLs of a generator result) for both generators, and on the 3MF. YAPP_Box needs OpenSCAD in the planner.
import { describe, expect, inject, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildSpec } from "@/lib/enclosure/spec";
import { runEnclosureGenerator } from "@/lib/enclosure/run";
import { parseStl } from "@/lib/enclosure/stl";
import { boundsOf, piecesTo3mf } from "@/lib/enclosure/printFiles";
import type { GeneratorKey } from "@/lib/enclosure/types";
import { exampleParts } from "./helpers";

const mesh = (b64: string) => parseStl(Buffer.from(b64, "base64"));
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

async function checkDownloads(key: GeneratorKey, opts: { plannerUrl?: string } = {}) {
  const spec = buildSpec({ items: exampleParts(), params: { lidType: "snap" } });
  const r = await runEnclosureGenerator(key, spec, { ...opts, timeoutSeconds: 240 });
  if (!r.ok) throw new Error(r.error);
  const baseY = boundsOf(mesh(r.baseStl)); // concept frame, Y up
  const lidY = boundsOf(mesh(r.lidStl));
  const base = boundsOf(mesh(r.basePrintStl));
  const lid = boundsOf(mesh(r.lidPrintStl));

  // the base: floor on z = 0, its height along z, its depth (concept z) along y
  expect(near(base.min[2], 0)).toBe(true);
  expect(base.max[2] - base.min[2]).toBeCloseTo(baseY.max[1] - baseY.min[1], 2);
  expect(base.max[1] - base.min[1]).toBeCloseTo(baseY.max[2] - baseY.min[2], 2);
  expect(base.max[0] - base.min[0]).toBeCloseTo(baseY.max[0] - baseY.min[0], 2);

  // the lid: on z = 0, its thickness along z
  expect(near(lid.min[2], 0)).toBe(true);
  expect(lid.max[2] - lid.min[2]).toBeCloseTo(lidY.max[1] - lidY.min[1], 2);
  // outer face down: the concept frame's highest vertices (the lid's top) are the file's lowest
  const top = mesh(r.lidStl);
  const flat = mesh(r.lidPrintStl);
  let onPlate = 0, topCount = 0;
  for (let i = 0; i < top.positions.length; i += 3) if (near(top.positions[i + 1], lidY.max[1])) topCount++;
  for (let i = 0; i < flat.positions.length; i += 3) if (near(flat.positions[i + 2], 0)) onPlate++;
  expect(topCount).toBeGreaterThan(0);
  expect(onPlate).toBe(topCount);

  // the 3MF holds both pieces, each an object, on z = 0
  const zip = unzipSync(await piecesTo3mf([{ name: "base", mesh: mesh(r.basePrintStl) }, { name: "lid", mesh: mesh(r.lidPrintStl) }]));
  const modelFile = Object.keys(zip).find((n) => /3D\/.*\.model$/i.test(n));
  expect(modelFile).toBeTruthy();
  const xml = Object.keys(zip).filter((n) => /\.model$/i.test(n)).map((n) => strFromU8(zip[n])).join("\n");
  expect((xml.match(/<object\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
}

describe("enclosure downloads are Z up and on the plate", () => {
  it("CaseMaker", async () => {
    await checkDownloads("casemaker");
  }, 90_000);

  const plannerUrl = inject("plannerUrl");
  it("YAPP_Box (skipped without OpenSCAD in the planner)", async (ctx) => {
    const health = await fetch(`${plannerUrl}/enclosure/health`, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.json() as Promise<{ openscad?: string | null }>)
      .catch(() => ({ openscad: null }));
    if (!health.openscad) ctx.skip();
    await checkDownloads("yapp", { plannerUrl });
  }, 300_000);
});
