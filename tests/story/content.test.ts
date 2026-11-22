// The content batches entered into the example concept after its first seed (src/lib/seedContent.ts,
// src/lib/seedContentDb.ts): every row is one a person could have typed, a fresh database holds them, and an
// install seeded before a batch gets it once, without duplicating a row or overwriting one a person has changed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { STORE_STATUSES } from "@/lib/api/schemas";
import { applyBatches, CONTENT_BATCHES, matches, RULED_SECTIONS, seededRows, type ContentBatch, type ContentRow } from "@/lib/seedContent";
import { checkContentRow, seedContent } from "@/lib/seedContentDb";

afterAll(async () => {
  await pool().end();
});

const P = "baggage-claims";
const batch = CONTENT_BATCHES[0];
const adds = batch.rows.filter((r) => r.op === "add");
const enriches = batch.rows.filter((r) => r.op === "enrich");
// the batch of the owner's rulings of 22 Nov 2026, and every batch's rows together
const rulings = CONTENT_BATCHES[1];
const allRows = CONTENT_BATCHES.flatMap((b) => b.rows);
const allAdds = allRows.filter((r) => r.op === "add");
const allEnriches = allRows.filter((r) => r.op === "enrich");
const LOWEST = ["open", "draft", "candidate", "unverified", "not run", "planned", "estimate"];
const count = async (where = "") => (await q<{ n: number }>(`SELECT count(*)::int AS n FROM items WHERE project_id='${P}' ${where}`))[0].n;
/** the SQL that finds the row an enrichment names: two parts can share a title, so a part is found by its reference */
const named = (r: { match: { title?: string; ref?: string } }) => (r.match.ref !== undefined ? "data->>'ref'" : "title");
const nameOf = (r: { match: { title?: string; ref?: string } }) => r.match.ref ?? r.match.title;
const marker = () => q<{ data: { batch: string; added: number; enriched: number; skipped: { proposal: string; why: string }[] } }>(`SELECT data FROM events WHERE project_id='${P}' AND kind='seed.content' ORDER BY id`);

