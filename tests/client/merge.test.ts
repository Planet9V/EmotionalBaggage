// Runs in node against the real PATCH route and PostgreSQL: the optimistic merge in useItems must give the row the server gives.
import { afterAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { applyChange, type ItemChange } from "@/lib/client";
import type { Item } from "@/lib/types";
import { ctx, json, read, SEEDED } from "../api/helpers";

afterAll(async () => {
  await q("DELETE FROM items WHERE title LIKE 'test-merge:%'");
  await pool().end();
});

const CASES: { name: string; start: Record<string, unknown>; change: ItemChange }[] = [
  { name: "one data key, others kept", start: { ref: "U1", qty: 2, source: "Amazon" }, change: { data: { qty: 5 } } },
  // Geometry is given in full: the server fills schema defaults (basis, explode) that the client cannot predict; see the note in useItems.
  { name: "a nested value is replaced whole, not merged", start: { ref: "U2", geometry: { shape: "box", size: [1, 2, 3], pos: [0, 0, 0], explode: [0, 0, 0], basis: "doc" } }, change: { data: { geometry: { shape: "box", size: [1, 2, 3], pos: [4, 5, 6], explode: [0, 0, 0], basis: "doc" } } } },
  { name: "a new key is added and an existing key is overwritten", start: { ref: "U3", asin: "B000" }, change: { data: { asin: "", search: "x" } } },
  { name: "title, body and status without data", start: { ref: "U4" }, change: { title: "test-merge: renamed", body: "spec", status: "ordered" } },
  { name: "an empty data object changes nothing", start: { ref: "U5", qty: 1 }, change: { data: {} } },
];

describe("applyChange matches the PATCH route", () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const made = await read<{ item: Item }>(await addItem(json("POST", { section: "design/bom", title: "test-merge: row", data: c.start }), ctx(SEEDED)));
      expect(made.status).toBe(201);
      const predicted = applyChange(made.body.item, c.change);
      const res = await read<{ item: Item }>(await patchItem(json("PATCH", c.change), ctx(String(made.body.item.id))));
      expect(res.status).toBe(200);
      const { ...server } = res.body.item;
      expect({ ...predicted }).toEqual(server);
    });
  }
});
