// Computed economics (plan 3.6, 7.1). Pure: rows in, figures out. Nothing here is typed by hand.
//
// Rules, all of them stated here because the screen shows them:
//  - Money is integer minor units. Every line is rounded to a minor unit on its own, then the lines are
//    added, so the total is always exactly the sum of what the table shows.
//  - Money is typed in major units (12.50). One currency per concept; no conversion.
//  - A part with no price is listed as "not priced". It is never counted as zero. Its cost is left out
//    of the sum, and the sum is marked incomplete.
//  - A part's price is: quantity x unit price (the unit price comes from a quantity price break when
//    the order quantity reaches one), else the line cost entered on the parts list, else not priced.
//  - Order quantity of a part for a batch is its quantity per unit x the batch size.
//  - A scrap allowance is a percentage of parts plus the other per-unit lines. Setup costs are paid once
//    per batch and are spread over the batch size. Tooling and certification are paid once in all and
//    appear in break-even only.
import { formatMoney, formatPercent, toMinor } from "./money";
import type { BatchRow, ChannelRow, CostRow, EconomicsInputs, MethodRow, PartInput } from "./read";
import { BATCH_KINDS, COST_KIND_LABEL, FIXED_KINDS, METHOD_LABEL, UNIT_KINDS, type CostKind } from "./schemas";

export type Missing = {
  key: string;
  /** what is missing, in a few words: "Battery holder: no price" */
  what: string;
  /** what to do about it */
  reason: string;
  /** the screen that has the row */
  href: string;
  rowId: number | null;
};

export type CostLine = {
  key: string;
  group: "part" | "line" | "scrap" | "setup";
  label: string;
  /** minor units; null when the line cannot be priced */
  amount: number | null;
  /** the arithmetic, in words and numbers */
  how: string;
  missing: Missing | null;
  rowId: number | null;
};

export type UnitCost = {
  batchSize: number;
  currency: string;
  lines: CostLine[];
  partsSubtotal: number;
  linesSubtotal: number;
  scrap: number;
  setupTotal: number;
  setupSpread: number;
  /** everything per unit including the setup spread */
  total: number;
  /** per unit without the setup spread (what a batch pays per piece) */
  variable: number;
  missing: Missing[];
  complete: boolean;
  /** rows typed by hand before cost kinds existed; they feed no figure */
  ignored: CostRow[];
};

export const HREF = {
  parts: "/s/production/pricing",
  economics: "/s/production/economics",
  channels: "/s/sales/channels",
  methods: "/s/production/methods",
  suppliers: "/s/production/suppliers",
  batches: "/s/production/batches",
  compliance: "/s/production/compliance",
  tests: "/s/prototype/tests",
} as const;

const fm = (m: number, c: string) => formatMoney(m, c);
const label = (p: PartInput) => (p.ref ? `${p.ref} ${p.title}` : p.title);
const roundHalfUp = (x: number) => Math.round(Number(x.toPrecision(12)));

/** The batch size as a whole number of at least one. */
export const wholeBatch = (n: number) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);

