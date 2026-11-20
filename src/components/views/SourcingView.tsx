"use client";
import { sumLine, toPart, type Part } from "@/lib/domain";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ExternalLink, ShoppingCart } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorLine } from "@/components/parts/controls";
import { ASIN_RE, amazonSearchUrl, cartUrl, microCenterSearchUrl, money, sourceKind,  } from "@/components/parts/bom";
import { useItems } from "@/lib/client";
import { statusTone } from "@/lib/statusTones";
import { cn } from "@/lib/utils";
import type { ViewProps } from "./types";

const BUY_STEPS = ["to buy", "ordered", "in hand"];
const PRINT_STEPS = ["to print", "in hand"];
const DONE = new Set(["ordered", "in hand"]);

export function SourcingView({ project, store }: ViewProps) {
  const { items, loading, error, patch } = useItems(project.id, store);
  const reduce = useReducedMotion();

  const parts = useMemo(() => items.map(toPart), [items]);
  const groups = useMemo(() => {
    const map = new Map<string, Part[]>();
    for (const p of parts) {
      const k = p.source.trim() || "No source set";
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return [...map.entries()];
  }, [parts]);

  const amazon = parts.filter((p) => sourceKind(p.source) === "amazon");
  const inCart = amazon.filter((p) => ASIN_RE.test(p.asin) && !DONE.has(p.item.status));
  const missing = amazon.filter((p) => !ASIN_RE.test(p.asin) && !DONE.has(p.item.status));
  const toBuyParts = parts.filter((p) => p.item.status === "to buy");
  const toBuyTotal = sumLine(toBuyParts);

  if (loading) return <p className="text-sm text-secondary">Loading the parts.</p>;
  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!parts.length)
    return (
      <EmptyState title="No parts to source">
        Parts come from the bill of materials. <Link href="/s/design/bom" className="text-link underline">Add parts there</Link> first.
      </EmptyState>
    );

  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
      <p className="max-w-3xl text-sm text-secondary">
        You complete checkout on Amazon yourself; this app does not place orders. Search links open a search, not a specific listing, so check the part before you buy.
      </p>

      <section aria-labelledby="cart-h" className="rounded-xl border border-hairline bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="cart-h" className="text-base font-semibold tracking-tight text-primary">Amazon cart</h2>
            <p className="mt-1 text-sm text-secondary">
              {amazon.length === 0
                ? "No part uses Amazon as its source."
                : inCart.length
                  ? `${inCart.length} ${inCart.length === 1 ? "part has" : "parts have"} an ASIN and can go in the cart. Parts already ordered or in hand are left out.`
                  : "Enter an ASIN on an Amazon part below to build a cart link."}
            </p>
            <p className="mt-1 font-mono text-xs text-muted">
              Still to buy: {money(toBuyTotal)} across {toBuyParts.length} {toBuyParts.length === 1 ? "part" : "parts"}
            </p>
          </div>
          {inCart.length > 0 && (
            <a
              href={cartUrl(inCart.map((p) => ({ asin: p.asin, qty: p.qty ?? 1 })))}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "primary" })}
            >
              <ShoppingCart className="h-4 w-4" aria-hidden /> Add to Amazon cart <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
        {missing.length > 0 && (
          <p className="mt-3 text-xs text-secondary">
            Missing an ASIN: {missing.map((p) => p.ref || p.item.title).join(", ")}
          </p>
        )}
      </section>

      {groups.map(([source, ps]) => {
        const sub = sumLine(ps);
        const left = ps.filter((p) => p.item.status === "to buy").reduce((a, p) => a + (p.line ?? 0), 0);
        return (
          <section key={source} aria-label={source} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline pb-2">
              <h2 className="text-base font-semibold tracking-tight text-primary">
                {source} <span className="font-mono text-xs font-normal text-muted">· {ps.length} {ps.length === 1 ? "part" : "parts"}</span>
              </h2>
              <p className="font-mono text-xs text-secondary">
                Subtotal {money(sub)} · still to buy {money(left)}
              </p>
            </div>
            <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
              {ps.map((p) => (
                <PartRow key={p.item.id} part={p} onStatus={(s) => void patch(p.item.id, { status: s })} onAsin={(a) => void patch(p.item.id, { data: { asin: a } })} />
              ))}
            </ul>
          </section>
        );
      })}
    </motion.div>
  );
}

