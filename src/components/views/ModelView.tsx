"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronRight, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api, useItems } from "@/lib/client";
import { keys } from "@/lib/queries";
import { STORE, NET_COLOR, toPart, type NetClass, type Part } from "@/lib/domain";
import type { CutPlane, Measurement, ShellView, TransformMode } from "@/components/three/ModelCanvas";
import { describeSize, sceneBounds, type PartGeometry } from "@/components/three/layout";
import { EditBar, ExportBar, MeasureReadout, PartsTable, RoutePanel, SectionPanel, type RouteState } from "@/components/three/ViewTools";
import { useShapes } from "@/lib/geometry/useShapes";
import { assembly3mf, assemblyStl, type ExportPart } from "@/lib/geometry/export";
import type { RouteOutcome } from "@/lib/geometry/routing";
import { PartPanel } from "@/components/three/PartPanel";
import { PrintPanel, type LoadedStl } from "@/components/three/PrintPanel";
import { SHELL_DEFAULTS, type ShellParams } from "@/components/three/stl";
import { RenderToImagery } from "@/components/market/RenderToImagery";
import type { ViewProps } from "./types";
import { useSceneModel } from "./model/useSceneModel";
import { useGeometryEdits } from "./model/useGeometryEdits";
import { NativeSelect } from "@/components/ui/native-select";
import { downloadFile } from "@/lib/download";
import { fileSlug } from "@/lib/format";
import { LoadingBlocks } from "@/components/ui/states";
import { Card } from "@/components/ui/Card";

const ModelCanvas = dynamic(() => import("@/components/three/ModelCanvas"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">Loading the 3D viewer.</p>,
});

const BOM_STORE = "design/bom";
const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

