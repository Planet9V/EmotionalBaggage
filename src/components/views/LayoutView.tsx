"use client";

/**
 * Design > Physical layout: a 2D drag-and-drop editor for where each part sits inside the envelope.
 * It edits data.geometry on the BOM parts, the same data the 3D model draws.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, useFilesChanged, useItems } from "@/lib/client";
import { toPart } from "@/lib/domain";
import type { PartGeometry } from "@/components/three/layout";
import { ChecksPanel, type NoGeometry } from "@/components/layout/ChecksPanel";
import { EnvelopePanel } from "@/components/layout/EnvelopePanel";
import { PartsTray } from "@/components/layout/PartsTray";
import { SelectionPanel } from "@/components/layout/SelectionPanel";
import { ThreeView, type Marker } from "@/components/layout/ThreeView";
import { buildSheet, readPalette } from "@/components/layout/export";
import {
  boxOf,
  floorLevel,
  runChecks,
  round3,
  snapTo,
  VIEW_DEFS,
  VIEW_ORDER,
  type Draft,
  type LayoutPart,
  type ViewKey,
} from "@/components/layout/geom";
import type { ViewProps } from "./types";
import { NativeSelect } from "@/components/ui/native-select";
import { downloadFile } from "@/lib/download";
import { fileSlug } from "@/lib/format";
import { LoadingBlocks } from "@/components/ui/states";
import { Card } from "@/components/ui/Card";

const BOM_STORE = "design/bom";
const SNAP_STEPS = [0.5, 1, 5];
const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";


export function LayoutView({ project }: ViewProps) {
  const { items, loading, error, add, patch } = useItems(project.id, BOM_STORE);
  const filesChanged = useFilesChanged(project.id);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [live, setLive] = useState<{ id: number; pos: number[] } | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [snapOn, setSnapOn] = useState(true);
  const [step, setStep] = useState(1);
  const [wall, setWall] = useState(2);
  const [activeView, setActiveView] = useState<ViewKey>("top");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parts = useMemo(() => [...items].sort((a, b) => a.sort - b.sort || a.id - b.id).map(toPart), [items]);
  const labelOf = (p: { ref: string; item: { title: string } }) => p.ref || p.item.title;

  // Parts with geometry, with the dragged one at its live position.
  const placed = useMemo(() => {
    const out: LayoutPart[] = [];
    for (const p of parts) {
      if (!p.geometry) continue;
      const g: PartGeometry = live && live.id === p.item.id ? { ...p.geometry, pos: live.pos } : p.geometry;
      out.push({ id: p.item.id, ref: p.ref, label: labelOf(p), geometry: g });
    }
    return out;
  }, [parts, live]);

  const shells = useMemo(() => placed.filter((p) => p.geometry.shape === "shell"), [placed]);
  const bodies = useMemo(() => placed.filter((p) => p.geometry.shape !== "shell"), [placed]);
  const shell = shells[0] ?? null;
  const floor = floorLevel(shell?.geometry ?? null, wall);
  const checks = useMemo(() => runChecks(bodies, shell?.geometry ?? null, wall), [bodies, shell, wall]);

  const noGeometry = useMemo<NoGeometry[]>(() => parts.filter((p) => !p.geometry).map((p) => ({ id: p.item.id, label: labelOf(p) })), [parts]);
  const tray = useMemo(
    () => parts.filter((p) => !p.geometry).map((p) => ({ id: p.item.id, label: labelOf(p), title: p.item.title, placing: !!drafts[p.item.id] })),
    [parts, drafts]
  );
  const markers = useMemo<Marker[]>(
    () =>
      parts
        .filter((p) => !p.geometry && drafts[p.item.id])
        .map((p) => {
          const d = drafts[p.item.id];
          return { id: p.item.id, label: labelOf(p), pos: [d.x, d.y ?? floor, d.z] };
        }),
    [parts, drafts, floor]
  );

  const selected = parts.find((p) => p.item.id === selectedId) ?? null;
  const selectedLive = selected ? placed.find((p) => p.id === selected.item.id) ?? null : null;
  const centre: [number, number] = shell
    ? (() => {
        const b = boxOf(shell.geometry);
        return [round3((b.min[0] + b.max[0]) / 2), round3((b.min[2] + b.max[2]) / 2)];
      })()
    : [0, 0];

  const fail = (e: unknown) => setNotice({ tone: "error", text: (e as Error).message || "That did not save." });

  const saveGeometry = useCallback(
    async (id: number, geometry: PartGeometry) => {
      try {
        await patch(id, { data: { geometry } });
      } catch (e) {
        fail(e);
      }
    },
    [patch]
  );

  const commitPos = useCallback(
    (id: number, pos: number[]) => {
      const p = parts.find((x) => x.item.id === id);
      setLive(null);
      if (p?.geometry) void saveGeometry(id, { ...p.geometry, pos: pos.map(round3) });
    },
    [parts, saveGeometry]
  );

  // Arrow keys nudge the selected part in the last view you touched. One save after the keys stop.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, select, textarea, button, a")) return;
    if (!selectedLive || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const v = VIEW_DEFS[activeView];
    const k = (e.shiftKey ? 10 : 1) * step;
    const base = live && live.id === selectedLive.id ? live.pos : selectedLive.geometry.pos;
    const next = [...base];
    if (e.key === "ArrowLeft") next[v.h] -= k;
    if (e.key === "ArrowRight") next[v.h] += k;
    // On screen up is -y of the drawing: in Top that is -z, in Front and Side it is +y.
    if (e.key === "ArrowUp") next[v.v] += v.flip ? k : -k;
    if (e.key === "ArrowDown") next[v.v] += v.flip ? -k : k;
    next[v.h] = snapOn ? snapTo(next[v.h], step) : round3(next[v.h]);
    next[v.v] = snapOn ? snapTo(next[v.v], step) : round3(next[v.v]);
    setLive({ id: selectedLive.id, pos: next });
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    const id = selectedLive.id;
    nudgeTimer.current = setTimeout(() => commitPos(id, next), 350);
  };
  useEffect(() => () => { if (nudgeTimer.current) clearTimeout(nudgeTimer.current); }, []);

  // Placing from the tray
  const startDraft = (id: number, x = 0, z = 0) => {
    setDrafts((d) => ({ ...d, [id]: d[id] ? { ...d[id], x, z } : { size: [null, null, null], basis: "", x, y: null, z } }));
    setSelectedId(id);
  };

  const updateDraft = (id: number, change: Partial<Draft>) => {
    const cur = drafts[id];
    if (!cur) return;
    const next = { ...cur, ...change };
    const sizes = next.size;
    if (sizes.every((s) => s !== null && s > 0) && next.basis) {
      const sz = sizes as number[];
      const y = next.y ?? floor + sz[1] / 2;
      const geometry: PartGeometry = { shape: "box", size: sz, pos: [next.x, y, next.z].map(round3), explode: [0, 0, 0], basis: next.basis };
      setDrafts((d) => {
        const { [id]: _gone, ...rest } = d;
        void _gone;
        return rest;
      });
      void saveGeometry(id, geometry);
      return;
    }
    setDrafts((d) => ({ ...d, [id]: next }));
  };
  const cancelDraft = (id: number) =>
    setDrafts((d) => {
      const { [id]: _gone, ...rest } = d;
      void _gone;
      return rest;
    });

  const createEnclosure = async (size: number[], basis: "doc" | "typical") => {
    const refs = new Set(parts.map((p) => p.ref));
    let n = 1;
    while (refs.has(`ENC${n}`)) n++;
    const geometry: PartGeometry = { shape: "shell", size, pos: [0, size[1] / 2, 0], explode: [0, 0, 0], basis, print: true };
    try {
      await add({
        section: BOM_STORE,
        title: "Enclosure",
        status: "to print",
        data: { ref: `ENC${n}`, qty: 1, source: "Own printer", search: "", asin: "", geometry },
      });
      setNotice(null);
    } catch (e) {
      fail(e);
    }
  };

  const resizeShell = (size: number[]) => {
    if (!shell) return;
    const g = shell.geometry;
    const bottom = boxOf(g).min[1];
    void saveGeometry(shell.id, { ...g, size, pos: [g.pos[0], round3(bottom + size[1] / 2), g.pos[2]] });
  };

  // Export
  const sheet = () =>
    buildSheet({
      conceptName: project.name,
      parts: bodies,
      shells,
      wall,
      overlapping: checks.overlapping,
      palette: readPalette(),
      date: new Date().toLocaleDateString("en-CA"),
    });
  const fileName = () => `${fileSlug(project.name)}-physical-layout.svg`;

  const download = () => {
    const s = sheet();
    if (!s) return;
    downloadFile(fileName(), s.svg, "image/svg+xml");
  };

  const saveToConcept = async () => {
    const s = sheet();
    if (!s) return;
    setSaving(true);
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", new File([s.svg], fileName(), { type: "image/svg+xml" }));
      form.append("kind", "layout");
      form.append("meta", JSON.stringify({ title: "Physical layout", scale: s.scaleNote, wall, parts: bodies.length }));
      await api(`/api/projects/${project.id}/files`, { method: "POST", body: form });
      void filesChanged();
      setNotice({ tone: "ok", text: `Saved ${fileName()} to this concept.` });
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlocks rows={2} label="Loading parts" />;

  const hasGeometry = placed.length > 0 || markers.length > 0;
  const anyParts = bodies.length > 0;

  const viewProps = (key: ViewKey, heightClass: string) => ({
    view: VIEW_DEFS[key],
    parts: bodies,
    shells,
    markers,
    wall,
    floor,
    selectedId,
    overlapping: checks.overlapping,
    snapOn,
    step,
    heightClass,
    onSelect: setSelectedId,
    onActivate: () => setActiveView(key),
    onMove: (id: number, pos: number[]) => setLive({ id, pos }),
    onCommit: commitPos,
    onDropDraft: key === "top" ? (id: number, x: number, z: number) => startDraft(id, x, z) : undefined,
  });

  return (
    <div className="flex flex-col gap-4 outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange" tabIndex={0} onKeyDown={onKeyDown}>
      {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      {notice && (
        <p role="status" className={`rounded-md px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {notice.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-hairline bg-surface p-0.5 lg:hidden" role="group" aria-label="Choose a view">
          {VIEW_ORDER.map((k) => (
            <Button key={k} size="sm" className="h-7" variant={activeView === k ? "subtle" : "ghost"} aria-pressed={activeView === k} onClick={() => setActiveView(k)}>
              {VIEW_DEFS[k].label}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-secondary">
          <input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} className="accent-[#E05A10]" />
          Snap to grid
        </label>
        <label className="flex items-center gap-2 text-xs text-secondary">
          <span className="sr-only">Snap step</span>
          <NativeSelect className="h-8 w-auto text-xs" value={step} onChange={(e) => setStep(Number(e.target.value))} aria-label="Snap step in mm">
            {SNAP_STEPS.map((s) => (
              <option key={s} value={s}>{s} mm</option>
            ))}
          </NativeSelect>
        </label>
        <span className="hidden text-xs text-muted md:inline">Drag a part to move it. Arrow keys nudge by the snap step, Shift for 10 times.</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={download} disabled={!hasGeometry}>
            <Download className="h-3.5 w-3.5" /> Download layout SVG
          </Button>
          <Button size="sm" variant="outline" onClick={saveToConcept} disabled={!hasGeometry || saving}>
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving" : "Save to concept"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <div className="order-2 flex flex-col gap-4 xl:order-1">
          <EnvelopePanel
            shell={shell?.geometry ?? null}
            label={shell?.label ?? ""}
            wall={wall}
            onWall={setWall}
            onResize={resizeShell}
            onCreate={createEnclosure}
          />
          <PartsTray parts={tray} selectedId={selectedId} onPlace={(id) => startDraft(id)} onSelect={setSelectedId} />
        </div>

        <section className="order-1 min-w-0 xl:order-2" aria-label="Layout views">
          {!hasGeometry ? (
            <div className="flex min-h-[320px] flex-col items-start justify-center gap-2 rounded-xl border border-dashed border-hairline bg-subtle p-8">
              <p className={eyebrow}>Nothing to lay out yet</p>
              <h2 className="text-lg font-semibold tracking-tight text-primary">Start with the enclosure, then place parts</h2>
              <p className="max-w-lg text-sm text-secondary">
                Give the enclosure its outer size under Envelope. Then drag parts from the tray onto the Top view and enter their sizes. Parts you add in the bill of materials show up in the tray.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className={`${activeView === "top" ? "block" : "hidden"} lg:row-span-2 lg:block`}>
                <ThreeView {...viewProps("top", "h-[420px] lg:h-[564px]")} />
              </div>
              <div className={`${activeView === "front" ? "block" : "hidden"} lg:block`}>
                <ThreeView {...viewProps("front", "h-[420px] lg:h-[276px]")} />
              </div>
              <div className={`${activeView === "side" ? "block" : "hidden"} lg:block`}>
                <ThreeView {...viewProps("side", "h-[420px] lg:h-[276px]")} />
              </div>
            </div>
          )}
          {hasGeometry && !anyParts && shell && (
            <p className="mt-2 text-sm text-muted">The enclosure is drawn. Parts with geometry will appear inside it.</p>
          )}
        </section>

        <aside className="order-3 flex flex-col gap-4">
          <Card variant="flat" as="section" aria-label="Selected part" className="p-4">
            <p className={`${eyebrow} mb-2`}>Selected part</p>
            {selected ? (
              <SelectionPanel
                key={selected.item.id}
                item={selected.item}
                geometry={selectedLive?.geometry ?? null}
                draft={drafts[selected.item.id] ?? null}
                floor={floor}
                centre={centre}
                onGeometry={(g) => void saveGeometry(selected.item.id, g)}
                onDraft={(c) => updateDraft(selected.item.id, c)}
                onCancelDraft={() => cancelDraft(selected.item.id)}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <p className="text-sm text-muted">
                {anyParts ? "Click a part in any view to edit it." : "Select a part to edit its size and position."}
              </p>
            )}
          </Card>
          <ChecksPanel checks={checks} noGeometry={noGeometry} hasParts={anyParts} onSelect={setSelectedId} />
        </aside>
      </div>
    </div>
  );
}