function PartRow({ part: p, onStatus, onAsin }: { part: Part; onStatus: (s: string) => void; onAsin: (asin: string) => void }) {
  const kind = sourceKind(p.source);
  const link = kind === "amazon" && p.search ? amazonSearchUrl(p.search) : kind === "microcenter" && p.search ? microCenterSearchUrl(p.search) : "";
  const steps = kind === "own" || p.item.status === "to print" ? PRINT_STEPS : BUY_STEPS;

  return (
    <li className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary">
          {p.ref ? <span className="mr-2 font-mono text-xs text-muted">{p.ref}</span> : null}
          {p.item.title}
        </p>
        {p.item.body ? <p className="mt-0.5 text-xs text-secondary">{p.item.body}</p> : null}
        <p className="mt-1 font-mono text-xs text-muted">
          qty {p.qty ?? "not set"} · {p.line === null ? "no cost set" : money(p.line)}
        </p>
      </div>

      <div className="min-w-0 space-y-1.5">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-link hover:underline">
            Search {kind === "amazon" ? "Amazon" : "Micro Center"} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : kind === "own" ? (
          <Link href="/s/prototype/printing" className="text-sm text-link hover:underline">Print it on your own printer</Link>
        ) : null}
        {p.search ? <p className="break-words font-mono text-xs text-muted">{p.search}</p> : kind !== "own" ? <p className="text-xs text-muted">No search term set. Add one in the bill of materials.</p> : null}
        {kind === "amazon" && <AsinField asin={p.asin} onSave={onAsin} label={p.item.title} />}
      </div>

      <Stepper steps={steps} current={p.item.status} onPick={onStatus} label={p.item.title} />
    </li>
  );
}

function AsinField({ asin, onSave, label }: { asin: string; onSave: (a: string) => void; label: string }) {
  const id = useId();
  const [draft, setDraft] = useState(asin);
  const [err, setErr] = useState("");
  const commit = () => {
    const v = draft.trim().toUpperCase();
    if (v === asin) return setErr("");
    if (v !== "" && !ASIN_RE.test(v)) return setErr("An ASIN is 10 letters and digits, such as B07XXXXXXX.");
    setErr("");
    setDraft(v);
    onSave(v);
  };
  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted" htmlFor={id}>ASIN</label>
        <Input
          id={id}
          value={draft}
          maxLength={10}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
          aria-invalid={err ? true : undefined}
          aria-label={`ASIN for ${label}`}
          placeholder="10 characters"
          className={cn("h-8 w-40 font-mono text-xs", err && "border-danger")}
        />
        {ASIN_RE.test(asin) && asin === draft ? <Check className="h-4 w-4 text-success" aria-label="Saved" /> : null}
      </div>
      {err ? <p role="alert" className="mt-1 text-[11px] text-danger">{err}</p> : null}
    </div>
  );
}

function Stepper({ steps, current, onPick, label }: { steps: string[]; current: string; onPick: (s: string) => void; label: string }) {
  const at = steps.indexOf(current);
  return (
    <div className="flex flex-col items-start gap-1.5 md:items-end">
      {at < 0 && <StatusBadge tone={statusTone(current)}>{current || "no status"}</StatusBadge>}
      <div role="group" aria-label={`Status of ${label}`} className="inline-flex overflow-hidden rounded-md border border-hairline">
        {steps.map((s, i) => {
          const active = i === at;
          const passed = at >= 0 && i < at;
          return (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={active ? "primary" : "ghost"}
              aria-pressed={active}
              onClick={() => !active && onPick(s)}
              className={cn("rounded-none border-r border-hairline last:border-r-0", passed && "text-success")}
            >
              {passed ? <Check className="h-3 w-3" aria-hidden /> : null}
              {s}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
