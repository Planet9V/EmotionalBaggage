"use client";

// The outputs of "What you get" that are documents and figures, each on the example's own rows at full size,
// with restrained motion: a staged reveal as a view opens, numbers that count to their value, bars that grow to
// it. Where a real structure exists it is drawn: the claims feeding the proof check that every ad line must pass
// (React Flow, as the app's diagrams are drawn), the unit cost built up line by line and its fall with volume,
// each channel's price split into what it takes and what it leaves against the cost, and the listing's fields
// against the marketplace's limits. Nothing is typed in: the rows and the rules come from the server.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useInView } from "motion/react";
import { StatusPill, Count } from "@/components/content/shared";
import { formatMoney } from "@/lib/economics/money";
import type { CostLine, UnitCost } from "@/lib/economics/compute";
import type { GetData, MarketData } from "../storyData";
import { useAnimated } from "../useAnimated";
import { GET_VIEWS } from "../content";
import { Range, Segmented } from "./ViewControls";
import { GET_PROVEN } from "./proven";

const H = "font-mono text-[10px] uppercase tracking-[0.08em] text-muted";
const CARD = "rounded-lg border border-hairline bg-white/[0.025]";
/** the staged reveal: each item later by its place, capped so a long list does not wait */
const stagger = (i: number): CSSProperties => ({ animationDelay: `${Math.min(i, 14) * 45}ms` });