/** One part's line at a batch size. */
export function partLine(p: PartInput, batchSize: number, currency: string): CostLine {
  const name = label(p);
  const base = { key: `part:${p.id}`, group: "part" as const, label: name, rowId: p.id };
  const miss = (reason: string): CostLine => ({
    ...base,
    amount: null,
    how: `Not priced: ${reason}`,
    missing: { key: base.key, what: `${name}: not priced`, reason, href: HREF.parts, rowId: p.id },
  });

  if (p.qty !== null && (p.unit !== null || p.breaks.length)) {
    const ordered = p.qty * batchSize;
    const hit = [...p.breaks].reverse().find((b) => b.qty <= ordered);
    const unit = hit ? hit.unit : p.unit;
    if (unit === null) {
      return miss(`${ordered} ordered is below the smallest price break (${p.breaks[0].qty}) and there is no single-piece price. Enter a unit price.`);
    }
    const unitMinor = toMinor(unit, currency);
    const amount = roundHalfUp(p.qty * unitMinor);
    const how = hit
      ? `${p.qty} x ${fm(unitMinor, currency)} = ${fm(amount, currency)} (${ordered} pieces ordered reaches the break at ${hit.qty})`
      : `${p.qty} x ${fm(unitMinor, currency)} = ${fm(amount, currency)}${p.breaks.length ? ` (${ordered} pieces ordered is below the first break at ${p.breaks[0].qty})` : ""}`;
    return { ...base, amount, how, missing: null };
  }
  if (p.line !== null) {
    const amount = toMinor(p.line, currency);
    return { ...base, amount, how: `Line cost entered on the parts list: ${fm(amount, currency)}`, missing: null };
  }
  if (p.unit !== null || p.breaks.length) return miss("quantity is not set. Enter how many go into one unit.");
  return miss("no unit price and no line cost. Enter one on the parts list.");
}

function rowLine(r: CostRow, currency: string): CostLine | null {
  if (!r.kind || !(UNIT_KINDS as readonly string[]).includes(r.kind) || r.kind === "scrap") return null;
  const key = `cost:${r.id}`;
  const base = { key, group: "line" as const, label: r.title || COST_KIND_LABEL[r.kind], rowId: r.id };
  const miss = (reason: string): CostLine => ({
    ...base,
    amount: null,
    how: `Not priced: ${reason}`,
    missing: { key, what: `${base.label}: not priced`, reason, href: HREF.economics, rowId: r.id },
  });
  switch (r.kind) {
    case "labour": {
      if (r.labourMinutes === null || r.rate === null) return miss("enter the minutes and the hourly rate.");
      const rate = toMinor(r.rate, currency);
      const amount = roundHalfUp((r.labourMinutes * rate) / 60);
      return { ...base, amount, how: `${r.labourMinutes} min x ${fm(rate, currency)} per hour / 60 = ${fm(amount, currency)}`, missing: null };
    }
    case "print-material": {
      if (r.grams === null || r.pricePerKg === null) return miss("enter the grams and the price per kilogram.");
      const perKg = toMinor(r.pricePerKg, currency);
      const amount = roundHalfUp((r.grams * perKg) / 1000);
      return { ...base, amount, how: `${r.grams} g x ${fm(perKg, currency)} per kg / 1000 = ${fm(amount, currency)}`, missing: null };
    }
    case "print-time": {
      if (r.printMinutes === null || r.machineRate === null) return miss("enter the print minutes and the machine rate per hour.");
      const rate = toMinor(r.machineRate, currency);
      const amount = roundHalfUp((r.printMinutes * rate) / 60);
      return { ...base, amount, how: `${r.printMinutes} min x ${fm(rate, currency)} per hour / 60 = ${fm(amount, currency)}`, missing: null };
    }
    default: {
      if (r.amount === null) return miss("enter the amount per unit.");
      const amount = toMinor(r.amount, currency);
      return { ...base, amount, how: `${fm(amount, currency)} per unit as entered`, missing: null };
    }
  }
}

function methodLine(m: MethodRow, currency: string): CostLine | null {
  if (m.unitCost === null) return null;
  const amount = toMinor(m.unitCost, currency);
  const what = m.method ? METHOD_LABEL[m.method] : "method";
  return {
    key: `method:${m.id}`,
    group: "line",
    label: `${m.title}${m.appliesTo ? ` (${m.appliesTo})` : ""}`,
    amount,
    how: `${what}: ${fm(amount, currency)} per unit as entered`,
    missing: null,
    rowId: m.id,
  };
}

