// The positioning line is composed from its parts, in one place, so the stored title, the screen
// and the reviewer all read the same sentence.
export type LineParts = { forWhom?: string; need?: string; productIs?: string; thatDoes?: string; unlike?: string; difference?: string };

const t = (s: string | undefined, blank: string) => (s && s.trim() ? s.trim().replace(/[.\s]+$/, "") : blank);

// The line supplies its own "a", so a model that wrote "a self-weighing bag" does not give "is a a".
const noArticle = (s: string | undefined) => (s ? s.trim().replace(/^(a|an|the)\s+/i, "") : s);

export function positioningLine(p: LineParts, product: string): string {
  return `For ${t(p.forWhom, "[who it is for]")}, who need ${t(p.need, "[what they need]")}, ${product} is a ${t(noArticle(p.productIs), "[what it is]")} that ${t(p.thatDoes, "[what it does]")}. Unlike ${t(p.unlike, "[the alternative]")}, ${product} ${t(p.difference, "[what is different]")}.`;
}

/** The row title for a positioning: the line, cut to the 300 characters a title may hold. */
export const lineTitle = (line: string) => (line.length > 296 ? `${line.slice(0, 293)}...` : line);
