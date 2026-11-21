// Rows read once, for the economics. A number nobody entered is null, never 0.
import type { Item } from "@/lib/types";
import { partPrice, toPart } from "@/lib/domain/part";
import { COST_KINDS, METHODS, type CostKind, type Method } from "./schemas";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** A number, or text that is plainly one ("12", "$1,200.50"). Anything else is null. */
export function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/^[$€£]/, "").replace(/,/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type PartInput = {
  id: number;
  ref: string;
  title: string;
  qty: number | null;
  /** price of one piece, major units */
  unit: number | null;
  /** cost of the whole line as entered on the parts list, major units */
  line: number | null;
  breaks: { qty: number; unit: number }[];
  supplier: string;
  /** set when the unit price is the chosen offer's (Sourcing): where and when it was checked */
  offer?: { supplier: string; checkedAt: string } | null;
  /** a part printed in house: the newest slice of a print job for it, and the material price per kg the user set on the part */
  printed?: { slice: { grams: number; job: string; by: string } | null; pricePerKg: number | null } | null;
};

/** The newest slice of a print job tied to this part (data.part is its reference or title). */
function sliceFor(ref: string, title: string, jobs: Item[]): { grams: number; job: string; by: string } | null {
  let best: { grams: number; job: string; by: string; at: string } | null = null;
  for (const j of jobs) {
    const d = (j.data ?? {}) as { part?: unknown; slice?: { filamentG?: unknown; slicedAt?: unknown; orcaVersion?: unknown; byHand?: { slicer?: unknown } } };
    const tie = str(d.part);
    if (!tie || (tie !== ref && tie !== title)) continue;
    const g = num(d.slice?.filamentG);
    if (g === null || g <= 0) continue;
    const at = str(d.slice?.slicedAt);
    const by = d.slice?.byHand ? `entered by hand from ${str(d.slice.byHand.slicer) || "another slicer"}` : `OrcaSlicer${str(d.slice?.orcaVersion) ? ` ${str(d.slice?.orcaVersion)}` : ""}`;
    if (!best || at > best.at) best = { grams: g, job: j.title, by, at };
  }
  return best ? { grams: best.grams, job: best.job, by: best.by } : null;
}

const isPrinted = (item: Item) => item.status === "to print" || (item.data?.geometry as { print?: unknown } | undefined)?.print === true;

export function readPartInput(item: Item, jobs: Item[] = []): PartInput {
  const p = toPart(item);
  const d = item.data ?? {};
  const breaks = Array.isArray(d.priceBreaks)
    ? d.priceBreaks
        .map((b) => ({ qty: num((b as { qty?: unknown })?.qty), unit: num((b as { unit?: unknown })?.unit) }))
        .filter((b): b is { qty: number; unit: number } => b.qty !== null && b.qty >= 1 && b.unit !== null && b.unit >= 0)
        .sort((a, b) => a.qty - b.qty)
    : [];
  // one price per part: a chosen offer's unit price wins over a stored copy, so a stale data.unit is never read
  const pr = partPrice(p);
  if (isPrinted(item) && pr.basis !== "offer") {
    return { id: item.id, ref: p.ref, title: item.title, qty: p.qty, unit: num(d.unit), line: p.line, breaks, supplier: str(d.supplier), offer: null, printed: { slice: sliceFor(p.ref, item.title, jobs), pricePerKg: num(d.printPricePerKg) } };
  }
  if (pr.basis === "offer") return { id: item.id, ref: p.ref, title: item.title, qty: p.qty, unit: pr.unit, line: p.line, breaks, supplier: pr.supplier, offer: { supplier: pr.supplier, checkedAt: pr.checkedAt } };
  return { id: item.id, ref: p.ref, title: item.title, qty: p.qty, unit: num(d.unit), line: p.line, breaks, supplier: str(d.supplier), offer: null };
}

export type CostRow = {
  id: number;
  title: string;
  /** null for a row typed by hand before the kinds existed: it is not used in any figure */
  kind: CostKind | null;
  amount: number | null;
  labourMinutes: number | null;
  rate: number | null;
  grams: number | null;
  pricePerKg: number | null;
  printMinutes: number | null;
  machineRate: number | null;
  percent: number | null;
};

export function readCostRow(item: Item): CostRow {
  const d = item.data ?? {};
  const kind = (COST_KINDS as readonly string[]).includes(str(d.kind)) ? (str(d.kind) as CostKind) : null;
  return {
    id: item.id,
    title: item.title,
    kind,
    amount: num(d.amount),
    labourMinutes: num(d.labourMinutes),
    rate: num(d.rate),
    grams: num(d.grams),
    pricePerKg: num(d.pricePerKg),
    printMinutes: num(d.printMinutes),
    machineRate: num(d.machineRate),
    percent: num(d.percent),
  };
}

export type ChannelRow = {
  id: number;
  title: string;
  status: string;
  price: number | null;
  platformPercent: number | null;
  platformFixed: number | null;
  paymentPercent: number | null;
  paymentFixed: number | null;
  fulfilment: number | null;
  returnsPercent: number | null;
  adCost: number | null;
};

export function readChannel(item: Item): ChannelRow {
  const d = item.data ?? {};
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    price: num(d.price),
    platformPercent: num(d.platformPercent),
    platformFixed: num(d.platformFixed),
    paymentPercent: num(d.paymentPercent),
    paymentFixed: num(d.paymentFixed),
    fulfilment: num(d.fulfilment),
    returnsPercent: num(d.returnsPercent),
    adCost: num(d.adCost),
  };
}