/** The unit cost build-up at one batch size. */
export function unitCost(inputs: EconomicsInputs, batchSize: number): UnitCost {
  const currency = inputs.currency;
  const n = wholeBatch(batchSize);
  const lines: CostLine[] = [];

  for (const p of inputs.parts) lines.push(partLine(p, n, currency));
  for (const r of inputs.costs) {
    const l = rowLine(r, currency);
    if (l) lines.push(l);
  }
  for (const m of inputs.methods) {
    const l = methodLine(m, currency);
    if (l) lines.push(l);
  }

  const partsSubtotal = lines.filter((l) => l.group === "part").reduce((a, l) => a + (l.amount ?? 0), 0);
  const linesSubtotal = lines.filter((l) => l.group === "line").reduce((a, l) => a + (l.amount ?? 0), 0);
  const scrapBase = partsSubtotal + linesSubtotal;

  for (const r of inputs.costs) {
    if (r.kind !== "scrap") continue;
    const key = `cost:${r.id}`;
    const name = r.title || COST_KIND_LABEL.scrap;
    if (r.percent === null) {
      lines.push({ key, group: "scrap", label: name, amount: null, how: "Not priced: enter the percentage.", rowId: r.id, missing: { key, what: `${name}: no percentage`, reason: "enter the scrap percentage.", href: HREF.economics, rowId: r.id } });
    } else {
      const amount = roundHalfUp((scrapBase * r.percent) / 100);
      lines.push({ key, group: "scrap", label: name, amount, how: `${formatPercent(r.percent)} of ${fm(scrapBase, currency)} (parts and per-unit lines) = ${fm(amount, currency)}`, missing: null, rowId: r.id });
    }
  }
  const scrap = lines.filter((l) => l.group === "scrap").reduce((a, l) => a + (l.amount ?? 0), 0);

  let setupTotal = 0;
  for (const r of inputs.costs) {
    if (!r.kind || !(BATCH_KINDS as readonly string[]).includes(r.kind)) continue;
    const key = `cost:${r.id}`;
    const name = r.title || COST_KIND_LABEL.setup;
    if (r.amount === null) {
      lines.push({ key, group: "setup", label: name, amount: null, how: "Not priced: enter the amount.", rowId: r.id, missing: { key, what: `${name}: no amount`, reason: "enter the setup cost for one batch.", href: HREF.economics, rowId: r.id } });
    } else {
      const total = toMinor(r.amount, currency);
      const spread = roundHalfUp(total / n);
      setupTotal += total;
      lines.push({ key, group: "setup", label: name, amount: spread, how: `${fm(total, currency)} per batch / ${n} units = ${fm(spread, currency)}`, missing: null, rowId: r.id });
    }
  }
  const setupSpread = lines.filter((l) => l.group === "setup").reduce((a, l) => a + (l.amount ?? 0), 0);

  const missing = lines.flatMap((l) => (l.missing ? [l.missing] : []));
  const total = partsSubtotal + linesSubtotal + scrap + setupSpread;
  return {
    batchSize: n,
    currency,
    lines,
    partsSubtotal,
    linesSubtotal,
    scrap,
    setupTotal,
    setupSpread,
    total,
    variable: partsSubtotal + linesSubtotal + scrap,
    missing,
    complete: missing.length === 0 && inputs.parts.length > 0,
    ignored: inputs.costs.filter((r) => r.kind === null),
  };
}

export type FixedCosts = { lines: { key: string; label: string; amount: number; how: string; /** paid once per batch, not once in all */ setup: boolean }[]; total: number; missing: Missing[] };

