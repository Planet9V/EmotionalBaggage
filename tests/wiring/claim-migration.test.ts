// Migration 0040: stored claim statuses the verified rule no longer gives go back to unverified, with an event.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { SUPPORTING_SOURCE } from "../research/verified";

const P = "zz-wiring-claims";
const UP = readFileSync("migrations/0031_claim_verified_rule.sql", "utf8").split("-- Down Migration")[0];
const add = async (title: string, evidence: unknown) =>
  Number((await q<{ id: string }>("INSERT INTO items (project_id, section, title, data, status) VALUES ($1,'research/claims',$2,$3,'verified') RETURNING id", [P, title, JSON.stringify(evidence === undefined ? {} : { evidence })]))[0].id);

beforeAll(async () => {
  await ready();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await q("INSERT INTO projects (id, name, one_liner) VALUES ($1, 'ZZ wiring claims', '')", [P]);
});
afterAll(async () => {
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await pool().end();
});

it("keeps a claim a quoted source from a saved answer stands behind, and returns the others to unverified", async () => {
  const bare = { url: "https://a.example", verdict: "supports", addedAt: "2026-11-01" };
  const ids = {
    typed: await add("typed by hand", undefined),
    bare: await add("verdict only", [bare]),
    garbage: await add("evidence not a list", "garbage"),
    disputed: await add("contradicted", [SUPPORTING_SOURCE, { url: "https://c.example", verdict: "contradicts", addedAt: "2026-11-01" }]),
    strong: await add("quoted", [bare, SUPPORTING_SOURCE]),
  };
  await q(UP);
  const status = new Map((await q<{ id: string; status: string }>("SELECT id, status FROM items WHERE project_id=$1", [P])).map((r) => [Number(r.id), r.status]));
  expect(status.get(ids.strong)).toBe("verified");
  for (const k of ["typed", "bare", "garbage", "disputed"] as const) expect(status.get(ids[k]), k).toBe("unverified");
  const events = await q<{ data: { itemId: number; before: { status: string } } }>("SELECT data FROM events WHERE project_id=$1 AND kind='item.status'", [P]);
  expect(events.map((e) => Number(e.data.itemId)).sort()).toEqual([ids.typed, ids.bare, ids.garbage, ids.disputed].sort());
  // running it again changes nothing
  await q(UP);
  expect((await q("SELECT 1 FROM events WHERE project_id=$1", [P])).length).toBe(4);
});
