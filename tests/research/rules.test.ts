// The evidence rule on the generic item routes: a claim's data.evidence changes only through
// /api/research/evidence, and a hand-set status must be one the evidence does not contradict.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { POST as createConcept } from "@/app/api/projects/route";
import { DELETE as dropEvidence, POST as addEvidence } from "@/app/api/research/evidence/route";
import { EVIDENCE_ONLY_THROUGH_ROUTES, manualStatusRefusal } from "@/lib/research/rules";
import { ctx, json, read, SEEDED } from "../api/helpers";

type ItemOut = { item: { id: number; status: string; data: Record<string, unknown> }; error?: string };
const S = "https://s.example/supports";
const C = "https://c.example/contradicts";
const U = "https://u.example/unclear";

const create = async (b: Record<string, unknown>) => read<ItemOut>(await addItem(json("POST", { section: "research/claims", title: "test: rule claim", ...b }), ctx(SEEDED)));
const patch = async (id: number, b: Record<string, unknown>) => read<ItemOut>(await patchItem(json("PATCH", b), ctx(String(id))));
const evidence = async (claimId: number, url: string, verdict: string) =>
  read<{ status: string }>(await addEvidence(json("POST", { claimId, url, verdict }, "http://test.local/api/research/evidence")));
const unEvidence = async (claimId: number, url: string) =>
  read<{ status: string }>(await dropEvidence(json("DELETE", { claimId, url }, "http://test.local/api/research/evidence")));
const row = async (id: number) => (await q<{ status: string; data: Record<string, unknown> }>("SELECT status, data FROM items WHERE id=$1", [id]))[0];

let claim = 0;

beforeAll(async () => {
  claim = (await create({})).body.item.id;
});

afterAll(async () => {
  await q("DELETE FROM items WHERE title LIKE 'test:%' AND project_id=$1", [SEEDED]);
  await q("DELETE FROM projects WHERE name LIKE 'test: rule%'");
  await pool().end();
});

