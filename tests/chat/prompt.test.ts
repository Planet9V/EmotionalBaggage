// Chat's pure parts: numbering sources, the instructions given to the model, links to sections,
// citations in the answer and the suggested questions. No database, no model.
import { describe, expect, it } from "vitest";
import { buildSystemPrompt, numberSources, stored } from "@/lib/chat/server";
import { clip, cut, linkCitations, sectionHref, sectionLabel, suggestedQuestions } from "@/lib/chat/shared";
import type { SourceHit } from "@/lib/ai/embeddings";

const item = (id: number, section: string, title: string, body = "", data: Record<string, unknown> = {}) =>
  ({ id, projectId: "p", section, title, body, data, status: "open", sort: id });

const HITS: SourceHit[] = [
  { kind: "item", score: 0.912345, item: item(7, "design/bom", "Load cell", "Weighs the bag\nwhen lifted", { ref: "LC1" }) },
  { kind: "research", score: 0.5, research: { id: 3, projectId: "p", query: "Airline limits?", answer: "Most allow 23 kg.", createdAt: "" } },
];

describe("numbering sources", () => {
  it("numbers rows and research answers from 1, keeps their section and title, rounds the score", () => {
    const s = numberSources(HITS);
    expect(s.map(stored)).toEqual([
      { n: 1, kind: "item", id: 7, section: "design/bom", title: "Load cell", score: 0.9123 },
      { n: 2, kind: "research", id: 3, section: "research/ask", title: "Airline limits?", score: 0.5 },
    ]);
    expect(s[0].text).toBe("Load cell\nWeighs the bag\nwhen lifted\nLC1");
    expect(s[1].text).toBe("Question: Airline limits?\nAnswer: Most allow 23 kg.");
  });

  it("cuts long source text so one row cannot fill the model's context", () => {
    const [s] = numberSources([{ kind: "item", score: 1, item: item(1, "concept/brief", "Long", "x".repeat(5000)) }]);
    expect(s.text.length).toBeLessThanOrEqual(1500);
    expect(s.text.endsWith("…")).toBe(true);
  });
});

describe("the instructions for the model", () => {
  it("name the concept, list the numbered sources with section and text, and set the rules", () => {
    const p = buildSystemPrompt({ name: "Baggage", oneLiner: "A bag that weighs itself" }, numberSources(HITS));
    expect(p).toContain('one product concept, "Baggage" (A bag that weighs itself), using only the numbered sources below');
    expect(p).toContain("Answer only from the sources.");
    expect(p).toContain("with its number in square brackets, like [2]");
    expect(p).toContain("If the sources do not cover the question, or cover only part of it, say so plainly");
    expect(p).toContain("[1] Bill of materials: Load cell\nLoad cell\nWeighs the bag\nwhen lifted\nLC1");
    expect(p).toContain("[2] Saved research answer: Airline limits?\nQuestion: Airline limits?\nAnswer: Most allow 23 kg.");
    expect(p).not.toContain("—");
  });

  it("say there are no sources when nothing matched", () => {
    const p = buildSystemPrompt({ name: "Baggage" }, []);
    expect(p).toContain('concept, "Baggage", using');
    expect(p).toContain("Sources: none.");
    expect(p).not.toContain("\n[1] ");
  });
});

describe("links and labels", () => {
  it("send a source to its section page", () => {
    expect(sectionHref("design/bom")).toBe("/s/design/bom");
    expect(sectionHref("concept/brief")).toBe("/s/concept/brief");
    expect(sectionHref("research/ask")).toBe("/s/research/ask");
    // a store shown by several sections, none of which is named by it, goes to the first
    expect(sectionHref("design/wiring")).toBe("/s/design/schematic");
    expect(sectionHref("nowhere/at-all")).toBeNull();
    expect(sectionLabel("design/bom")).toBe("Bill of materials");
    expect(sectionLabel("nowhere/at-all")).toBe("nowhere/at-all");
  });

  it("turn [n] into a citation link only for numbers that name a source", () => {
    expect(linkCitations("Weighs the bag [1]. Limits [2][3]. Not [4]. Kept [1](x).", 3)).toBe(
      "Weighs the bag [1](#source-1). Limits [2](#source-2)[3](#source-3). Not [4]. Kept [1](x)."
    );
    expect(linkCitations("None [1].", 0)).toBe("None [1].");
  });
});

describe("text helpers", () => {
  it("cut shortens at a word with an ellipsis; clip keeps line breaks", () => {
    expect(cut("short", 80)).toBe("short");
    const c = cut("What does the load cell under the handle weigh, and what do airlines allow for checked bags?", 80);
    expect(c.length).toBeLessThanOrEqual(80);
    expect(c).toBe("What does the load cell under the handle weigh, and what do airlines allow for…");
    expect(clip("a  b\n\n\n\nc", 100)).toBe("a b\n\nc");
  });
});

describe("suggested questions", () => {
  it("are built from the names of the three sections with the most rows, and nothing else", () => {
    expect(
      suggestedQuestions([
        { store: "concept/brief", count: 2 },
        { store: "design/bom", count: 9 },
        { store: "concept/questions", count: 4 },
        { store: "research/claims", count: 1 },
        { store: "sales/listing", count: 0 },
      ])
    ).toEqual(["What does the Bill of materials say so far?", "What is still open in Open questions?", "Summarise the Brief in five lines."]);
    expect(suggestedQuestions([])).toEqual([]);
  });
});
