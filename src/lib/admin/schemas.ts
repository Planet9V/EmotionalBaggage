// Request schemas for the Admin routes. Kept apart from src/lib/api/schemas.ts, which belongs to the item routes.
import { z } from "zod";

const MAX_VALUE = 8000;

/** Checks an http or https address with no user name or password in it (a secret never goes in a URL). */
export function httpUrlProblem(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "must be an http or https address, for example http://localhost:11434/v1";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "must start with http:// or https://";
  if (u.username || u.password) return "must not contain a user name or password; put keys in their own field";
  return null;
}

/** An http(s) address, trimmed, without a trailing slash. */
export const httpUrl = z
  .string()
  .trim()
  .min(1, "is required")
  .max(2000)
  .superRefine((v, ctx) => {
    const p = httpUrlProblem(v);
    if (p) ctx.addIssue({ code: "custom", message: p });
  })
  .transform((v) => v.replace(/\/+$/, ""));

/** A host name or an IP address, without a scheme or path. */
export const hostName = z
  .string()
  .trim()
  .min(1, "is required")
  .max(255)
  .regex(/^[A-Za-z0-9.\-:[\]]+$/, "must be a host name or IP address, with no http:// or path");

const modelProvider = z.enum(["ollama", "lmstudio", "openrouter"]);

const modelName = z.string().trim().min(1, "is required").max(300);

export const reasoningChoice = z
  .object({ provider: modelProvider, baseUrl: httpUrl, model: modelName, dims: z.undefined({ error: "applies to the embedding model only" }).optional() })
  .strict();

export const embeddingChoice = z
  .object({
    provider: modelProvider,
    baseUrl: httpUrl,
    model: modelName,
    dims: z.number({ error: "is required: the width of the vectors this model returns" }).int("must be a whole number").positive("must be positive").max(8192, "must be 8192 or less"),
  })
  .strict();

export const adminSettingsPut = z
  .object({
    reasoningModel: reasoningChoice.nullable().optional(),
    embeddingModel: embeddingChoice.nullable().optional(),
    plannerUrl: httpUrl.nullable().optional(),
    slicerUrl: httpUrl.nullable().optional(),
    defaultConcept: z.string().trim().min(1, "cannot be empty; send null to clear it").max(80).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "nothing to change" });

export const credentialsPut = z
  .object({
    fields: z.record(z.string().max(80), z.string().max(MAX_VALUE, "is too long")),
    /** model hosts only: the address the key is for; a saved key is only ever sent to this host */
    address: httpUrl.optional(),
  })
  .strict();

/** Values for a printer's access fields. Blank leaves a saved value unchanged; null removes an optional one. */
const accessValues = z.record(z.string().max(80), z.string().max(MAX_VALUE, "is too long").nullable());

const printerName = z.string().trim().min(1, "is required").max(120);

export const printerPost = z
  .object({
    name: printerName,
    family: z.string().max(40),
    model: z.string().trim().max(200).optional(),
    enabled: z.boolean().optional(),
    access: accessValues.optional(),
  })
  .strict();

export const printerPatch = z
  .object({
    name: printerName.optional(),
    family: z.string().max(40).optional(),
    model: z.string().trim().max(200).optional(),
    enabled: z.boolean().optional(),
    access: accessValues.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "nothing to change" });

const optKey = z.string().max(MAX_VALUE).optional();

export const connectionTest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("model"), provider: modelProvider, baseUrl: httpUrl, model: z.string().trim().max(300).optional(), apiKey: optKey }).strict(),
  z
    .object({
      kind: z.literal("embedding"),
      provider: modelProvider,
      baseUrl: httpUrl,
      model: modelName,
      dims: z.number().int("must be a whole number").positive("must be positive").max(8192, "must be 8192 or less"),
      apiKey: optKey,
    })
    .strict(),
  z.object({ kind: z.literal("perplexity"), apiKey: optKey }).strict(),
  z
    .object({
      kind: z.literal("printer"),
      id: z.number().int().positive().optional(),
      family: z.string().max(40).optional(),
      access: accessValues.optional(),
    })
    .strict()
    .refine((v) => v.id !== undefined || v.family !== undefined, { message: "send id (a saved printer) or family and access (a printer not saved yet)", path: ["id"] }),
  z.object({ kind: z.literal("planner"), url: httpUrl.optional() }).strict(),
  // the channel connections test the saved values (plan 8.17 to 8.19)
  z.object({ kind: z.literal("amazon-sp") }).strict(),
  z.object({ kind: z.literal("x") }).strict(),
  z.object({ kind: z.literal("instagram") }).strict(),
  z.object({ kind: z.literal("slicer"), url: httpUrl.optional() }).strict(),
  z.object({ kind: z.literal("database") }).strict(),
]);

export type ConnectionTest = z.infer<typeof connectionTest>;

/** A 400 naming one field, in the same shape the route wrapper gives every validation failure. */
export function invalid(path: (string | number)[], message: string): z.ZodError {
  return new z.ZodError([{ code: "custom", path, message, input: undefined }]);
}
