// The brand kit as plain functions: find it among the rows, turn it into text for another
// generator's prompt, and into CSS variables for the landing page. No storage here;
// `brandContext(projectId)` in brand.ts reads the rows and calls these.
import type { Item } from "@/lib/types";
import { brandColour, brandData, HEX, voiceRule, type BrandColour } from "./schemas";
import { contrastRatio } from "./contrast";

/** The one kit row of a concept: the first row of the brand section whose kind is "kit". */
export function findKit(items: Item[]): Item | null {
  return items.find((i) => i.section === "marketing/brand" && i.data.kind === "kit") ?? null;
}

/** Reads the kit leniently: a colour or a rule that does not fit is dropped, the rest is kept. */
export function readKit(item: Item | null) {
  if (!item) return null;
  const keep = <T>(list: unknown, schema: { safeParse: (v: unknown) => { success: boolean } }) =>
    Array.isArray(list) ? (list.filter((x) => schema.safeParse(x).success) as T[]) : undefined;
  const d = item.data ?? {};
  const r = brandData.safeParse({ ...d, colours: keep(d.colours, brandColour), rules: keep(d.rules, voiceRule) });
  return r.success ? r.data : null;
}

/**
 * The kit as text for a prompt: voice, rules with their examples, tagline and boilerplate.
 * Returns "" when the kit holds nothing a writer could use. Colours and fonts are left out:
 * they do not change what words are written.
 */
export function brandText(item: Item | null): string {
  const k = readKit(item);
  if (!k) return "";
  const out: string[] = [];
  if (k.voiceSummary?.trim()) out.push(`Voice: ${k.voiceSummary.trim()}`);
  const rules = (k.rules ?? []).filter((r) => r.rule.trim());
  if (rules.length) {
    out.push("Voice rules:");
    for (const r of rules) {
      out.push(`- ${r.rule.trim()}${r.doExample.trim() ? ` Do: "${r.doExample.trim()}"` : ""}${r.dontExample.trim() ? ` Do not: "${r.dontExample.trim()}"` : ""}`);
    }
  }
  if (k.tagline?.trim()) out.push(`Tagline: ${k.tagline.trim()}`);
  if (k.boilerplate?.trim()) out.push(`Boilerplate: ${k.boilerplate.trim()}`);
  return out.join("\n");
}

const FONT = /^[A-Za-z0-9 \-,'"]{1,120}$/;

/** The text colour (white or black) that reads better on a background. */
export function onColour(hex: string): "#FFFFFF" | "#000000" {
  const w = contrastRatio(hex, "#FFFFFF") ?? 0;
  const b = contrastRatio(hex, "#000000") ?? 0;
  return w >= b ? "#FFFFFF" : "#000000";
}

/**
 * CSS custom properties for the landing page: `:root { --brand-primary: ... }`. Only values that
 * pass a strict pattern are written, so nothing a user types can break out of the declaration.
 */
export function brandCssVariables(item: Item | null): string {
  const k = readKit(item);
  if (!k) return "";
  const decl: string[] = [];
  const colours: BrandColour[] = (k.colours ?? []).filter((c) => HEX.test(c.hex));
  const primary = colours.find((c) => c.role === "primary");
  const secondaries = colours.filter((c) => c.role === "secondary");
  if (primary) decl.push(`--brand-primary: ${primary.hex.toUpperCase()};`, `--brand-on-primary: ${onColour(primary.hex)};`);
  secondaries.forEach((c, i) => {
    const name = i === 0 ? "--brand-secondary" : `--brand-secondary-${i + 1}`;
    decl.push(`${name}: ${c.hex.toUpperCase()};`, `${name}-on: ${onColour(c.hex)};`);
  });
  if (k.headingFont && FONT.test(k.headingFont)) decl.push(`--brand-font-heading: ${k.headingFont};`);
  if (k.bodyFont && FONT.test(k.bodyFont)) decl.push(`--brand-font-body: ${k.bodyFont};`);
  return decl.length ? `:root {\n  ${decl.join("\n  ")}\n}` : "";
}
