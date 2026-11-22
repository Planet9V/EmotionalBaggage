"use client";

// "What do I end up with?": a track of the seven stages in two lanes, Make it and Sell it, and beside it the stage's
// output, live, on the worked example's own rows, in the same instrument frame as the Engineering and Market
// stages (a dark stage in a bezel that takes the page's theme):
//   01 Brief      every line of the brief, the one-liner first                         (GetBrief)
//   02 Research   every claim with its source, and the proof check it feeds            (GetClaim, React Flow)
//   03 Design     the 3D model from the parts list: looks, layers, tags, exploded view and the assembly in the
//                 build sheet's order (GetModel, the shared ModelCanvas); or the schematic (EngSchematic)
//   04 Prototype  the enclosure on the print bed, cut at any layer (GetPrint, the shared EnclosureCanvas)
//   05 Production the unit cost built up line by line, its fall with volume, each channel against it (GetCost)
//   06 Marketing  the ad drafts as a stack, each against every channel's limit           (GetAd)
//   07 Sales      the listing's fields against the marketplace's limits, and the channels (GetChannel)
// Until a visitor chooses, the track walks itself while it is on screen, staying longer on the 3D stages so
// their assembly and print can run; a choice stops the walk for good. There is no pause control (owner, 22 Nov).
//
// At most one WebGL canvas is alive here: the 3D model or the print, only while its stage is chosen and the
// section is near the window; leaving either disposes it, and until then the model shows as a vector drawing
// from the same parts. The server sends the first stage open; without script the others are in <noscript>.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useInView } from "motion/react";
import type { Item } from "@/lib/types";
import type { UnitCost } from "@/lib/economics/compute";
import type { GetData, MarketData } from "./storyData";
import type { ExampleEnclosure } from "./exampleData";
import { useAnimated, useHydrated } from "./useAnimated";
import { GET, GET_VIEWS } from "./content";
import { StageFoot, Waiting } from "./StageParts";
import { GetAd, GetBrief, GetChannel, GetClaim, GetCost } from "./get/GetDocs";
import { ModelStill } from "./get/ModelStill";
import { Segmented } from "./get/ViewControls";

const loading = () => <Waiting label={GET_VIEWS.loading} />;
const GetModel = dynamic(() => import("./get/GetModel"), { ssr: false, loading });
const GetPrint = dynamic(() => import("./get/GetPrint"), { ssr: false, loading });
const EngSchematic = dynamic(() => import("./EngSchematic"), { ssr: false, loading });

const ITEMS = GET.groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.key })));
/** how long the walk stays on each stage: the 3D stages long enough for one assembly or one print */
const DWELL: Record<string, number> = { "01": 6000, "02": 6500, "03": 16000, "04": 12500, "05": 7000, "06": 8000, "07": 6500 };
const PATH: Record<string, string> = { "01": GET_VIEWS.brief.path, "02": GET_VIEWS.claim.path, "03": GET_VIEWS.model.path, "04": GET_VIEWS.print.path, "05": GET_VIEWS.cost.path, "06": GET_VIEWS.ad.path, "07": GET_VIEWS.channel.path };

export type GetProps = {
  /** each stage's sections, by stage number */
  holds: Record<string, string[]>;
  get: GetData;
  market: MarketData;
  unit: UnitCost;
  parts: Item[];
  wires: Item[];
  enclosure: ExampleEnclosure | null;
};
type Sub = "model" | "schematic";

