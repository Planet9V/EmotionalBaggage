"use client";

// The seven tabs of the market stage (Market.tsx). Each is set out as the workbench sets the section out, on the
// worked example's own rows and the rules the app enforces, all worked out on the server (storyData.ts): the
// positioning line and the proof check, the brand kit and the contrast check, the ad variants and each channel's
// limits, the planned pages and the sections the generator draws, the launch templates' dated steps, the
// listing's fields and limits, and the channels and campaigns with their targets. The status pills and the
// character counts are the app's own components. Where the example holds little, the first line of the tab says
// so, and what follows is the stage's structure, never content written to fill the gap.
import { useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Count, StatusPill } from "@/components/content/shared";
import type { ProofState } from "@/lib/market/proof";
import type { MarketData } from "./storyData";
import { CHIP, CHIP_OFF, CHIP_ON, StageBar, StageFoot, StageView } from "./StageParts";
import { MARKET } from "./content";

/** as the Positioning page colours a proof link */
const STATE_TONE: Record<ProofState, "success" | "info" | "warning" | "danger"> = {
  "verified claim": "success",
  "passing test": "success",
  requirement: "info",
  "unverified claim": "warning",
  "test not passing": "warning",
  missing: "danger",
};

const H = ({ children }: { children: ReactNode }) => <h3 className="text-sm font-semibold text-primary">{children}</h3>;
const Hint = ({ children }: { children: ReactNode }) => <p className="mt-1 text-[13px] leading-relaxed text-secondary">{children}</p>;
const BOX = "rounded-lg border border-hairline bg-surface";
const TH = "px-3 py-2 text-left font-mono text-[11px] font-normal text-muted";
const TD = "px-3 py-2 align-top text-[13px] leading-snug";

/** What the example holds on this tab, said first. */
function Honest({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 border-b border-hairline bg-[var(--accent-orange-subtle)] px-4 py-2.5 text-[13px] leading-relaxed text-primary lg:px-5">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
      {children}
    </p>
  );
}

function Panel({ path, honest, foot, count, bar, children }: { path: string; honest: string; foot: string; count: string; bar?: ReactNode; children: ReactNode }) {
  return (
    <>
      {/* on a phone the bar holds only its controls, so a tab without any has no bar */}
      <div className={bar ? "contents" : "hidden sm:contents"}>
        <StageBar path={path}>{bar}</StageBar>
      </div>
      <StageView className="lg:overflow-auto" tabIndex={0} label={foot}>
        <Honest>{honest}</Honest>
        <div className="p-4 lg:p-5">{children}</div>
      </StageView>
      <StageFoot hint={foot}>{count}</StageFoot>
    </>
  );
}

const Row = ({ title, body, status }: { title: string; body: string; status: string }) => (
  <li className="flex items-start gap-3 border-b border-hairline px-3.5 py-3 last:border-0">
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold text-primary">{title}</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-secondary">{body}</p>
    </div>
    <StatusPill status={status} />
  </li>
);

function Positioning({ d }: { d: MarketData["positioning"] }) {
  const c = MARKET.positioning;
  return (
    <Panel path={c.path} honest={c.honest(d.notes.length, d.statements)} foot={c.lineHint} count={`${d.notes.length} rows`}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <H>{c.lineTitle}</H>
          <p className={`${BOX} mt-2 p-4 text-[15px] leading-relaxed text-primary`}>
            {d.line.split(/(\[[^\]]+\])/).map((part, i) =>
              part.startsWith("[") ? (
                <span key={i} className="rounded bg-[var(--accent-orange-subtle)] px-1 font-mono text-[13px] text-dutchOrange-300">{part}</span>
              ) : (
                part
              ),
            )}
          </p>
          <Hint>{c.lineHint}</Hint>
          <div className="mt-5">
            <H>{c.notesTitle}</H>
            <ul className={`${BOX} mt-2`}>
              {d.notes.map((n) => (
                <Row key={n.title} {...n} />
              ))}
            </ul>
          </div>
        </div>
        <div>
          <H>{c.messagesTitle}</H>
          <Hint>{c.messagesHint}</Hint>
          <ul className={`${BOX} mt-3`}>
            {d.pool.map((p) => (
              <li key={p.label} className="flex items-center gap-3 border-b border-hairline px-3.5 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-primary">{p.label}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{c.proven(p.proven, p.count, p.label)}</p>
                </div>
                <StatusBadge tone={STATE_TONE[p.state]}>{p.state}</StatusBadge>
              </li>
            ))}
          </ul>
          <Hint>{c.reviewer}</Hint>
        </div>
      </div>
    </Panel>
  );
}

