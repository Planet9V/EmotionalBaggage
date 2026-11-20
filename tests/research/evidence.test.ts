// POST and DELETE /api/research/evidence: a claim is verified against one named source.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { DELETE, POST } from "@/app/api/research/evidence/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { ctx, json, read, SEEDED } from "../api/helpers";

const OTHER = "zz-research-evidence-other";
const A = "https://a.example/supports";
const B = "https://b.example/contradicts";

type Out = { item: { id: number; status: string; data: { evidence?: { url: string; verdict: string; quote?: string; researchId?: number; addedAt: string; title?: string }[] } }; status: string; disputed: boolean; evidence: unknown[] };
type Err = { error: string };

let claimId = 0;
let notClaimId = 0;
let researchId = 0;
let otherResearchId = 0;

const add = async (payload: Record<string, unknown>) => read<Out & Err>(await POST(json("POST", payload, "http://test.local/api/research/evidence")));
const remove = async (payload: Record<string, unknown>) => read<Out & Err>(await DELETE(json("DELETE", payload, "http://test.local/api/research/evidence")));
const lastEvent = async () =>
  (await q<{ kind: string; summary: string; data: { itemId: string; url: string; verdict: string; before: { status: string; evidence: unknown[] }; after: { status: string; evidence: unknown[]; disputed: boolean } } }>(
    "SELECT kind, summary, data FROM events WHERE data->>'itemId' = $1 ORDER BY id DESC LIMIT 1",
    [String(claimId)]
  ))[0];

beforeAll(async () => {
  await q("INSERT INTO projects (id, name, one_liner) VALUES ($1, 'test other', '') ON CONFLICT DO NOTHING", [OTHER]);
  claimId = Number((await q<{ id: string }>("INSERT INTO items (project_id, section, title, data, status) VALUES ($1,'research/claims','test: claim evidence','{}','unverified') RETURNING id", [SEEDED]))[0].id);
  notClaimId = Number((await q<{ id: string }>("INSERT INTO items (project_id, section, title, status) VALUES ($1,'concept/brief','test: not a claim','open') RETURNING id", [SEEDED]))[0].id);
  researchId = Number((await q<{ id: string }>("INSERT INTO research (project_id, query, answer, citations, model) VALUES ($1,'test: evidence q','a',$2,'m') RETURNING id", [SEEDED, JSON.stringify([A, B])]))[0].id);
  otherResearchId = Number((await q<{ id: string }>("INSERT INTO research (project_id, query, answer, citations, model) VALUES ($1,'test: other q','a',$2,'m') RETURNING id", [OTHER, JSON.stringify([A])]))[0].id);
});

afterAll(async () => {
  await q("DELETE FROM items WHERE title LIKE 'test:%' AND project_id=$1", [SEEDED]);
  await q("DELETE FROM research WHERE query LIKE 'test:%'");
  await q("DELETE FROM projects WHERE id=$1", [OTHER]);
  await pool().end();
});

