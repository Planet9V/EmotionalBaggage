"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useItems } from "@/lib/client";
import { STORE, NET_COLOR, toPart, toWire, type NetClass, type Part, type Wire } from "@/lib/domain";
import type { CanvasPart, CanvasWire, ShellView } from "@/components/three/ModelCanvas";
import { describeSize, type PartGeometry } from "@/components/three/layout";
import { PartPanel, type ConnectionRow } from "@/components/three/PartPanel";
import { PrintPanel, type LoadedStl } from "@/components/three/PrintPanel";
import { SHELL_DEFAULTS, type ShellParams } from "@/components/three/stl";
import type { ViewProps } from "./types";

const ModelCanvas = dynamic(() => import("@/components/three/ModelCanvas"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">Loading the 3D viewer.</p>,
});

const BOM_STORE = "design/bom";
const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

const CLASS_ORDER: NetClass[] = ["power", "ground", "signal", "audio"];
const CLASS_LABEL: Record<NetClass, string> = { power: "Power", ground: "Ground", signal: "Signal", audio: "Audio" };
const FADED = 0.12;
const NEIGHBOUR = 0.6;
const NO_WIRES = "No wires yet. Add them in Schematic to draw them here, pull one net apart and see a part's connections.";

const pin = (ref: string, p: string) => (p ? `${ref}.${p}` : ref);

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}
const useDark = () =>
  useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );

