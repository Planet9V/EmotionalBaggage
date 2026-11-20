// Pure logic for the decision tree view: state of each decision, the tree,
// the walkthrough order, the route taken so far, captions and the layout.
// Nothing here invents a decision or an outcome; it only reads what the store holds.
import { decisionReady, type Decision, type DecisionOption } from "@/lib/domain";
import { findSection } from "@/lib/menu";

export type DState = "decided" | "open" | "waiting" | "blocked";

/** The option a decision has chosen, if the chosen id still names one of its options. */
export const chosenOption = (d: Decision): DecisionOption | undefined => (d.chosen ? d.options.find((o) => o.id === d.chosen) : undefined);

export const isDecided = (d: Decision) => !!d.chosen;

/** Keys of the decisions this one depends on that are not decided yet. */
export function unmet(d: Decision, byKey: Map<string, Decision>) {
  return d.dependsOn.filter((k) => !byKey.get(k)?.chosen);
}

export function stateOf(d: Decision, all: Decision[]): DState {
  if (isDecided(d)) return "decided";
  if (d.status === "blocked") return "blocked";
  if (!decisionReady(d, all)) return "waiting";
  return "open";
}

/** The mono eyebrow word for a card: "decided", "open", "blocked" or "waiting on <key>". */
export function stateWord(d: Decision, all: Decision[], byKey: Map<string, Decision>) {
  const s = stateOf(d, all);
  if (s === "waiting") return `waiting on ${unmet(d, byKey).join(", ")}`;
  return s;
}

/** Short form of a question for a sentence: the part before a colon, without the question mark. */
export function shortQuestion(q: string) {
  const head = q.includes(":") ? q.slice(0, q.indexOf(":")) : q;
  return head.replace(/\?\s*$/, "").trim() || q;
}

export function caption(d: Decision, all: Decision[], byKey: Map<string, Decision>) {
  const head = shortQuestion(d.question);
  const s = stateOf(d, all);
  if (s === "decided") {
    const o = chosenOption(d);
    return `${head}: decided, ${o ? o.label : d.chosen}.`;
  }
  const waits = unmet(d, byKey).map((k) => byKey.get(k)?.question ?? k);
  if (s === "waiting") return `${head}: open, waiting on ${waits.join(" and ")}`;
  if (s === "blocked") return `${head}: blocked.`;
  return `${head}: open, ready to decide.`;
}

/** The parent of a decision, if it names one that exists (an unknown parent makes it a root). */
export function parentOf(d: Decision, byKey: Map<string, Decision>) {
  return d.parent && d.parent !== d.key && byKey.has(d.parent) ? d.parent : "";
}

export type Tree = {
  roots: string[];
  children: Map<string, string[]>;
  /** keys whose parent chain loops; drawn as roots so nothing disappears */
  looped: Set<string>;
};

const bySort = (byKey: Map<string, Decision>) => (a: string, b: string) => (byKey.get(a)!.item.sort - byKey.get(b)!.item.sort) || a.localeCompare(b);

export function buildTree(all: Decision[], byKey: Map<string, Decision>): Tree {
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  const looped = new Set<string>();
  for (const d of all) {
    // walk up the parent chain; a loop makes this decision a root
    const seen = new Set([d.key]);
    let p = parentOf(d, byKey);
    while (p && !seen.has(p)) {
      seen.add(p);
      p = parentOf(byKey.get(p)!, byKey);
    }
    if (p) looped.add(d.key);
    const parent = looped.has(d.key) ? "" : parentOf(d, byKey);
    if (!parent) roots.push(d.key);
    else children.set(parent, [...(children.get(parent) ?? []), d.key]);
  }
  const cmp = bySort(byKey);
  roots.sort(cmp);
  for (const list of children.values()) list.sort(cmp);
  return { roots, children, looped };
}

/** Root first: the chain of keys from a root down to this decision. */
export function ancestry(key: string, byKey: Map<string, Decision>, tree: Tree) {
  const chain: string[] = [];
  let k = key;
  const seen = new Set<string>();
  while (k && !seen.has(k)) {
    seen.add(k);
    chain.unshift(k);
    const d = byKey.get(k);
    if (!d || tree.looped.has(k)) break;
    k = parentOf(d, byKey);
  }
  return chain;
}

/** Parents before children, dependencies before dependents; ties by the store's own order. Loops fall back to store order. */
export function walkOrder(all: Decision[], byKey: Map<string, Decision>, tree: Tree) {
  const pre = new Map<string, Set<string>>();
  for (const d of all) {
    const s = new Set<string>();
    const p = tree.looped.has(d.key) ? "" : parentOf(d, byKey);
    if (p) s.add(p);
    for (const k of d.dependsOn) if (byKey.has(k) && k !== d.key) s.add(k);
    pre.set(d.key, s);
  }
  const cmp = bySort(byKey);
  const done = new Set<string>();
  const out: string[] = [];
  const rest = all.map((d) => d.key).sort(cmp);
  while (out.length < rest.length) {
    const next = rest.find((k) => !done.has(k) && [...pre.get(k)!].every((x) => done.has(x)));
    // a dependency loop: take the earliest remaining decision so the walk still covers everything
    const k = next ?? rest.find((x) => !done.has(x))!;
    done.add(k);
    out.push(k);
  }
  return out;
}

/**
 * The route taken so far: every decided decision with the chain above it, and the
 * open decisions that come next (the roots, and the children and dependents of decided ones).
 */