describe("adding evidence", () => {
  it("refuses an unknown claim, a row that is not a claim, and bad input", async () => {
    expect((await add({ claimId: 999_999_999, url: A, verdict: "supports" })).status).toBe(404);
    const nc = await add({ claimId: notClaimId, url: A, verdict: "supports" });
    expect(nc.status).toBe(400);
    expect(nc.body.error).toMatch(/not a claim/);
    expect((await add({ claimId, url: "javascript:alert(1)", verdict: "supports" })).status).toBe(400);
    expect((await add({ claimId, url: A, verdict: "probably" })).status).toBe(400);
    expect((await add({ claimId, url: A })).status).toBe(400);
  });

  it("refuses a research entry from another concept, an unknown one, and an address it does not cite", async () => {
    const other = await add({ claimId, url: A, researchId: otherResearchId, verdict: "supports" });
    expect(other.status).toBe(400);
    expect(other.body.error).toMatch(/another concept/);
    expect((await add({ claimId, url: A, researchId: 999_999_999, verdict: "supports" })).status).toBe(404);
    const uncited = await add({ claimId, url: "https://not-cited.example/", researchId, verdict: "supports" });
    expect(uncited.status).toBe(400);
    expect(uncited.body.error).toMatch(/not one of the sources/);
    const row = await q<{ status: string; data: Record<string, unknown> }>("SELECT status, data FROM items WHERE id=$1", [claimId]);
    expect(row[0]).toEqual({ status: "unverified", data: {} });
  });

  it("moves the status through supports → contradicts → removal, with an event each time", async () => {
    const one = await add({ claimId, url: A, title: "Source A", quote: "  Carry-on limit is 7 kg.  ", researchId, verdict: "supports" });
    expect(one.status).toBe(201);
    expect(one.body).toMatchObject({ status: "verified", disputed: false });
    expect(one.body.item.status).toBe("verified");
    expect(one.body.item.data.evidence).toEqual([{ url: A, title: "Source A", quote: "Carry-on limit is 7 kg.", researchId, verdict: "supports", addedAt: expect.any(String) }]);
    let e = await lastEvent();
    expect(e.kind).toBe("claim.evidence.added");
    expect(e.data.before).toEqual({ status: "unverified", evidence: [] });
    expect(e.data.after).toMatchObject({ status: "verified", disputed: false });
    expect(e.data.after.evidence).toHaveLength(1);
    expect(e.summary).toContain("unverified → verified");

    const dup = await add({ claimId, url: A, verdict: "contradicts" });
    expect(dup.status).toBe(409);

    const two = await add({ claimId, url: B, researchId, verdict: "contradicts" });
    expect(two.status).toBe(201);
    expect(two.body).toMatchObject({ status: "unverified", disputed: true });
    e = await lastEvent();
    expect(e.data.before.status).toBe("verified");
    expect(e.data.after).toMatchObject({ status: "unverified", disputed: true });

    const gone = await remove({ claimId, url: A });
    expect(gone.status).toBe(200);
    expect(gone.body).toMatchObject({ status: "wrong", disputed: false });
    expect(gone.body.item.data.evidence?.map((x) => x.url)).toEqual([B]);
    e = await lastEvent();
    expect(e.kind).toBe("claim.evidence.removed");
    expect(e.data).toMatchObject({ url: A, verdict: "supports", before: { status: "unverified" }, after: { status: "wrong" } });
    expect(e.data.before.evidence).toHaveLength(2);

    expect((await remove({ claimId, url: A })).status).toBe(404);
    const last = await remove({ claimId, url: B });
    expect(last.body).toMatchObject({ status: "unverified", evidence: [] });
  });

  it("accepts a source that is not from a research entry, and an unclear verdict changes nothing", async () => {
    const r = await add({ claimId, url: "https://manual.example/page", verdict: "unclear" });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("unverified");
    await remove({ claimId, url: "https://manual.example/page" });
  });

  it("lets the user overrule the status by hand, recorded as a manual change", async () => {
    const res = await patchItem(json("PATCH", { status: "verified" }), ctx(String(claimId)));
    expect(res.status).toBe(200);
    const e = await lastEvent();
    expect(e.kind).toBe("item.status");
    // the next evidence change recomputes the status from the evidence
    const r = await add({ claimId, url: B, researchId, verdict: "contradicts" });
    expect(r.body.status).toBe("wrong");
    expect((await lastEvent()).data.before.status).toBe("verified");
  });

  it("leaves a claim alone whose stored evidence is not in the expected shape", async () => {
    await q("UPDATE items SET data = jsonb_build_object('evidence', 'garbage') WHERE id=$1", [claimId]);
    const r = await add({ claimId, url: A, verdict: "supports" });
    expect(r.status).toBe(409);
    const row = await q<{ data: unknown }>("SELECT data FROM items WHERE id=$1", [claimId]);
    expect(row[0].data).toEqual({ evidence: "garbage" });
  });
});
