import { SEED_ITEMS } from "@/lib/seed";
import type { Item } from "@/lib/types";

/** The example concept's parts list, as rows, straight from the seed. */
export function exampleParts(): Item[] {
  return SEED_ITEMS.filter((i) => i.section === "design/bom").map((i, n) => ({
    id: n + 1,
    projectId: "example",
    section: i.section,
    title: i.title,
    body: i.body ?? "",
    data: (i.data ?? {}) as Record<string, unknown>,
    status: i.status ?? "to buy",
    sort: n,
  }));
}

export function part(id: number, ref: string, title: string, geometry: Record<string, unknown> | null, data: Record<string, unknown> = {}, body = ""): Item {
  return { id, projectId: "p", section: "design/bom", title, body, data: { ref, ...(geometry ? { geometry } : {}), ...data }, status: "to buy", sort: id };
}
