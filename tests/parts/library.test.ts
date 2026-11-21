import { describe, expect, it } from "vitest";
import { LIBRARY, RAW_LIBRARY, libraryEntryById } from "@/lib/parts/library";
import { libraryEntry } from "@/lib/parts/schema";
import { PART_KINDS, partKind, SYMBOL_IDS } from "@/lib/parts/kinds";
import { partData } from "@/lib/domain/schemas";

describe("part library", () => {
  it("every entry satisfies the library schema", () => {
    for (const e of RAW_LIBRARY) {
      const r = libraryEntry.safeParse(e);
      expect(r.success, `${e.id}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true);
    }
  });

  it("ids are unique and each names a known kind and symbol", () => {
    const ids = LIBRARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of LIBRARY) {
      expect(partKind(e.kind), e.id).not.toBeNull();
      expect(SYMBOL_IDS).toContain(e.symbol);
    }
  });

  it("every electrical figure names its source", () => {
    for (const e of LIBRARY) {
      const figured = e.pins.filter((p) => p.voltage || p.current);
      if (!figured.length) continue;
      expect(e.sources.length, e.id).toBeGreaterThan(0);
      expect(e.figures.length, e.id).toBeGreaterThan(20);
      for (const s of e.sources) expect(s.url).toMatch(/^https?:\/\//);
    }
  });

  it("every pin has a position inside the outline, and pin names are unique per entry", () => {
    for (const e of LIBRARY) {
      expect(new Set(e.pins.map((p) => p.name)).size, e.id).toBe(e.pins.length);
      for (const p of e.pins) {
        expect(p.position, `${e.id}.${p.name}`).toBeTruthy();
        expect(Math.abs(p.position!.x)).toBeLessThanOrEqual(e.size.w / 2 + 0.01);
        expect(Math.abs(p.position!.y)).toBeLessThanOrEqual(e.size.d / 2 + 0.01);
      }
    }
  });

  it("covers the generic parts of a first prototype", () => {
    const kinds = new Set(LIBRARY.map((e) => e.kind));
    for (const k of ["microcontroller", "sensor", "display", "battery", "regulator", "switch", "button", "led", "resistor", "capacitor", "connector", "module"]) expect(kinds).toContain(k);
    expect(LIBRARY.filter((e) => e.kind === "microcontroller").length).toBeGreaterThanOrEqual(3);
    expect(libraryEntryById("hx711-module")?.name).toMatch(/load cell/i);
  });

  it("refuses an entry whose figure has no source, and a pin outside the outline", () => {
    const base = { id: "x", kind: "sensor", name: "X", description: "", size: { w: 10, d: 10 }, basis: "typical", symbol: "box" };
    expect(libraryEntry.safeParse({ ...base, sources: [], pins: [{ name: "VCC", kind: "power_in", voltage: { min: 3, max: 5 } }] }).success).toBe(false);
    expect(libraryEntry.safeParse({ ...base, sources: [], pins: [{ name: "A", kind: "input", position: { x: 6, y: 0 } }] }).success).toBe(false);
    expect(libraryEntry.safeParse({ ...base, sources: [], pins: [{ name: "A", kind: "input" }, { name: "A", kind: "output" }] }).success).toBe(false);
  });

  it("the part row accepts a known kind and library entry and refuses unknown ones", () => {
    expect(partData.safeParse({ kind: "resistor", library: "resistor-axial" }).success).toBe(true);
    expect(partData.safeParse({ kind: "", library: "" }).success).toBe(true);
    expect(partData.safeParse({ kind: "flux-capacitor" }).success).toBe(false);
    expect(partData.safeParse({ library: "no-such-part" }).success).toBe(false);
    expect(PART_KINDS.find((k) => k.id === "resistor")!.defaultPins.map((p) => p.name)).toEqual(["1", "2"]);
  });
});
