import type { Item } from "@/lib/types";
import { keys } from "./step";

export type DecisionOption = { id: string; label: string; outcome: string };

export type Decision = {
  item: Item;
  key: string;
  /** key of the parent decision, "" for the root */
  parent: string;
  question: string;
  context: string;
  options: DecisionOption[];
  /** option id, "" while undecided */
  chosen: string;
  /** keys of decisions that must be decided first */
  dependsOn: string[];
  /** section store keys (or free text) this decision opens up */
  unlocks: string[];
  source: string;
  status: string;
};

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** A row is a decision once it has a key. */
export function toDecision(item: Item): Decision | null {
  const key = str(item.data.key);
  if (!key) return null;
  const raw = Array.isArray(item.data.options) ? (item.data.options as unknown[]) : [];
  const options = raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map((o) => ({ id: str(o.id), label: str(o.label), outcome: str(o.outcome) }))
    .filter((o) => o.id && o.label);
  return {
    item,
    key,
    parent: str(item.data.parent),
    question: item.title,
    context: item.body,
    options,
    chosen: str(item.data.chosen),
    dependsOn: keys(item.data.dependsOn),
    unlocks: keys(item.data.unlocks),
    source: str(item.data.source),
    status: item.status,
  };
}

/** A decision is ready when every decision it depends on has been decided. */
export function decisionReady(d: Decision, all: Decision[]) {
  const byKey = new Map(all.map((x) => [x.key, x]));
  return d.dependsOn.every((k) => !!byKey.get(k)?.chosen);
}
