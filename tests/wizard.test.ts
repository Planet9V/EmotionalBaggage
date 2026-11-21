import { describe, expect, it } from "vitest";
import { buildItems, emptyAnswers } from "@/components/wizard/model";
import { newProject } from "@/lib/api/schemas";

describe("the new-concept wizard", () => {
  it("produces rows the API accepts, with every field filled", () => {
    const a = emptyAnswers();
    Object.assign(a, {
      name: "Test thing", oneLiner: "One line", who: "People", problem: "A problem", why: "Now",
      how: "It works", printed: "yes", w: "80", h: "40", d: "60",
      test: "Cheapest test", testCost: "20", gate: "Gate", channel: "A shop", price: "30",
    });
    a.parts = [{ ...a.parts[0], name: "Board", qty: "1", source: "Amazon", search: "esp32", line: "9.99" }];
    a.names = [{ ...a.names[0], text: "Alpha" }];
    const items = buildItems(a);
    expect(items.length).toBeGreaterThan(5);
    const parsed = newProject.safeParse({ name: a.name, oneLiner: a.oneLiner, items });
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it("produces rows the API accepts from a name alone, and invents no sales channel", () => {
    const a = emptyAnswers();
    a.name = "Bare";
    const items = buildItems(a);
    expect(newProject.safeParse({ name: a.name, items }).success).toBe(true);
    expect(items.filter((i) => i.section === "sales/channels")).toEqual([]);
  });

  it("creates the go or stop decision the Concept gate asks for, with the gate as its context (U15)", () => {
    const a = emptyAnswers();
    Object.assign(a, { name: "Comb", oneLiner: "A cable comb", gate: "Ten pre-orders in a week" });
    const go = buildItems(a).filter((i) => i.section === "concept/decisions");
    expect(go).toHaveLength(1);
    expect(go[0].data).toMatchObject({ key: "go", options: [{ id: "go", label: "Go" }, { id: "stop", label: "Stop" }], chosen: "" });
    expect(go[0].body).toContain("Ten pre-orders in a week");
    expect(newProject.safeParse({ name: a.name, items: buildItems(a) }).success).toBe(true);
  });

  it("labels sizes typed in the wizard as entered by you, not as stated in source documents (U24)", async () => {
    const a = emptyAnswers();
    Object.assign(a, { name: "Box", oneLiner: "A box", printed: "yes", w: "80", h: "40", d: "60" });
    const shell = buildItems(a).find((i) => (i.data as { geometry?: { print?: boolean } } | undefined)?.geometry?.print);
    expect((shell!.data as { geometry: { basis: string } }).geometry.basis).toBe("entered");
    const { BASIS_TEXT } = await import("@/components/layout/geom");
    expect(BASIS_TEXT.entered).toBe("Entered by you");
  });
});
