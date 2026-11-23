import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/types";
import { productOf } from "@/components/welcome/product/model";
import { FACE, TAG_MM } from "@/components/welcome/scenes/film/tagShape";

let id = 0;
const part = (ref: string, title: string, kind: string, body: string, data: Record<string, unknown> = {}): Item => ({ id: ++id, projectId: "p", section: "design/bom", title, body, status: "", sort: id, data: { ref, kind, qty: 1, ...data } });
const wire = (from: string, to: string, net: string, netClass: string): Item => ({ id: ++id, projectId: "p", section: "design/wiring", title: `${from} to ${to}`, body: "", status: "to solder", sort: id, data: { from, to, net, netClass, fromPin: "1", toPin: "1", order: id } });
const geo = (shape: string, size: number[], pos: number[], explode: number[], axis?: string) => ({ shape, size, pos, explode, basis: "doc", ...(axis ? { axis } : {}) });

// the example's own layout frame: x across, y up from the back plate, z along with the strap at -z
const parts = [
  part("ENC1", "Tag body, printed", "enclosure", "The body. Printed flat.", { line: 0.57, geometry: geo("shell", [62, 12.8, 92], [0, 6.4, 0], [0, 0, 0]) }),
  part("ENC2", "Back plate, printed", "printed part", "Drops into the rim.", { line: 0.12 }),
  part("ENC4", "Coin-cell door, printed", "printed part", "Bayonet door in the front.", { line: 0.01 }),
  part("PCB1", "Custom circuit board, 24 x 35 mm", "circuit board", "Two layers. It carries every chip.", { line: 4, components: ["U1", "U4", "R1", "BT1", "J1"], geometry: geo("box", [24, 0.8, 35], [-15.6, 6, -14.1], [0, -12, 0]) }),
  part("U1", "Controller chip", "microcontroller", "QFN-48 6 x 6 mm, run from the cell directly; its radio is never started. More.", { line: 3.4, insideOf: "PCB1", priceBreaks: [{ qty: 5, unit: 3.4 }, { qty: 100, unit: 2.6 }] }),
  part("U4", "Amplifier chip", "module", "The amplifier (TQFN-16 3 x 3) on the board.", { line: 2.1, insideOf: "PCB1" }),
  part("R1", "Charge resistor", "resistor", "From the charge switch to the supercapacitor.", { line: 0.03, insideOf: "PCB1" }),
  part("BT1", "Cell contacts", "battery", "Two springs.", { line: 0.6, insideOf: "PCB1" }),
  part("BAT", "Coin cell CR2032", "", "One CR2032 lithium coin cell.", { line: 0.6, geometry: geo("cylinder", [20, 3.2], [-14.6, 9.15, -14], [0, 22, 0], "y") }),
  part("SPK1", "Speaker 28 mm", "speaker", "The speaker.", { line: 7.33, geometry: geo("cylinder", [28, 7.5], [13.2, 6.95, -14.4], [0, 14, 0], "y") }),
  part("PCBA", "Board assembly", "generic", "Stencil and reflow by hand.", { line: 0, insideOf: "PCB1" }),
];
const wires = [wire("U1", "U4", "I2S_BCLK", "signal"), wire("U1", "U4", "I2S_DIN", "signal"), wire("U4", "SPK1", "SPK_P", "audio"), wire("BT1", "U1", "VCELL", "power"), wire("U1", "U1", "LOOP", "signal")];

