// "Who built it": the builder's name and a short text in his own words, read from the settings store (the row
// BUILDER.setting, a JSON object { name, text, role? }). The block is drawn only when both a name and a text are
// there: a public page carries no placeholder. Never throws: with no row, a row of another shape, or a database
// that cannot be read, there is no block. Kept for a minute per server process, like the plan catalogue.
import { getSetting } from "@/lib/settings";
import { BUILDER } from "./content";

export type Builder = { name: string; text: string; role: string };

const line = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** A stored value as a builder, or null when it does not hold a name and a text. */
function toBuilder(raw: unknown): Builder | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const [name, text] = [line(r.name, 80), line(r.text, 600)];
  return name && text ? { name, text, role: line(r.role, 80) } : null;
}

const KEPT_MS = 60_000;
let kept: { at: number; value: Builder | null } | null = null;

export async function publicBuilder(): Promise<Builder | null> {
  if (kept && Date.now() - kept.at < KEPT_MS) return kept.value;
  let value: Builder | null = null;
  try {
    value = toBuilder(await getSetting<unknown>(BUILDER.setting, null));
  } catch {
    value = null;
  }
  kept = { at: Date.now(), value };
  return value;
}