function Output({ n, p, live, active, sub }: { n: string; p: GetProps; /** a canvas may be mounted */ live: boolean; active: boolean; sub: Sub }) {
  const shaped = p.parts.filter((x) => (x.data as { geometry?: unknown }).geometry).length;
  switch (n) {
    case "01":
      return (
        <>
          <GetBrief get={p.get} />
          <StageFoot hint={GET_VIEWS.brief.hint}>{GET_VIEWS.brief.counts(p.get.brief.length, p.get.brief.filter((r) => r.status === "done").length)}</StageFoot>
        </>
      );
    case "02":
      return (
        <>
          <GetClaim get={p.get} market={p.market} />
          <StageFoot hint={GET_VIEWS.claim.hint}>{GET_VIEWS.claim.counts(p.get.claims.length)}</StageFoot>
        </>
      );
    case "03":
      if (sub === "schematic") return live ? <EngSchematic parts={p.parts} wires={p.wires} /> : <Waiting label={GET_VIEWS.loading} />;
      return (
        <>
          {live ? (
            <GetModel parts={p.parts} wires={p.wires} get={p.get} />
          ) : (
            <div className="relative flex min-h-[340px] flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_50%_45%,#1a1e25_0%,#0b0c0e_70%)] p-6">
              <ModelStill still={p.get.still} label={GET_VIEWS.still} className="max-h-full max-w-[640px]" />
            </div>
          )}
          <StageFoot hint={GET_VIEWS.model.hint}>{GET_VIEWS.model.counts(shaped, p.parts.length, p.wires.length, p.get.steps)}</StageFoot>
        </>
      );
    case "04":
      return (
        <>
          {!p.enclosure ? (
            <div className="relative flex-1">
              <Waiting label={GET_VIEWS.loading} />
            </div>
          ) : live ? (
            <GetPrint enclosure={p.enclosure} get={p.get} />
          ) : (
            <div className="relative flex min-h-[340px] flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_50%_45%,#1a1e25_0%,#0b0c0e_70%)] p-6">
              <ModelStill still={{ ...p.get.still, faces: p.get.still.faces.filter((f) => f.shell) }} label={GET_VIEWS.print.label} className="max-h-full max-w-[520px]" />
            </div>
          )}
          <StageFoot hint={GET_VIEWS.print.hint}>{p.enclosure ? GET_VIEWS.print.counts(p.enclosure.checks.filter((c) => c.ok).length, p.enclosure.checks.length, p.enclosure.version) : ""}</StageFoot>
        </>
      );
    case "05":
      return (
        <>
          <GetCost unit={p.unit} get={p.get} market={p.market} />
          <StageFoot hint={GET_VIEWS.cost.hint}>{GET_VIEWS.cost.counts(p.unit.lines.length, p.unit.missing.length)}</StageFoot>
        </>
      );
    case "06":
      return (
        <>
          <GetAd market={p.market} active={active} />
          <StageFoot hint={GET_VIEWS.ad.hint}>{GET_VIEWS.ad.counts(p.market.ads.drafts.length, p.market.ads.channels.length)}</StageFoot>
        </>
      );
    default:
      return (
        <>
          <GetChannel market={p.market} />
          <StageFoot hint={GET_VIEWS.channel.hint}>{GET_VIEWS.channel.counts(p.market.listing.rows.length, p.market.results.channels.length)}</StageFoot>
        </>
      );
  }
}

function Heading({ n, holds }: { n: string; holds: Record<string, string[]> }) {
  const it = ITEMS.find((x) => x.n === n)!;
  return (
    <div className="lg:min-h-[9.75rem]">
      <p className="font-mono text-[11px] text-muted">
        <span className="text-link">{it.n}</span> {it.stage}
      </p>
      <h3 className="mt-1 text-xl font-semibold leading-snug tracking-tight text-primary sm:text-[1.375rem]">{it.get}</h3>
      <p className="mt-1.5 max-w-[78ch] text-sm leading-relaxed text-secondary">{it.also}</p>
      <p className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[11px] text-muted">{GET.holds}</span>
        {(holds[n] ?? []).map((s) => (
          <span key={s} className="rounded-md border border-hairline bg-subtle px-1.5 py-0.5 text-[11px] text-secondary">{s}</span>
        ))}
      </p>
    </div>
  );
}

