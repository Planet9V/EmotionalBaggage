// The slicer's profile file and the printer model list are written by different hands; they must name printers the same way.
import { describe, expect, it } from "vitest";
import { MODELS } from "@/lib/printers/models";
import catalogue from "../../slicer/profiles.json";

describe("slicer profiles and the supported printer list", () => {
  it("has an entry, with a profile or a stated reason, for every filament printer model", () => {
    const printers = (catalogue as unknown as { printers: Record<string, Record<string, { profile: boolean | null }>> }).printers;
    const missing = MODELS.filter((m) => m.kind === "fdm" && !printers[m.maker]?.[m.model]).map((m) => `${m.maker} ${m.model}`);
    expect(missing).toEqual([]);
  });
});
