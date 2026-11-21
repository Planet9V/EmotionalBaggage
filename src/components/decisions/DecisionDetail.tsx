"use client";

/**
 * The right pane: one decision in full. Its question, context, source and state; its
 * options as cards to choose or reopen; what it depends on, what it unlocks and what it
 * decides next; and, under it, the outcome of every decision made so far.
 */
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Pencil, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import type { Decision } from "@/lib/domain";
import { chosenOption, isDecided, stateOf, stateWord, unlockTarget, unmet, type DState, type Tree } from "./model";

type Props = {
  d: Decision;
  all: Decision[];
  byKey: Map<string, Decision>;
  tree: Tree;
  order: string[];
  busy: boolean;
  onSelect: (key: string) => void;
  onChoose: (d: Decision, optionId: string) => void;
  onReopen: (d: Decision) => void;
  onEdit: (d: Decision) => void;
  onAddChild: (d: Decision) => void;
};

const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";
const BADGE: Record<DState, string> = { decided: "decided", open: "open", waiting: "waiting", blocked: "blocked" };

function DecisionLink({ k, byKey, all, onSelect }: { k: string; byKey: Map<string, Decision>; all: Decision[]; onSelect: (key: string) => void }) {
  const d = byKey.get(k);
  if (!d) {
    return (
      <span className="text-sm text-muted">
        <span className="font-mono text-[11px]">{k}</span> is not in this tree
      </span>
    );
  }
  const s = stateOf(d, all);
  return (
    <button type="button" onClick={() => onSelect(k)} className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-subtle">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s === "decided" ? "bg-dutchOrange" : s === "open" ? "bg-hairline" : "bg-danger"}`} aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm text-primary group-hover:text-link">{d.question}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {d.key} · {s === "decided" ? `decided, ${chosenOption(d)?.label ?? d.chosen}` : stateWord(d, all, byKey)}
        </span>
      </span>
    </button>
  );
}

