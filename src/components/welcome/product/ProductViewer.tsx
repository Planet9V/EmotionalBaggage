"use client";

// The worked example as a product to look at and take apart, in "What do I end up with?": a strip of set views
// (every side, the doors open, on a handle, pulled apart, see-through, as a line drawing), the tag itself, live,
// in whichever view is picked (one canvas, reposed: ProductCanvas), and its parts. It turns on its own and by
// hand in every look. Every part can be chosen, in the picture or in the list beside it (grouped, searchable, and
// the keyboard's way in): the chosen part stands out, the lines to the parts it is joined to are drawn, and a card
// says what it does, its size, its cost and its nets, each joined part a button that goes to it. All of it is read
// from the example's parts list and schematic (model.ts); nothing here is typed in but the names of the controls.
//
// The server draws the picked view in SVG (ViewArt); the canvas is asked for only when the stage nears the window,
// and never without WebGL or on a device that cannot keep pace. On a phone the list and the card are a sheet over
// the foot of the stage.
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { List, RotateCw, X } from "lucide-react";
import type { Still } from "../get/projection";
import { Range, Segmented, Switch } from "../get/ViewControls";
import { filmMode, paceVerdict } from "../scenes/pace";
import { useAnimated, useHydrated } from "../useAnimated";
import { EXAMPLE, GET_VIEWS } from "../content";
import { PART_GROUPS, type Product, type ProductPart } from "./model";
import type { Pose } from "./ProductCanvas";
import type { ViewerMode } from "./scene";
import { ViewArt } from "./ViewArt";
import { VIEWS, type View } from "./views";

