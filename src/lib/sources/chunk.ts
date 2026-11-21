// Cutting a source's text into passages for search (pure, unit-tested). Paragraphs are kept together where
// they fit; a passage aims at TARGET characters and never passes MAX. A paragraph longer than MAX is cut at
// sentence ends, and a sentence longer than MAX at a space. No text is dropped and none is repeated.

/** The length a passage aims for: about a page's worth of a paragraph or two, short enough to embed well. */
const TARGET_CHARS = 1200;
/** The longest passage (the table allows 8,000; embedding models read this comfortably). */
export const MAX_CHARS = 2000;
/** A library cap: a source cut into more passages than this keeps only the first ones, and says so. */
export const MAX_CHUNKS = 2000;

/** Text as it is stored: Unix line ends, no NUL, no trailing spaces, at most one blank line in a row. */
export function normaliseText(text: string): string {
  return text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hardCut(s: string, max: number): string[] {
  const out: string[] = [];
  let rest = s;
  while (rest.length > max) {
    const space = rest.lastIndexOf(" ", max);
    const at = space > max * 0.5 ? space : max;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Pieces of a long paragraph, each at most `max`: whole sentences where possible. */
function splitLong(p: string, max: number): string[] {
  const sentences = p.match(/[^.!?\n]+(?:[.!?]+["')\]]*|\n|$)\s*/g) ?? [p];
  const out: string[] = [];
  let cur = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > max) {
      if (cur) out.push(cur);
      cur = "";
      out.push(...hardCut(s, max));
      continue;
    }
    if (cur && cur.length + 1 + s.length > max) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}

/** The passages of a text, in order. Empty text gives none. */
export function chunkText(text: string, o: { target?: number; max?: number } = {}): string[] {
  const target = o.target ?? TARGET_CHARS;
  const max = o.max ?? MAX_CHARS;
  const clean = normaliseText(text);
  if (!clean) return [];
  const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur) out.push(cur);
    cur = "";
  };
  for (const p of paragraphs) {
    if (p.length > max) {
      flush();
      out.push(...splitLong(p, max));
      continue;
    }
    if (cur && cur.length + 2 + p.length > max) flush();
    cur = cur ? `${cur}\n\n${p}` : p;
    if (cur.length >= target) flush();
  }
  flush();
  return out;
}
