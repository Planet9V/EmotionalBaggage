"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useItems } from "@/lib/client";
import type { CanvasPart, ShellView } from "@/components/three/ModelCanvas";
import { describeSize, toPart, type Part, type PartGeometry } from "@/components/three/layout";
import { PartPanel } from "@/components/three/PartPanel";
import { PrintPanel, type LoadedStl } from "@/components/three/PrintPanel";
import { SHELL_DEFAULTS, type ShellParams } from "@/components/three/stl";
import type { ViewProps } from "./types";

const ModelCanvas = dynamic(() => import("@/components/three/ModelCanvas"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">Loading the 3D viewer.</p>,
});

const BOM_STORE = "design/bom";
const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

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
  const { items, loading, error, patch } = useItems(project.id, BOM_STORE);
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

  const withGeometry = parts.filter((p) => p.geometry);
  const canvasParts = useMemo<CanvasPart[]>(
    () =>
      parts
        .filter((p) => p.geometry && !hidden.has(p.item.id))
        .map((p) => ({ id: p.item.id, ref: p.ref, title: p.item.title, geometry: p.geometry as PartGeometry })),
    [parts, hidden]
  );
  const selected = parts.find((p) => p.item.id === selectedId) ?? null;

  const saveGeometry = useCallback((p: Part, geometry: PartGeometry) => patch(p.item.id, { data: { geometry } }), [patch]);
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

  const uploadedForCanvas = useMemo(() => (loaded && loaded.show ? { mesh: loaded.mesh, key: loaded.key } : null), [loaded]);
  const showCanvas = withGeometry.length > 0 || uploadedForCanvas !== null;

  if (loading) return <p className="text-sm text-secondary">Loading parts.</p>;

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

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
                      onClick={() => setSelectedId(isSel ? null : p.item.id)}
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

          <div className="relative h-[560px] overflow-hidden rounded-xl border border-hairline bg-subtle">
            {showCanvas ? (
              <ModelCanvas
                parts={canvasParts}
                selectedId={selectedId}
                onSelect={setSelectedId}
                explode={explodePct / 100}
                labels={labels}
                shellView={shellView}
                shellParams={params}
                resetToken={resetToken}
                dark={dark}
                uploaded={uploadedForCanvas}
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
                  onClose={() => setSelectedId(null)}
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
