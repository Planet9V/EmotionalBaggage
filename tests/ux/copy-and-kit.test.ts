// U27: one select (the native one) in Admin; no doubled "(experimental)"; the Models copy names every use.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { familyOptionLabel } from "@/components/admin/PrintersTab";

describe("U27", () => {
  it("Admin and the printer picker use the kit's native select", () => {
    for (const f of ["src/components/admin/PrintersTab.tsx", "src/components/admin/AuditTab.tsx", "src/components/admin/ModelsTab.tsx", "src/components/printers/ModelPicker.tsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/@\/components\/ui\/select"/);
    }
  });
  it("a family already labelled experimental is not labelled twice", () => {
    expect(familyOptionLabel({ id: "creality", label: "Creality (experimental)", status: "supported", experimental: true, fields: [] } as never)).toBe("Creality (experimental)");
  });
  it("Admin, Models says what the reasoning model is used for, not only the reviewer", () => {
    expect(readFileSync("src/components/admin/ModelsTab.tsx", "utf8")).toMatch(/Writes every draft/);
  });
});
