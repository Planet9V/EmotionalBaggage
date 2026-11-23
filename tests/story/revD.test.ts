// The Rev D batch of 22 Nov 2026 (seed/concepts/baggage-claims/content/2026-11-22-revD.json): the slim
// leather-look tag the owner approved at 19:00, put into the example as decisions, parts, a schematic,
// requirements and tests, an authored enclosure and its print jobs.
import { describe, expect, it } from "vitest";
import { applyBatches, CONTENT_BATCHES, seededRows } from "@/lib/seedContent";

const revD = CONTENT_BATCHES.find((b) => b.batch === "2026-11-22-revD")!;
const after = applyBatches(seededRows());
const row = (section: string, title: string) => after.find((x) => x.section === section && x.title === title);
const APPROVAL = "yes this is perfect, a perfect design";

describe("the Rev D batch: decisions", () => {
  it("is the last batch, after the engineering batch", () => {
    expect(CONTENT_BATCHES.at(-1)).toBe(revD);
    expect(CONTENT_BATCHES.indexOf(revD)).toBeGreaterThan(CONTENT_BATCHES.findIndex((b) => b.batch === "2026-11-22-engineering"));
  });

  it("decides the design, the form factor, the lines on the tag and the cell, each quoting the owner", () => {
    const want: [string, string][] = [
      ["Which enclosure design ships?", "A1"],
      ["Which form factor ships?", "slim-tag"],
      ["Which lines go on the tag?", "talks-back"],
      ["Which cell powers the tag?", "cr2032-supercap"],
      ["Which enclosure build?", "rev-d-tag"],
    ];
    for (const [title, chosen] of want) {
      const r = row("concept/decisions", title)!;
      expect(r.status, title).toBe("decided");
      expect(r.data.chosen, title).toBe(chosen);
      expect(String(r.data.ruling), title).toMatch(/^Owner, 22 Nov 2026/);
      expect(String(r.data.ruling), title).toContain(APPROVAL);
      expect((r.data.options as { id: string }[]).some((o) => o.id === chosen), title).toBe(true);
    }
    expect(row("concept/decisions", "Which lines go on the tag?")!.body).toContain("Your luggage finally talks back.");
    expect(row("concept/decisions", "Which lines go on the tag?")!.body).toContain("FRAGILE — and emotionally unstable.");
  });

  it("quotes the airline rules with their sources on the power decision", () => {
    const note = String(row("concept/decisions", "Which cell powers the tag?")!.data.note);
    for (const s of ["iata.org", "faa.gov/hazmat/packsafe/baggage-with-lithium-batteries", "0.3 g lithium metal", "2.7 Wh", "completely switched off", "Check with the airline"]) expect(note, s).toContain(s);
  });

  it("marks the 2 x AA rulings as superseded and leaves them decided, with the owner's words of the day", () => {
    for (const title of ["Batteries: two AA alkaline cells", "Enclosure: 80 x 60 x 42 mm, a tag on the handle", "Motion sensor: the Adafruit MPU6050 breakout"]) {
      const r = row("concept/questions", title)!;
      expect(r.status).toBe("decided");
      expect(r.body).toContain("Superseded on 22 Nov 2026 by the Rev D tag");
    }
  });
});
