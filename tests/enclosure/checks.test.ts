// The checks can fail: each one is shown a result that is wrong in exactly one way.
import { beforeAll, describe, expect, it } from "vitest";
import { generateCaseMaker } from "@/lib/enclosure/casemaker";
import { computeChecks } from "@/lib/enclosure/checks";
import { buildSpec } from "@/lib/enclosure/spec";
import type { EnclosureSpec, GeneratedMesh, GeneratorOutput } from "@/lib/enclosure/types";
import { exampleParts, part } from "./helpers";

let spec: EnclosureSpec;
let good: GeneratorOutput;
const byKey = (cs: Awaited<ReturnType<typeof computeChecks>>) => Object.fromEntries(cs.map((c) => [c.key, c]));

beforeAll(async () => {
  spec = buildSpec({ items: exampleParts(), params: { lidType: "slip" } });
  good = await generateCaseMaker(spec);
}, 60_000);

const copy = (m: GeneratedMesh): GeneratedMesh => ({ positions: new Float32Array(m.positions), indices: new Uint32Array(m.indices) });

describe("checks on a good result", () => {
  it("are all met", async () => {
    const c = await computeChecks(spec, good);
    expect(c.filter((x) => !x.ok)).toEqual([]);
  });
});

describe("checks on a result that is wrong", () => {
  it("not watertight: a triangle is missing from the base", async () => {
    const base = copy(good.base);
    const c = byKey(await computeChecks(spec, { ...good, base: { positions: base.positions, indices: base.indices.slice(0, base.indices.length - 3) } }));
    expect(c["watertight-base"].ok).toBe(false);
    expect(c["watertight-lid"].ok).toBe(true);
  });

  it("lid does not close: the lid is moved sideways", async () => {
    const lid = copy(good.lid);
    for (let i = 0; i < lid.positions.length; i += 3) lid.positions[i] += 3;
    const c = byKey(await computeChecks(spec, { ...good, lid }));
    expect(c["lid-closes"].ok).toBe(false);
  });

  it("an opening is missing: the spec asks for one the mesh does not have", async () => {
    const without = buildSpec({ items: exampleParts().map((i) => (i.data.ref === "SPK1" ? { ...i, data: { ...i.data, opening: { off: true } } } : i)), params: { lidType: "slip" } });
    expect(without.openings.length).toBe(spec.openings.length - 1);
    const made = await generateCaseMaker(without);
    const c = byKey(await computeChecks(spec, made));
    expect(c["openings-line-up"].ok).toBe(false);
    expect(c["openings-line-up"].detail).toMatch(/SPK1/);
  }, 60_000);

  it("a part does not fit: the spec has a part larger than the cavity the mesh made", async () => {
    const tall = spec.parts.map((p) => (p.ref === "BT1" ? { ...p, box: { min: p.box.min, max: [p.box.max[0] + 6, p.box.max[1], p.box.max[2]] as [number, number, number] } } : p));
    const c = byKey(await computeChecks({ ...spec, parts: tall }, good));
    expect(c["parts-fit"].ok).toBe(false);
  });
});

describe("a part that is not in the example", () => {
  it("the spec for parts of another kind still builds a box", () => {
    const s = buildSpec({ items: [part(1, "B1", "Block", { shape: "box", size: [20, 10, 20], pos: [0, 5, 0] })] });
    expect(s.envelope).toBe("parts");
  });
});