describe("the content batches, as data", () => {
  it("hold only rows a person could have typed: a known section, an allowed lowest status, the section's schema and rules", () => {
    for (let n = 0; n < CONTENT_BATCHES.length; n++) {
      const before = applyBatches(seededRows(), CONTENT_BATCHES.slice(0, n));
      for (const r of CONTENT_BATCHES[n].rows) {
        expect(r.section in STORE_STATUSES, `${r.proposal} ${r.section}`).toBe(true);
        expect(r.proposal).toMatch(/^P\d{3}$/);
        expect(r.sourceFile.length > 0 && r.sourceLocation.length > 0, r.proposal).toBe(true);
        const was = r.op === "enrich" ? before.find((x) => matches(x, r)) : undefined;
        expect(() => checkContentRow(r, was), r.proposal).not.toThrow();
      }
    }
  });

  it("enter every claim as unverified with its source document and no evidence", () => {
    const claims = allAdds.filter((r) => r.section === "research/claims");
    expect(claims.length).toBeGreaterThan(0);
    for (const r of claims) {
      expect(r.status).toBe("unverified");
      expect(r.data.source).toBe(r.sourceFile);
      expect("evidence" in r.data).toBe(false);
    }
  });

  it("mark nothing done, approved, verified or passed, and decided only where the owner's words decide it", () => {
    // a new row starts at its lowest status; "decided" only for a question or a decision that quotes the ruling
    for (const r of allAdds) {
      if (r.ruling === undefined) expect(LOWEST, r.proposal).toContain(r.status);
      else {
        expect(r.status, r.proposal).toBe("decided");
        expect(RULED_SECTIONS.has(r.section), r.proposal).toBe(true);
        expect(r.ruling, r.proposal).toMatch(/^Owner, 22 Nov 2026/);
      }
    }
    for (const r of adds) expect(LOWEST, r.proposal).toContain(r.status);
    const after = applyBatches(seededRows());
    const before = seededRows();
    // an enrichment changes a status only by a ruling: every other row keeps the status it had
    const decided = allEnriches.filter((r) => r.decide);
    for (const b of before) {
      const now = after.find((x) => x.section === b.section && x.title === b.title)!;
      const ruled = decided.find((r) => matches(b, r));
      expect(now.status, `${b.section} ${b.title}`).toBe(ruled ? "decided" : b.status);
      if (ruled) expect(now.data.ruling).toBe(ruled.decide!.ruling);
    }
    for (const r of decided) {
      expect(RULED_SECTIONS.has(r.section), r.proposal).toBe(true);
      expect(r.decide!.ruling, r.proposal).toMatch(/^Owner, 22 Nov 2026/);
    }
    // a decision an enrichment adds to without a ruling stays as it was
    for (const r of allEnriches.filter((x) => x.section === "concept/decisions" && !x.decide)) expect(after.find((x) => matches(x, r))?.status).toBe("open");
  });

  it("refuse a ruling that is not one: a status above the lowest with no words of his, a section a ruling cannot decide, an option that is not there", () => {
    const from = { proposal: "P900", sourceFile: adds[0].sourceFile, sourceLocation: "test" };
    const question: ContentRow = { ...from, op: "add", section: "concept/questions", title: "A test question", body: "", data: {}, status: "decided" };
    expect(() => checkContentRow(question)).toThrow(/cannot start as "decided"/);
    expect(() => checkContentRow({ ...question, ruling: "Owner, 22 Nov 2026: yes." })).not.toThrow();
    expect(() => checkContentRow({ ...question, ruling: "   " })).toThrow();
    expect(() => checkContentRow({ ...question, status: "open", ruling: "Owner, 22 Nov 2026: yes." })).toThrow(/must then be "decided"/);
    expect(() => checkContentRow({ ...question, section: "research/claims", status: "verified", ruling: "Owner, 22 Nov 2026: yes." })).toThrow();
    const rows = seededRows();
    const stack = rows.find((x) => x.section === "concept/decisions" && x.title === "Which web stack for the product site?")!;
    const decide: ContentRow = { ...from, op: "enrich", section: stack.section, match: { title: stack.title }, decide: { ruling: "Owner, 22 Nov 2026: yes.", chosen: "rev-b" } };
    expect(checkContentRow(decide, stack).status).toBe("decided");
    expect(() => checkContentRow({ ...decide, decide: { ruling: "Owner, 22 Nov 2026: yes.", chosen: "no-such-option" } }, stack)).toThrow(/not one of the decision's options/);
    const brief = rows.find((x) => x.section === "concept/brief")!;
    expect(() => checkContentRow({ ...decide, section: brief.section, match: { title: brief.title } }, brief)).toThrow(/only a question or a decision/);
  });

  it("record the rulings of 22 Nov: the stack, the channels, the batteries and the budget are decided, each quoting him", () => {
    const after = applyBatches(seededRows());
    const row = (section: string, title: string) => after.find((x) => x.section === section && x.title === title)!;
    const stack = row("concept/decisions", "Which web stack for the product site?");
    expect(stack.status).toBe("decided");
    expect(stack.data.chosen).toBe("this-app");
    expect((stack.data.options as { id: string }[]).map((o) => o.id)).toEqual(["shopify", "rev-a", "rev-b", "this-app"]);
    expect(String(stack.data.ruling)).toContain("we already built this");
    expect(String(row("concept/questions", "Primary sales channel").data.ruling)).toContain("We do NOT use Shopify; we use Stripe and Amazon marketplace.");
    for (const title of ["Batteries: two AA alkaline cells", "Marketing budget: 5,000 USD", "Email: the product's own mail server, set in Admin", "Referrals: the engine built into this app"]) {
      expect(row("concept/questions", title).status, title).toBe("decided");
      expect(row("concept/questions", title).data.ruledOn).toBe("2026-11-22");
    }
    // what he did not decide stays open, with the option added
    const name = row("concept/decisions", "Which name ships?");
    expect(name.status).toBe("open");
    expect(name.data.chosen).toBe("");
    // the budget is the plan row of the campaigns, in minor units
    expect(row("marketing/campaigns", "Marketing plan and budget").data).toMatchObject({ kind: "plan", planTotalMinor: 500000 });
    // the story says what is decided and keeps the owner's lines; proposed lines are added as proposals
    expect(row("concept/story", "Decided and still open").body.startsWith("**Decided by the owner on 22 Nov 2026.**")).toBe(true);
    const voice = row("concept/story", "Voice, humour and personality");
    const examples = voice.data.examples as { text: string; context?: string }[];
    expect(examples[1]).toEqual({ text: "Are you calling me FAT?", context: "Held still on the check-in scale" });
    expect(examples.filter((e) => e.context?.startsWith("Proposed 22 Nov")).length).toBeGreaterThanOrEqual(8);
    expect(examples.length).toBeLessThanOrEqual(60);
  });

  it("give a figure he asked to have guessed as an estimate that says what it rests on", () => {
    const estimates = rulings.rows.filter((r) => r.op === "add" && (r.data.estimate === true || r.status === "estimate"));
    expect(estimates.length).toBeGreaterThanOrEqual(4);
    for (const r of estimates) if (r.op === "add") expect(`${r.title} ${r.body}`, r.proposal).toMatch(/[Ee]stimate|[Rr]ests on|about/);
  });

  it("name source documents that are in the example's files, and agree with the map of the review sheet", () => {
    const manifest = JSON.parse(readFileSync(join("seed", "concepts", P, "manifest.json"), "utf8")) as { files: { file: string }[] };
    const files = new Set(manifest.files.map((f) => f.file));
    for (const r of allRows) expect(files.has(r.sourceFile), `${r.proposal} ${r.sourceFile}`).toBe(true);
    type Entry = { entered: boolean; batch?: string; group?: string; reason?: string; resolution?: { how: string; note: string; with?: string } };
    const map = JSON.parse(readFileSync(join("seed", "concepts", P, "content-proposal-map.json"), "utf8")) as { rows: Record<string, Entry>; added: Record<string, { batch: string }> };
    expect(Object.keys(map.rows)).toHaveLength(491);
    // every sheet row a batch entered is marked entered with its batch; rows that come from the rulings alone are under `added`
    const entered = Object.entries(map.rows).filter(([, v]) => v.entered).map(([k]) => k);
    const fromSheet = new Set(allRows.map((r) => r.proposal).filter((id) => id in map.rows));
    expect(entered.sort()).toEqual([...fromSheet].sort());
    for (const b of CONTENT_BATCHES) for (const r of b.rows) expect((map.rows[r.proposal] ?? map.added[r.proposal]).batch, r.proposal).toBe(b.batch);
    expect(Object.keys(map.added).sort()).toEqual([...new Set(allRows.map((r) => r.proposal).filter((id) => !(id in map.rows)))].sort());
    for (const v of Object.values(map.rows)) if (!v.entered) expect(Boolean(v.group && v.reason)).toBe(true);
    // since the rulings, every row that was left for the owner says what became of it
    const HOW = ["ruling", "estimate", "reason", "owner", "ws14", "design"];
    const left = Object.entries(map.rows).filter(([, v]) => v.batch !== batch.batch);
    expect(left).toHaveLength(376);
    for (const [id, v] of left) {
      expect(HOW, id).toContain(v.resolution?.how);
      expect(v.resolution!.note.length, id).toBeGreaterThan(0);
      if (v.resolution!.with) expect(v.resolution!.with in map.rows || v.resolution!.with in map.added, id).toBe(true);
    }
  });

  it("leave the owner's settled facts alone: no strap, no colour, no tagline, no other enclosure size", () => {
    const text = JSON.stringify(allRows).toLowerCase();
    for (const word of ["strap", "velcro", "puck", "tagline", "colour", "90 x 68", "80 x 60 x 40"]) expect(text.includes(word), word).toBe(false);
  });
});

describe("the content batches, in a database", () => {
  it("are on a fresh install: every added row once, every enrichment applied, one marker per batch", async () => {
    await ready();
    // tests/story/seed.test.ts writes the story's parts again as first seeded, in the database these files share:
    // let the rulings batch find them as a fresh install does (its other rows are there and are left alone)
    await q(`DELETE FROM events WHERE project_id='${P}' AND kind='seed.content' AND data->>'batch'=$1`, [rulings.batch]);
    await seedContent(pool());
    const m = await marker();
    expect(m.map((e) => e.data.batch)).toEqual(CONTENT_BATCHES.map((b) => b.batch));
    // (the counts in the marker are checked below, where the test sets the database up itself)
    for (const r of allAdds) expect(await count(`AND section='${r.section}' AND title=$$${r.title}$$`), r.proposal).toBe(1);
    // the rulings: a decided row holds the owner's words, and the row it decides has the status and the option
    for (const r of rulings.rows) {
      const title = r.op === "add" ? r.title : r.match.title!;
      const got = (await q<{ status: string; data: Record<string, unknown> }>(`SELECT status, data FROM items WHERE project_id='${P}' AND section=$1 AND title=$2`, [r.section, title]))[0];
      const ruling = r.op === "add" ? r.ruling : r.decide?.ruling;
      if (ruling) {
        expect(got.status, r.proposal).toBe("decided");
        expect(got.data.ruling, r.proposal).toBe(ruling);
      }
      if (r.op === "enrich" && r.decide?.chosen) expect(got.data.chosen).toBe(r.decide.chosen);
    }
    const story = (await q<{ body: string; data: { examples: unknown[]; sourceIds: number[] } }>(`SELECT body, data FROM items WHERE project_id='${P}' AND section='concept/story' AND data->>'part'='voice'`))[0];
    const wantVoice = applyBatches(seededRows()).find((x) => x.section === "concept/story" && x.data.part === "voice")!;
    expect(story.body).toBe(wantVoice.body);
    expect(story.data.examples).toEqual(wantVoice.data.examples);
    // the links to the story's sources, which a batch does not know, are kept
    expect(story.data.sourceIds.length).toBeGreaterThan(0);
    const want = applyBatches(seededRows());
    for (const r of enriches) {
      const w = want.find((x) => matches(x, r))!;
      const got = (await q<{ body: string; data: Record<string, unknown> }>(`SELECT body, data FROM items WHERE project_id='${P}' AND section=$1 AND ${named(r)}=$2`, [w.section, nameOf(r)]))[0];
      expect(got.body, r.proposal).toBe(w.body);
      for (const k of Object.keys(r.setData ?? {})) expect(got.data[k]).toBe(w.data[k]);
      expect((got.data.additions as { proposal: string }[]).some((a) => a.proposal === r.proposal)).toBe(true);
    }
    // each row keeps where it came from, and its history says so
    const one = (await q<{ id: string; data: { proposal: string; sourceFile: string; sourceLocation: string } }>(`SELECT id, data FROM items WHERE project_id='${P}' AND section=$1 AND title=$2`, [adds[0].section, adds[0].title]))[0];
    expect(one.data).toMatchObject({ proposal: adds[0].proposal, sourceFile: adds[0].sourceFile, sourceLocation: adds[0].sourceLocation });
    const ev = await q<{ data: { seeded: boolean; proposal: string } }>(`SELECT data FROM events WHERE project_id='${P}' AND kind='item.added' AND (data->>'itemId')::bigint=$1`, [one.id]);
    expect(ev[0].data).toMatchObject({ seeded: true, proposal: adds[0].proposal });
  });

  it("are not applied twice, and a row someone removed does not come back", async () => {
    await ready();
    const gone = adds[1];
    await q(`DELETE FROM items WHERE project_id='${P}' AND section=$1 AND title=$2`, [gone.section, gone.title]);
    const before = await count();
    await seedContent(pool());
    await seedContent(pool());
    expect(await count()).toBe(before);
    expect(await marker()).toHaveLength(CONTENT_BATCHES.length);
    // put it back for the tests that follow
    await q(`DELETE FROM events WHERE project_id='${P}' AND kind='seed.content'`);
    await seedContent(pool());
    const m = await marker();
    expect(m[0].data.added).toBe(1);
    expect(m[0].data.skipped.filter((s) => s.why === "a row of that title is already there")).toHaveLength(adds.length - 1);
  });

  it("brings an install seeded before the batch up to date, leaving alone what a person changed or already typed", async () => {
    await ready();
    // as an install seeded before the batch: none of its rows, the enriched rows as first seeded, no marker
    const seeded = seededRows();
    for (const r of adds) await q(`DELETE FROM items WHERE project_id='${P}' AND section=$1 AND title=$2`, [r.section, r.title]);
    for (const r of enriches) {
      const was = seeded.find((x) => matches(x, r))!;
      await q(`UPDATE items SET body=$3, data = (data - 'additions' - 'flags' - 'noProof') || $4::jsonb WHERE project_id='${P}' AND section=$1 AND ${named(r)}=$2`, [was.section, nameOf(r), was.body, JSON.stringify(Object.fromEntries([...Object.keys(r.setData ?? {}), ...Object.keys(r.appendData ?? {})].map((k) => [k, was.data[k] ?? ""])))]);
    }
    await q(`DELETE FROM events WHERE project_id='${P}' AND kind='seed.content'`);
    const others = await count();
    // a person edited one row the batch adds to, and had already typed one row the batch adds
    const edited = enriches.find((r) => r.appendBody && r.match.title)!;
    await q(`UPDATE items SET body='My own words.' WHERE project_id='${P}' AND section=$1 AND title=$2`, [edited.section, edited.match.title]);
    const typed = adds[2];
    await q(`INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ('${P}',$1,$2,'Typed by hand.','{}',$3,9000)`, [typed.section, typed.title, typed.status]);

    await seedContent(pool());
    await seedContent(pool());

    const m = await marker();
    // the later batch finds its own rows already there and leaves them: nothing is entered or decided twice
    expect(m).toHaveLength(CONTENT_BATCHES.length);
    expect(m[1].data.added + m[1].data.enriched).toBe(0);
    expect(m[1].data.skipped).toHaveLength(rulings.rows.length);
    expect(m[0].data.added).toBe(adds.length - 1);
    expect(m[0].data.enriched).toBe(enriches.length - 1);
    expect(m[0].data.skipped.map((s) => s.proposal).sort()).toEqual([edited.proposal, typed.proposal].sort());
    expect(await count()).toBe(others + adds.length);
    expect((await q<{ body: string }>(`SELECT body FROM items WHERE project_id='${P}' AND section=$1 AND title=$2`, [edited.section, edited.match.title]))[0].body).toBe("My own words.");
    const mine = await q<{ body: string }>(`SELECT body FROM items WHERE project_id='${P}' AND section=$1 AND title=$2`, [typed.section, typed.title]);
    expect(mine).toHaveLength(1);
    expect(mine[0].body).toBe("Typed by hand.");
    // put both rows as the batch leaves them: the test database is shared with the other files
    const want = applyBatches(seededRows()).find((x) => matches(x, edited))!;
    await q(`UPDATE items SET body=$3, data = data || $4::jsonb WHERE project_id='${P}' AND section=$1 AND title=$2`, [want.section, want.title, want.body, JSON.stringify({ additions: want.data.additions })]);
    const row = checkContentRow(typed);
    await q(`UPDATE items SET body=$3, data=$4 WHERE project_id='${P}' AND section=$1 AND title=$2`, [row.section, row.title, row.body, JSON.stringify(row.data)]);
  });

  it("applies a later batch on top of an earlier one, and only the later one", async () => {
    await ready();
    const first = enriches.find((r) => r.appendBody && r.match.title && r.proposal !== enriches.find((x) => x.appendBody && x.match.title)!.proposal)!;
    const later: ContentBatch = {
      batch: "2099-01-01",
      about: "test",
      rows: [
        { op: "enrich", section: first.section, match: first.match, appendBody: "A later line.", proposal: "P999", sourceFile: first.sourceFile, sourceLocation: "test" },
        { op: "add", section: "concept/brief", title: "A later brief line", body: "From a later batch.", data: {}, status: "open", proposal: "P998", sourceFile: first.sourceFile, sourceLocation: "test" },
      ],
    };
    const before = await count();
    await seedContent(pool(), [...CONTENT_BATCHES, later]);
    await seedContent(pool(), [...CONTENT_BATCHES, later]);
    expect(await count()).toBe(before + 1);
    const body = (await q<{ body: string }>(`SELECT body FROM items WHERE project_id='${P}' AND section=$1 AND title=$2`, [first.section, first.match.title]))[0].body;
    expect(body.endsWith(`${first.appendBody} A later line.`)).toBe(true);
    // tidy up: the test database is shared with the other files
    await q(`DELETE FROM items WHERE project_id='${P}' AND title='A later brief line'`);
    await q(`UPDATE items SET body = left(body, length(body) - length(' A later line.')) WHERE project_id='${P}' AND section=$1 AND title=$2`, [first.section, first.match.title]);
    await q(`DELETE FROM events WHERE project_id='${P}' AND kind='seed.content' AND data->>'batch'='2099-01-01'`);
  });
});
