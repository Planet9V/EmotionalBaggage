// 8.6 "Check this text against the brand voice": specific before and after suggestions, saved as a draft.
import { z } from "zod";
import { stampOf, GROUNDING, type Entry, type Generator, type ToRows } from "./types";

const schema = z.object({
  verdict: z.string().max(400),
  suggestions: z.array(z.object({ before: z.string().max(600), after: z.string().max(600), why: z.string().max(300) })).max(10),
});

export const MAX_TEXT = 6000;

export const generator: Generator<typeof schema> = {
  id: "voice-check",
  label: "Check text against the brand voice",
  from: ["marketing/brand"],
  to: "marketing/brand",
  applies: (c) => {
    if (!c.brand) return { ok: false, reason: "Set up the brand voice first: add at least a voice summary or one rule." };
    const t = c.params.text;
    return typeof t === "string" && t.trim() ? { ok: true } : { ok: false, reason: "Paste the text to check." };
  },
  buildPrompt: (c) => ({
    system: `You check a piece of marketing text against a brand voice. Quote the exact words from the text in "before", and give a rewrite in "after" that keeps the meaning and changes only what the voice rules call for. Only suggest a change when a rule or example applies, and say which in "why". If the text already fits, return no suggestions.\n${GROUNDING}`,
    prompt: `Brand voice:\n${c.brand}\n\nText to check:\n${String(c.params.text).slice(0, MAX_TEXT)}`,
    maxOutputTokens: 1800,
  }),
  schema,
};

export const toRows: ToRows<typeof schema> = (out, c, stamp) => {
  const notes: string[] = [];
  const text = String(c.params.text).slice(0, MAX_TEXT);
  const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const whole = squash(text);
  const suggestions = out.suggestions.filter((s) => {
    const real = whole.includes(squash(s.before));
    if (!real) notes.push(`Dropped a suggestion whose "before" is not in your text: "${s.before.slice(0, 60)}".`);
    return real;
  });
  return {
    rows: [
      {
        section: "marketing/brand",
        title: `Voice check: ${text.replace(/\s+/g, " ").slice(0, 60)}`,
        body: out.verdict,
        data: { kind: "voicecheck", checked: text, suggestions, generatedFrom: stampOf(c.brandItem ? [{ kind: "brand", id: c.brandItem.id, title: c.brandItem.title }] : [], stamp) },
        status: "draft" as const,
      },
    ],
    notes,
  };
};

export const entry: Entry<typeof schema> = { generator, toRows };