export type MethodRow = {
  id: number;
  title: string;
  method: Method | null;
  appliesTo: string;
  toolingCost: number | null;
  unitCost: number | null;
};

export function readMethod(item: Item): MethodRow {
  const d = item.data ?? {};
  return {
    id: item.id,
    title: item.title,
    method: (METHODS as readonly string[]).includes(str(d.method)) ? (str(d.method) as Method) : null,
    appliesTo: str(d.appliesTo),
    toolingCost: num(d.toolingCost),
    unitCost: num(d.unitCost),
  };
}

export type BatchRow = { id: number; title: string; status: string; units: number | null; targetDate: string; build: string };

export function readBatch(item: Item): BatchRow {
  const d = item.data ?? {};
  const units = num(d.units);
  return { id: item.id, title: item.title, status: item.status, units: units !== null && units >= 1 ? Math.floor(units) : null, targetDate: str(d.targetDate), build: str(d.build) };
}

export type SupplierRow = { id: number; title: string; code: string; status: string; supplies: string; leadTimeDays: number | null; minOrder: number | null; location: string; url: string };

export function readSupplier(item: Item): SupplierRow {
  const d = item.data ?? {};
  return { id: item.id, title: item.title, code: str(d.code), status: item.status, supplies: str(d.supplies), leadTimeDays: num(d.leadTimeDays), minOrder: num(d.minOrder), location: str(d.location), url: str(d.url) };
}

/** The rows the economics read, each as the items of its store. */
export type EconomicsRows = {
  parts: Item[];
  economics: Item[];
  channels: Item[];
  methods: Item[];
  batches: Item[];
  /** prototype/printing rows: a printed part's material cost is worked out from its slice */
  printJobs?: Item[];
};

export type EconomicsInputs = {
  currency: string;
  parts: PartInput[];
  costs: CostRow[];
  channels: ChannelRow[];
  methods: MethodRow[];
  batches: BatchRow[];
};

export function readEconomics(rows: EconomicsRows, currency: string): EconomicsInputs {
  return {
    currency,
    parts: rows.parts.map((i) => readPartInput(i, rows.printJobs ?? [])),
    costs: rows.economics.map(readCostRow),
    channels: rows.channels.map(readChannel),
    methods: rows.methods.map(readMethod),
    batches: rows.batches.map(readBatch),
  };
}