/** Costs paid once in all: tooling and certification rows, tooling named on a manufacturing method, and one run of every setup row. */
export function fixedCosts(inputs: EconomicsInputs): FixedCosts {
  const currency = inputs.currency;
  const lines: FixedCosts["lines"] = [];
  const missing: Missing[] = [];
  for (const r of inputs.costs) {
    if (!r.kind || !([...FIXED_KINDS, ...BATCH_KINDS] as readonly string[]).includes(r.kind)) continue;
    const name = r.title || COST_KIND_LABEL[r.kind as CostKind];
    if (r.amount === null) {
      missing.push({ key: `cost:${r.id}`, what: `${name}: no amount`, reason: "enter the amount.", href: HREF.economics, rowId: r.id });
      continue;
    }
    const amount = toMinor(r.amount, currency);
    lines.push({ key: `cost:${r.id}`, label: `${name} (${COST_KIND_LABEL[r.kind as CostKind].toLowerCase()})`, amount, how: `${fm(amount, currency)} as entered${r.kind === "setup" ? ", counted once" : ""}`, setup: r.kind === "setup" });
  }
  for (const m of inputs.methods) {
    if (m.toolingCost === null) continue;
    const amount = toMinor(m.toolingCost, currency);
    lines.push({ key: `method:${m.id}`, label: `${m.title}: tooling`, amount, how: `${fm(amount, currency)} tooling as entered`, setup: false });
  }
  return { lines, total: lines.reduce((a, l) => a + l.amount, 0), missing };
}

export type BreakEven = { units: number | null; reason: string };

export type ChannelResult = {
  id: number;
  title: string;
  status: string;
  price: number | null;
  platformFee: number;
  paymentFee: number;
  fulfilment: number;
  returns: number;
  adCost: number;
  /** the unit cost the margin is worked from */
  unitCost: number;
  margin: number | null;
  marginPercent: number | null;
  breakEven: BreakEven | null;
  missing: Missing[];
  complete: boolean;
  how: string[];
};

/** Margin per unit and break-even for each sales channel, at one unit cost and one set of fixed costs. */
export function channelResults(channels: ChannelRow[], unit: UnitCost, fixed: FixedCosts): ChannelResult[] {
  const currency = unit.currency;
  return channels.map((c) => {
    const miss: Missing[] = [];
    const how: string[] = [];
    const note = (reason: string, what: string) => miss.push({ key: `channel:${c.id}:${what}`, what: `${c.title}: ${what}`, reason, href: HREF.channels, rowId: c.id });

    const price = c.price === null ? null : toMinor(c.price, currency);
    if (price === null) note("enter the selling price.", "no price");
    if (c.platformPercent === null && c.platformFixed === null) note("enter the platform fee as a percent, a fixed amount, or 0 if there is none.", "platform fee not entered");

    const pct = (p: number | null, of: number | null) => (p === null || of === null ? 0 : roundHalfUp((of * p) / 100));
    const fix = (v: number | null) => (v === null ? 0 : toMinor(v, currency));
    const platformFee = pct(c.platformPercent, price) + fix(c.platformFixed);
    const paymentFee = pct(c.paymentPercent, price) + fix(c.paymentFixed);
    const fulfilment = fix(c.fulfilment);
    const returns = pct(c.returnsPercent, price);
    const adCost = fix(c.adCost);

    if (price !== null) {
      how.push(`Price ${fm(price, currency)}`);
      how.push(`Platform fee: ${c.platformPercent === null && c.platformFixed === null ? "not entered, counted as nothing" : `${formatPercent(c.platformPercent ?? 0)} of price + ${fm(fix(c.platformFixed), currency)} = ${fm(platformFee, currency)}`}`);
      how.push(`Payment fee: ${c.paymentPercent === null && c.paymentFixed === null ? "not entered, counted as nothing" : `${formatPercent(c.paymentPercent ?? 0)} of price + ${fm(fix(c.paymentFixed), currency)} = ${fm(paymentFee, currency)}`}`);
      how.push(`Fulfilment per order: ${c.fulfilment === null ? "not entered, counted as nothing" : fm(fulfilment, currency)}`);
      how.push(`Returns allowance: ${c.returnsPercent === null ? "not entered, counted as nothing" : `${formatPercent(c.returnsPercent)} of price = ${fm(returns, currency)}`}`);
      how.push(`Advertising per order: ${c.adCost === null ? "not entered, counted as nothing" : fm(adCost, currency)}`);
      how.push(`Unit cost at ${unit.batchSize} units: ${fm(unit.total, currency)}`);
    }
    if (!unit.complete) {
      miss.push({
        key: `channel:${c.id}:unit-cost`,
        what: `${c.title}: unit cost is incomplete`,
        reason: unit.missing.length ? `${unit.missing.length} cost ${unit.missing.length === 1 ? "line is" : "lines are"} not priced, so the margin is overstated.` : "there are no parts yet.",
        href: HREF.economics,
        rowId: null,
      });
    }

    let margin: number | null = null;
    let marginPercent: number | null = null;
    let breakEven: BreakEven | null = null;
    if (price !== null) {
      margin = price - unit.total - platformFee - paymentFee - fulfilment - returns - adCost;
      marginPercent = price > 0 ? (margin / price) * 100 : null;
      how.push(`Margin = ${fm(price, currency)} - ${fm(unit.total, currency)} - ${fm(platformFee, currency)} - ${fm(paymentFee, currency)} - ${fm(fulfilment, currency)} - ${fm(returns, currency)} - ${fm(adCost, currency)} = ${fm(margin, currency)}`);
      if (fixed.total === 0) {
        breakEven = { units: 0, reason: "No fixed costs are entered." };
      } else if (margin <= 0) {
        breakEven = { units: null, reason: "Each unit sold earns nothing or loses money, so fixed costs are never recovered." };
      } else {
        const units = Math.ceil(fixed.total / margin);
        breakEven = { units, reason: `${fm(fixed.total, currency)} fixed costs / ${fm(margin, currency)} margin per unit = ${units} units` };
        how.push(breakEven.reason);
      }
    }
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      price,
      platformFee,
      paymentFee,
      fulfilment,
      returns,
      adCost,
      unitCost: unit.total,
      margin,
      marginPercent,
      breakEven,
      missing: miss,
      complete: miss.length === 0,
      how,
    };
  });
}

