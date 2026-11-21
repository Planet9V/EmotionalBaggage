// D7: a figure shown is derived or sourced, and says which. A printed part's material cost comes from its
// slice (grams x the price per kilogram the user set, with the arithmetic); without one it is labelled an
// estimate. A size "stated in a document" names the document or says it was entered by hand.
import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/types";
import { readEconomics } from "@/lib/economics/read";
import { partLine } from "@/lib/economics/compute";
import { basisText } from "@/lib/domain";
import { geometry } from "@/lib/domain/schemas";

const enc = (data: Record<string, unknown> = {}): Item => ({ id: 1, projectId: "p", section: "design/bom", title: "Enclosure", body: "", status: "to print", sort: 1, data: { ref: "ENC1", qty: 1, line: 5, ...data } });
const job = (grams: number, at: string, extra: Record<string, unknown> = {}): Item => ({ id: 9, projectId: "p", section: "prototype/printing", title: "Case print", body: "", status: "sliced", sort: 1, data: { part: "ENC1", slice: { filamentG: grams, slicedAt: at, orcaVersion: "2.5.0", ...extra } } });
const line = (parts: Item[], printJobs: Item[]) => partLine(readEconomics({ parts, economics: [], channels: [], methods: [], batches: [], printJobs }, "USD").parts[0], 5, "USD");

describe("a printed part's cost", () => {
  it("is grams from the newest slice x the material price per kg, with the arithmetic", () => {
    const l = line([enc({ printPricePerKg: 25 })], [job(30, "2026-11-01"), job(41.2, "2026-11-20")]);
    expect(l.amount).toBe(103); // 41.2 g x $25.00 / 1000 = $1.03
    expect(l.how).toBe('1 x 41.2 g (slice of print job "Case print", OrcaSlicer 2.5.0) x $25.00 per kg / 1000 = $1.03');
  });

  it("names a slice entered by hand from another slicer", () => {
    const l = line([enc({ printPricePerKg: 20 })], [job(50, "2026-11-20", { byHand: { slicer: "PrusaSlicer" } })]);
    expect(l.how).toMatch(/entered by hand from PrusaSlicer/);
  });

  it("is an entered estimate, saying what is missing, when there is no slice or no price per kg", () => {
    expect(line([enc()], []).how).toBe("Entered estimate on the parts list: $5.00; slice a print job tied to this part to work it out from grams");
    expect(line([enc()], [job(41.2, "2026-11-20")]).how).toMatch(/^Entered estimate on the parts list: \$5\.00; set the material price per kilogram/);
  });
});

describe("where a size comes from", () => {
  it("names the document, or says entered by hand", () => {
    expect(basisText({ basis: "doc", basisSource: "Espressif ESP32-S3-DevKitC-1 user guide" })).toBe("Stated in Espressif ESP32-S3-DevKitC-1 user guide");
    expect(basisText({ basis: "doc" })).toBe("Entered by hand; no document is named");
    expect(basisText({ basis: "library", basisSource: "18650 holder" })).toMatch(/parts library: 18650 holder/);
    const g = geometry.parse({ shape: "box", size: [1, 2, 3], basis: "doc", basisSource: "Drawing 12" });
    expect(g.basisSource).toBe("Drawing 12");
  });
});
