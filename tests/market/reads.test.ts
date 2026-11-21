// D7: Draft with AI on a marketing section says what the generator reads. The market generators name their
// sources as store paths; they used to be dropped, so the button said "from nothing yet" while the
// generator read personas and competitors.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET } from "@/app/api/drafts/generators/route";
import { json, read } from "../api/helpers";
import { addItem, makeConcept } from "../drafts/helpers";

const P = "zz-market-reads";
beforeAll(async () => {
  await makeConcept(P, "ZZ Reads", "printed", "A clip");
  await addItem(P, "marketing/personas", "Careful Chris", {}, "", "approved");
  await addItem(P, "marketing/competitors", "Rival", { basis: "typed" }, "", "approved");
});
afterAll(async () => {
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await pool().end();
});

describe("what Draft with AI says a marketing generator reads", () => {
  it("positioning reads the personas and competitors on record", async () => {
    const r = await read<{ generators: { id: string; from: string[]; counts: Record<string, number>; reads: number; readsText: string }[] }>(
      await GET(json("GET", undefined, `http://t/api/drafts/generators?projectId=${P}&kind=section&store=${encodeURIComponent("marketing/positioning")}`))
    );
    expect(r.status).toBe(200);
    const g = r.body.generators.find((x) => x.id.includes("positioning"))!;
    expect(g.from).toEqual(expect.arrayContaining(["marketing/personas", "marketing/competitors"]));
    expect(g.reads).toBeGreaterThanOrEqual(2);
    expect(g.readsText).not.toMatch(/nothing/);
  });
});
