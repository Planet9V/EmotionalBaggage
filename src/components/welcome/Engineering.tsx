"use client";

// The engineering stage: one dark panel with six tabs, each the app's own view running on the worked example's
// rows. The rows come from the server (exampleData.ts) as props; nothing here calls the API, and nothing can be
// saved: every view is given its read-only form.
//   3D                  ModelCanvas + useSceneModel (EngModel)
//   Schematic           SymbolCanvas and SchematicCanvas + the circuit and layout derivations (EngSchematic)
//   Physical layout     ThreeView, three times (EngLayout)
//   Enclosure and print EnclosureCanvas on the meshes the app's generator built on the server (EngEnclosure)
//   Parts list          the seeded parts priced by the app's own price rule (here)
//   Build sheet         StepCard on the app's own soldering order (EngBuildSheet)
// Each view is loaded with next/dynamic the first time its tab is shown, and the 3D view only when the stage
// nears the window. The stage has one fixed height, so nothing moves when a view arrives. Until the first view
// arrives the stage holds a still of it; without script the stills, the parts list and the first build steps are
// all in the page (the <noscript> block).
import dynamic from "next/dynamic";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useInView } from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { partPrice, partSource, sumLine, toPart, type Part } from "@/lib/domain";
import type { Item } from "@/lib/types";
import { sequence, toWires } from "@/components/buildsheet/derive";
import type { ExampleEnclosure } from "./exampleData";
import { Shot } from "./Shot";
import { useHydrated } from "./useAnimated";
import { ENGINEERING, FEATURES } from "./content";
import { StageBar, StageFoot, StageView, Waiting } from "./StageParts";

const loading = () => <Waiting label={ENGINEERING.loading} />;
const EngModel = dynamic(() => import("./EngModel"), { ssr: false, loading });
const EngSchematic = dynamic(() => import("./EngSchematic"), { ssr: false, loading });
const EngLayout = dynamic(() => import("./EngLayout"), { ssr: false, loading });
const EngEnclosure = dynamic(() => import("./EngEnclosure"), { ssr: false, loading });
const EngBuildSheet = dynamic(() => import("./EngBuildSheet"), { ssr: false, loading });

type Tab = keyof typeof ENGINEERING.tabs;
const TABS = Object.keys(ENGINEERING.tabs) as Tab[];
const altOf = (shot: string) => FEATURES.find((f) => f.shot === shot)?.alt ?? "";

type SortKey = keyof typeof ENGINEERING.bom.columns;
const COLUMNS = Object.keys(ENGINEERING.bom.columns) as SortKey[];
const money = (n: number | null) => (n === null ? "no price" : `$${n.toFixed(2)}`);