const CLASS_LABEL: Record<NetClass, string> = { power: "Power", ground: "Ground", signal: "Signal", audio: "Audio" };
const NO_WIRES = "No wires yet. Add them in Schematic to draw them here, pull one net apart and see a part's connections.";

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
  // the canvas hands out a function that draws the scene once as a PNG (Imagery, plan 8.7)
  const [capture, setCapture] = useState<(() => string) | null>(null);
  const onCaptureReady = useCallback((fn: (() => string) | null) => setCapture(() => fn), []);
  const [sub, setSub] = useState(false);
  const [wiresOn, setWiresOn] = useState(false);
  const [classOff, setClassOff] = useState<Set<NetClass>>(() => new Set());
  const [explodeBy, setExplodeBy] = useState("");
  const wiringItems = useItems(project.id, STORE.wiring);
  const qc = useQueryClient();
  const [mode, setMode] = useState<TransformMode>("translate");
  const [measure, setMeasure] = useState(false);
  const [measurement, setMeasurement] = useState<Measurement>(null);
  const [cut, setCut] = useState<CutPlane[]>(() => (["x", "y", "z"] as const).map((axis) => ({ axis, on: false, pos: 0, flip: false })));
  const [routeCell, setRouteCell] = useState(2);
  const [route, setRoute] = useState<RouteState>({ state: "idle" });
  const [exportBusy, setExportBusy] = useState("");
  const [exportError, setExportError] = useState("");

  const withGeometry = parts.filter((p) => p.geometry);
  const shapeFiles = useShapes(parts.map((p) => ({ id: p.item.id, geometry: p.geometry })));
  const selected = parts.find((p) => p.item.id === selectedId) ?? null;
  const scene = useSceneModel({ parts, hidden, shapes: shapeFiles.shapes, wireItems: wiringItems.items, focusId, sub, explodeBy, routeCell, explodePct, classOff });
  const { canvasParts, wires, classesPresent, netsPresent, focus, focused, neighbourIds, explodeByValid, fade, focusIds, weights, routeCounts, wirePlan, connections } = scene;
  const { saveGeometry, undo, redo, onTransform, onCanvasKey, history } = useGeometryEdits({ parts, patch, selectedId });

  const exportParts = useMemo<ExportPart[]>(
    () => canvasParts.map((c) => ({ id: c.id, ref: c.ref, title: c.title, geometry: c.geometry, shape: c.shape })),
    [canvasParts]
  );
  const runExport = async (what: "assembly" | "part", format: "stl" | "3mf") => {
    setExportError("");
    const only = what === "part" ? selectedId ?? undefined : undefined;
    if (what === "part" && only === undefined) return;
    setExportBusy(`${what === "part" ? "the part" : "the assembly"} as ${format.toUpperCase()}`);
    try {
      const buf = format === "stl" ? assemblyStl(exportParts, params, only) : await assembly3mf(exportParts, params, only);
      const sel = only !== undefined ? parts.find((x) => x.item.id === only) : null;
      const name = `${fileSlug(project.id, "model")}-${sel ? fileSlug(sel.ref || sel.item.title, "model") : "assembly"}.${format}`;
      downloadFile(name, buf, format === "stl" ? "model/stl" : "model/3mf");
    } catch (e) {
      setExportError(`Could not write the file: ${(e as Error).message}`);
    } finally {
      setExportBusy("");
    }
  };

  const doRoute = async () => {
    setRoute({ state: "running" });
    const t0 = performance.now();
    try {
      const outcome = await api<RouteOutcome>(`/api/projects/${encodeURIComponent(project.id)}/route-wires`, {
        method: "POST",
        body: JSON.stringify({ cell: routeCell, wallMm: params.wallMm }),
      });
      await Promise.all([qc.invalidateQueries({ queryKey: keys.itemsOf(project.id) }), qc.invalidateQueries({ queryKey: keys.events(project.id) })]);
      setRoute({ state: "done", outcome, totalMs: performance.now() - t0 });
      setWiresOn(true);
    } catch (e) {
      setRoute({ state: "error", message: (e as Error).message });
    }
  };
  const sceneBox = useMemo(() => sceneBounds(canvasParts.map((c) => c.geometry), false), [canvasParts]);
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

  if (loading) return <LoadingBlocks rows={2} label="Loading parts" />;

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
              <NativeSelect
                className="h-8 w-auto text-xs"
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
              </NativeSelect>
            </label>
          </div>
          <RoutePanel
            cell={routeCell}
            onCell={setRouteCell}
            onRoute={() => void doRoute()}
            result={route}
            canRoute={showCanvas && wires.length > 0 && withGeometry.length > 1}
            why={wires.length === 0 ? "Wires come from the Schematic. Add some to route them." : withGeometry.length < 2 ? "Give at least two parts a shape and position first." : ""}
            counts={routeCounts}
          />
          {!wiringItems.loading && wires.length === 0 && parts.length > 0 && <p className="text-xs text-muted">{NO_WIRES}</p>}
          {wiresOn && wirePlan.note && <p className="text-xs text-warning">{wirePlan.note}</p>}
          {wiresOn && wirePlan.draw.length > 0 && <p className="text-xs text-muted">{wirePlan.draw.length} wire{wirePlan.draw.length === 1 ? " is" : "s are"} drawn as straight curves between part centres: {explodePct === 0 ? "not routed yet, or the route is out of date." : "the exploded view does not show routes."}</p>}
          <EditBar
            mode={mode}
            onMode={setMode}
            measure={measure}
            onMeasure={setMeasure}
            canUndo={history.undo > 0}
            canRedo={history.redo > 0}
            onUndo={undo}
            onRedo={redo}
            selectedLabel={selected && selected.geometry ? selected.ref || selected.item.title : ""}
            disabled={!showCanvas}
            exploded={explodePct > 0}
          />
          <SectionPanel cut={cut} bounds={sceneBox} onChange={setCut} />

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

          <Card variant="well" className="relative h-[560px] overflow-hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
 tabIndex={showCanvas ? 0 : -1}
 role="group"
 aria-label="3D model"
 aria-describedby="model-keys"
 aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown R Control+Z"
 onKeyDown={onCanvasKey}>
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
                onCaptureReady={onCaptureReady}
                transform={mode}
                onTransform={onTransform}
                section={cut}
                measure={measure}
                onMeasure={setMeasurement}
                routed={wirePlan.routed}
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
                <p className="font-mono text-[10px] text-muted">mm · grid 10 / 50 · drag to orbit, scroll to zoom, right drag to pan · arrow keys nudge the selected part</p>
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
          </Card>
          <p id="model-keys" className="sr-only">
            With a part selected and this area focused: arrow keys move it 1 mm in x and z, Shift for 10 mm, Page Up and Page Down move it in y, R turns it 15 degrees about y, Control Z undoes.
          </p>
          <MeasureReadout m={measurement} onClear={() => setMeasure(false)} />
          {showCanvas && <ExportBar selectedLabel={selected && selected.geometry ? selected.ref || selected.item.title : ""} busy={exportBusy} error={exportError} onExport={(w, f) => void runExport(w, f)} />}
          {showCanvas && (
            <PartsTable
              rows={parts.map((p) => ({ id: p.item.id, ref: p.ref, title: p.item.title, geometry: p.geometry, selected: p.item.id === selectedId }))}
              onSelect={(id) => choose(id)}
            />
          )}
          {showCanvas && <RenderToImagery projectId={project.id} capture={capture} />}
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
            {selected ? (
              <div className="animate-enter" key={selected.item.id}>
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
                  projectId={project.id}
                  shapeStatus={shapeFiles.status.get(selected.item.id)}
                  onSave={(g) => saveGeometry(selected, g)}
                  onTogglePrint={(v) => togglePrint(selected, v)}
                />
              </div>
            ) : (
              <div className="animate-enter" key="none">
                <p className={eyebrow}>Part details</p>
                <p className="mt-2 text-sm text-secondary">Click a part in the model or the list to see its spec, cost, size and where that size comes from.</p>
                <p className="mt-2 text-sm text-secondary">Parts without geometry can be given a shape and size here, so the model works for any concept.</p>
              </div>
            )}
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
