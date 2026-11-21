import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { movePricingChannels } from "@/lib/economics/movePricingChannels";

const A = "zz-move-pricing-a";
const B = "zz-move-pricing-b";
type Row = { title: string; section: string; status: string; data: Record<string, unknown> };

const add = (project: string, section: string, title: string, data: unknown, status = "draft") =>
  q("INSERT INTO items (project_id, section, title, data, status) VALUES ($1,$2,$3,$4,$5)", [project, section, title, JSON.stringify(data), status]);
const rows = (project: string, section: string) => q<Row>("SELECT title, section, status, data FROM items WHERE project_id=$1 AND section=$2 ORDER BY id", [project, section]);

beforeAll(async () => {
  await q("DELETE FROM projects WHERE id = ANY($1)", [[A, B]]);
  await q("INSERT INTO projects (id, name, one_liner, currency) VALUES ($1,'ZZ move A','x','USD'), ($2,'ZZ move B','x','JPY')", [A, B]);
  // USD: one new channel, one matching a sales channel with nothing entered, one matching one with a fee entered
  await add(A, "marketing/pricing", "Own shop", { kind: "channel", feePercent: 3, fixedFeeMinor: 30, currency: "USD" });
  await add(A, "marketing/pricing", "amazon", { kind: "channel", feePercent: 15, fixedFeeMinor: 0 });
  await add(A, "marketing/pricing", "Etsy", { kind: "channel", feePercent: 6.5, fixedFeeMinor: 20 });
  await add(A, "marketing/pricing", "$25.00", { kind: "price", priceMinor: 2500, currency: "USD" });
  await add(A, "sales/channels", "Amazon", { price: 25 }, "planned");
  await add(A, "sales/channels", "Etsy", { platformPercent: 9, platformFixed: 0.1 }, "planned");
  await add(B, "marketing/pricing", "Direct", { kind: "channel", feePercent: 4, fixedFeeMinor: 50 });
});
afterAll(async () => {
  await q("DELETE FROM projects WHERE id = ANY($1)", [[A, B]]);
  await pool().end().catch(() => undefined);
});

describe("moving Pricing's own channel rows to Sales channels", () => {
  it("moves each row once, keeps the economics fee where one is entered, and says what it dropped", async () => {
    await movePricingChannels(pool());
    const sales = await rows(A, "sales/channels");
    const by = (t: string) => sales.find((r) => r.title === t)!;
    expect(by("Own shop").data).toMatchObject({ platformPercent: 3, platformFixed: 0.3 });
    expect(by("Own shop").status).toBe("planned");
    expect(by("Amazon").data).toMatchObject({ price: 25, platformPercent: 15, platformFixed: 0 });
    expect(by("Etsy").data).toMatchObject({ platformPercent: 9, platformFixed: 0.1 });
    expect(sales).toHaveLength(3);
    // no channel rows are left on Pricing; the price stays
    const pricing = await rows(A, "marketing/pricing");
    expect(pricing.map((r) => r.data.kind)).toEqual(["price"]);
    // a yen fixed fee has no minor digits
    expect((await rows(B, "sales/channels"))[0].data).toMatchObject({ platformPercent: 4, platformFixed: 50 });
    const ev = await q<{ summary: string }>("SELECT summary FROM events WHERE project_id=$1 AND kind='pricing.channel.moved' ORDER BY id", [A]);
    expect(ev).toHaveLength(3);
    expect(ev.some((e) => /Etsy.*dropped/.test(e.summary))).toBe(true);
  });
  it("is idempotent: a second start changes nothing", async () => {
    const before = JSON.stringify([await rows(A, "sales/channels"), await rows(A, "marketing/pricing"), await rows(B, "sales/channels")]);
    expect(await movePricingChannels(pool())).toBe(0);
    expect(JSON.stringify([await rows(A, "sales/channels"), await rows(A, "marketing/pricing"), await rows(B, "sales/channels")])).toBe(before);
    expect((await q("SELECT 1 FROM events WHERE project_id=$1 AND kind='pricing.channel.moved'", [A])).length).toBe(3);
  });
});