function BomTable({ parts, sortable }: { parts: Part[]; sortable: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; down: boolean } | null>(null);
  const rows = useMemo(() => {
    const value = (p: Part, k: SortKey) => (k === "line" ? (partPrice(p).line ?? -1) : k === "qty" ? (p.qty ?? -1) : k === "source" ? partSource(p) : p[k]);
    if (!sort) return parts;
    return [...parts].sort((a, b) => {
      const [x, y] = [value(a, sort.key), value(b, sort.key)];
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en", { numeric: true });
      return sort.down ? -order : order;
    });
  }, [parts, sort]);
  const numeric = (k: SortKey) => k === "qty" || k === "line";
  return (
    <table className="w-full border-collapse text-left text-[13px]">
      <caption className="sr-only">{ENGINEERING.bom.caption}</caption>
      <thead className="sticky top-0 z-10 bg-[#0b0c0e]">
        <tr className="border-b border-hairline">
          {COLUMNS.map((k) => (
            <th key={k} scope="col" aria-sort={sort?.key === k ? (sort.down ? "descending" : "ascending") : sortable ? "none" : undefined} className={`px-3 py-0 font-normal sm:px-4 ${numeric(k) ? "text-right" : ""} ${k === "spec" ? "hidden md:table-cell" : k === "source" ? "hidden sm:table-cell" : ""}`}>
              {sortable ? (
                <button type="button" onClick={() => setSort((s) => ({ key: k, down: s?.key === k ? !s.down : false }))} className={`inline-flex h-9 items-center gap-1 font-mono text-[11px] transition-colors duration-150 hover:text-primary ${sort?.key === k ? "text-primary" : "text-muted"}`}>
                  {ENGINEERING.bom.columns[k]}
                  {sort?.key === k ? sort.down ? <ChevronDown className="h-3 w-3" aria-hidden /> : <ChevronUp className="h-3 w-3" aria-hidden /> : null}
                </button>
              ) : (
                <span className="inline-flex h-9 items-center font-mono text-[11px] text-muted">{ENGINEERING.bom.columns[k]}</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.item.id} className="border-b border-hairline">
            <td className="px-3 py-1.5 font-mono text-xs text-dutchOrange-300 sm:px-4">{p.ref}</td>
            <th scope="row" className="px-3 py-1.5 font-medium text-primary sm:whitespace-nowrap sm:px-4">{p.title}</th>
            <td className="hidden px-4 py-1.5 text-secondary md:table-cell">{p.spec}</td>
            <td className="px-3 py-1.5 text-right font-mono tabular-nums text-secondary sm:px-4">{p.qty ?? ""}</td>
            <td className="hidden whitespace-nowrap px-4 py-1.5 text-secondary sm:table-cell">{partSource(p)}</td>
            <td className="px-3 py-1.5 text-right font-mono tabular-nums text-primary sm:px-4">{money(partPrice(p).line)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={3} className="px-3 py-2.5 text-right sm:hidden"><span className="font-mono text-[11px] font-normal text-muted">{ENGINEERING.bom.total}</span></th>
          <th scope="row" colSpan={4} className="hidden px-4 py-2.5 text-right sm:table-cell md:hidden"><span className="font-mono text-[11px] font-normal text-muted">{ENGINEERING.bom.total}</span></th>
          <th scope="row" colSpan={5} className="hidden px-4 py-2.5 text-right font-mono text-[11px] font-normal text-muted md:table-cell">{ENGINEERING.bom.total}</th>
          <td className="px-4 py-2.5 text-right font-mono text-base font-semibold tabular-nums text-primary">{money(sumLine(parts))}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function Engineering({ parts: partItems, wires, enclosure }: { parts: Item[]; wires: Item[]; enclosure: ExampleEnclosure | null }) {
  const stage = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const hydrated = useHydrated();
  const near = useInView(stage, { margin: "700px 0px", once: true });
  const [tab, setTab] = useState<Tab>("model");
  const parts = useMemo(() => partItems.map(toPart), [partItems]);
  const live = hydrated && near;

  const onKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const to = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i + TABS.length - 1) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(TABS[to]!);
    tabRefs.current[to]?.focus();
  };

  return (
    <div ref={stage} className="dark overflow-hidden rounded-xl border border-hairline bg-[#0b0c0e] text-primary shadow-[var(--shadow-card)]">
      <div role="tablist" aria-label={ENGINEERING.title} onKeyDown={onKey} className="flex overflow-x-auto border-b border-hairline [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`eng-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="eng-panel"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className={`relative h-12 shrink-0 whitespace-nowrap px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:px-5 ${tab === t ? "text-primary" : "text-secondary hover:text-primary"}`}
          >
            {ENGINEERING.tabs[t]}
            <span className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-dutchOrange transition-opacity duration-150 ${tab === t ? "opacity-100" : "opacity-0"}`} aria-hidden />
          </button>
        ))}
      </div>

      {/* one fixed height for every tab, so nothing below moves when a view loads or the tab changes */}
      <div id="eng-panel" role="tabpanel" aria-labelledby={`eng-tab-${tab}`} className="flex h-[600px] flex-col lg:h-[700px]">
        {tab === "bom" ? (
          <>
            <StageBar path="/s/design/bom">
              <p className="font-mono text-[11px] text-muted">{ENGINEERING.bom.sort}</p>
            </StageBar>
            <StageView className="overflow-auto" tabIndex={0} label={ENGINEERING.bom.caption}>
              <BomTable parts={parts} sortable />
            </StageView>
            <StageFoot hint={ENGINEERING.bom.hint}>{parts.length} lines</StageFoot>
          </>
        ) : !live ? (
          <>
            <StageBar path="/s/design/model" />
            <StageView className="flex items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,#171a20_0%,#0b0c0e_72%)]">
              <div className="w-full max-w-[1100px] opacity-90">
                <Shot name="model" theme="dark" alt={altOf("model")} />
              </div>
            </StageView>
            <StageFoot hint={ENGINEERING.still}>{ENGINEERING.model.counts(parts.filter((p) => p.geometry).length, parts.length, null, wires.length)}</StageFoot>
          </>
        ) : tab === "model" ? (
          <EngModel parts={partItems} wires={wires} />
        ) : tab === "schematic" ? (
          <EngSchematic parts={partItems} wires={wires} />
        ) : tab === "layout" ? (
          <EngLayout parts={partItems} />
        ) : tab === "enclosure" ? (
          enclosure ? (
            <EngEnclosure enclosure={enclosure} />
          ) : (
            <StageView>
              <Waiting label={ENGINEERING.enclosure.missing} />
            </StageView>
          )
        ) : (
          <EngBuildSheet parts={partItems} wires={wires} />
        )}
      </div>

      {/* without script the tabs cannot change, so everything they hold that can be read is set out here */}
      <noscript>
        <div className="border-t border-hairline">
          <p className="px-4 py-3 text-[13px] text-secondary">{ENGINEERING.noscript}</p>
          <div className="grid gap-px sm:grid-cols-2">
            <Shot name="schematic" theme="dark" alt={altOf("schematic")} eager />
            <Shot name="enclosure" theme="dark" alt={altOf("enclosure")} eager />
          </div>
          <div className="overflow-x-auto">
            <BomTable parts={parts} sortable={false} />
          </div>
          <ol className="grid gap-1 px-4 py-3 text-[13px] text-secondary">
            {sequence(toWires(wires)).slice(0, 8).map((s) => (
              <li key={s.wire.item.id}>
                <span className="font-mono text-dutchOrange-300">{String(s.n).padStart(2, "0")}</span> {s.wire.name}: {s.wire.from}.{s.wire.fromPin} to {s.wire.to}.{s.wire.toPin}
              </li>
            ))}
          </ol>
        </div>
      </noscript>
    </div>
  );
}