describe("the example as a product", () => {
  const product = productOf(parts, wires);
  const by = (ref: string) => product.parts.find((p) => p.ref === ref)!;

  it("turns a part's layout row into the tag's own frame: the cell under its door at the front, the board behind it", () => {
    const cell = by("BAT").body!;
    expect(cell.at[0]).toBeCloseTo(FACE.door.x, 0);
    expect(cell.at[1]).toBeCloseTo(FACE.door.y, 0);
    expect(cell.axis).toBe("z");
    expect(cell.at[2]).toBeGreaterThan(by("PCB1").body!.at[2]);
    expect(by("SPK1").body!.at[0]).toBeGreaterThan(0); // under the speaker's field of holes
    expect(by("PCB1").body!.size).toEqual([24, 35, 0.8]);
    expect(by("BAT").placed).toBe("row");
  });

  it("places the printed pieces by the design's own numbers", () => {
    expect(by("ENC4").body!.at.slice(0, 2)).toEqual([FACE.door.x, FACE.door.y]);
    expect(by("ENC4").body!.size[0]).toBeCloseTo(FACE.door.r * 2, 5);
    expect(by("ENC2").placed).toBe("design");
    expect(product.size).toEqual({ w: TAG_MM.w, h: TAG_MM.h, t: TAG_MM.t });
  });

  it("sets the board's components out on the board, inside its edges, at the size their rows state, and says they are illustrative", () => {
    const board = by("PCB1").body!;
    for (const ref of ["U1", "U4", "R1"]) {
      const b = by(ref).body!;
      expect(by(ref).placed).toBe("illustrative");
      expect(Math.abs(b.at[0] - board.at[0]) + b.size[0]! / 2).toBeLessThanOrEqual(board.size[0]! / 2);
      expect(Math.abs(b.at[1] - board.at[1]) + b.size[1]! / 2).toBeLessThanOrEqual(board.size[1]! / 2);
      expect(b.at[2]).toBeLessThan(board.at[2]); // on its back
    }
    expect(by("U1").body!.size.slice(0, 2)).toEqual([6, 6]);
    expect(by("U4").body!.size.slice(0, 2)).toEqual([3, 3]);
    // no two of them overlap
    const boxes = ["U1", "U4", "R1"].map((r) => by(r).body!);
    for (const a of boxes) for (const b of boxes) if (a !== b) expect(Math.abs(a.at[0] - b.at[0]) >= (a.size[0]! + b.size[0]!) / 2 || Math.abs(a.at[1] - b.at[1]) >= (a.size[1]! + b.size[1]!) / 2).toBe(true);
    expect(by("BT1").body!.at[2]).toBeGreaterThan(board.at[2]); // the springs stand on its front, under the cell
    expect(product.illustrative).toBe(4);
    expect(by("PCBA").body).toBeNull();
  });

  it("pulls the tag apart front to back: the door, the body, the cell, the board, the back plate", () => {
    const z = (ref: string) => by(ref).out[2];
    expect(z("ENC4")).toBeGreaterThan(z("ENC1"));
    expect(z("ENC1")).toBeGreaterThan(z("BAT"));
    expect(z("BAT")).toBeGreaterThan(z("PCB1"));
    expect(z("U1")).toBe(z("PCB1"));
    expect(z("PCB1")).toBeGreaterThan(z("ENC2"));
  });

  it("reads what a part does, its cost and its nets from its own rows", () => {
    const u1 = by("U1");
    expect(u1.does).toBe("QFN-48 6 x 6 mm, run from the cell directly; its radio is never started.");
    expect(u1.cost).toBe("$3.40");
    expect(u1.costAt).toBe("$2.60 at 100");
    expect(u1.nets.map((n) => n.net).sort()).toEqual(["I2S_BCLK", "I2S_DIN", "VCELL"]);
    expect(u1.nets.find((n) => n.net === "VCELL")).toMatchObject({ netClass: "power", to: ["BT1"] });
    expect(by("SPK1").nets).toEqual([{ net: "SPK_P", netClass: "audio", to: ["U4"] }]);
    expect(by("PCBA").cost).toBe("");
  });

  it("groups the parts for the list", () => {
    expect(by("ENC1").group).toBe("enclosure");
    expect(by("U4").group).toBe("audio");
    expect(by("SPK1").group).toBe("audio");
    expect(by("BAT").group).toBe("power");
    expect(by("BT1").group).toBe("power");
    expect(by("U1").group).toBe("board");
    expect(by("PCB1").group).toBe("board");
  });
});
