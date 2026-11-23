// The Rev D wording batch of 23 Nov 2026 (seed/concepts/baggage-claims/content/2026-11-23-revD-3.json): the rows the
// two Rev D batches left describing the Rev A or 2 x AA device as current. The airline and security rows say only
// what the Rev D engineering note's cited rules support, name the source, say that airline and security staff make
// the final call and that the tag has an off switch, and wait for the owner's approval.
import { afterAll, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { applyBatches, CONTENT_BATCHES, seededRows } from "@/lib/seedContent";
import { checkContentRow } from "@/lib/seedContentDb";

afterAll(async () => {
  await pool().end();
});

const revD3 = CONTENT_BATCHES.find((b) => b.batch === "2026-11-23-revD-3")!;
const at = CONTENT_BATCHES.indexOf(revD3);
const before = applyBatches(seededRows(), CONTENT_BATCHES.slice(0, at));
const after = applyBatches(seededRows(), CONTENT_BATCHES.slice(0, at + 1));
const row = (section: string, title: string) => after.find((x) => x.section === section && x.title === title)!;
const text = (r: { body: string; data: Record<string, unknown> }) => `${r.body} ${typeof r.data.how === "string" ? r.data.how : ""}`;

/** The rows that state an airline or security rule in the owner's name. */
const AIRLINE: [string, string][] = [
  ["concept/story", "Why it should work"],
  ["concept/brief", "Claimed moats"],
  ["concept/brief", "Risk: batteries in checked bags, as it looks to others (High)"],
  ["concept/faq", "Will TSA confiscate it?"],
  ["concept/faq", "Can it ride in a checked bag?"],
  ["marketing/landing", "Legal pages"],
  ["marketing/launch", "The compliance mark, the battery statement and a barcode"],
];

describe("the Rev D wording batch", () => {
  it("is applied after the Rev D leftovers batch, only enriches, and every row passes the checks a typed row passes", () => {
    expect(CONTENT_BATCHES[at - 1]!.batch).toBe("2026-11-22-revD-2");
    expect(revD3.rows.every((r) => r.op === "enrich")).toBe(true);
    expect(after).toHaveLength(before.length);
    for (const r of revD3.rows) {
      expect(r.sourceFile, r.proposal).toMatch(/RevD|revD/);
      if (r.op !== "enrich") continue;
      const was = before.find((x) => x.section === r.section && x.title === r.match.title);
      expect(was, r.proposal).toBeTruthy();
      expect(() => checkContentRow(r, was)).not.toThrow();
    }
  });

  it("leaves no row it touches describing the puck, alkaline or AA cells, the DFPlayer, a microSD card or USB as the design", () => {
    for (const r of revD3.rows) {
      if (r.op !== "enrich") continue;
      const now = row(r.section, r.match.title!);
      const said = text(now).replace(/The Rev A list \([^)]*\) was for the 2 x AA design\.|the Rev A cause \([^)]*\)|the PRD rested the checked-bag point on alkaline AA cells, which|has no microSD card|has no DFPlayer|no DFPlayer BUSY line|has no USB port/g, "");
      expect(said, r.proposal).not.toMatch(/puck|alkaline|\bAA\b|DFPlayer|microSD|USB-C|Arduino|hot glue/i);
    }
    expect(row("concept/story", "The pitch").body).toContain("62 by 92 by 12.8 mm");
    expect(row("concept/story", "The pitch").body).toMatch(/side off switch, and a pocket for the buyer's own tracker/);
    expect(row("concept/story", "The pitch").status).toBe("written");
  });

  it("states the airline rules only as the cited sources support them, with the final call and the off switch, as drafts", () => {
    for (const [section, title] of AIRLINE) {
      const r = row(section, title);
      const t = text(r);
      expect(t, title).toMatch(/0\.07 g of lithium metal/);
      expect(t, title).toMatch(/under the 0\.3 g limit that IATA \(Dangerous Goods Regulations, Table 2\.3\.A\) and the FAA \(PackSafe, Baggage Equipped with Lithium Batteries\)/);
      expect(t, title).toMatch(/airline and security staff make the final call/i);
      expect(t, title).toMatch(/off switch/);
      // no mark or certification is claimed, and nothing is promised as legal
      expect(t, title).not.toMatch(/certified|approved by|compliant|checked-bag legal|FCC|\bCE\b|UKCA|TSA-approved|guarantee/i);
      // the app's own status for unapproved copy where the section has one; said in the text where it does not
      if (section === "concept/brief" || section === "marketing/launch" || section === "concept/story" || section === "marketing/landing") expect(t, title).toContain("Draft: needs the owner's approval");
      expect(r.status, title).toBe(section === "concept/brief" || section === "marketing/launch" ? "open" : "draft");
    }
    // the TSA answer promises nothing
    expect(row("concept/faq", "Will TSA confiscate it?").body).toMatch(/^We cannot promise/);
  });

  it("gives the bench tools and troubleshooting rows as Rev D's", () => {
    expect(row("prototype/assembly", "Tools and materials on the bench").body).toMatch(/TC2030[\s\S]*SWD/);
    expect(row("prototype/assembly", "Troubleshooting: boot loop").body).toMatch(/no USB port/);
    expect(row("prototype/assembly", "Troubleshooting: no gags, but the log shows events").body).toMatch(/8 MB flash/);
    expect(row("prototype/assembly", "Troubleshooting: gags at random").body).toMatch(/I2S/);
    expect(row("prototype/assembly", "Troubleshooting: high sleep current").body).toMatch(/25 uA/);
    // the keys the app's assembly view reads are kept
    expect(row("prototype/assembly", "Tools and materials on the bench").data.key).toBe("tools");
  });
});

