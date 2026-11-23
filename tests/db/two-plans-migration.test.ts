// Migration 0042: a plan catalogue saved before the owner's ruling of 22 Nov becomes the two plans, Maker and Studio,
// without overwriting a price an admin set. The migration's own SQL is run again here against prepared rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { getPlanCatalogue } from "@/lib/admin/plans";

const UP = readFileSync(join(process.cwd(), "migrations/0042_two_plans.sql"), "utf8").split("-- Down Migration")[0]!;
let saved: unknown = null;

const tier = (key: string, name: string, priceMonthly: number | null, over: Record<string, unknown> = {}) => ({
  key, name, shown: true, paid: priceMonthly !== 0, currency: "USD", priceMonthly, priceYearly: null, who: `${name} people`, what: `What ${name} is`,
  includes: [`${name} line`], action: "request", limits: { concepts: null, members: null, aiCreditsPerMonth: null, storageMb: null, printJobsPerMonth: null },
  stripePriceMonthly: null, stripePriceYearly: null, ...over,
});

async function upgrade(value: unknown) {
  await q("DELETE FROM settings WHERE key = 'plans.catalogue'");
  if (value !== null) await q("INSERT INTO settings (key, value) VALUES ('plans.catalogue', $1)", [JSON.stringify(value)]);
  await q(UP);
  return (await q<{ value: Record<string, unknown> }>("SELECT value FROM settings WHERE key = 'plans.catalogue'"))[0]?.value ?? null;
}

beforeAll(async () => {
  saved = (await q<{ value: unknown }>("SELECT value FROM settings WHERE key = 'plans.catalogue'"))[0]?.value ?? null;
});
afterAll(async () => {
  await q("DELETE FROM settings WHERE key = 'plans.catalogue'");
  if (saved !== null) await q("INSERT INTO settings (key, value) VALUES ('plans.catalogue', $1)", [JSON.stringify(saved)]);
  await pool().end();
});

describe("migration 0042, two plans", () => {
  it("removes Free and Self-hosted, keeps a price the admin typed, moves old seeded prices to $20 and $40, shows prices", async () => {
    const before = { showPrices: false, tiers: [tier("free", "Free", 0), tier("maker", "Maker", 25, { what: "Edited by the admin" }), tier("studio", "Studio", 99), tier("self", "Self-hosted", 0, { action: "run" })] };
    const after = await upgrade(before);
    expect(after).toMatchObject({ showPrices: true });
    const tiers = (after!.tiers as { key: string; priceMonthly: number; what: string }[]);
    expect(tiers.map((t) => [t.key, t.priceMonthly])).toEqual([["maker", 25], ["studio", 40]]);
    expect(tiers[0]!.what).toBe("Edited by the admin");
    // what the app reads is valid
    expect((await getPlanCatalogue()).source).toBe("database");
    const line = await q<{ detail: { before: unknown; after: unknown } }>("SELECT detail FROM audit_log WHERE action = 'setting.changed' AND summary LIKE '%upgrade 0042%' ORDER BY id DESC LIMIT 1");
    expect(line[0]!.detail.before).toEqual(before);
  });

  it("fills a price that was never set, turns a Run it yourself button into a request, and runs twice to the same result", async () => {
    const first = await upgrade({ showPrices: false, tiers: [tier("maker", "Maker", null), tier("team", "Team", 300, { action: "run" })] });
    expect((first!.tiers as { key: string; priceMonthly: number; action: string }[]).map((t) => [t.key, t.priceMonthly, t.action])).toEqual([["maker", 20, "request"], ["team", 300, "request"]]);
    const n = (await q<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE summary LIKE '%upgrade 0042%'"))[0]!.n;
    await q(UP);
    expect((await q<{ value: unknown }>("SELECT value FROM settings WHERE key = 'plans.catalogue'"))[0]!.value).toEqual(first);
    expect((await q<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE summary LIKE '%upgrade 0042%'"))[0]!.n).toBe(n);
  });

  it("with nothing left, removes the saved row so the built-in two plans apply; with no saved row, does nothing", async () => {
    expect(await upgrade({ showPrices: true, tiers: [tier("free", "Free", 0), tier("self", "Self-hosted", 0)] })).toBeNull();
    const c = await getPlanCatalogue();
    expect(c.source).toBe("built-in");
    expect(c.catalogue.tiers.map((t) => [t.key, t.priceMonthly])).toEqual([["maker", 20], ["studio", 40]]);
    expect(c.catalogue.showPrices).toBe(true);
    expect(await upgrade(null)).toBeNull();
  });
});
