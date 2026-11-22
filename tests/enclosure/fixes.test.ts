// Where each blocking message on the Enclosure page is fixed (the address of the page and of the control or row).
import { describe, expect, it } from "vitest";
import { buildSpec, validateSpec } from "@/lib/enclosure/spec";
import { withDefaults } from "@/lib/enclosure/validate";
import { fixFor, noBoxFix } from "@/lib/enclosure/fixes";
import { exampleParts, part } from "./helpers";

describe("fixFor", () => {
  it("points a parameter problem at its own field on the Enclosure page", () => {
    expect(fixFor({ severity: "error", code: "param-range", about: "wallThickness", message: "x" }, [])).toEqual({ href: "/s/design/enclosure#enc-wallThickness", label: "Change wall thickness" });
  });
  it("points a part that does not fit at its row in Physical layout", () => {
    const parts = exampleParts();
    const spec = buildSpec({ items: parts, params: withDefaults({ clearance: 5 }) });
    const issue = validateSpec(spec).find((i) => i.code === "part-hits-wall")!;
    const named = spec.parts.find((p) => (p.ref || p.title) === issue.about)!;
    expect(fixFor(issue, spec.parts)).toMatchObject({ href: `/s/design/layout?item=${named.id}` });
  });
  it("points a missing opening at the opening editor on the same page", () => {
    expect(fixFor({ severity: "error", code: "crossing-no-opening", about: "S1", message: "x" }, []).href).toBe("/s/design/enclosure#enclosure-part-pick");
  });
  it("points 'no part has a box' at the first part without one", () => {
    const rows = [part(4, "A", "Alpha", { pos: [0, 0, 0], size: [1, 1, 1] }), part(5, "B", "Beta", null), part(6, "C", "Gamma", null)];
    expect(noBoxFix(rows).href).toBe("/s/design/layout?item=5");
    expect(noBoxFix([]).href).toBe("/s/design/layout");
  });
});
