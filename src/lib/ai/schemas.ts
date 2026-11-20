// Shapes the model layer reads and the AI routes accept.
import { z } from "zod";

/**
 * A model choice as saved by Admin (`ModelChoice` in src/lib/settings.ts), checked on read.
 * The settings row is JSON written by another part of the app, so it is never trusted blindly.
 * An empty base address means "the provider's usual address" (DEFAULT_BASE_URL).
 */
export const savedModelChoice = z.object({
  provider: z.enum(["ollama", "lmstudio", "openrouter"]),
  baseUrl: z.string().trim().max(2000).optional().default(""),
  model: z.string().trim().min(1).max(400),
  dims: z.number().int().positive().max(100_000).optional(),
});

/** Body of POST /api/index. */
export const indexRequest = z.object({
  projectId: z.string().max(80).min(1),
});

/** Query of GET /api/search. Text is the default so existing callers see no change. */
export const searchMode = z.enum(["text", "meaning", "auto"]);