describe("creating a claim", () => {
  it("refuses a claim that starts as verified, saying why", async () => {
    const r = await create({ status: "verified" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("A new claim cannot start as verified: no source supports it yet. Add a supporting source as evidence and the status follows.");
    expect((await q("SELECT 1 FROM items WHERE title='test: rule claim' AND status='verified'")).length).toBe(0);
  });

  it("refuses a claim that arrives with evidence", async () => {
    const r = await create({ data: { evidence: [{ url: S, verdict: "supports", addedAt: "2026-11-20" }] } });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe(EVIDENCE_ONLY_THROUGH_ROUTES);
    // even an empty list: evidence is never written here
    expect((await create({ data: { evidence: [] } })).status).toBe(400);
  });

  it("allows unverified (the default) and wrong", async () => {
    const plain = await create({});
    expect(plain.status).toBe(201);
    expect(plain.body.item.status).toBe("unverified");
    const wrong = await create({ status: "wrong" });
    expect(wrong.status).toBe(201);
    expect(wrong.body.item.status).toBe("wrong");
  });

  it("refuses the same in a new concept's rows, and creates nothing", async () => {
    const before = (await q<{ n: number }>("SELECT count(*)::int AS n FROM projects"))[0].n;
    const r = await read<{ error: string }>(
      await createConcept(json("POST", { name: "test: rule concept", items: [{ section: "research/claims", title: "test: x", status: "verified" }] }))
    );
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/^A new claim cannot start as verified/);
    const ev = await read<{ error: string }>(
      await createConcept(json("POST", { name: "test: rule concept", items: [{ section: "research/claims", title: "test: x", data: { evidence: [] } }] }))
    );
    expect(ev.status).toBe(400);
    expect((await q<{ n: number }>("SELECT count(*)::int AS n FROM projects"))[0].n).toBe(before);
    const ok = await read<{ project: { id: string } }>(
      await createConcept(json("POST", { name: "test: rule concept ok", items: [{ section: "research/claims", title: "test: y", status: "wrong" }] }))
    );
    expect(ok.status).toBe(201);
  });

  it("leaves other sections alone", async () => {
    const r = await read<ItemOut>(await addItem(json("POST", { section: "concept/brief", title: "test: brief with evidence key", data: { evidence: "free text" } }), ctx(SEEDED)));
    expect(r.status).toBe(201);
    const p = await patch(r.body.item.id, { data: { evidence: "changed" } });
    expect(p.status).toBe(200);
  });
});

describe("changing a claim with PATCH", () => {
  it("refuses any change to data.evidence and changes nothing", async () => {
    const before = await row(claim);
    for (const evidenceValue of [[{ url: S, verdict: "supports", addedAt: "2026-11-20" }], [], null, "x"]) {
      const r = await patch(claim, { data: { evidence: evidenceValue } });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe(EVIDENCE_ONLY_THROUGH_ROUTES);
    }
    const both = await patch(claim, { status: "wrong", data: { evidence: [] } });
    expect(both.status).toBe(400);
    expect(await row(claim)).toEqual(before);
    // other data keys still change
    expect((await patch(claim, { data: { source: "Our PRD" } })).status).toBe(200);
  });

  it("with no evidence: refuses verified, allows wrong and unverified", async () => {
    const v = await patch(claim, { status: "verified" });
    expect(v.status).toBe(400);
    expect(v.body.error).toBe("This claim cannot be marked verified: no source supports it yet. Add a supporting source as evidence and the status follows.");
    expect((await row(claim)).status).toBe("unverified");
    expect((await patch(claim, { status: "wrong" })).status).toBe(200);
    expect((await patch(claim, { status: "unverified" })).status).toBe(200);
  });

  it("with only unclear sources: refuses verified", async () => {
    await evidence(claim, U, "unclear");
    const v = await patch(claim, { status: "verified" });
    expect(v.status).toBe(400);
    expect(v.body.error).toMatch(/no source supports it yet, only unclear ones/);
    await unEvidence(claim, U);
  });

  it("with a supporting source: allows verified and unverified, refuses wrong", async () => {
    expect((await evidence(claim, S, "supports")).body.status).toBe("verified");
    expect((await patch(claim, { status: "unverified" })).status).toBe(200);
    expect((await patch(claim, { status: "verified" })).status).toBe(200);
    const w = await patch(claim, { status: "wrong" });
    expect(w.status).toBe(400);
    expect(w.body.error).toBe("This claim cannot be marked wrong: 1 source supports it and none contradicts it. Add a contradicting source, or remove the supporting one first.");
    expect((await row(claim)).status).toBe("verified");
  });

  it("with a contradicting source as well: refuses verified, allows wrong", async () => {
    expect((await evidence(claim, C, "contradicts")).body.status).toBe("unverified");
    const v = await patch(claim, { status: "verified" });
    expect(v.status).toBe(400);
    expect(v.body.error).toBe("This claim cannot be marked verified: 1 source contradicts it. Remove that evidence first, or mark it wrong or unverified.");
    expect((await patch(claim, { status: "wrong" })).status).toBe(200);
    await unEvidence(claim, S);
    await unEvidence(claim, C);
  });

  it("does not check a status that is resent unchanged, so the editor can still save other fields", async () => {
    // a claim marked verified before this rule existed, with no evidence
    await q("UPDATE items SET status='verified' WHERE id=$1", [claim]);
    const r = await patch(claim, { title: "test: rule claim renamed", status: "verified" });
    expect(r.status).toBe(200);
    expect((await row(claim)).status).toBe("verified");
    // but it cannot be moved back to verified once it leaves
    expect((await patch(claim, { status: "unverified" })).status).toBe(200);
    expect((await patch(claim, { status: "verified" })).status).toBe(400);
  });
});

describe("manualStatusRefusal", () => {
  const ev = (...v: string[]) => v.map((verdict) => ({ verdict }));
  it("covers each combination", () => {
    expect(manualStatusRefusal("unverified", ev("supports"))).toBeNull();
    expect(manualStatusRefusal("unverified", ev("contradicts"))).toBeNull();
    expect(manualStatusRefusal("verified", ev("supports", "supports", "unclear"))).toBeNull();
    expect(manualStatusRefusal("verified", ev("contradicts", "contradicts"))).toMatch(/2 sources contradict it/);
    expect(manualStatusRefusal("wrong", ev("contradicts"))).toBeNull();
    expect(manualStatusRefusal("wrong", ev("unclear"))).toBeNull();
    expect(manualStatusRefusal("wrong", ev("supports", "supports"))).toMatch(/2 sources support it/);
  });
});
