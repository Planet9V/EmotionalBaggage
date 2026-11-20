import { describe, expect, it } from "vitest";
import { DOC_PAGES, readDoc } from "@/lib/docs";
import { STAGES } from "@/lib/menu";

describe("the in-app documentation", () => {
  it("has a user, an admin and a developer guide, each with real content", () => {
    expect(DOC_PAGES.map((d) => d.slug)).toEqual(expect.arrayContaining(["user", "admin", "developer"]));
    for (const d of DOC_PAGES) {
      const text = readDoc(d.slug);
      expect(text.startsWith("# ")).toBe(true);
      expect(text.length).toBeGreaterThan(1500);
    }
  });

  it("names every stage and every section of the menu in the user guide", () => {
    const guide = readDoc("user").toLowerCase();
    const missing = STAGES.flatMap((s) => [s.label, ...s.sections.map((x) => x.label)]).filter((label) => !guide.includes(label.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it("documents every setting in .env.example in the admin guide, except those for unbuilt features", async () => {
    const { readFileSync } = await import("node:fs");
    const env = readFileSync(".env.example", "utf8");
    const built = env.split("# Not built yet")[0];
    const names = [...built.matchAll(/^([A-Z_]+)=/gm)].map((m) => m[1]);
    const admin = readDoc("admin");
    expect(names.filter((n) => !admin.includes(n))).toEqual([]);
  });
});
