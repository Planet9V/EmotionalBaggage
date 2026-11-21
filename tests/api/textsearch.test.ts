// Full-text search over a concept's rows and research (migrations/0008_search.sql), as chat uses it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { q, ready } from "@/lib/db";
import { searchSourcesByText } from "@/lib/ai/embeddings";

const P = "zz-textsearch";
const titles = (hits: Awaited<ReturnType<typeof searchSourcesByText>>) => hits.map((h) => (h.kind === "item" ? h.item.title : h.kind === "source" ? `source: ${h.item.title} ${h.chunk.n}` : `research: ${h.research.query}`));

beforeAll(async () => {
  await ready();
  await q("DELETE FROM projects WHERE id = $1", [P]);
  await q("INSERT INTO projects (id, name) VALUES ($1, 'Text search probe')", [P]);
  const add = (section: string, title: string, body: string, data: object = {}) =>
    q("INSERT INTO items (project_id, section, title, body, data) VALUES ($1, $2, $3, $4, $5)", [P, section, title, body, JSON.stringify(data)]);
  await add("design/bom", "Load cell amplifier", "Reads the strain gauge.", { ref: "TXS1", supplier: "Sparkfun", mpn: "HX711" });
  await add("design/bom", "Battery holder", "Two cells in series.", { ref: "TXS2" });
  await add("prototype/wiring", "Solder the wires to the amplifier", "Keep each wire short.");
  await add("concept/brief", "Problem", "Travellers are charged for overweight bags; an amplifier is not mentioned in titles here.");
  await q("INSERT INTO research (project_id, query, answer, citations) VALUES ($1, 'Airline weight limits', 'Most allow 23 kg per checked bag.', '[]')", [P]);
});
afterAll(async () => {
  await q("DELETE FROM projects WHERE id = $1", [P]);
});

describe("text search", () => {
  it("folds word forms: 'wire' finds 'wires'", async () => {
    expect(titles(await searchSourcesByText(P, "Which wire goes where?", 8))).toContain("Solder the wires to the amplifier");
  });

  it("ranks a title match above a body match", async () => {
    const t = titles(await searchSourcesByText(P, "Tell me about the amplifier", 8));
    expect(t.slice(0, 2).sort()).toEqual(["Load cell amplifier", "Solder the wires to the amplifier"]);
    expect(t.indexOf("Problem")).toBeGreaterThan(1);
  });

  it("finds a value inside a row's fields, such as a part number", async () => {
    expect(titles(await searchSourcesByText(P, "Where do we buy the HX711?", 8))[0]).toBe("Load cell amplifier");
  });

  it("returns a section's rows when the question names the section, even with no word in common", async () => {
    const t = titles(await searchSourcesByText(P, "What is still open in Bill of materials?", 8));
    expect(t).toEqual(expect.arrayContaining(["Load cell amplifier", "Battery holder"]));
    expect(t).not.toContain("Problem");
  });

  it("finds research answers, gives scores between 0 and 1, and nothing for a question with no useful words", async () => {
    const hits = await searchSourcesByText(P, "What weight do airlines allow?", 8);
    expect(titles(hits)).toContain("research: Airline weight limits");
    expect(hits.every((h) => h.score > 0 && h.score < 1)).toBe(true);
    expect(await searchSourcesByText(P, "is it ok", 8)).toEqual([]);
    expect(await searchSourcesByText(P, "zzqx yyvv", 8)).toEqual([]);
  });

  it("uses the GIN index for the word match", async () => {
    const plan = await q<{ "QUERY PLAN": string }>("EXPLAIN SELECT id FROM items WHERE search @@ to_tsquery('english', 'amplifi')");
    const forced = await q<{ "QUERY PLAN": string }>("SELECT set_config('enable_seqscan', 'off', false)").then(() => q<{ "QUERY PLAN": string }>("EXPLAIN SELECT id FROM items WHERE search @@ to_tsquery('english', 'amplifi')"));
    expect([...plan, ...forced].map((r) => r["QUERY PLAN"]).join("\n")).toContain("items_search");
    await q("SELECT set_config('enable_seqscan', 'on', false)");
  });
});
