import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { readSources } from "@/lib/research/schemas";
import { brandText, findKit } from "./brandKit";
import type { MarketContext } from "./generators/types";

type R = { id: string; query: string; answer: string; citations: unknown; sources: unknown };

/** Loads everything a marketing generator may read, for one concept. The only place generators' inputs are read. */
export async function loadContext(project: { id: string; name: string; one_liner: string }, params: Record<string, unknown>): Promise<MarketContext> {
  const rows = (
    await q<ItemRow>(
      `SELECT ${ITEM_COLS} FROM items WHERE project_id=$1
         AND section IN ('concept/brief','research/claims','marketing/personas','marketing/competitors','design/requirements','prototype/tests','concept/names','marketing/brand')
       ORDER BY sort, id`,
      [project.id]
    )
  ).map(toItem);
  const research = await q<R>("SELECT id, query, answer, citations, sources FROM research WHERE project_id=$1 ORDER BY id DESC LIMIT 30", [project.id]);
  const of = (s: string) => rows.filter((i) => i.section === s);
  const brandItem = findKit(of("marketing/brand"));
  return {
    project: { id: project.id, name: project.name, oneLiner: project.one_liner },
    brief: of("concept/brief"),
    claims: of("research/claims"),
    research: research.map((r) => ({ id: Number(r.id), query: r.query, answer: r.answer, sources: readSources(r.sources, r.citations).map((s) => ({ url: s.url, title: s.title })) })),
    personas: of("marketing/personas"),
    competitors: of("marketing/competitors"),
    requirements: of("design/requirements"),
    tests: of("prototype/tests"),
    names: of("concept/names"),
    brand: brandText(brandItem),
    brandItem,
    params,
  };
}