describe("the Rev D wording batch, in a database", () => {
  const P = "baggage-claims";
  it("is applied once on a fresh install, nothing left alone", async () => {
    await ready();
    const m = (await q<{ data: { enriched: number; skipped: unknown[] } }>(`SELECT data FROM events WHERE project_id='${P}' AND kind='seed.content' AND data->>'batch'=$1`, [revD3.batch]))[0]?.data;
    expect(m?.skipped).toEqual([]);
    expect(m?.enriched).toBe(revD3.rows.length);
    const faq = await q<{ body: string; status: string }>(`SELECT body, status FROM items WHERE project_id='${P}' AND section='concept/faq' AND title='Can it ride in a checked bag?'`);
    expect(faq[0]).toEqual({ body: row("concept/faq", "Can it ride in a checked bag?").body, status: "draft" });
  });

  it("never overwrites a row a person edited: that row is left alone and says why", async () => {
    await ready();
    const { seedContent } = await import("@/lib/seedContentDb");
    const title = "Will TSA confiscate it?";
    const was = await q<{ body: string }>(`SELECT body FROM items WHERE project_id='${P}' AND section='concept/faq' AND title=$1`, [title]);
    const seeded = before.find((x) => x.section === "concept/faq" && x.title === title)!;
    // a person's own answer, written over the seeded one
    await q(`UPDATE items SET body='Ask the bag.' WHERE project_id='${P}' AND section='concept/faq' AND title=$1`, [title]);
    await q(`DELETE FROM events WHERE project_id='${P}' AND kind='seed.content' AND data->>'batch'=$1`, [revD3.batch]);
    // the other rows read as this batch left them, so they are left alone too: put them back as the earlier batches did
    for (const r of revD3.rows) {
      if (r.op !== "enrich" || r.match.title === title) continue;
      const b = before.find((x) => x.section === r.section && x.title === r.match.title)!;
      await q(`UPDATE items SET body=$3, status=$4, data = data || $5::jsonb WHERE project_id='${P}' AND section=$1 AND title=$2`, [r.section, r.match.title, b.body, b.status, JSON.stringify(Object.fromEntries(Object.keys(r.setData ?? {}).map((k) => [k, b.data[k]])))]);
    }
    await seedContent(pool());
    const m = (await q<{ data: { enriched: number; skipped: { proposal: string; why: string }[] } }>(`SELECT data FROM events WHERE project_id='${P}' AND kind='seed.content' AND data->>'batch'=$1`, [revD3.batch]))[0].data;
    expect(m.skipped).toEqual([{ proposal: "D305", why: "the row has been changed since it was seeded" }]);
    expect(m.enriched).toBe(revD3.rows.length - 1);
    expect((await q<{ body: string }>(`SELECT body FROM items WHERE project_id='${P}' AND section='concept/faq' AND title=$1`, [title]))[0].body).toBe("Ask the bag.");
    expect(seeded.body).not.toBe("Ask the bag.");
    // put the row back as the batch makes it, for the tests that follow in this database
    await q(`UPDATE items SET body=$2 WHERE project_id='${P}' AND section='concept/faq' AND title=$1`, [title, was[0].body]);
  });
});
