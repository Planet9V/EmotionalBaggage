// Shapes and pure helpers shared by the chat routes and the chat screen. No database, no model calls,
// so the browser can import it.
import type { UIMessage } from "ai";
import { z } from "zod";
import { sectionLabel } from "@/lib/menuLookup";

/** How many sources each question is answered from. */
export const TOP_SOURCES = 8;
/** Earlier messages of the chat sent with each new question. */
export const HISTORY_MESSAGES = 20;
/** The longest question accepted. */
export const MAX_QUESTION = 4000;
/** Characters of each source's text given to the model. */
export const SOURCE_CHARS = 1500;

/** One numbered source as stored on an assistant message and sent to the browser. */
export const chatSource = z.object({
  n: z.number().int().positive(),
  kind: z.enum(["item", "research"]),
  id: z.number().int().positive(),
  /** the row's store key (`design/bom`), or `research/ask` for a research answer */
  section: z.string(),
  title: z.string(),
  score: z.number(),
});
export type ChatSource = z.infer<typeof chatSource>;

/** "both": found by meaning and by matching words, with the two rankings joined. */
export type Retrieval = "meaning" | "text" | "both";

/** What the server attaches to a streamed (and a saved) assistant message. */
export type ChatMetadata = {
  sources?: ChatSource[];
  /** how the sources were found */
  retrieval?: Retrieval;
  /** why retrieval was by text, when it was */
  note?: string;
  /** the reasoning model that answered */
  model?: string;
  provider?: string;
  /** "exact", "bits", "hnsw" or "binary" when retrieval was by meaning */
  search?: string;
  /** the saved message's id, sent when the answer has been stored */
  savedId?: number;
};

/** A chat message as useChat holds it: text parts plus the metadata above. */
export type ChatUIMessage = UIMessage<ChatMetadata>;

export const RESEARCH_SECTION = "research/ask";

/** Body of POST /api/chats/[id]/messages. */
export const chatAsk = z.object({ message: z.string().trim().min(1, "Type a question.").max(MAX_QUESTION) });

/** Shortens text to at most `max` characters, at a word boundary where one is near, with an ellipsis. */
export function cut(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max - 1);
  const space = slice.lastIndexOf(" ");
  return `${(space > max * 0.6 ? slice.slice(0, space) : slice).trimEnd()}…`;
}

/** Shortens text to at most `max` characters like cut(), but keeps line breaks (for text given to the model). */
export function clip(text: string, max: number): string {
  const t = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Three questions built from the names of the concept's sections that have the most rows. No facts are invented. */
export function suggestedQuestions(sections: { store: string; count: number }[]): string[] {
  const top = [...sections].filter((s) => s.count > 0).sort((a, b) => b.count - a.count).slice(0, 3).map((s) => sectionLabel(s.store));
  const forms = [(l: string) => `What does the ${l} say so far?`, (l: string) => `What is still open in ${l}?`, (l: string) => `Summarise the ${l} in five lines.`];
  return top.map((label, i) => forms[i](label));
}

/** Rewrites `[3]` into a link the screen turns into a citation, for numbers that name a given source only. */
export function linkCitations(text: string, count: number): string {
  return text.replace(/\[(\d{1,3})\](?!\()/g, (m, d: string) => {
    const n = Number(d);
    return n >= 1 && n <= count ? `[${n}](#source-${n})` : m;
  });
}