export function ModelView({ project }: ViewProps) {
  const { items, loading, error, writeError, patch } = useItems(project.id, BOM_STORE);
  const dark = useDark();
  const reduce = useReducedMotion();

  const parts = useMemo(() => [...items].sort((a, b) => a.sort - b.sort || a.id - b.id).map(toPart), [items]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const [explodePct, setExplodePct] = useState(0);
  const [labels, setLabels] = useState(true);
  const [shellView, setShellView] = useState<ShellView>("clear");
  const [resetToken, setResetToken] = useState(0);
  const [params, setParams] = useState<ShellParams>(SHELL_DEFAULTS);
  const [loaded, setLoaded] = useState<LoadedStl | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [sub, setSub] = useState(false);
  const [wiresOn, setWiresOn] = useState(false);
  const [classOff, setClassOff] = useState<Set<NetClass>>(() => new Set());
  const [explodeBy, setExplodeBy] = useState("");
  const wiringItems = useItems(project.id, STORE.wiring);

  const withGeometry = parts.filter((p) => p.geometry);
  const canvasParts = useMemo<CanvasPart[]>(
    () =>
      parts
        .filter((p) => p.geometry && !hidden.has(p.item.id))
        .map((p) => ({ id: p.item.id, ref: p.ref, title: p.item.title, geometry: p.geometry as PartGeometry })),
    [parts, hidden]
  );
  const selected = parts.find((p) => p.item.id === selectedId) ?? null;

  const wires = useMemo(
    () =>
      [...wiringItems.items]
        .sort((a, b) => a.sort - b.sort || a.id - b.id)
        .map(toWire)
        .filter((w): w is Wire => w !== null),
    [wiringItems.items]
  );
  const partByRef = useMemo(() => {
    const m = new Map<string, Part>();
    for (const p of parts) if (p.ref && !m.has(p.ref)) m.set(p.ref, p);
    return m;
  }, [parts]);
  const classesPresent = useMemo(() => CLASS_ORDER.filter((c) => wires.some((w) => w.netClass === c)), [wires]);
  const netsPresent = useMemo(() => [...new Set(wires.map((w) => w.net).filter(Boolean))].sort(), [wires]);

  const focus = focusId === null ? null : (parts.find((p) => p.item.id === focusId && p.geometry) ?? null);
  // A focused part that was deleted or lost its geometry simply stops being focused (focus is null).
  const focused = focus !== null;

  /** Wires that touch the focused part, as an end or in series. */
  const touching = useMemo(() => (focus && focus.ref ? wires.filter((w) => w.from === focus.ref || w.to === focus.ref || w.via === focus.ref) : []), [focus, wires]);
  const neighbourIds = useMemo(() => {
    const ids = new Set<number>();
    if (!focus) return ids;
    for (const w of touching) {
      for (const r of [w.from, w.to, w.via]) {
        const p = r ? partByRef.get(r) : undefined;
        if (p && p.item.id !== focus.item.id && p.geometry) ids.add(p.item.id);
      }
    }
    return ids;
  }, [focus, touching, partByRef]);

  const fade = useMemo<ReadonlyMap<number, number> | null>(() => {
    if (!focus) return null;
    const m = new Map<number, number>();
    for (const p of parts) {
      const id = p.item.id;
      m.set(id, id === focus.item.id ? 1 : neighbourIds.has(id) ? (sub ? 1 : NEIGHBOUR) : FADED);
    }
    return m;
  }, [focus, parts, neighbourIds, sub]);
  const focusIds = useMemo(() => (focus ? [focus.item.id, ...(sub ? [...neighbourIds] : [])] : null), [focus, sub, neighbourIds]);

  // Explode by net: only parts on the chosen class or net move with the slider.
  const explodeByValid = explodeBy.startsWith("class:") ? classesPresent.includes(explodeBy.slice(6) as NetClass) : explodeBy.startsWith("net:") ? netsPresent.includes(explodeBy.slice(4)) : false;
  const weights = useMemo<ReadonlyMap<number, number> | null>(() => {
    if (!explodeByValid) return null;
    const match = (w: Wire) => (explodeBy.startsWith("class:") ? w.netClass === explodeBy.slice(6) : w.net === explodeBy.slice(4));
    const refs = new Set<string>();
    for (const w of wires) if (match(w)) for (const r of [w.from, w.to, w.via]) if (r) refs.add(r);
    return new Map(parts.map((p) => [p.item.id, p.ref && refs.has(p.ref) ? 1 : 0]));
  }, [explodeByValid, explodeBy, wires, parts]);

  // Wires that can be drawn, and why the rest cannot.
  const wirePlan = useMemo(() => {
    const draw: CanvasWire[] = [];
    let noGeometry = 0;
    let unknown = 0;
    let hiddenEnd = 0;
    for (const w of wires) {
      const a = partByRef.get(w.from);
      const b = partByRef.get(w.to);
      if (!a || !b) unknown++;
      else if (!a.geometry || !b.geometry) noGeometry++;
      else if (hidden.has(a.item.id) || hidden.has(b.item.id)) hiddenEnd++;
      else if (!classOff.has(w.netClass)) {
        draw.push({
          id: w.item.id,
          name: w.name || w.net || "Wire",
          ends: `${pin(w.from, w.fromPin)} \u2192 ${pin(w.to, w.toPin)}${w.via ? ` via ${w.via}` : ""}`,
          color: NET_COLOR[w.netClass],
          a: a.item.id,
          b: b.item.id,
          via: w.via,
        });
      }
    }
    const reasons: [number, string][] = [
      [noGeometry, "a part has no geometry"],
      [unknown, "a part is not in the bill of materials"],
      [hiddenEnd, "a part is hidden"],
    ];
    const active = reasons.filter(([n]) => n > 0);
    const total = noGeometry + unknown + hiddenEnd;
    const note =
      total === 0
        ? ""
        : active.length === 1
          ? `${total} wire${total === 1 ? "" : "s"} not drawn: ${active[0][1]}.`
          : `${total} wires not drawn: ${active.map(([n, r]) => `${n} where ${r}`).join(", ")}.`;
    return { draw, note };
  }, [wires, partByRef, hidden, classOff]);

  const connections = useMemo<ConnectionRow[]>(() => {
    if (!focus) return [];
    return touching.map((w) => {
      const end = w.from === focus.ref || w.to === focus.ref;
      const fromSide = w.from === focus.ref;
      const otherRef = end ? (fromSide ? w.to : w.from) : "";
      const other = otherRef ? partByRef.get(otherRef) : undefined;
      return {
        key: w.item.id,
        pin: end ? (fromSide ? w.fromPin : w.toPin) : "",
        otherRef,
        otherPin: end ? (fromSide ? w.toPin : w.fromPin) : "",
        otherTitle: other ? other.item.title : otherRef ? "Not in the bill of materials" : "",
        otherId: other && other.geometry ? other.item.id : null,
        net: w.net,
        color: NET_COLOR[w.netClass],
        via: end ? w.via : "",
        status: w.status,
        series: end ? "" : `In series: ${pin(w.from, w.fromPin)} \u2192 ${pin(w.to, w.toPin)}`,
      };
    });
  }, [focus, touching, partByRef]);

  // A failed save is shown in the error line (writeError) and the part goes back to its saved geometry.
  const saveGeometry = useCallback((p: Part, geometry: PartGeometry) => patch(p.item.id, { data: { geometry } }).catch(() => undefined), [patch]);
  const togglePrint = useCallback(
    (p: Part, v: boolean) => {
      if (!p.geometry) return;
      const geometry: PartGeometry = { ...p.geometry };
      if (v) geometry.print = true;
      else delete geometry.print;
      void patch(p.item.id, { data: { geometry } });
    },
    [patch]
  );
  const toggleHidden = (id: number) =>
    setHidden((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /** Assembled and Exploded also re-frame the camera so the whole model is in view. */
  const showAt = (pct: number) => {
    setExplodePct(pct);
    setResetToken((n) => n + 1);
  };

  /** Choosing a part while focused moves the focus with it. */
  const choose = useCallback((id: number | null) => {
    setSelectedId(id);
    setFocusId((f) => (f === null ? f : id));
  }, []);
  const focusOn = useCallback(
    (id: number) => {
      const p = parts.find((x) => x.item.id === id);
      if (!p?.geometry) return;
      setSelectedId(id);
      setFocusId(id);
      setHidden((h) => {
        if (!h.has(id)) return h;
        const n = new Set(h);
        n.delete(id);
        return n;
      });
    },
    [parts]
  );
  const exitFocus = useCallback(() => {
    setFocusId(null);
    setSub(false);
  }, []);
  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      exitFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, exitFocus]);

  const uploadedForCanvas = useMemo(() => (loaded && loaded.show ? { mesh: loaded.mesh, key: loaded.key } : null), [loaded]);
  const showCanvas = withGeometry.length > 0 || uploadedForCanvas !== null;

  if (loading) return <p className="text-sm text-secondary">Loading parts.</p>;

  return (
    <div className="flex flex-col gap-6">
      {(error || writeError) && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error || writeError}</p>}

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        {/* Parts list */}
        <aside className="order-2 rounded-xl border border-hairline bg-surface p-3 xl:order-1">
          <div className="flex items-baseline justify-between px-1">
            <p className={eyebrow}>Parts</p>
            <span className="font-mono text-[10px] text-muted">
              {withGeometry.length}/{parts.length} placed
            </span>
          </div>
          {parts.length === 0 ? (
            <p className="mt-3 px-1 text-sm text-muted">
              No parts yet. Add them in{" "}
              <Link href="/s/design/bom" className="text-link hover:underline">
                Bill of materials
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-2 flex max-h-[560px] flex-col gap-0.5 overflow-y-auto">
              {parts.map((p) => {
                const isSel = p.item.id === selectedId;
                const off = hidden.has(p.item.id);
                return (
                  <li key={p.item.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => choose(isSel ? null : p.item.id)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" || !p.geometry) return;
                        // Enter focuses the part; a click or Space still just selects it.
                        e.preventDefault();
                        focusOn(p.item.id);
                      }}
                      aria-pressed={isSel}
                      className={`min-w-0 flex-1 rounded-md border px-2 py-1.5 text-left transition-colors duration-150 ${
                        isSel ? "border-dutchOrange/40 bg-dutchOrange/10" : "border-transparent hover:bg-subtle"
                      }`}
                    >
                      <span className="block truncate text-sm text-primary">
                        {p.ref && <span className="mr-1 font-mono text-[11px] text-link">{p.ref} </span>}
                        {p.item.title}
                      </span>
                      <span className={`block truncate font-mono text-[10px] ${p.geometry ? "text-muted" : "text-warning"}`}>
                        {p.geometry ? `${p.geometry.shape} · ${describeSize(p.geometry)}${p.geometry.print ? " · printed" : ""}` : "No geometry yet"}
                      </span>
                    </button>
                    {p.geometry && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label={off ? `Show ${p.item.title}` : `Hide ${p.item.title}`}
                        aria-pressed={!off}
                        onClick={() => toggleHidden(p.item.id)}
                      >
                        {off ? <EyeOff className="h-3.5 w-3.5 text-muted" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Canvas */}
        <section className="order-1 flex min-w-0 flex-col gap-2 xl:order-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-hairline bg-surface p-0.5">
              <Button size="sm" variant={explodePct === 0 ? "subtle" : "ghost"} className="h-7" onClick={() => showAt(0)} disabled={!showCanvas}>
                Assembled
              </Button>
              <Button size="sm" variant={explodePct === 100 ? "subtle" : "ghost"} className="h-7" onClick={() => showAt(100)} disabled={!showCanvas}>
                Exploded
              </Button>
            </div>
            <label className="flex min-w-[180px] flex-1 items-center gap-2">
              <span className="sr-only">Explode amount</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={explodePct}
                disabled={!showCanvas}
                onChange={(e) => setExplodePct(Number(e.target.value))}
                className="h-1 flex-1 accent-[#E05A10]"
                aria-valuetext={`${explodePct}% exploded`}
              />
              <span className="w-10 text-right font-mono text-xs text-secondary">{explodePct}%</span>
            </label>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setResetToken((n) => n + 1)} disabled={!showCanvas}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset camera
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={wiresOn ? "subtle" : "outline"}
              className="h-8"
              aria-pressed={wiresOn}
              disabled={!showCanvas || wires.length === 0}
              onClick={() => setWiresOn((v) => !v)}
            >
              Wires {wiresOn ? "on" : "off"}
            </Button>
            {wiresOn &&
              classesPresent.map((c) => {
                const on = !classOff.has(c);
                return (
                  <Button
                    key={c}
                    size="chip"
                    variant="outline"
                    aria-pressed={on}
                    className={on ? "" : "opacity-60"}
                    onClick={() =>
                      setClassOff((s) => {
                        const n = new Set(s);
                        if (n.has(c)) n.delete(c);
                        else n.add(c);
                        return n;
                      })
                    }
                  >
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: NET_COLOR[c] }} />
                    {CLASS_LABEL[c]}
                  </Button>
                );
              })}
            <label className="ml-auto flex items-center gap-2 text-xs text-secondary">
              Explode by net
              <select
                className="h-8 rounded-md border border-hairline bg-surface px-2 text-xs text-primary focus-visible:border-dutchOrange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dutchOrange disabled:opacity-40"
                value={explodeByValid ? explodeBy : ""}
                disabled={!showCanvas || wires.length === 0}
                onChange={(e) => setExplodeBy(e.target.value)}
              >
                <option value="">All parts</option>
                {classesPresent.length > 0 && (
                  <optgroup label="Net class">
                    {classesPresent.map((c) => (
                      <option key={c} value={`class:${c}`}>
                        {CLASS_LABEL[c]}
                      </option>
                    ))}
                  </optgroup>
                )}
                {netsPresent.length > 0 && (
                  <optgroup label="Net">
                    {netsPresent.map((n) => (
                      <option key={n} value={`net:${n}`}>
                        {n}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
          </div>
          {!wiringItems.loading && wires.length === 0 && parts.length > 0 && <p className="text-xs text-muted">{NO_WIRES}</p>}
          {wiresOn && wirePlan.note && <p className="text-xs text-warning">{wirePlan.note}</p>}

          {focus && (
            <nav aria-label="Focus" className="flex flex-wrap items-center gap-1 text-sm">
              <button type="button" className="text-link hover:underline" onClick={exitFocus}>
                Whole product
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden />
              <span className="font-medium text-primary">
                {focus.ref && <span className="mr-1 font-mono text-xs text-link">{focus.ref}</span>}
                {focus.item.title}
                {sub && neighbourIds.size > 0 ? <span className="ml-1 text-xs font-normal text-muted">and {neighbourIds.size} wired to it</span> : null}
              </span>
              <span className="ml-auto font-mono text-[10px] text-muted">Esc to go back</span>
            </nav>
          )}

          <div className="relative h-[560px] overflow-hidden rounded-xl border border-hairline bg-subtle">
            {showCanvas ? (
              <ModelCanvas
                parts={canvasParts}
                selectedId={selectedId}
                onSelect={choose}
                explode={explodePct / 100}
                labels={labels}
                shellView={shellView}
                shellParams={params}
                resetToken={resetToken}
                dark={dark}
                uploaded={uploadedForCanvas}
                wires={wirePlan.draw}
                wiresOn={wiresOn}
                fade={fade}
                weights={weights}
                focusIds={focusIds}
                onFocusPart={focusOn}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
                <p className={eyebrow}>Nothing to show yet</p>
                <p className="max-w-md text-sm text-secondary">
                  {parts.length === 0 ? (
                    <>
                      Add parts in{" "}
                      <Link href="/s/design/bom" className="text-link hover:underline">
                        Bill of materials
                      </Link>
                      , then come back and give each one a shape and size here. Use an enclosure shell for the case.
                    </>
                  ) : (
                    <>Pick a part in the list and add its geometry: a shape, a size in mm and where it sits. Use an enclosure shell for the case.</>
                  )}
                </p>
                <p className="max-w-md text-xs text-muted">You can also load an existing STL below to view it here.</p>
              </div>
            )}
            {showCanvas && (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2">
                <p className="font-mono text-[10px] text-muted">mm · grid 10 / 50 · drag to orbit, scroll to zoom, right drag to pan</p>
                <div className="pointer-events-auto flex gap-1.5">
                  <Button size="chip" variant="outline" onClick={() => setLabels((v) => !v)} aria-pressed={labels}>
                    Labels {labels ? "on" : "off"}
                  </Button>
                  <Button size="chip" variant="outline" onClick={() => setShellView((v) => (v === "clear" ? "solid" : "clear"))}>
                    Shell {shellView === "clear" ? "see-through" : "solid"}
                  </Button>
                </div>
              </div>
            )}
          </div>
          {canvasParts.length > 0 && hidden.size > 0 && (
            <p className="text-xs text-muted">
              {hidden.size} hidden.{" "}
              <button type="button" className="text-link hover:underline" onClick={() => setHidden(new Set())}>
                Show all
              </button>
            </p>
          )}
        </section>

        {/* Side panel */}
        <aside className="order-3 rounded-xl border border-hairline bg-surface p-4">
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div
                key={selected.item.id}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <PartPanel
                  part={selected}
                  onClose={() => {
                    choose(null);
                    exitFocus();
                  }}
                  focus={{
                    focused: focus !== null && focus.item.id === selected.item.id,
                    sub,
                    reason: selected.geometry ? "" : "Add geometry below to focus this part.",
                    onFocus: () => focusOn(selected.item.id),
                    onExit: exitFocus,
                    onToggleSub: setSub,
                    connections,
                    onOpenPart: focusOn,
                  }}
                  onSave={(g) => saveGeometry(selected, g)}
                  onTogglePrint={(v) => togglePrint(selected, v)}
                />
              </motion.div>
            ) : (
              <motion.div key="none" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <p className={eyebrow}>Part details</p>
                <p className="mt-2 text-sm text-secondary">Click a part in the model or the list to see its spec, cost, size and where that size comes from.</p>
                <p className="mt-2 text-sm text-secondary">Parts without geometry can be given a shape and size here, so the model works for any concept.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>

      <PrintPanel
        projectId={project.id}
        parts={parts}
        params={params}
        setParams={setParams}
        onTogglePrint={togglePrint}
        loaded={loaded}
        setLoaded={(l) => {
          setLoaded(l);
          if (l && l.show && l.key !== loaded?.key) setResetToken((n) => n + 1);
        }}
      />
    </div>
  );
}
