import { describe, expect, it } from "vitest";
import { project, stillOf, toneOf } from "@/components/welcome/get/projection";
import { netWheel } from "@/components/welcome/get/heroArt";

const box = (id: number, pos: [number, number, number], size: [number, number, number], step = 0) => ({ id, ref: `P${id}`, title: `part ${id}`, kind: "module", step, geometry: { shape: "box" as const, basis: "doc" as const, size, pos, explode: [0, 20, 0] as [number, number, number] } });

describe("the model as a vector drawing", () => {
  it("projects up as up on screen and the nearer corner as nearer", () => {
    expect(project([0, 10, 0]).y).toBeLessThan(project([0, 0, 0]).y);
    expect(project([10, 10, 10]).depth).toBeGreaterThan(project([-10, -10, -10]).depth);
  });
  it("keeps only the three faces of a box that face the viewer, inside its box", () => {
    const s = stillOf([box(1, [0, 0, 0], [20, 10, 30])]);
    expect(s.faces).toHaveLength(3);
    for (const f of s.faces) {
      const nums = f.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      for (let i = 0; i < nums.length; i += 2) {
        expect(nums[i]!).toBeGreaterThanOrEqual(s.box[0]);
        expect(nums[i]!).toBeLessThanOrEqual(s.box[0] + s.box[2]);
      }
    }
  });
  it("draws far parts before near ones", () => {
    const s = stillOf([box(1, [0, 0, 60], [10, 10, 10]), box(2, [0, 0, -60], [10, 10, 10])]);
    expect(s.faces[0]!.part).toBe(2);
    expect(s.faces.at(-1)!.part).toBe(1);
  });
  it("gives each part its tone, step and the screen direction it explodes in", () => {
    const s = stillOf([box(1, [0, 0, 0], [10, 10, 10], 3)]);
    expect(s.parts[0]).toMatchObject({ tone: "--net-signal", step: 3 });
    expect(s.parts[0]!.explode[1]).toBeLessThan(0); // up the screen
    expect(toneOf("", "BAT")).toBe("--net-power");
    expect(toneOf("enclosure", "ENC1")).toBe("--accent-orange");
  });
  it("draws a counted cylinder once per body, and a shell with its far faces, behind and in front", () => {
    const cyl = { id: 3, ref: "BAT", title: "cells", kind: "", step: 0, geometry: { shape: "cylinder" as const, basis: "doc" as const, size: [14, 50] as [number, number], pos: [0, 10, 0] as [number, number, number], explode: [0, 0, 0] as [number, number, number], count: 3 } };
    const shell = { id: 4, ref: "ENC1", title: "case", kind: "enclosure", step: 0, geometry: { shape: "shell" as const, basis: "doc" as const, size: [80, 42, 60] as [number, number, number], pos: [0, 21, 0] as [number, number, number], explode: [0, 0, 0] as [number, number, number] } };
    const s = stillOf([cyl, shell]);
    expect(s.faces.filter((f) => f.part === 3).length % 3).toBe(0);
    const sh = s.faces.filter((f) => f.shell);
    expect(sh).toHaveLength(6);
    expect(s.faces[0]!.shell).toBe(true);
    expect(s.faces.at(-1)!.shell).toBe(true);
  });
});

describe("the hero's netlist wheel", () => {
  const wires = [
    { from: "BT1", to: "S1", netClass: "power" as const },
    { from: "S1", to: "U1", netClass: "power" as const },
    { from: "U1", to: "U2", netClass: "signal" as const },
    { from: "U1", to: "U2", netClass: "signal" as const },
    { from: "U1", to: "SPK1", netClass: "audio" as const },
  ];
  it("puts the hub in the middle and every other part on the ring, one line per wire", () => {
    const w = netWheel(wires, "U1", 100);
    const hub = w.nodes.find((n) => n.hub)!;
    expect(hub).toMatchObject({ ref: "U1", x: 50, y: 50 });
    expect(w.nodes.map((n) => n.ref).sort()).toEqual(["BT1", "S1", "SPK1", "U1", "U2"]);
    for (const n of w.nodes.filter((x) => !x.hub)) expect(Math.hypot(n.x - 50, n.y - 50)).toBeCloseTo(38, 0);
    expect(w.links).toHaveLength(5);
    // two wires between the same parts bow apart
    const twins = w.links.filter((l) => l.a === "U1" && l.b === "U2");
    expect(twins[0]!.d).not.toBe(twins[1]!.d);
  });
});
