// Wiring check 4: positioning with no proof cannot be approved. One function (positioningProofGap)
// says whether a positioning's messages are proven; the server's approval rule, the Marketing gate and
// the Approve button read it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { positioningFingerprint } from "@/lib/market/critique";
import { positioningProofGap } from "@/lib/market/proof";
import { positioningCheck } from "@/lib/process/computed";
import type { Item } from "@/lib/types";
import { ctx, json, read } from "../api/helpers";
import { addItem as insert, makeConcept } from "../drafts/helpers";
import { VERIFIED } from "../research/verified";

const row = (id: number, section: string, status: string, data: Record<string, unknown> = {}, title = `row ${id}`): Item => ({ id, projectId: "p", section, title, body: "", data, status, sort: id });
const reviewed = (data: Record<string, unknown>) => ({ ...data, critique: { text: "Weak.", at: "2026-11-21", model: "m", fingerprint: positioningFingerprint(data) } });
const linkTo = (r: Item) => ({ itemId: r.id, section: r.section });

describe("whether a positioning is proven", () => {
  const claim = row(1, "research/claims", "verified", VERIFIED);
  const weak = row(2, "research/claims", "unverified");
  const rows = new Map([claim, weak].map((r) => [r.id, r]));
  it("needs a message, and proof for every message", () => {
    expect(positioningProofGap({ forWhom: "travellers" }, rows)).toMatch(/no supporting message/);
    expect(positioningProofGap({ messages: [{ text: "It talks", proof: [] }] }, rows)).toMatch(/1 of 1 message has no proof: "It talks"/);
    expect(positioningProofGap({ messages: [{ text: "It talks", proof: [linkTo(weak)] }] }, rows)).toMatch(/no proof/);
    expect(positioningProofGap({ messages: [{ text: "It talks", proof: [linkTo(claim)] }, { text: "It lasts", proof: [] }] }, rows)).toMatch(/1 of 2 messages has no proof: "It lasts"/);
    expect(positioningProofGap({ messages: [{ text: "It talks", proof: [linkTo(claim)] }] }, rows)).toBeNull();
  });

  it("the Marketing gate does not count an approved positioning that has no proof", () => {
    const bare = row(3, "marketing/positioning", "approved", {}, "Bare line");
    expect(positioningCheck([bare])).toMatchObject({ met: false, href: "/s/marketing/positioning#positioning-3" });
    expect(positioningCheck([bare]).detail).toMatch(/"Bare line" is approved, but it has no supporting message/);
    const unproven = row(4, "marketing/positioning", "approved", { messages: [{ text: "It talks", proof: [linkTo(weak)] }] });
    expect(positioningCheck([weak, unproven]).met).toBe(false);
    const proven = row(5, "marketing/positioning", "approved", { messages: [{ text: "It talks", proof: [linkTo(claim)] }] });
    expect(positioningCheck([claim, proven]).met).toBe(true);
    // the claim loses its evidence: the approval no longer carries the gate
    expect(positioningCheck([{ ...claim, data: {} }, proven]).met).toBe(false);
  });
});

describe("approving through the API", () => {
  const P = "zz-wiring-positioning";
  const patch = async (id: number, change: Record<string, unknown>) => read<{ item?: { status: string }; error?: string }>(await patchItem(json("PATCH", change), ctx(String(id))));
  let claim = 0;
  let unverified = 0;

  beforeAll(async () => {
    await makeConcept(P, "ZZ Positioning", "physical", "A tag that talks");
    claim = await insert(P, "research/claims", "Travellers laugh at it", VERIFIED, "", "verified");
    unverified = await insert(P, "research/claims", "Everyone wants one", {}, "", "unverified");
  });
  afterAll(async () => {
    await q("DELETE FROM projects WHERE id=$1", [P]);
    await pool().end();
  });

  it("refuses a reviewed positioning whose message has no proof, and says which", async () => {
    const id = await insert(P, "marketing/positioning", "Line", reviewed({ kind: "statement", forWhom: "travellers", messages: [{ text: "Everyone wants one", proof: [] }] }), "", "draft");
    const r = await patch(id, { status: "approved" });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/cannot be approved: 1 of 1 message has no proof: "Everyone wants one"/);
    expect((await q<{ status: string }>("SELECT status FROM items WHERE id=$1", [id]))[0].status).toBe("draft");
  });

  it("refuses one whose only link is an unverified claim, and one with no messages", async () => {
    const linked = await insert(P, "marketing/positioning", "Line 2", reviewed({ kind: "statement", forWhom: "travellers", messages: [{ text: "Everyone wants one", proof: [{ itemId: unverified, section: "research/claims" }] }] }), "", "draft");
    expect((await patch(linked, { status: "approved" })).status).toBe(409);
    const empty = await insert(P, "marketing/positioning", "Line 3", reviewed({ kind: "statement", forWhom: "travellers" }), "", "draft");
    const r = await patch(empty, { status: "approved" });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/no supporting message/);
  });

  it("approves one whose every message links to a verified claim", async () => {
    const id = await insert(P, "marketing/positioning", "Line 4", reviewed({ kind: "statement", forWhom: "travellers", messages: [{ text: "Travellers laugh at it", proof: [{ itemId: claim, section: "research/claims" }] }] }), "", "draft");
    const r = await patch(id, { status: "approved" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.item?.status).toBe("approved");
  });
});
