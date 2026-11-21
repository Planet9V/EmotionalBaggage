// One set of menu lookups. Several sections show the parts list; the section whose own path is the store owns it.
import { describe, expect, it } from "vitest";
import { STAGES, storeKey } from "@/lib/menu";
import { sectionLabel, stageLabel, statusesFor, storeHref, storeLabel, storeLink, storeRef, STORE_REFS } from "@/lib/menuLookup";

describe("statuses come from the menu, not from the screens", () => {
  it("are the ones the menu declares for the stores the content, names and batch screens used to list by hand", () => {
    expect(statusesFor("marketing/ads")).toEqual(["draft", "approved", "running", "paused", "killed"]);
    expect(statusesFor("sales/listing")).toEqual(["draft", "ready", "live"]);
    expect(statusesFor("concept/names")).toEqual(["draft", "candidate", "shortlist", "chosen", "rejected"]);
    expect(statusesFor("production/batches")).toEqual(["planned", "funded", "building", "shipped"]);
    expect(statusesFor("marketing/social")).toEqual(["draft", "approved", "scheduled", "posted"]);
  });
  it("match what the API accepts for each store (STORE_STATUSES)", async () => {
    const { STORE_STATUSES } = await import("@/lib/api/schemas");
    for (const r of STORE_REFS) expect(statusesFor(r.store), r.store).toEqual(STORE_STATUSES[r.store]);
  });
});

describe("menu lookups", () => {
  it("names stages and sections, and returns the key for one the menu does not have", () => {
    expect(stageLabel("prototype")).toBe("Prototype");
    expect(stageLabel("nope")).toBe("nope");
    expect(sectionLabel("design/bom")).toBe("Bill of materials");
    expect(sectionLabel("design/wiring")).toBe("Schematic");
    expect(sectionLabel("research/ask")).toBeTruthy();
    expect(sectionLabel("zz/none")).toBe("zz/none");
    // a section that shows another section's store is named by its own path
    expect(sectionLabel("prototype/sourcing")).toBe("Sourcing");
    expect(storeHref("prototype/sourcing")).toBe("/s/prototype/sourcing");
  });

  it("gives the parts list to the Bill of materials, not to Physical layout, which shows the same store", () => {
    // Plan labelled these rows "Design / Physical layout" and offered the default statuses, because it took the first section to show the store.
    expect(storeLabel("design/bom")).toBe("Design / Bill of materials");
    expect(storeHref("design/bom")).toBe("/s/design/bom");
    expect(storeRef("design/bom")?.section.key).toBe("bom");
    expect(statusesFor("design/bom")).toEqual(["to buy", "to print", "ordered", "in hand"]);
  });

  it("sends a store no section has the path of to the first section that shows it", () => {
    expect(storeHref("design/wiring")).toBe("/s/design/schematic");
    expect(statusesFor("design/wiring", "extra")).toEqual(["to solder", "soldered", "tested", "extra"]);
  });

  it("falls back for a store the menu does not know", () => {
    expect(storeHref("zz/none")).toBeNull();
    expect(storeLink("zz/none")).toBe("/s/zz/none");
    expect(storeLabel("zz/none")).toBe("zz/none");
    expect(statusesFor("zz/none")).toEqual(["open", "in progress", "done", "blocked"]);
  });

  it("holds every store once, in menu order, and every store a section names", () => {
    const stores = STAGES.flatMap((st) => st.sections.map((s) => storeKey(st, s)));
    expect(STORE_REFS.map((r) => r.store).sort()).toEqual([...new Set(stores)].sort());
    for (const r of STORE_REFS) expect(storeKey(r.stage, r.section)).toBe(r.store);
  });
});
