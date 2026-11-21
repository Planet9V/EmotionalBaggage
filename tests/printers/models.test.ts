// The supported-printer list (plan 6.0). "Done when": every listed model names its adapter and its source page.
// The sources were also fetched over HTTP on 21 Nov 2026 (every page answered 200, the four github.com pages are blocked from this
// machine's proxy and their content was read from raw.githubusercontent.com instead); that check is not repeated here because
// tests do not use the network.
import { describe, expect, it } from "vitest";
import { printerFamily, PRINTER_FAMILIES } from "@/lib/admin/printerFamilies";
import { createAdapter } from "@/lib/printers/factory";
import { FILE_ONLY_STEPS, MODELS, factsOf, findModel, modelsByMaker, validateModels, type PrinterModel } from "@/lib/printers/models";
import { findModelFor } from "@/lib/printers/modelLookup";

describe("the model list", () => {
  it("has no problems: every entry has an adapter, a family and a source page, and every fact has its own source", () => {
    expect(validateModels()).toEqual([]);
  });

  it("names an adapter and a https source page on every model", () => {
    expect(MODELS.length).toBeGreaterThanOrEqual(30);
    for (const m of MODELS) {
      expect(m.adapter, m.id).toBeTruthy();
      expect(m.source, m.id).toMatch(/^https:\/\//);
      for (const f of factsOf(m)) expect(f.source, `${m.id} ${f.field}`).toMatch(/^https:\/\/\S+$|^this app$/);
    }
  });

  it("covers every family in the plan, and the maker names the plan lists", () => {
    const makers = new Set(MODELS.map((m) => m.maker));
    for (const want of ["Bambu Lab", "Prusa Research", "Creality", "Elegoo", "Anycubic", "QIDI", "Sovol", "FlashForge"]) expect(makers.has(want), want).toBe(true);
    const adapters = new Set(MODELS.map((m) => m.adapter));
    for (const a of ["bambu", "prusalink", "moonraker", "octoprint", "duet", "file-only"]) expect(adapters.has(a as PrinterModel["adapter"]), a).toBe(true);
    expect(MODELS.some((m) => m.kind === "resin" && m.adapter === "file-only")).toBe(true);
  });

  it("gives every model a unique id that findModel and modelsByMaker agree on", () => {
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(MODELS.length);
    for (const m of MODELS) expect(findModel(m.id)).toBe(m);
    expect(modelsByMaker().flatMap((g) => g.models)).toHaveLength(MODELS.length);
  });

  it("uses families the Admin registry knows, and the family's adapter can be built (file-only models get the file-only adapter)", () => {
    for (const m of MODELS) {
      expect(printerFamily(m.family), m.id).toBeTruthy();
      const a = createAdapter(m.family, { address: "http://127.0.0.1:1", apiKey: "k", serial: "s", accessCode: "c" });
      expect(a.family, m.id).toBe(m.family === "file-only" ? "file-only" : m.family);
      expect(a.capabilities.experimental, m.id).toBe(m.experimental);
    }
  });

  it("labels Creality and Elegoo as experimental, and a model whose connection was not confirmed is file only", () => {
    for (const m of MODELS) {
      if (m.family === "creality" || m.family === "elegoo") expect(m.experimental, m.id).toBe(true);
      if (m.confirmed === "none" && m.kind !== "generic") expect(m.adapter, m.id).toBe("file-only");
      if (m.adapter === "file-only") expect(m.family, m.id).toBe("file-only");
    }
  });

  it("says what to switch on at the printer for every model with a connection, and Bambu says which firmware changed the rules", () => {
    for (const m of MODELS.filter((x) => x.adapter !== "file-only")) {
      expect(m.atPrinter?.value.length, m.id).toBeGreaterThan(0);
    }
    for (const m of MODELS.filter((x) => x.adapter === "bambu")) expect(m.firmwareNote?.value, m.id).toMatch(/Developer Mode/);
  });

  it("gives the file-only steps as plain steps, and no model or step uses an em dash", () => {
    expect(FILE_ONLY_STEPS.value.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify([MODELS, FILE_ONLY_STEPS])).not.toContain("—");
  });

  it("leaves a fact out rather than guessing: a missing volume, nozzle list or release month is absent, never a placeholder", () => {
    for (const m of MODELS) {
      for (const k of ["released", "volume", "nozzles", "materials"] as const) {
        const f = m[k];
        if (!f) continue;
        expect(f.source, `${m.id} ${k}`).toMatch(/^https:\/\//);
        expect(JSON.stringify(f.value), `${m.id} ${k}`).not.toMatch(/unknown|tbd|n\/a|\?\?/i);
      }
      if (m.volume) for (const n of [m.volume.value.x, m.volume.value.y, m.volume.value.z]) expect(n).toBeGreaterThan(0);
      if (m.nozzles) expect(m.nozzles.value.every((n) => n > 0 && n < 2)).toBe(true);
    }
  });

  it("catches an entry with no source, no adapter, or a fact with no source (the check itself works)", () => {
    const good = MODELS[0];
    expect(validateModels([{ ...good, source: "" }]).join()).toMatch(/no source page/);
    expect(validateModels([{ ...good, adapter: undefined as never }]).join()).toMatch(/no adapter/);
    expect(validateModels([{ ...good, volume: { value: { x: 1, y: 1, z: 1 }, source: "" } }]).join()).toMatch(/volume has no source page/);
    expect(validateModels([MODELS.find((m) => m.family === "creality")!].map((m) => ({ ...m, experimental: false }))).join()).toMatch(/experimental/);
    expect(validateModels([good, good]).join()).toMatch(/duplicate/);
  });

  it("lets a saved printer's free-text model find its entry", () => {
    expect(findModelFor("Bambu Lab P2S")?.id).toBeTruthy();
    expect(findModelFor("p2s")?.maker).toBe("Bambu Lab");
    expect(findModelFor("nothing like this printer")).toBeUndefined();
    expect(PRINTER_FAMILIES.length).toBe(8);
  });
});
