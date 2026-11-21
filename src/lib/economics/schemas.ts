// What the production, sales-channel and compliance rows store in `data` (plan 3.6, 3.8, 7.1, 7.2).
// The shared schema file calls `economicsSchemas` with its own step fields and number reader, so the
// shapes live here and the registry stays one place. Money is entered in major units (12.50) and the
// economics module turns it into integer minor units; nothing here converts a currency.
import { z } from "zod";

export const STORE_ECONOMICS = "production/economics";
export const STORE_BATCHES = "production/batches";
export const STORE_SUPPLIERS = "production/suppliers";
export const STORE_METHODS = "production/methods";
export const STORE_COMPLIANCE = "production/compliance";
export const STORE_CHANNELS = "sales/channels";

/** Lines that add to the cost of one unit. */
export const UNIT_KINDS = ["packaging", "labour", "print-material", "print-time", "shipping-in", "other-unit", "scrap"] as const;
/** Costs paid once however many units are made: they go into break-even, not into the unit cost. */
export const FIXED_KINDS = ["tooling", "certification"] as const;
/** Paid once per batch: spread over the batch size in the unit cost. */
export const BATCH_KINDS = ["setup"] as const;
export const COST_KINDS = [...UNIT_KINDS, ...FIXED_KINDS, ...BATCH_KINDS] as const;
export type CostKind = (typeof COST_KINDS)[number];

export const COST_KIND_LABEL: Record<CostKind, string> = {
  packaging: "Packaging",
  labour: "Labour",
  "print-material": "Print material",
  "print-time": "Print time",
  "shipping-in": "Shipping in",
  "other-unit": "Other, per unit",
  scrap: "Scrap allowance",
  tooling: "Tooling",
  certification: "Certification",
  setup: "Setup, per batch",
};

export const METHODS = ["fdm", "resin", "cnc", "injection", "laser-cut", "hand-assembled", "bought-in", "other"] as const;
export type Method = (typeof METHODS)[number];
export const METHOD_LABEL: Record<Method, string> = {
  fdm: "3D printed, FDM",
  resin: "3D printed, resin",
  cnc: "CNC machined",
  injection: "Injection moulded",
  "laser-cut": "Laser cut",
  "hand-assembled": "Hand assembled",
  "bought-in": "Bought in",
  other: "Other",
};

export const REGIONS = ["us", "eu", "uk", "canada", "australia", "other"] as const;
export type Region = (typeof REGIONS)[number];
export const REGION_LABEL: Record<Region, string> = { us: "United States", eu: "European Union", uk: "United Kingdom", canada: "Canada", australia: "Australia", other: "Other" };

/** The statuses a person may give a row when confirming a draft. */
export const CONFIRM_STATUSES = ["to check", "applies", "does not apply", "done"] as const;

export const METHOD_STATUSES = ["estimate", "quoted", "actual"];

/** A public web address only: no mail links, no phone numbers, no scripts. */
export function isPublicUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** A number typed the way people type money: "12.5", "$12.50", "1,200". Anything else is not a number. */
function looseNumber(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim().replace(/^[$€£]/, "").replace(/,/g, "");
  return t !== "" && Number.isFinite(Number(t)) ? Number(t) : v;
}

export function economicsSchemas(step: z.ZodRawShape): Record<string, z.ZodType<Record<string, unknown>>> {
  const text = (max = 400) => z.string().max(max);
  const money = z.preprocess(looseNumber, z.number().finite().min(0, "cannot be negative").max(1e9, "is too large"));
  const percent = z.preprocess(looseNumber, z.number().finite().min(0, "cannot be negative").max(100, "cannot be more than 100"));
  const count = z.preprocess(looseNumber, z.number().finite().int("must be a whole number").min(0, "cannot be negative").max(1e9, "is too large"));
  const url = text(500).refine((s) => s === "" || isPublicUrl(s), "must be a public web address starting with http:// or https://, not an email or phone number");

  const cost = z.looseObject({
    ...step,
    kind: z.enum(COST_KINDS, { message: `must be one of: ${COST_KINDS.join(", ")}` }).optional(),
    /** packaging, shipping in, other, tooling, certification, setup: the amount */
    amount: money.optional(),
    labourMinutes: money.optional(),
    /** per hour */
    rate: money.optional(),
    grams: money.optional(),
    pricePerKg: money.optional(),
    printMinutes: money.optional(),
    /** machine rate, per hour */
    machineRate: money.optional(),
    /** scrap allowance */
    percent: percent.optional(),
  });

  const channel = z.looseObject({
    ...step,
    price: money.optional(),
    platformPercent: percent.optional(),
    platformFixed: money.optional(),
    paymentPercent: percent.optional(),
    paymentFixed: money.optional(),
    /** per order */
    fulfilment: money.optional(),
    returnsPercent: percent.optional(),
    /** advertising cost per order */
    adCost: money.optional(),
  });

  const batch = z.looseObject({
    ...step,
    units: count.refine((n) => n > 0, "must be at least 1").optional(),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date as YYYY-MM-DD").or(z.literal("")).optional(),
    /** the build the batch is made from, as the user names it; acceptance tests may carry the same name */
    build: text(120).optional(),
  });

  const supplier = z.looseObject({
    ...step,
    /** what parts link to. Not `key`: a keyed row would join the order of operations. */
    code: text(60).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "may use letters, numbers, dots, dashes and underscores only").or(z.literal("")).optional(),
    supplies: text(400).optional(),
    leadTimeDays: count.optional(),
    minOrder: count.optional(),
    location: text(200).optional(),
    url: url.optional(),
  });

  const method = z.looseObject({
    ...step,
    method: z.enum(METHODS, { message: `must be one of: ${METHODS.join(", ")}` }).optional(),
    /** the reference of a part or the key of an assembly step this method is for */
    appliesTo: text(120).optional(),
    toolingCost: money.optional(),
    /** extra cost per unit from this method, on top of the part's own price */
    unitCost: money.optional(),
  });

  const provenance = z.looseObject({
    sources: z.array(z.looseObject({ id: z.number().optional(), section: text(80).optional(), title: text(300) })).max(100).optional(),
    model: text(200).optional(),
    at: text(40).optional(),
    regions: z.array(text(20)).max(10).optional(),
    confirmedAt: text(40).optional(),
  });
  const compliance = z.looseObject({
    ...step,
    why: text(2000).optional(),
    check: text(2000).optional(),
    /** a public address that shows the evidence */
    evidence: url.optional(),
    /** a file kept with the concept */
    evidenceFile: z.preprocess(looseNumber, z.number().int().positive()).optional(),
    generated: provenance.optional(),
  });

  return {
    [STORE_ECONOMICS]: cost,
    [STORE_CHANNELS]: channel,
    [STORE_BATCHES]: batch,
    [STORE_SUPPLIERS]: supplier,
    [STORE_METHODS]: method,
    [STORE_COMPLIANCE]: compliance,
  };
}

/** Part fields the economics read; added to the part schema. */
export function partPricingFields() {
  const money = z.preprocess(looseNumber, z.number().finite().min(0, "cannot be negative").max(1e9, "is too large"));
  return {
    /** price of one piece, in the concept's currency */
    unit: money.optional(),
    /** the code of a row in production/suppliers */
    supplier: z.string().max(120).optional(),
    /** price per piece at an ordered quantity: [{ qty: 100, unit: 1.2 }] */
    priceBreaks: z
      .array(
        z.object({
          qty: z.preprocess(looseNumber, z.number().int("must be a whole number").min(1)),
          unit: money,
        }),
      )
      .max(30)
      .optional(),
  };
}