export function DecisionDetail({ d, all, byKey, tree, order, busy, onSelect, onChoose, onReopen, onEdit, onAddChild }: Props) {
  const reduce = useReducedMotion();
  const state = stateOf(d, all);
  const waits = unmet(d, byKey);
  const ready = waits.length === 0;
  const kids = tree.children.get(d.key) ?? [];
  // decisions outside this branch that also wait on this one
  const dependents = all.filter((x) => x.dependsOn.includes(d.key) && !kids.includes(x.key));
  // decided while something it depends on is still open: say so rather than hide it
  const early = isDecided(d) && waits.length > 0;

  const nextFor = (k: string) => {
    const x = byKey.get(k);
    if (!x) return "";
    if (isDecided(x)) return `decided, ${chosenOption(x)?.label ?? x.chosen}`;
    const rest = unmet(x, byKey).filter((w) => w !== d.key);
    if (x.dependsOn.includes(d.key) && !isDecided(d)) return rest.length ? `still waits on ${rest.join(", ")} after this` : "becomes ready once this is decided";
    return rest.length ? `waits on ${rest.join(", ")}` : "ready now";
  };

  const decided = order.map((k) => byKey.get(k)!).filter((x) => x && isDecided(x));
  const open = order.map((k) => byKey.get(k)!).filter((x) => x && !isDecided(x));

  return (
    <motion.div
      key={d.key}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6 p-5 sm:p-6"
      data-testid="decision-detail"
      data-key={d.key}
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className={eyebrow}>Decision {d.key}</p>
          <StatusBadge tone={state === "waiting" ? "warning" : statusTone(state)} className="px-2! py-0! text-[11px]!">
            {BADGE[state]}
          </StatusBadge>
          <div className="ml-auto flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => onEdit(d)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onAddChild(d)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add under this
            </Button>
          </div>
        </div>
        <h2 className="text-xl font-semibold leading-snug tracking-tight text-primary">{d.question}</h2>
        {d.context && <p className="text-sm leading-relaxed text-secondary">{d.context}</p>}
        {d.source && (
          <p className="text-xs text-muted">
            <span className="font-mono uppercase tracking-[0.16em]">Source</span> {d.source}
          </p>
        )}
        {early && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
            Decided while {waits.map((k) => byKey.get(k)?.question ?? k).join(" and ")} is still open.
          </p>
        )}
      </header>

      <section className="space-y-2.5" aria-label="Options">
        <p className={eyebrow}>Options</p>
        {!ready && !isDecided(d) && (
          <p className="rounded-md border border-hairline bg-subtle px-3 py-2 text-xs text-secondary">
            Choosing is closed until {waits.map((k) => byKey.get(k)?.question ?? k).join(" and ")} {waits.length === 1 ? "is" : "are"} decided.
          </p>
        )}
        {d.options.length === 0 && (
          <div className="rounded-xl border border-dashed border-hairline p-4 text-sm text-secondary">
            No options yet.{" "}
            <button type="button" className="font-medium text-link hover:underline" onClick={() => onEdit(d)}>
              Add options
            </button>
          </div>
        )}
        <ul className="space-y-2">
          {d.options.map((o) => {
            const chosen = d.chosen === o.id;
            const dim = isDecided(d) && !chosen;
            return (
              <li
                key={o.id}
                className={`rounded-xl border p-3.5 transition-colors duration-150 ${chosen ? "border-dutchOrange bg-dutchOrange/10" : "border-hairline bg-surface hover:border-dutchOrange/40"} ${dim ? "opacity-60" : ""}`}
                data-testid="decision-option"
                data-chosen={chosen ? "true" : "false"}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${chosen ? "border-dutchOrange bg-dutchOrange text-white" : "border-hairline"}`}
                    aria-hidden
                  >
                    {chosen && <Check className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tracking-tight text-primary">{o.label}</p>
                    {o.outcome ? <p className="mt-0.5 text-[13px] leading-snug text-secondary">{o.outcome}</p> : <p className="mt-0.5 text-xs text-muted">No outcome written.</p>}
                  </div>
                  <div className="shrink-0">
                    {chosen ? (
                      <Button variant="outline" size="sm" onClick={() => onReopen(d)} disabled={busy}>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        Reopen
                      </Button>
                    ) : (
                      <Button
                        variant={isDecided(d) ? "outline" : "primary"}
                        size="sm"
                        onClick={() => onChoose(d, o.id)}
                        disabled={busy || !ready}
                        title={!ready ? `Decide ${waits.join(", ")} first` : undefined}
                      >
                        Choose this
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {isDecided(d) && !chosenOption(d) && (
          <p className="text-xs text-warning">
            The chosen option <span className="font-mono">{d.chosen}</span> is no longer listed.{" "}
            <button type="button" className="font-medium underline" onClick={() => onReopen(d)}>
              Reopen
            </button>
          </p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-1.5" aria-label="Depends on">
          <p className={eyebrow}>Depends on</p>
          {d.dependsOn.length === 0 ? (
            <p className="text-sm text-muted">Nothing. It can be decided now.</p>
          ) : (
            <div className="-mx-2">
              {d.dependsOn.map((k) => (
                <DecisionLink key={k} k={k} byKey={byKey} all={all} onSelect={onSelect} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-1.5" aria-label="Unlocks">
          <p className={eyebrow}>Unlocks</p>
          {d.unlocks.length === 0 ? (
            <p className="text-sm text-muted">Nothing listed.</p>
          ) : (
            <ul className="space-y-1">
              {d.unlocks.map((u) => {
                const t = unlockTarget(u);
                return (
                  <li key={u}>
                    {t ? (
                      <Link href={t.href} className="group inline-flex items-center gap-1 text-sm text-primary hover:text-link">
                        {t.label}
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted group-hover:text-link" aria-hidden />
                      </Link>
                    ) : (
                      <span className="text-sm text-secondary">{u}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-1.5" aria-label="What this decides next">
        <p className={eyebrow}>What this decides next</p>
        {kids.length === 0 && dependents.length === 0 ? (
          <p className="text-sm text-muted">No decisions hang under this one or wait on it.</p>
        ) : (
          <ul className="space-y-1">
            {[...kids, ...dependents.map((x) => x.key)].map((k) => {
              const x = byKey.get(k)!;
              const note = nextFor(k);
              return (
                <li key={k}>
                  <button type="button" onClick={() => onSelect(k)} className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-subtle">
                    <span className="mt-0.5 font-mono text-[11px] text-link">{k}</span>
                    <span className="min-w-0">
                      <span className="block text-sm text-primary group-hover:text-link">{x.question}</span>
                      <span className={`text-xs ${note.startsWith("becomes ready") ? "text-success" : "text-muted"}`}>
                        {kids.includes(k) ? "" : "Depends on this. "}
                        {note.charAt(0).toUpperCase() + note.slice(1)}.
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2 border-t border-hairline pt-5" aria-label="Outcome so far">
        <p className={eyebrow}>Outcome so far</p>
        {decided.length === 0 ? (
          <p className="text-sm text-muted">Nothing decided yet.</p>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 marker:font-mono marker:text-[11px] marker:text-muted">
            {decided.map((x) => {
              const o = chosenOption(x);
              return (
                <li key={x.key} className="pl-1 text-sm">
                  <button type="button" onClick={() => onSelect(x.key)} className="text-left text-primary hover:text-link">
                    {x.question}
                  </button>{" "}
                  <span className="font-semibold text-primary">{o?.label ?? x.chosen}.</span>
                  {o?.outcome && <span className="block text-[13px] leading-snug text-secondary">{o.outcome}</span>}
                </li>
              );
            })}
          </ol>
        )}
        {open.length > 0 && (
          <div className="pt-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Still open ({open.length})</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {open.map((x) => (
                <li key={x.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(x.key)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors duration-150 hover:border-dutchOrange hover:text-link ${
                      x.key === d.key ? "border-dutchOrange/40 text-link" : "border-hairline text-secondary"
                    }`}
                    title={x.question}
                  >
                    {x.key}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </motion.div>
  );
}