export type SizePoint = { size: number; unitCost: number; missing: number };

/** Unit cost at each batch size, for the chart. Sizes are sorted and made unique. */
export function costBySize(inputs: EconomicsInputs, sizes: number[]): SizePoint[] {
  return [...new Set(sizes.map(wholeBatch))]
    .sort((a, b) => a - b)
    .map((size) => {
      const u = unitCost(inputs, size);
      return { size, unitCost: u.total, missing: u.missing.length };
    });
}

export type BatchResult = {
  id: number;
  title: string;
  status: string;
  targetDate: string;
  build: string;
  units: number | null;
  /** per unit including the setup spread, or null when the batch has no size */
  unitCost: number | null;
  /** parts and lines for every unit, plus one run of every setup row */
  cash: number | null;
  missing: Missing[];
  how: string[];
};

/** Each planned batch with its computed unit cost, the cash it needs and what is not priced. */
export function batchResults(inputs: EconomicsInputs): BatchResult[] {
  const currency = inputs.currency;
  return inputs.batches.map((b: BatchRow) => {
    if (b.units === null) {
      return {
        id: b.id,
        title: b.title,
        status: b.status,
        targetDate: b.targetDate,
        build: b.build,
        units: null,
        unitCost: null,
        cash: null,
        missing: [{ key: `batch:${b.id}`, what: `${b.title}: no size`, reason: "enter how many units the batch makes.", href: HREF.batches, rowId: b.id }],
        how: [],
      };
    }
    const u = unitCost(inputs, b.units);
    const cash = u.variable * b.units + u.setupTotal;
    return {
      id: b.id,
      title: b.title,
      status: b.status,
      targetDate: b.targetDate,
      build: b.build,
      units: b.units,
      unitCost: u.total,
      cash,
      missing: u.missing,
      how: [
        `Unit cost at ${b.units} units: ${fm(u.total, currency)}`,
        `Cash = ${fm(u.variable, currency)} per unit x ${b.units} units + ${fm(u.setupTotal, currency)} setup = ${fm(cash, currency)}`,
      ],
    };
  });
}