/** A number that counts up to its value when it comes into view; the value itself is what is read out. */
function CountTo({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useAnimated();
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!animated || !seen) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [animated, seen, value]);
  return (
    <span ref={ref} className="tabular-nums">
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

/** The body of a view: scrolls on a wide screen inside the stage's fixed height. */
function Body({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto p-4 lg:p-5 ${className}`} tabIndex={0} role="group" aria-label={label}>
      {children}
    </div>
  );
}

function Honest({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 border-b border-hairline bg-[var(--accent-orange-subtle)] px-4 py-2 text-[12.5px] leading-relaxed text-primary lg:px-5">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
      {children}
    </p>
  );
}

// ---- 01 Brief

export function GetBrief({ get }: { get: GetData }) {
  const c = GET_VIEWS.brief;
  const one = get.brief.find((r) => r.title === "One-liner") ?? get.brief[0];
  const rest = get.brief.filter((r) => r !== one);
  const done = get.brief.filter((r) => r.status === "done").length;
  return (
    <Body label={c.lines}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          {one ? (
            <figure className="wl-in border-l-2 border-dutchOrange pl-4">
              <p className={H}>{c.lead}</p>
              <blockquote className="mt-1.5 text-[1.0625rem] font-medium leading-snug tracking-tight text-primary sm:text-lg">{one.body}</blockquote>
            </figure>
          ) : null}
          <p className={`${H} mt-5`}>{c.lines}</p>
          <ol className="mt-2 grid gap-2 sm:grid-cols-2">
            {rest.map((r, i) => (
              <li key={r.title} className={`${CARD} wl-in p-3`} style={stagger(i + 1)}>
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-primary">
                    <span className="mr-1.5 font-mono text-[11px] font-normal text-dutchOrange-300">{String(i + 2).padStart(2, "0")}</span>
                    {r.title}
                  </p>
                  <StatusPill status={r.status} />
                </div>
                <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-secondary">{r.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="wl-in self-start lg:sticky lg:top-0" style={stagger(2)}>
          <p className={H}>{c.statusTitle}</p>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <span className="wl-bar bg-[var(--success)]" style={{ width: `${(done / Math.max(1, get.brief.length)) * 100}%` }} />
          </div>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1.5 font-mono text-[11px]">
            <dt className="text-secondary">done</dt>
            <dd className="text-right text-primary"><CountTo value={done} format={(n) => String(Math.round(n))} /></dd>
            <dt className="text-secondary">open</dt>
            <dd className="text-right text-primary"><CountTo value={get.brief.length - done} format={(n) => String(Math.round(n))} /></dd>
          </dl>
          <p className="mt-4 border-t border-hairline pt-3 text-[12.5px] leading-relaxed text-secondary">{c.decisions(get.decisions)}</p>
        </div>
      </div>
    </Body>
  );
}

// ---- 02 Claims, and the proof check they feed

// React Flow is loaded with the claims view only
const ProofFlow = dynamic(() => import("./ProofFlow"), { ssr: false, loading: () => <div className="h-[380px]" /> });


export function GetClaim({ get, market }: { get: GetData; market: MarketData }) {
  const c = GET_VIEWS.claim;
  const verified = get.claims.filter((x) => x.status === "verified").length;
  return (
    <>
      <Honest>{c.honest(get.claims.length, verified)}</Honest>
      <Body label={c.listTitle}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 xl:order-2 xl:sticky xl:top-0 xl:self-start">
            <p className={H}>{c.flowTitle}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-secondary">{c.flowHint}</p>
            <div className={`${CARD} mt-2 px-2`}>
              <ProofFlow market={market} />
            </div>
            {/* what the drawing says, for a screen reader */}
            <ul className="sr-only">
              {market.positioning.pool.map((p) => (
                <li key={p.label}>{`${p.label}: ${GET_PROVEN(p)}; a link counts as ${p.state}.`}</li>
              ))}
              <li>{c.checkBody}</li>
              <li>{`${c.ads}: ${c.adsBody(market.ads.drafts.length)}.`}</li>
            </ul>
          </div>
          <div className="min-w-0">
            <p className={H}>{c.listTitle}</p>
            <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-1.5">
              {get.claims.map((x, i) => (
                <li key={x.title} className={`${CARD} wl-in flex items-start gap-3 px-3 py-2.5`} style={stagger(i)}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-snug text-primary">{x.title}</p>
                    <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted">
                      {c.stated} {x.source}
                      {x.where ? `, ${x.where}` : ""}
                    </p>
                  </div>
                  <StatusPill status={x.status} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Body>
    </>
  );
}

// ---- 05 Cost

const GROUPS: CostLine["group"][] = ["part", "line", "scrap", "setup"];
const GROUP_TONE: Record<CostLine["group"], string> = { part: "var(--net-signal)", line: "var(--net-audio)", scrap: "var(--warning)", setup: "var(--net-power)" };
const cents = (s: string) => {
  const m = /\$?\s*([\d,]+(?:\.\d+)?)/.exec(s);
  return m ? Math.round(Number(m[1]!.replace(/,/g, "")) * 100) : null;
};

/** The example's unit cost estimates at each volume, as a line on a log scale of volume. */
function Curve({ rows, at, currency }: { rows: { label: string; size: number; cost: number }[]; at: number; currency: string }) {
  const W = 360;
  const Hh = 150;
  const pad = { l: 44, r: 30, t: 18, b: 26 };
  const xs = rows.map((r) => Math.log10(r.size));
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const ymax = Math.max(...rows.map((r) => r.cost)) * 1.08;
  const X = (v: number) => pad.l + ((v - x0) / Math.max(1e-6, x1 - x0)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v / ymax) * (Hh - pad.t - pad.b);
  const d = rows.map((r, i) => `${i ? "L" : "M"}${X(Math.log10(r.size)).toFixed(1)} ${Y(r.cost).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} className="h-auto w-full" aria-hidden>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={W - pad.r} y1={Y(ymax * f)} y2={Y(ymax * f)} stroke="rgba(255,255,255,0.07)" />
          <text x={pad.l - 6} y={Y(ymax * f) + 3} textAnchor="end" className="fill-[#8b919b] font-mono text-[9px]">
            {formatMoney(Math.round((ymax * f) / 100) * 100, currency).replace(/\.00$/, "")}
          </text>
        </g>
      ))}
      <path d={d} fill="none" stroke="#E05A10" strokeWidth="2" strokeLinejoin="round" />
      {rows.map((r, i) => (
        <g key={r.label}>
          <circle cx={X(Math.log10(r.size))} cy={Y(r.cost)} r={i === at ? 5 : 3.2} fill={i === at ? "#E05A10" : "#0b0c0e"} stroke="#E05A10" strokeWidth="1.6" />
          <text x={X(Math.log10(r.size))} y={Hh - 8} textAnchor="middle" className={`font-mono text-[9.5px] ${i === at ? "fill-[#e8eaed]" : "fill-[#8b919b]"}`}>
            {r.label}
          </text>
          <text x={X(Math.log10(r.size)) + (i === rows.length - 1 ? 4 : 6)} y={Y(r.cost) - (i === rows.length - 1 ? 10 : 8)} textAnchor={i === rows.length - 1 ? "end" : "start"} className="fill-[#e8eaed] font-mono text-[10px]">
            {formatMoney(r.cost, currency)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function GetCost({ unit, get, market }: { unit: UnitCost; get: GetData; market: MarketData }) {
  const c = GET_VIEWS.cost;
  const fm = (m: number) => formatMoney(m, unit.currency);
  const lines = unit.lines.filter((l) => l.amount !== null && l.amount > 0).sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || (b.amount ?? 0) - (a.amount ?? 0));
  const sum = lines.reduce((a, l) => a + (l.amount ?? 0), 0);
  const total = unit.total;
  const vols = get.volumes.map((v) => ({ label: v.volume, size: Number(v.volume.replace(/,/g, "")), cost: cents(v.cogs) ?? 0 })).filter((v) => v.size > 0 && v.cost > 0);
  const [at, setAt] = useState(Math.min(2, Math.max(0, vols.length - 1)));
  const cost = vols[at]?.cost ?? total;
  const channels = market.results.channels.map((ch) => ({ ...ch, priceC: cents(ch.price), netC: cents(ch.net) })).filter((ch) => ch.priceC !== null && ch.netC !== null);
  const pmax = Math.max(...channels.map((ch) => ch.priceC!), cost) * 1.05;
  // where each line of the waterfall starts: the sum of the lines before it
  const starts = lines.map((_, i) => lines.slice(0, i).reduce((a, l) => a + (l.amount ?? 0), 0));
  return (
    <Body label={c.buildTitle(unit.batchSize)}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={H}>{c.buildTitle(unit.batchSize)}</p>
            <p className="font-mono text-[11px] text-secondary">
              {c.total} <span className="text-xl font-semibold text-primary"><CountTo value={total} format={(n) => fm(Math.round(n))} /></span>
            </p>
          </div>
          {/* the stack: every line a layer of the unit cost, in the order it is built up */}
          <div className="mt-3 flex h-7 overflow-hidden rounded-md border border-hairline" aria-hidden>
            {lines.map((l, i) => (
              <span key={l.key} className="wl-bar h-full border-r border-[#0b0c0e]/70 last:border-0" style={{ width: `${((l.amount ?? 0) / Math.max(1, sum)) * 100}%`, background: GROUP_TONE[l.group], opacity: 0.55 + 0.45 * (1 - (i % 3) / 3), ...stagger(i) }} title={`${l.label} ${fm(l.amount ?? 0)}`} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-secondary">
            {GROUPS.filter((g) => lines.some((l) => l.group === g)).map((g) => (
              <li key={g} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: GROUP_TONE[g] }} aria-hidden />
                {c.groups[g]} {fm(lines.filter((l) => l.group === g).reduce((a, l) => a + (l.amount ?? 0), 0))}
              </li>
            ))}
          </ul>
          {/* the same build-up as a waterfall: each line starts where the last ended */}
          <table className="mt-3 w-full border-collapse text-[12px]">
            <caption className="sr-only">{c.buildTitle(unit.batchSize)}</caption>
            <tbody>
              {lines.map((l, i) => {
                const from = starts[i]!;
                return (
                  <tr key={l.key} className="wl-in border-b border-hairline/60" style={stagger(i)}>
                    <th scope="row" className="w-[44%] truncate py-1 pr-2 text-left font-normal text-secondary">
                      <span className="block max-w-[15rem] truncate">{l.label}</span>
                    </th>
                    <td className="py-1" aria-hidden>
                      <div className="relative h-2.5">
                        <span className="wl-bar absolute top-0 h-full rounded-[2px]" style={{ left: `${(from / Math.max(1, sum)) * 100}%`, width: `${Math.max(0.6, ((l.amount ?? 0) / Math.max(1, sum)) * 100)}%`, background: GROUP_TONE[l.group], ...stagger(i) }} />
                      </div>
                    </td>
                    <td className="w-16 py-1 pl-2 text-right font-mono tabular-nums text-primary">{fm(l.amount ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {unit.missing.length ? <p className="mt-2 font-mono text-[11px] text-warning">{unit.missing.length} not priced: {unit.missing.map((m) => m.what).join(", ")}</p> : null}
        </div>
        <div className="min-w-0">
          <p className={H}>{c.curveTitle}</p>
          <p className="mt-1 text-[12.5px] text-secondary">{c.curveHint}</p>
          <div className={`${CARD} mt-2 p-2`}>
            <Curve rows={vols} at={at} currency={unit.currency} />
          </div>
          <p className={`${H} mt-5`}>{c.marginTitle}</p>
          <div className="mt-2">
            <Range label={c.volume} value={at} min={0} max={Math.max(0, vols.length - 1)} onChange={setAt} readout={`${vols[at]?.label ?? ""} · ${fm(cost)}`} valueText={`${vols[at]?.label ?? ""} units, ${fm(cost)} each`} />
          </div>
          <ul className="mt-2 grid gap-2">
            {channels.map((ch, i) => {
              const take = ch.priceC! - ch.netC!;
              const margin = ch.netC! - cost;
              return (
                <li key={ch.title} className="wl-in" style={stagger(i)}>
                  <div className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="truncate text-primary">{ch.title}</span>
                    <span className={`shrink-0 font-mono text-[11px] ${margin >= 0 ? "text-[var(--success)]" : "text-warning"}`}>{margin >= 0 ? c.leaves(fm(margin)) : c.short(fm(-margin))}</span>
                  </div>
                  <div className="relative mt-1 h-3 rounded-[3px] bg-white/[0.04]" aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-l-[3px] bg-white/25" style={{ width: `${(ch.netC! / pmax) * 100}%` }} />
                    <span className="absolute inset-y-0 bg-white/[0.08]" style={{ left: `${(ch.netC! / pmax) * 100}%`, width: `${(take / pmax) * 100}%` }} />
                    <span className="absolute -inset-y-1 w-0.5 bg-dutchOrange transition-[left] duration-500" style={{ left: `${(cost / pmax) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted">
                    {ch.price} − {ch.take} = {ch.net} {c.net}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">{c.honest}</p>
        </div>
      </div>
    </Body>
  );
}

// ---- 06 Ads

const AD_MS = 3800;

export function GetAd({ market, active }: { market: MarketData; active: boolean }) {
  const c = GET_VIEWS.ad;
  const animated = useAnimated();
  const drafts = market.ads.drafts;
  const [front, setFront] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!animated || !active || held || drafts.length < 2) return;
    const t = window.setInterval(() => setFront((f) => (f + 1) % drafts.length), AD_MS);
    return () => window.clearInterval(t);
  }, [animated, active, held, drafts.length]);
  const ad = drafts[front];
  const limits = market.ads.channels.filter((ch) => ch.textMax !== null);
  return (
    <Body label={c.stackTitle}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={H}>{c.stackTitle}</p>
            <Segmented
              label={c.choose}
              value={String(front)}
              onChange={(v) => {
                setHeld(true);
                setFront(Number(v));
              }}
              options={drafts.map((_, i) => ({ value: String(i), label: String(i + 1) }))}
            />
          </div>
          {/* the drafts as a stack of cards, the front one full size; the others sit behind it, in depth */}
          <div className="relative mt-4 h-[300px] [perspective:1100px] sm:h-[280px]">
            {drafts.map((a, i) => {
              const depth = (i - front + drafts.length) % drafts.length;
              return (
                <article
                  key={a.text}
                  aria-hidden={depth !== 0}
                  className="absolute inset-x-0 top-0 min-h-[190px] rounded-xl border border-white/12 bg-[#15171b] p-5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none sm:p-5"
                  style={{ transform: `translate3d(0, ${depth * 34}px, ${-depth * 90}px) rotateX(${depth ? 6 : 0}deg)`, opacity: depth > 2 ? 0 : 1 - depth * 0.3, zIndex: 10 - depth }}
                >
                  <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
                    <span className="text-dutchOrange-300">{c.of(i + 1, drafts.length)}</span>
                    <span>·</span>
                    <span>{a.channel}</span>
                    <span className="ml-auto">
                      <StatusPill status={a.status} />
                    </span>
                  </div>
                  <p className="mt-4 text-xl font-semibold leading-snug tracking-tight text-primary sm:text-2xl">&ldquo;{a.text}&rdquo;</p>
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-secondary">
                    <span>{a.rule}</span>
                    <span>{a.length} characters</span>
                  </p>
                </article>
              );
            })}
          </div>
          {ad?.body ? <p className="mt-2 text-[12.5px] leading-relaxed text-secondary">{ad.body}</p> : null}
        </div>
        <div className="min-w-0">
          <p className={H}>{c.fitTitle}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-secondary">{c.fitHint}</p>
          <ul className="mt-3 grid gap-2.5">
            {ad
              ? limits.map((ch, i) => {
                  const n = ch.xWeight ? ad.xLength : ad.length;
                  const max = ch.textMax!;
                  const over = n > max;
                  return (
                    <li key={ch.id} className="wl-in" style={stagger(i)}>
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="truncate text-primary">
                          {ch.label} <span className="text-muted">{ch.textLabel}</span>
                        </span>
                        <Count n={n} max={max} enforce={ch.textEnforce} />
                      </div>
                      <div className="relative mt-1 h-1.5 rounded-full bg-white/[0.07]" aria-hidden>
                        <span className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${over ? (ch.textEnforce ? "bg-[var(--danger)]" : "bg-warning") : "bg-[var(--success)]"}`} style={{ width: `${Math.min(100, (n / max) * 100)}%` }} />
                      </div>
                    </li>
                  );
                })
              : null}
          </ul>
        </div>
      </div>
    </Body>
  );
}

// ---- 07 Listing and channels

export function GetChannel({ market }: { market: MarketData }) {
  const c = GET_VIEWS.channel;
  const L = market.listing;
  const row = L.rows[0];
  return (
    <>
      {row ? <Honest>{row.body}</Honest> : null}
      <Body label={c.listingTitle}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="flex items-start gap-2">
              <p className={`${H} flex-1`}>{c.listingTitle}</p>
              {row ? <StatusPill status={row.status} /> : null}
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-secondary">{c.listingHint(L.category)}</p>
            {/* the listing's form: each field a frame of its limit, empty because the example has none yet */}
            <ul className={`${CARD} mt-3 divide-y divide-[var(--border-hairline)]`}>
              {L.fields.map((f, i) => (
                <li key={f.key} className="wl-in px-3.5 py-3" style={stagger(i)}>
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 text-[13px] font-medium text-primary">
                      {f.label}
                      {f.rows > 1 ? <span className="ml-2 font-mono text-[11px] font-normal text-muted">× {f.rows}</span> : null}
                    </span>
                    <span className="font-mono text-[10.5px] text-muted">{f.unit}</span>
                    <Count n={0} max={f.max} enforce={f.enforce} />
                  </div>
                  <div className="mt-2 grid gap-1" aria-hidden>
                    {Array.from({ length: Math.min(f.rows, 5) }, (_, k) => (
                      <span key={k} className={`block rounded-[4px] border border-dashed border-white/12 ${f.key === "description" ? "h-9" : "h-5"}`} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <p className={H}>{c.channelsTitle}</p>
            <table className="mt-2 w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="py-2 text-left font-mono text-[10.5px] font-normal text-muted">Channel</th>
                  <th scope="col" className="py-2 text-right font-mono text-[10.5px] font-normal text-muted">{c.price}</th>
                  <th scope="col" className="py-2 text-right font-mono text-[10.5px] font-normal text-muted">{c.net}</th>
                  <th scope="col" className="py-2 pl-3 text-left font-mono text-[10.5px] font-normal text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {market.results.channels.map((ch, i) => (
                  <tr key={ch.title} className="wl-in border-b border-hairline/70" style={stagger(i)}>
                    <th scope="row" className="py-2 pr-2 text-left font-medium text-primary">
                      {ch.title}
                      <span className="mt-0.5 block font-mono text-[10.5px] font-normal text-muted">{c.take} {ch.take}</span>
                    </th>
                    <td className="py-2 text-right font-mono tabular-nums text-secondary">{ch.price}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-primary">{ch.net}</td>
                    <td className="py-2 pl-3"><StatusPill status={ch.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-4 grid gap-1.5">
              {market.results.connections.map((x) => (
                <li key={x.name} className="flex items-baseline gap-3 text-[12px]">
                  <span className="w-20 shrink-0 font-medium text-primary">{x.name}</span>
                  <span className="text-secondary">{x.does}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Body>
    </>
  );
}
