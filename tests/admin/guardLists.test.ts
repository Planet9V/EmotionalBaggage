// Review S5 of the admin area: every provider, settings key and test kind the app knows is placed in exactly one of
// the guard's two lists (src/lib/admin/guard.ts GUARD_LISTS). A new one that is placed in neither fails here, and is
// meanwhile treated as needing the platform administrator.
import { describe, expect, it } from "vitest";
import { GUARD_LISTS } from "@/lib/admin/guard";
import { adminSettingsPut, connectionTest } from "@/lib/admin/schemas";
import { PROVIDERS } from "@/lib/settings";

const placed = (open: readonly string[], admin: readonly string[], all: string[]) =>
  all.filter((x) => Number(open.includes(x)) + Number(admin.includes(x)) !== 1);

describe("the admin guard's allow-list", () => {
  it("places every provider once", () => {
    expect(placed(GUARD_LISTS.open.providers, GUARD_LISTS.platformAdmin.providers, [...PROVIDERS])).toEqual([]);
  });
  it("places every settings key once", () => {
    const keys = Object.keys((adminSettingsPut as unknown as { _def: { schema?: { shape: object } }; shape?: object }).shape ?? (adminSettingsPut as unknown as { def: { in: { shape: object } } }).def?.in?.shape ?? {});
    expect(keys.length).toBeGreaterThan(3);
    expect(placed(GUARD_LISTS.open.settings, GUARD_LISTS.platformAdmin.settings, keys)).toEqual([]);
  });
  it("places every test kind once", () => {
    const kinds = (connectionTest as unknown as { options: { shape: { kind: { value: string } } }[] }).options.map((o) => o.shape.kind.value);
    expect(kinds.length).toBeGreaterThan(5);
    expect(placed(GUARD_LISTS.open.tests, GUARD_LISTS.platformAdmin.tests, kinds)).toEqual([]);
  });
});
