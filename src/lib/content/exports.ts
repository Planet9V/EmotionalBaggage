// Files the user takes away: the ads as CSV, the listing as text and as a flat-file row, the launch pieces as
// HTML and text. Pure functions of rows; nothing here sends, posts or uploads.
import type { Item } from "@/lib/types";
import { listingCategory, type ChannelSpec, type FieldSpec } from "./channels";
import { effectiveAdRule } from "@/lib/campaigns/adRule";
import { minorDigits, toMajor } from "@/lib/economics/money";
import { toCsvText } from "@/lib/csv";
import { esc } from "@/lib/html";

/** Rows as CSV through the one CSV writer (src/lib/csv.ts), which neutralises formula-looking cells. */
const csv = (rows: unknown[][]) => toCsvText(rows);

const list = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : typeof v === "string" && v ? [v] : []);
const moneyIn = (currency: string) => (minor: unknown) => (typeof minor === "number" ? toMajor(minor, currency).toFixed(minorDigits(currency)) : "");

/**
 * Ads of one channel as CSV. Google: Google Ads Editor's one-ad-per-row layout. Other channels: plain, one
 * column per field, with the stop and scale rule that governs each ad: its campaign's, else its own.
 */
export function adsCsv(spec: ChannelSpec, ads: Item[], concept: string, campaigns: Item[] = [], currency = "USD"): string {
  const money = moneyIn(currency);
  if (spec.bulk.layout === "google-ads-editor") {
    const head = ["Campaign", "Ad group", "Ad type", ...Array.from({ length: 15 }, (_, i) => `Headline ${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `Description ${i + 1}`), "Path 1", "Path 2", "Final URL"];
    const rows = ads.map((a, n) => {
      const f = (a.data.fields ?? {}) as Record<string, unknown>;
      const h = list(f.headlines);
      const d = list(f.descriptions);
      return [concept, `Variant ${n + 1}`, "Responsive search ad", ...Array.from({ length: 15 }, (_, i) => h[i] ?? ""), ...Array.from({ length: 4 }, (_, i) => d[i] ?? ""), f.path1 ?? "", f.path2 ?? "", f.finalUrl ?? ""];
    });
    return csv([head, ...rows]);
  }
  const cols: FieldSpec[] = spec.fields;
  const head = ["Status", "Channel", "Message", ...cols.map((c) => c.label), "Stop and scale rule", `Cost per order ceiling (${currency})`, `Least spend before judging (${currency})`, "Rule from"];
  const rows = ads.map((a) => {
    const f = (a.data.fields ?? {}) as Record<string, unknown>;
    const r = effectiveAdRule(a, campaigns);
    return [a.status, spec.label, (a.data.message as { text?: string } | undefined)?.text ?? "", ...cols.map((c) => (c.kind === "list" ? list(f[c.key]).join(" | ") : f[c.key] ?? "")), r.sentence, money(r.stopAboveMinor), money(r.afterSpendMinor), r.campaign ? `campaign: ${r.campaign.title}` : "the ad"];
  });
  return csv([head, ...rows]);
}

export type ListingFile = { title: string; bullets: string[]; description: string; searchTerms: string };

export function listingText(l: ListingFile, category: string): string {
  const cat = listingCategory(category);
  return [`Category: ${cat.label}`, "", "TITLE", l.title, "", "BULLETS", ...l.bullets.map((b, i) => `${i + 1}. ${b}`), "", "DESCRIPTION", l.description, "", "SEARCH TERMS", l.searchTerms, ""].join("\n");
}

const tab = (v: string) => v.replace(/[\t\r\n]+/g, " ");

/** A tab-separated row with the column names Amazon's inventory flat files use. Template names vary by category: check against your category's template. */
export function listingFlatFile(l: ListingFile, opts: { sku?: string; brand?: string } = {}): string {
  const head = ["item_sku", "brand_name", "item_name", "bullet_point1", "bullet_point2", "bullet_point3", "bullet_point4", "bullet_point5", "product_description", "generic_keywords"];
  const row = [opts.sku ?? "", opts.brand ?? "", l.title, ...Array.from({ length: 5 }, (_, i) => l.bullets[i] ?? ""), l.description, l.searchTerms];
  return `${head.join("\t")}\n${row.map(tab).join("\t")}\n`;
}

const paragraphs = (body: string) => body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

export function launchText(r: Item): string {
  const subjects = list(r.data.subjects);
  const out: string[] = [];
  if (subjects.length) out.push(subjects.length > 1 ? `Subject options:\n${subjects.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : `Subject: ${subjects[0]}`);
  if (typeof r.data.previewText === "string" && r.data.previewText) out.push(`Preview text: ${r.data.previewText}`);
  out.push(r.body.trim());
  return out.join("\n\n") + "\n";
}

/** A self-contained HTML email body: one column, inline styles, no images, no script. */
export function launchHtml(r: Item): string {
  const subjects = list(r.data.subjects);
  const pre = typeof r.data.previewText === "string" ? r.data.previewText : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subjects[0] ?? r.title)}</title></head>
<body style="margin:0;padding:24px;background:#f4f2ee;font-family:Arial,Helvetica,sans-serif;color:#15181d">
${pre ? `<div style="display:none;max-height:0;overflow:hidden">${esc(pre)}</div>` : ""}
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:32px;line-height:1.6;font-size:16px">
${paragraphs(r.body).map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n")}
</div>
</body></html>
`;
}
