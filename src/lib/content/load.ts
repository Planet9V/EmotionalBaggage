// Server side readers for the content features: the landing page's sections and what it is drawn with,
// and the rows each export reads. Everything is read for one concept.
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { readKit, findKit } from "@/lib/market/brandKit";
import { brandVariables } from "@/lib/market/brand";
import type { Item } from "@/lib/types";
import { formatMoney } from "@/lib/economics/money";
import { proofStateOf } from "./claims";
import { renderPage, type Competitor, type LandingSection, type RenderEnv } from "./landing";
import { CONTENT, LANDING_KINDS } from "./schemas";
import { currencyOf } from "@/lib/economics/currency";

export async function rowsOf(projectId: string, section: string): Promise<Item[]> {
  return (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 ORDER BY sort, id`, [projectId, section])).map(toItem);
}

function toSections(rows: Item[]): LandingSection[] {
  return rows
    .filter((r) => LANDING_KINDS.includes(r.data.kind as never))
    .map((r) => ({ id: r.id, kind: r.data.kind as LandingSection["kind"], content: (r.data.content ?? {}) as Record<string, unknown>, status: r.status, order: typeof r.data.order === "number" ? r.data.order : 0 }));
}

type FileRow = { id: string; name: string; mime: string; bytes?: Buffer };
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };

/** An approved price as the page shows it, in the concept's currency (projects.currency). A price saved in another currency is not shown. */
const priceText = (r: Item, currency: string) => {
  const minor = r.data.priceMinor;
  if (typeof minor !== "number") return null;
  const cur = String(r.data.currency || currency).toUpperCase();
  if (cur !== currency) return null;
  try {
    return formatMoney(minor, cur);
  } catch {
    return null;
  }
};

async function landingEnv(projectId: string, name: string, sections: LandingSection[], mode: "preview" | "export", scheme: "light" | "dark" | "auto") {
  const kit = readKit(findKit(await rowsOf(projectId, "marketing/brand")));
  const primary = kit?.colours?.find((c) => c.role === "primary")?.hex ?? null;
  const comps = (await rowsOf(projectId, "marketing/competitors")).map((r): Competitor => ({ id: r.id, title: r.title, ...(r.data as object) }) as Competitor);
  const pricing = await rowsOf(projectId, "marketing/pricing");
  const currency = await currencyOf(projectId);
  const prices = new Map(pricing.filter((p) => p.data.kind === "price" && p.status === "approved").map((p) => [p.id, priceText(p, currency)]));
  const proofIds = new Set<number>();
  const imageIds = new Set<number>();
  for (const s of sections) {
    if (s.kind === "proof" && Array.isArray(s.content.items)) for (const it of s.content.items as { proofItemId?: number }[]) if (typeof it.proofItemId === "number") proofIds.add(it.proofItemId);
    if (s.kind === "hero" && typeof s.content.imageFileId === "number") imageIds.add(s.content.imageFileId);
  }
  const proof = proofIds.size ? (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND id = ANY($2)`, [projectId, [...proofIds]])).map(toItem) : [];
  const labelOf = new Map<number, string>();
  for (const r of proof) {
    const state = proofStateOf({ id: r.id, section: r.section, title: r.title, body: r.body, status: r.status, data: r.data });
    if (state !== "not proof") labelOf.set(r.id, `${state[0].toUpperCase()}${state.slice(1)}: ${r.title}`.slice(0, 160));
  }
  // The preview frame is sandboxed without allow-same-origin, so it cannot load /api/files (no session there):
  // in preview mode the image bytes are inlined as data: addresses instead (robustness review S5).
  const cols = mode === "preview" ? "id, name, mime, bytes" : "id, name, mime";
  const files = imageIds.size ? await q<FileRow>(`SELECT ${cols} FROM files WHERE project_id=$1 AND id = ANY($2)`, [projectId, [...imageIds]]) : [];
  const fileById = new Map(files.map((f) => [Number(f.id), f]));
  const only = [...prices.values()].find((v) => v !== null) ?? null;
  const env: RenderEnv = {
    name,
    primary,
    headingFont: kit?.headingFont,
    bodyFont: kit?.bodyFont,
    competitors: comps,
    priceText: (id) => (id === null || id === undefined ? only : (prices.get(id) ?? null)),
    proofLabel: (id) => labelOf.get(id) ?? null,
    image: (id) => {
      const f = fileById.get(id);
      if (!f || !EXT[f.mime]) return null;
      const file = `images/${id}.${EXT[f.mime]}`;
      return { src: mode === "preview" && f.bytes ? `data:${f.mime};base64,${Buffer.from(f.bytes).toString("base64")}` : file, file };
    },
    scheme,
    boilerplate: kit?.boilerplate,
    brandVars: await brandVariables(projectId),
  };
  return { env, files: fileById };
}

export async function renderLanding(projectId: string, name: string, mode: "preview" | "export", scheme: "light" | "dark" | "auto" = "auto") {
  const sections = toSections(await rowsOf(projectId, CONTENT.landing));
  const { env, files } = await landingEnv(projectId, name, sections, mode, scheme);
  const out = renderPage(sections, env);
  return { ...out, sections, files, env };
}

