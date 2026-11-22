// Wiring check 1: one price and one margin. For the same price on the same sales channel, the
// Pricing page (margin) and Unit economics (channelResults) show the same margin, whatever the
// channel takes: fees, fulfilment, a returns allowance and advertising per order.
import { describe, expect, it } from "vitest";
import { channelResults, fixedCosts, referenceUnitCost } from "@/lib/economics/compute";
import { readEconomics } from "@/lib/economics/read";
import { costPlusPrice, margin, pricingUnitCost } from "@/lib/market/pricing";
import type { Item } from "@/lib/types";

const item = (id: number, section: string, title: string, data: Record<string, unknown>): Item =>
  ({ id, project_id: 1, section, title, body: "", status: "planned", data, position: id, created_at: "", updated_at: "" }) as unknown as Item;

const rows = {
  parts: [item(1, "design/bom", "Case", { ref: "P1", qty: 1, unit: 6.4 }), item(2, "design/bom", "Board", { ref: "U1", qty: 1, unit: 3.6 })],
  economics: [],
  channels: [item(3, "sales/channels", "Own shop", { price: 24.99, platformPercent: 8, platformFixed: 0.3, paymentPercent: 2.9, paymentFixed: 0.3, fulfilment: 3.2, returnsPercent: 5, adCost: 2 })],
  methods: [],
  batches: [],
};

describe("one price, one margin", () => {
  const inputs = readEconomics(rows, "USD");
  const unit = referenceUnitCost(inputs);
  const economics = channelResults(inputs.channels, unit, fixedCosts(inputs))[0];
  const channel = inputs.channels[0];

  it("Pricing shows the margin Unit economics shows for the channel's own price", () => {
    const pricing = margin(economics.price as number, pricingUnitCost(unit), channel);
    expect(pricing.marginMinor).toBe(economics.margin);
    expect(pricing.marginPercent).toBeCloseTo(economics.marginPercent as number, 9);
  });

  it("counts fulfilment, returns and advertising per order, not only the two fees", () => {
    const pricing = margin(2499, pricingUnitCost(unit), channel);
    // 2499 - 1000 unit - (200 + 30) platform - (72 + 30) payment - 320 fulfilment - 125 returns - 200 ads
    expect(pricing.marginMinor).toBe(2499 - 1000 - 230 - 102 - 320 - 125 - 200);
  });

  it("a cost-plus price reaches its target on the margin both screens show", () => {
    const u = pricingUnitCost(unit);
    const price = costPlusPrice(u, 30, channel) as number;
    const back = channelResults([{ ...channel, price: price / 100 }], unit, fixedCosts(inputs))[0];
    expect(back.marginPercent as number).toBeGreaterThanOrEqual(29.9); // each fee is rounded to a minor unit on its own
    expect(back.marginPercent as number).toBeLessThan(30.2);
    expect(margin(price, u, channel).marginMinor).toBe(back.margin);
  });
});