function Brand({ d }: { d: MarketData["brand"] }) {
  const c = MARKET.brand;
  return (
    <Panel path={c.path} honest={c.honest(d.kit)} foot={c.kitHint} count={d.kit ? "1 kit" : "no kit yet"}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <H>{c.voiceTitle}</H>
          {d.voice ? (
            <ul className={`${BOX} mt-2`}>
              <Row {...d.voice} />
            </ul>
          ) : null}
          <div className="mt-5">
            <H>{c.kitTitle}</H>
            <ul className={`${BOX} mt-2`}>
              {c.kit.map((k) => (
                <li key={k} className="border-b border-hairline px-3.5 py-2 text-[13px] text-secondary last:border-0">{k}</li>
              ))}
            </ul>
            <Hint>{c.kitHint}</Hint>
          </div>
        </div>
        {d.demo ? (
          <div>
            <H>{c.contrastTitle}</H>
            <Hint>{c.contrastHint}</Hint>
            <div className={`${BOX} mt-3 overflow-hidden`}>
              <div className="flex items-center gap-3 border-b border-hairline px-3.5 py-3">
                <span className="h-9 w-9 shrink-0 rounded-md border border-hairline" style={{ background: d.demo.hex }} aria-hidden />
                <p className="font-mono text-[13px] text-primary">{d.demo.hex}</p>
              </div>
              <div className="grid grid-cols-2">
                {(
                  [
                    [c.onWhite, "#FFFFFF", d.demo.white, d.demo.whiteLevel],
                    [c.onBlack, "#000000", d.demo.black, d.demo.blackLevel],
                  ] as const
                ).map(([label, ground, ratio, level]) => (
                  <div key={label} className="border-r border-hairline p-3.5 last:border-0">
                    <p className="flex h-16 items-center justify-center rounded-md text-2xl font-semibold" style={{ background: ground, color: d.demo!.hex }} aria-hidden>
                      Aa
                    </p>
                    <p className="mt-2 text-[13px] text-secondary">{label}</p>
                    <p className="mt-0.5 flex items-center gap-2 font-mono text-[13px] tabular-nums text-primary">
                      {ratio}:1 <StatusBadge tone={level === "fails" ? "danger" : level === "AA large" ? "warning" : "success"}>{level}</StatusBadge>
                    </p>
                  </div>
                ))}
              </div>
              {d.demo.note ? <p className="border-t border-hairline px-3.5 py-3 text-[13px] leading-relaxed text-secondary">{d.demo.note}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function Ads({ d }: { d: MarketData["ads"] }) {
  const c = MARKET.ads;
  const [id, setId] = useState(d.channels.find((x) => x.textEnforce)?.id ?? d.channels[0]?.id ?? "");
  const ch = d.channels.find((x) => x.id === id) ?? d.channels[0];
  const first = d.drafts[0];
  return (
    <Panel path={c.path} honest={c.honest(d.drafts.length, d.posts)} foot={ch?.unverified ?? ""} count={`${d.drafts.length} drafts, ${d.channels.length} channels`}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <H>{c.draftsTitle}</H>
          <ul className="mt-2 grid gap-2">
            {d.drafts.map((a) => (
              <li key={a.text} className={`${BOX} p-3.5`}>
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-primary">&ldquo;{a.text}&rdquo;</p>
                  <StatusPill status={a.status} />
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
                  <span>{a.channel}</span>
                  <span>{a.rule}</span>
                  <span>{a.length} characters</span>
                </p>
              </li>
            ))}
          </ul>
          {first?.body ? <Hint>{first.body}</Hint> : null}
        </div>
        {ch ? (
          <div>
            <H>{c.limitsTitle}</H>
            <Hint>{c.limitsHint}</Hint>
            <div role="group" aria-label={c.limitsTitle} className="mt-3 flex flex-wrap gap-1.5">
              {d.channels.map((x) => (
                <button key={x.id} type="button" aria-pressed={x.id === ch.id} onClick={() => setId(x.id)} className={`${CHIP} ${x.id === ch.id ? CHIP_ON : CHIP_OFF}`}>
                  {x.label}
                </button>
              ))}
            </div>
            <div className={`${BOX} mt-3`}>
              <p className="border-b border-hairline px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary">{ch.summary}</p>
              <ul>
                {ch.fields.map((f) => (
                  <li key={f.label} className="flex items-center gap-3 border-b border-hairline px-3.5 py-2 last:border-0">
                    <span className="min-w-0 flex-1 text-[13px] text-primary">
                      {f.label}
                      {f.required ? <span className="ml-2 font-mono text-[11px] text-muted">{c.required}</span> : null}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-secondary">{f.max}</span>
                    <StatusBadge tone={f.enforce ? "info" : "neutral"}>{f.enforce ? c.enforced : c.guide}</StatusBadge>
                  </li>
                ))}
              </ul>
              {first && ch.textMax !== null ? (
                <p className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline bg-subtle px-3.5 py-2.5 text-[13px] text-secondary">
                  {c.fits(ch.label, ch.textLabel)}
                  <Count n={ch.xWeight ? first.xLength : first.length} max={ch.textMax} enforce={ch.textEnforce} />
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/** A section of the generated page as a block of the wireframe: its name and a few rules standing for its text. */
function Block({ label, i }: { label: string; i: number }) {
  const tall = i === 0;
  return (
    <li className={`flex items-center gap-3 border-b border-hairline px-3.5 last:border-0 ${tall ? "bg-[var(--accent-orange-subtle)] py-5" : "py-3"}`}>
      <span className="w-6 shrink-0 font-mono text-[11px] text-dutchOrange-300">{String(i + 1).padStart(2, "0")}</span>
      <span className="w-40 shrink-0 text-[13px] font-medium text-primary">{label}</span>
      <span className="grid min-w-0 flex-1 gap-1.5" aria-hidden>
        <span className={`h-1.5 rounded-full bg-[var(--border-hairline)] ${tall ? "w-4/5" : "w-3/5"}`} />
        <span className="h-1.5 w-2/5 rounded-full bg-[var(--border-hairline)]" />
      </span>
    </li>
  );
}

function Landing({ d }: { d: MarketData["landing"] }) {
  const c = MARKET.landing;
  return (
    <Panel path={c.path} honest={c.honest(d.pages.length, d.sections)} foot={c.kindsHint} count={`${d.pages.length} planned pages`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <H>{c.kindsTitle}</H>
          <Hint>{c.kindsHint}</Hint>
          <ol className={`${BOX} mt-3 overflow-hidden`}>
            {d.kinds.map((k, i) => (
              <Block key={k} label={k} i={i} />
            ))}
          </ol>
        </div>
        <div>
          <H>{c.pagesTitle}</H>
          <ul className={`${BOX} mt-2`}>
            {d.pages.map((p) => (
              <li key={p.path} className="border-b border-hairline px-3.5 py-2.5 last:border-0">
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[13px] font-semibold text-primary">{p.title}</span>
                  <span className="font-mono text-[11px] text-dutchOrange-300">{p.path}</span>
                  <span className="ml-auto"><StatusPill status={p.status} /></span>
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-secondary">{p.body}</p>
                <p className="mt-1 font-mono text-[11px] text-muted">{c.cta}: {p.cta}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function Launch({ d }: { d: MarketData["launch"] }) {
  const c = MARKET.launch;
  const [id, setId] = useState(d.templates[0]?.id ?? "");
  const t = d.templates.find((x) => x.id === id) ?? d.templates[0];
  if (!t) return null;
  const phases = t.steps.reduce<{ phase: string; steps: typeof t.steps }[]>((out, s) => {
    const at = out.find((p) => p.phase === s.phase);
    if (at) at.steps.push(s);
    else out.push({ phase: s.phase, steps: [s] });
    return out;
  }, []);
  const when = (n: number) => (n === 0 ? c.day : n > 0 ? c.before(n) : c.after(-n));
  return (
    <Panel
      path={c.path}
      honest={c.honest(d.launches)}
      foot={c.foot}
      count={c.steps(t.steps.length)}
      bar={
        <div role="group" aria-label={c.pick} className="flex shrink-0 gap-1.5">
          {d.templates.map((x) => (
            <button key={x.id} type="button" aria-pressed={x.id === t.id} onClick={() => setId(x.id)} className={`${CHIP} ${x.id === t.id ? CHIP_ON : CHIP_OFF}`}>
              {x.label}
            </button>
          ))}
        </div>
      }
    >
      <p className="max-w-[80ch] text-[13px] leading-relaxed text-secondary">{t.blurb}</p>
      <div className="mt-4 grid gap-x-6 gap-y-5 lg:grid-cols-2">
        {phases.map((p) => (
          <section key={p.phase} aria-label={p.phase}>
            <H>{p.phase}</H>
            <ol className={`${BOX} mt-2`}>
              {p.steps.map((s) => (
                <li key={s.title} className="flex items-start gap-3 border-b border-hairline px-3.5 py-2.5 last:border-0">
                  <span className={`w-[7.5rem] shrink-0 font-mono text-[11px] leading-5 tabular-nums ${s.days === 0 ? "text-dutchOrange-300" : "text-muted"}`}>{when(s.days)}</span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-primary">
                    {s.title}
                    {s.gate ? <span className="ml-2 whitespace-nowrap font-mono text-[11px] text-muted">{c.needs(s.gate)}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Panel>
  );
}

function Listing({ d }: { d: MarketData["listing"] }) {
  const c = MARKET.listing;
  return (
    <Panel path={c.path} honest={c.honest(d.rows.length)} foot={d.note} count={`${d.rows.length} row`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <H>{c.fieldsTitle}</H>
          <Hint>{c.fieldsHint(d.category)}</Hint>
          <ul className={`${BOX} mt-3`}>
            {d.fields.map((f) => (
              <li key={f.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline px-3.5 py-3 last:border-0">
                <span className="min-w-0 flex-1 text-[13px] font-medium text-primary">
                  {f.label}
                  {f.rows > 1 ? <span className="ml-2 font-mono text-[11px] font-normal text-muted">{f.rows} of them</span> : null}
                </span>
                <span className="font-mono text-[11px] text-muted">{f.unit}</span>
                <Count n={0} max={f.max} enforce={f.enforce} />
                <StatusBadge tone={f.enforce ? "info" : "neutral"}>{f.enforce ? MARKET.ads.enforced : MARKET.ads.guide}</StatusBadge>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <H>{c.rowsTitle}</H>
          <ul className={`${BOX} mt-2`}>
            {d.rows.map((r) => (
              <Row key={r.title} {...r} />
            ))}
          </ul>
          <Hint>{d.note}</Hint>
        </div>
      </div>
    </Panel>
  );
}

function Results({ d }: { d: MarketData["results"] }) {
  const c = MARKET.results;
  const k = c.columns;
  return (
    <Panel path={c.path} honest={c.honest(d.channels.length, d.campaigns.length, d.days)} foot={c.foot} count={`${d.channels.length} channels, ${d.campaigns.length} campaigns`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div>
          <H>{c.channelsTitle}</H>
          <div className={`${BOX} mt-2 overflow-x-auto`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className={TH}>{k.channel}</th>
                  <th scope="col" className={`${TH} text-right`}>{k.price}</th>
                  <th scope="col" className={`${TH} text-right`}>{k.net}</th>
                  <th scope="col" className={TH}>{k.status}</th>
                </tr>
              </thead>
              <tbody>
                {d.channels.map((r) => (
                  <tr key={r.title} className="border-b border-hairline last:border-0">
                    <th scope="row" className={`${TD} text-left font-medium text-primary`}>
                      {r.title}
                      <span className="mt-0.5 block font-normal text-secondary">{r.take}</span>
                    </th>
                    <td className={`${TD} text-right font-mono tabular-nums text-primary`}>{r.price}</td>
                    <td className={`${TD} text-right font-mono tabular-nums text-primary`}>{r.net}</td>
                    <td className={TD}><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5">
            <H>{c.connectionsTitle}</H>
            <ul className={`${BOX} mt-2`}>
              {d.connections.map((x) => (
                <li key={x.name} className="flex items-baseline gap-3 border-b border-hairline px-3.5 py-2.5 last:border-0">
                  <span className="w-20 shrink-0 text-[13px] font-semibold text-primary">{x.name}</span>
                  <span className="text-[13px] leading-snug text-secondary">{x.does}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div>
          <H>{c.campaignsTitle}</H>
          <div className={`${BOX} mt-2 overflow-x-auto`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className={TH}>{k.campaign}</th>
                  <th scope="col" className={`${TH} hidden sm:table-cell`}>{k.budget}</th>
                  <th scope="col" className={TH}>{k.target}</th>
                  <th scope="col" className={TH}>{k.result}</th>
                </tr>
              </thead>
              <tbody>
                {d.campaigns.map((r) => (
                  <tr key={r.title} className="border-b border-hairline last:border-0">
                    <th scope="row" className={`${TD} text-left font-medium text-primary`}>
                      {r.title}
                      <span className="mt-0.5 block font-mono text-[11px] font-normal text-muted">{r.funnel}</span>
                    </th>
                    <td className={`${TD} hidden whitespace-nowrap font-mono text-[11px] text-secondary sm:table-cell`}>{r.budget}</td>
                    <td className={`${TD} text-secondary`}>{r.target}</td>
                    <td className={`${TD} whitespace-nowrap font-mono text-[11px] text-muted`}>{c.none}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export type MarketTab = keyof typeof MARKET.tabs;

export function MarketPanel({ tab, data }: { tab: MarketTab; data: MarketData }) {
  switch (tab) {
    case "positioning":
      return <Positioning d={data.positioning} />;
    case "brand":
      return <Brand d={data.brand} />;
    case "ads":
      return <Ads d={data.ads} />;
    case "landing":
      return <Landing d={data.landing} />;
    case "launch":
      return <Launch d={data.launch} />;
    case "listing":
      return <Listing d={data.listing} />;
    case "results":
      return <Results d={data.results} />;
  }
}