export function routeKeys(all: Decision[], byKey: Map<string, Decision>, tree: Tree) {
  const keep = new Set<string>(tree.roots);
  for (const d of all) {
    if (!isDecided(d)) continue;
    for (const k of ancestry(d.key, byKey, tree)) keep.add(k);
    for (const c of tree.children.get(d.key) ?? []) keep.add(c);
  }
  // open dependents of a decided decision come next too, with the chain above them so they hang in place
  for (const d of all) {
    if (isDecided(d) || !d.dependsOn.length) continue;
    if (decisionReady(d, all) && d.dependsOn.some((k) => keep.has(k))) for (const k of ancestry(d.key, byKey, tree)) keep.add(k);
  }
  return keep;
}

/** "stage/section" store keys become links to the section; anything else stays text. */
export function unlockTarget(u: string): { href: string; label: string } | null {
  const m = /^([a-z0-9-]+)\/([a-z0-9-]+)$/i.exec(u.trim());
  if (!m) return null;
  const f = findSection(m[1], m[2]);
  if (!f) return null;
  return { href: `/s/${f.stage.key}/${f.section.key}`, label: `${f.stage.label} · ${f.section.label}` };
}

/** A short unique slug from a question: lower case, hyphens, at most three words. */
export function slugKey(question: string, taken: Set<string>) {
  const words = question
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
  const base = words.slice(0, 3).join("-").slice(0, 24).replace(/-+$/, "") || "decision";
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export function slugOption(label: string, taken: Set<string>) {
  return slugKey(label, taken).replace(/^decision/, "option");
}

const STOP = new Set(["a", "an", "the", "which", "what", "who", "how", "do", "does", "did", "we", "is", "are", "to", "of", "for", "on", "in", "if", "should", "will", "it", "and", "or"]);

// ───────── layout

export const CARD_W = 256;
export const CARD_H = 96;
export const OPT_W = 220;
export const OPT_H = 36;
const OPT_GAP = 8;
const OPT_INDENT = 22;
const COL = CARD_W + 120;
const ROW_GAP = 26;

export type Placed = { kind: "decision"; key: string; x: number; y: number } | { kind: "option"; key: string; option: string; x: number; y: number };

export type LayoutInput = {
  tree: Tree;
  byKey: Map<string, Decision>;
  /** decisions whose children (and options) are shown */
  expanded: Set<string>;
  /** when set, only these decisions are drawn (the route view) */
  only: Set<string> | null;
  /** route view: show only the chosen option under a decided decision */
  chosenOnly: boolean;
};

/** Options shown under a decision card, given the view. */
export function shownOptions(d: Decision, input: LayoutInput) {
  if (input.chosenOnly) {
    const o = chosenOption(d);
    return o ? [o] : [];
  }
  return input.expanded.has(d.key) ? d.options : [];
}

/** Children drawn to the right of a decision, given the view. */
export function shownChildren(key: string, input: LayoutInput) {
  const kids = input.tree.children.get(key) ?? [];
  if (input.only) return kids.filter((k) => input.only!.has(k));
  return input.expanded.has(key) ? kids : [];
}

/**
 * Left to right: each decision in its column by depth, its options stacked under its card,
 * its children to the right, the card centred against the span of its children.
 */
export function layout(input: LayoutInput): Placed[] {
  const out: Placed[] = [];
  const block = (key: string) => {
    const n = shownOptions(input.byKey.get(key)!, input).length;
    return CARD_H + (n ? OPT_GAP + n * (OPT_H + OPT_GAP) : 0);
  };
  const span = new Map<string, number>();
  const measure = (key: string, guard: Set<string>): number => {
    if (guard.has(key)) return block(key);
    guard.add(key);
    const kids = shownChildren(key, input);
    const kidSpan = kids.reduce((s, k, i) => s + measure(k, guard) + (i ? ROW_GAP : 0), 0);
    const h = Math.max(block(key), kidSpan);
    span.set(key, h);
    return h;
  };
  const place = (key: string, depth: number, top: number, guard: Set<string>) => {
    if (guard.has(key)) return;
    guard.add(key);
    const h = span.get(key) ?? block(key);
    const b = block(key);
    const y = top + (h - b) / 2;
    const x = depth * COL;
    out.push({ kind: "decision", key, x, y });
    shownOptions(input.byKey.get(key)!, input).forEach((o, i) =>
      out.push({ kind: "option", key, option: o.id, x: x + OPT_INDENT, y: y + CARD_H + OPT_GAP + i * (OPT_H + OPT_GAP) }),
    );
    const kids = shownChildren(key, input);
    const kidSpan = kids.reduce((s, k, i) => s + (span.get(k) ?? block(k)) + (i ? ROW_GAP : 0), 0);
    let t = top + (h - kidSpan) / 2;
    for (const k of kids) {
      place(k, depth + 1, t, guard);
      t += (span.get(k) ?? block(k)) + ROW_GAP;
    }
  };
  const roots = input.only ? input.tree.roots.filter((k) => input.only!.has(k)) : input.tree.roots;
  const mg = new Set<string>();
  for (const r of roots) measure(r, mg);
  let top = 0;
  const pg = new Set<string>();
  for (const r of roots) {
    place(r, 0, top, pg);
    top += (span.get(r) ?? block(r)) + ROW_GAP * 2;
  }
  return out;
}