const ProductCanvas = dynamic(() => import("./ProductCanvas"), { ssr: false });
const C = GET_VIEWS.product;
const MODES: ViewerMode[] = ["solid", "translucent", "wireframe"];
const NET_TONE: Record<string, string> = { power: "border-[#f0a04a]/60 text-[#f6b877]", ground: "border-white/25 text-secondary", signal: "border-[#6ea8ff]/60 text-[#9cc3ff]", audio: "border-[#c5a7f5]/60 text-[#d6c1f8]" };
const short = (title: string) => title.split(",")[0]!.replace(/\s*\(.*$/, "");

function hasWebGl() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

function caption(view: View, product: Product): string {
  const by = (look: ProductPart["look"]) => product.parts.find((p) => p.look === look);
  const named = (...looks: ProductPart["look"][]) => looks.map((l) => by(l)).filter((p): p is ProductPart => !!p).map((p) => (p.spec && p.placed !== "row" ? `${p.title}, ${p.spec}` : p.title)).join("; ");
  const size = C.caption.size(product.size.w, product.size.h, product.size.t);
  switch (view.key) {
    case "front":
    case "left":
    case "right":
      return `${size}. ${named("shell", "strap")}`;
    case "back":
      return named("plate", "trackerDoor");
    case "edge":
      return `${product.size.t} mm thick. ${named("switch", "button")}`;
    case "top":
      return named("strap");
    case "handle":
      return C.render;
    case "coin":
      return named("coinDoor", "cell");
    case "tracker":
      return named("trackerDoor", "tracker");
    case "exploded":
      return C.caption.parts(product.parts.filter((p) => p.body).length, product.illustrative);
    default:
      return named("board", "cell", "supercap", "speaker", "tracker");
  }
}

function Card({ part, product, onChoose, onClose }: { part: ProductPart; product: Product; onChoose: (ref: string) => void; onClose: () => void }) {
  const title = (ref: string) => product.parts.find((p) => p.ref === ref)?.title ?? ref;
  const row = "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 border-t border-hairline py-2 text-[13px] leading-snug";
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-part-card={part.ref}>
      <div className="flex items-start gap-2 border-b border-hairline px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">
            <span className="font-mono font-semibold text-dutchOrange-300">{part.ref}</span> · {C.groups[part.group]}
          </p>
          <h4 className="mt-0.5 text-base font-semibold leading-snug text-primary">{part.title}</h4>
        </div>
        <button type="button" onClick={onClose} aria-label={C.all} className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        <p className="py-3 text-[15px] leading-relaxed text-secondary">{part.does}</p>
        <dl>
          {part.spec ? (
            <div className={row}>
              <dt className="text-muted">{C.size}</dt>
              <dd className="tabular-nums text-primary">{part.spec}</dd>
            </div>
          ) : null}
          {part.qty !== null && part.qty > 1 ? (
            <div className={row}>
              <dt className="text-muted">{C.qty}</dt>
              <dd className="tabular-nums text-primary">{part.qty}</dd>
            </div>
          ) : null}
          {part.cost ? (
            <div className={row}>
              <dt className="text-muted">{C.cost}</dt>
              <dd className="tabular-nums text-primary">
                {part.cost}
                {part.costAt ? <span className="text-secondary">, {part.costAt}</span> : null} <span className="text-muted">({C.costNote})</span>
              </dd>
            </div>
          ) : null}
          {part.source ? (
            <div className={row}>
              <dt className="text-muted">{C.source}</dt>
              <dd className="text-primary">{part.source}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-3 border-t border-hairline pt-3 text-[13px] font-medium text-muted">{C.joins}</p>
        {part.nets.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-secondary">{C.noJoins}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {part.nets.map((n) => (
              <li key={n.net} className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[12px] leading-none ${NET_TONE[n.netClass] ?? NET_TONE.signal}`} title={C.netClass[n.netClass]}>
                  {n.net}
                </span>
                <span className="sr-only">({C.netClass[n.netClass]}) to</span>
                {n.to.map((ref) => (
                  <button key={ref} type="button" onClick={() => onChoose(ref)} title={title(ref)} aria-label={`${ref}, ${title(ref)}`} className="inline-flex min-h-8 items-center rounded-md border border-hairline px-2 font-mono text-[12px] text-primary hover:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus max-md:min-h-11 max-md:px-3">
                    {ref}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        )}
        {part.placed === "illustrative" ? <p className="mt-3 text-[13px] leading-snug text-muted">{C.illustrative}</p> : null}
        {!part.body ? <p className="mt-3 text-[13px] leading-snug text-muted">{C.listOnly}</p> : null}
      </div>
    </div>
  );
}

export function ProductViewer({ product, still, wires, live, seen }: { product: Product; still: Still; wires: number; /** the canvas may be mounted */ live: boolean; /** the stage is on screen */ seen: boolean }) {
  const hydrated = useHydrated();
  const animated = useAnimated();
  const [view, setView] = useState<View>(VIEWS[1]!);
  const [mode, setMode] = useState<ViewerMode>(VIEWS[1]!.mode);
  const [apart, setApart] = useState(0);
  const [pose, setPose] = useState<Pose>({ yaw: VIEWS[1]!.yaw, pitch: VIEWS[1]!.pitch, key: 0 });
  const [turning, setTurning] = useState(true);
  const [chosen, setChosen] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(false);
  const [ready, setReady] = useState(false);
  const [sharp, setSharp] = useState(true);
  const [slow, setSlow] = useState(false);
  const capable = useMemo(() => hydrated && hasWebGl(), [hydrated]);
  const film = useMemo(() => (hydrated ? filmMode(window.location.search) : "normal"), [hydrated]);
  const canvas = live && capable && !slow && !view.render;
  const part = chosen ? product.parts.find((p) => p.ref === chosen) ?? null : null;
  const drawn = product.parts.filter((p) => p.body);

  const pick = (v: View) => {
    setView(v);
    setMode(v.mode);
    setApart(v.explode);
    setPose((p) => ({ yaw: v.yaw, pitch: v.pitch, key: p.key + 1 }));
    // a set view is held still; Turn starts it turning again from there
    setTurning(false);
  };
  const choose = (ref: string | null) => {
    setChosen(ref);
    setSheet(false);
    const p = ref ? product.parts.find((x) => x.ref === ref) : null;
    // a part inside the closed, finished tag cannot be seen: show it through the body
    if (p?.body && mode === "solid" && apart < 0.4 && !(p.group === "enclosure" && p.look !== "gasket" && p.look !== "tracker")) setMode("translucent");
  };
  const onPace = (ms: number) => {
    const verdict = paceVerdict(ms, sharp, film);
    if (verdict === "soften") setSharp(false);
    else if (verdict === "stills") setSlow(true);
  };

  const labels = useMemo(() => (apart > 0.6 && view.labels ? drawn.filter((p) => p.placed !== "illustrative").map((p) => ({ ref: p.ref, text: short(p.title) })) : undefined), [apart, view.labels, drawn]);
  const q = query.trim().toLowerCase();
  const groups = PART_GROUPS.map((g) => ({ g, parts: product.parts.filter((p) => p.group === g && (!q || `${p.ref} ${p.title}`.toLowerCase().includes(q))) })).filter((x) => x.parts.length);
  const joined = product.parts.filter((p) => p.nets.length).length;
  const text = caption(view, product);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-product-viewer={canvas && ready ? "live" : "still"}>
      {/* the views */}
      <div role="group" aria-label={C.viewsLabel} className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-hairline px-3 py-2 sm:px-4">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" aria-pressed={view.key === v.key} onClick={() => pick(v)} className={`group flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-lg border p-1 text-[13px] leading-tight transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${view.key === v.key ? "border-dutchOrange bg-white/5 text-primary" : "border-transparent text-secondary hover:border-hairline hover:text-primary"}`}>
            <span className="block h-[52px] w-[52px] overflow-hidden rounded-md bg-[radial-gradient(ellipse_at_50%_40%,#22262e,#0d0e11)] p-1">
              <ViewArt view={v} product={product} />
            </span>
            <span className="line-clamp-2 min-h-[2.4em] text-center">{C.views[v.key]}</span>
          </button>
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* the product */}
        <div className="relative min-w-0 flex-1 bg-[radial-gradient(ellipse_62%_58%_at_50%_46%,#2a211b_0%,#15120f_45%,#0b0c0e_82%)]">
          <div className={`absolute inset-x-0 bottom-[92px] top-[88px] flex items-center md:top-11 justify-center p-3 transition-opacity duration-500 motion-reduce:transition-none ${canvas && ready ? "opacity-0" : "opacity-100"}`} aria-hidden={canvas && ready ? true : undefined}>
            <div className={view.render ? "h-full w-full overflow-hidden rounded-xl" : "aspect-[70/105] h-full max-h-[420px]"}>
              <ViewArt view={view} product={product} still={still} big label={`${EXAMPLE.name}: ${C.views[view.key]}. ${text}`} />
            </div>
          </div>
          {canvas ? (
            <div className={`absolute inset-x-0 bottom-[92px] top-[88px] transition-opacity md:top-11 duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
              <ProductCanvas product={product} mode={mode} explode={apart} open={view.open} turning={turning && animated} pose={pose} chosen={chosen} onChoose={choose} onHover={setHovered} labels={labels} playing={seen} sharp={sharp} label={C.label(EXAMPLE.name)} onReady={() => setReady(true)} onPace={onPace} />
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
            <div className="pointer-events-auto rounded-lg bg-[#0b0c0e]/80 p-0.5 backdrop-blur-sm">
              <Segmented<ViewerMode> label={C.lookLabel} value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m, label: C.looks[m] }))} />
            </div>
            <div className="pointer-events-auto flex gap-1.5">
              <Switch label={C.turn} on={turning} onChange={setTurning} disabled={!animated} />
              <button type="button" onClick={() => setSheet(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-[#0b0c0e]/80 px-2.5 text-[13px] text-secondary hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus md:hidden">
                <List className="h-3.5 w-3.5" aria-hidden />
                {C.partsTitle}
              </button>
            </div>
          </div>
          {hovered && hovered !== chosen ? (
            <p className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-3 py-1 text-[13px] text-white" aria-hidden>
              <span className="font-mono text-dutchOrange-300">{hovered}</span> {short(product.parts.find((p) => p.ref === hovered)?.title ?? "")}
            </p>
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
            <p className="mb-2 max-w-[60ch] text-[13px] leading-snug text-secondary [text-shadow:0_1px_3px_#000]" aria-live="polite">
              <span className="font-medium text-primary">{C.views[view.key]}.</span> {text}
            </p>
            <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-[#0b0c0e]/80 px-3 py-1 backdrop-blur-sm">
              <Range label={C.apart} value={Math.round(apart * 100)} min={0} max={100} onChange={(v) => setApart(v / 100)} readout={`${Math.round(apart * 100)}%`} valueText={`${Math.round(apart * 100)} percent`} className="flex-1" />
              <button type="button" onClick={() => pick(view)} aria-label={`${C.views[view.key]}: back to this view`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline text-secondary hover:border-dutchOrange hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
                <RotateCw className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {/* its parts: beside the picture from 768 px, a sheet over its foot on a phone */}
        <div className={`z-10 flex min-h-0 flex-col border-hairline bg-[#101216] md:static md:w-[300px] md:shrink-0 md:border-l ${part || sheet ? "absolute inset-x-0 bottom-0 max-h-[56%] rounded-t-2xl border-t shadow-[0_-18px_40px_rgba(0,0,0,0.6)] md:max-h-none md:rounded-none md:border-t-0 md:shadow-none" : "hidden md:flex"}`}>
          {part ? (
            <Card part={part} product={product} onChoose={choose} onClose={() => setChosen(null)} />
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
                <label className="sr-only" htmlFor="product-part-search">{C.search}</label>
                <input id="product-part-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={C.search} className="h-9 min-w-0 flex-1 rounded-md border border-hairline bg-[#0b0c0e] px-2.5 text-[15px] text-primary placeholder:text-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus max-md:h-11" />
                <button type="button" onClick={() => setSheet(false)} aria-label={C.close} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus md:hidden">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3" data-product-parts>
                {groups.length === 0 ? <p className="px-2 py-3 text-[13px] text-secondary">{C.none}</p> : null}
                {groups.map(({ g, parts }) => (
                  <div key={g}>
                    <p className="px-2 pb-1 pt-3 text-[13px] font-medium text-muted">{C.groups[g]}</p>
                    <ul>
                      {parts.map((p) => (
                        <li key={p.ref}>
                          <button type="button" onClick={() => choose(p.ref)} onPointerEnter={() => setHovered(p.ref)} onPointerLeave={() => setHovered(null)} className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 py-1 text-left text-[13px] leading-snug text-secondary hover:bg-white/5 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus max-md:min-h-11">
                            <span className="w-10 shrink-0 font-mono text-[12px] text-dutchOrange-300">{p.ref}</span>
                            <span className="min-w-0 flex-1 truncate">{p.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <p className="sr-only">{C.alt(product.parts.length, joined)} {C.counts(product.parts.length, wires)}</p>
    </div>
  );
}