export function WhatYouGet(props: GetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const animated = useAnimated();
  const hydrated = useHydrated();
  const seen = useInView(ref, { amount: 0.4 });
  // a canvas lives only while the stage is near the window; leaving disposes it
  const near = useInView(stage, { margin: "150px 0px" });
  const [at, setAt] = useState(0);
  const [chosen, setChosen] = useState(false);
  const [sub, setSub] = useState<Sub>("model");
  const walking = animated && seen && !chosen;
  const now = ITEMS[at]!;

  useEffect(() => {
    if (!walking) return;
    const t = window.setTimeout(() => setAt((i) => (i + 1) % ITEMS.length), DWELL[now.n] ?? 6000);
    return () => window.clearTimeout(t);
  }, [walking, now.n]);

  const pick = (i: number) => {
    setChosen(true);
    setAt(i);
  };
  const onKey = (e: KeyboardEvent) => {
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? (at + 1) % ITEMS.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (at + ITEMS.length - 1) % ITEMS.length : e.key === "Home" ? 0 : e.key === "End" ? ITEMS.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    pick(to);
    tabRefs.current[to]?.focus();
  };
  const live = hydrated && near;
  const tall = now.n === "03" || now.n === "04";

  return (
    <div ref={ref} className="grid gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-6">
      {/* the track: two lanes, one stop a stage */}
      <div role="group" aria-label={GET.label} onKeyDown={onKey} className="grid grid-cols-2 gap-x-3 gap-y-4 self-start lg:sticky lg:top-6 lg:grid-cols-1">
        {GET.groups.map((g) => (
          <div key={g.key}>
            <p className="text-base font-semibold tracking-tight text-primary">{g.title}</p>
            <p className="text-xs text-secondary">{g.sub}</p>
            <div className="relative mt-2.5 grid gap-1.5">
              <span className="absolute bottom-4 left-[15px] top-4 w-0.5 bg-[var(--border-hairline)]" aria-hidden />
              {g.items.map((it) => {
                const i = ITEMS.findIndex((x) => x.n === it.n);
                const on = i === at;
                return (
                  <button
                    key={it.n}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    type="button"
                    aria-pressed={on}
                    aria-controls="get-panel"
                    onClick={() => pick(i)}
                    className={`relative flex min-h-11 items-center gap-3 overflow-hidden rounded-lg border px-1.5 py-1.5 text-left transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${on ? "border-hairline bg-surface shadow-[var(--shadow-card)]" : "border-transparent hover:bg-surface"}`}
                  >
                    <span className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border font-mono text-[10px] transition-colors duration-200 ${on ? "border-transparent bg-action text-white" : "border-hairline bg-canvas text-secondary"}`}>{it.n}</span>
                    <span className={`text-sm ${on ? "font-semibold text-primary" : "text-secondary"}`}>{it.stage}</span>
                    {/* how long until the walk moves on */}
                    {on && walking ? <span key={at} className="wl-progress absolute inset-x-0 bottom-0 h-0.5 bg-dutchOrange" style={{ animationDuration: `${DWELL[it.n] ?? 6000}ms` }} aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="min-w-0">
        <Heading n={now.n} holds={props.holds} />
        <div ref={stage} className="mt-4 rounded-[18px] border border-hairline bg-bezel p-1.5 shadow-plate sm:p-2">
          <div id="get-stage" className="dark overflow-hidden rounded-xl border border-black/60 bg-[#0b0c0e] text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="flex min-h-[45px] items-center gap-3 border-b border-hairline px-3 sm:px-4">
              <p className="mr-auto truncate font-mono text-[11px] text-muted">{now.n === "03" && sub === "schematic" ? "/s/design/schematic" : PATH[now.n]}</p>
              {now.n === "03" ? <Segmented<Sub> label="Which view of the design" value={sub} onChange={(v) => { setChosen(true); setSub(v); }} options={(Object.keys(GET_VIEWS.views) as Sub[]).map((k) => ({ value: k, label: GET_VIEWS.views[k] }))} /> : null}
              <p className="hidden shrink-0 items-center gap-2 font-mono text-[11px] text-muted xl:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-dutchOrange" aria-hidden />
                {GET_VIEWS.badge}
              </p>
            </div>
            <div id="get-panel" role="region" aria-label={`${now.stage}: ${now.get}`} className={`flex flex-col ${tall ? "h-[640px] sm:h-[620px]" : "max-h-[760px] min-h-[420px]"} lg:h-[620px] lg:max-h-none`}>
              <Output key={now.n} n={now.n} p={props} live={live} active={seen} sub={sub} />
            </div>
          </div>
        </div>
        <noscript>
          {ITEMS.slice(1).map((it) => (
            <div key={it.n} className="dark mt-6 overflow-hidden rounded-xl border border-hairline bg-[#0b0c0e] text-primary">
              <p className="border-b border-hairline px-4 py-3 text-base font-semibold">
                <span className="mr-2 font-mono text-xs text-link">{it.n}</span>
                {it.get}
              </p>
              <div className="flex flex-col">
                <Output n={it.n} p={props} live={false} active={false} sub="model" />
              </div>
            </div>
          ))}
        </noscript>
      </div>
    </div>
  );
}
