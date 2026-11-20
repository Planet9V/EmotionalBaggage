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
});
