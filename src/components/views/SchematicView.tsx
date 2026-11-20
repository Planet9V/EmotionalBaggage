"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ReactFlowProvider } from "@xyflow/react";
import { Cable, LayoutGrid, PanelRightClose, PanelRightOpen, Plus, Save, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useItems } from "@/lib/client";
import { PARTS_STORE, type NetClass, type Wire } from "@/lib/design";
import {
  buildGraph,
  computeChecks,
  computeNets,
  netlistKicad,
  netlistText,
  nodeId,
  pinsFor,
  readParts,
  readWires,
  readXY,
  schematicSvg,
  slug,
  wiringCsv,
  type Check,
  type Part,
  type XY,
} from "@/components/schematic/model";
import { SchematicCanvas, type ConnectRequest } from "@/components/schematic/SchematicCanvas";
import { SidePanel, type Selection } from "@/components/schematic/SidePanel";
import { ChecksPanel } from "@/components/schematic/ChecksPanel";
import { FilesPanel, type GeneratedFile } from "@/components/schematic/FilesPanel";
import { WireDialog, type WireDialogMode, type WireDraft } from "@/components/schematic/WireDialog";
import { PinDialog } from "@/components/schematic/PinDialog";
import { FirstConnection } from "@/components/schematic/FirstConnection";
import { EYEBROW, ErrorLine, Modal } from "@/components/schematic/controls";
import type { ViewProps } from "./types";

type DialogState =
  | { kind: "wire"; mode: WireDialogMode }
  | { kind: "pin"; part: Part }
  | { kind: "place"; part: Part; at: XY | null }
  | { kind: "first" }
  | null;

const same = (a: XY | null, b: XY) => !!a && Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y);

export function SchematicView({ project, section, store }: ViewProps) {
  const reduce = useReducedMotion();
  const partsApi = useItems(project.id, PARTS_STORE);
  const wiresApi = useItems(project.id, store);

  const [overlay, setOverlay] = useState<Record<string, XY>>({});
  const [sel, setSel] = useState<Selection>(null);
  const [hidden, setHidden] = useState<Set<NetClass>>(new Set());
  const [hoverNet, setHoverNet] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [layoutMsg, setLayoutMsg] = useState("");

  const parts = useMemo(() => readParts(partsApi.items), [partsApi.items]);
  const wires = useMemo(() => readWires(wiresApi.items), [wiresApi.items]);
  const graph = useMemo(() => buildGraph(parts, wires, overlay), [parts, wires, overlay]);
  const checks = useMemo(() => computeChecks(parts, wires), [parts, wires]);
  const nets = useMemo(() => computeNets(wires), [wires]);
  const nextOrder = useMemo(() => wires.reduce((m, w) => Math.max(m, w.order), 0) + 1, [wires]);
  const statuses = section.statuses ?? [];

  const pinsByRef = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of parts) m.set(p.ref, pinsFor(p.ref, wires, p.extraPins));
    return m;
  }, [parts, wires]);

  const palette = useMemo(() => {
    const vias = new Set(wires.map((w) => w.via).filter(Boolean));
    const seen = new Set<string>();
    return parts.filter((p) => {
      if (seen.has(p.ref)) return false;
      seen.add(p.ref);
      return !graph.byId.has(nodeId(p.ref)) && !vias.has(p.ref);
    });
  }, [parts, wires, graph]);

  const highlight = useMemo(() => {
    const n = hoverNet ? nets.find((x) => x.name === hoverNet) : null;
    return new Set(n ? n.members : []);
  }, [hoverNet, nets]);

  // positions not yet stored (automatic, tidied or dragged and waiting for the debounce)
  const unsaved = useMemo(
    () =>
      graph.nodes.filter((n) => {
        if (n.kind === "part") return !!n.part && !same(n.part.saved, n.pos);
        return !same(readXY(n.wire.item.data.schematic), n.pos);
      }),
    [graph]
  );
  const anySaved = graph.nodes.some((n) => n.saved);

  // ───────── debounced position saves after a drag
  const latest = useRef({ graph, patchPart: partsApi.patch, patchWire: wiresApi.patch });
  useEffect(() => {
    latest.current = { graph, patchPart: partsApi.patch, patchWire: wiresApi.patch };
  });
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { graph: g, patchPart, patchWire } = latest.current;
    for (const id of pending.current) {
      const n = g.byId.get(id);
      if (!n) continue;
      if (n.kind === "part" && n.part && !same(n.part.saved, n.pos)) void patchPart(n.part.item.id, { data: { schematic: n.pos } });
      if (n.kind === "via" && !same(readXY(n.wire.item.data.schematic), n.pos)) void patchWire(n.wire.item.id, { data: { schematic: n.pos } });
    }
    pending.current.clear();
  }, []);
  useEffect(() => () => flush(), [flush]);

  const onDragStop = useCallback(
    (ids: string[]) => {
      for (const id of ids) pending.current.add(id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 450);
      setLayoutMsg("");
    },
    [flush]
  );
  const onMove = useCallback((moves: Record<string, XY>) => setOverlay((o) => ({ ...o, ...moves })), []);

  const saveLayout = async () => {
    setLayoutMsg("");
    const jobs: Promise<void>[] = [];
    for (const n of unsaved) {
      if (n.kind === "part" && n.part) jobs.push(partsApi.patch(n.part.item.id, { data: { schematic: n.pos } }));
      if (n.kind === "via") jobs.push(wiresApi.patch(n.wire.item.id, { data: { schematic: n.pos } }));
    }
    await Promise.all(jobs);
    setLayoutMsg(`Saved ${jobs.length} ${jobs.length === 1 ? "position" : "positions"}.`);
  };

  const tidy = () => {
    const fresh = buildGraph(parts, wires, {}, true);
    setOverlay(Object.fromEntries(fresh.nodes.map((n) => [n.id, n.pos])));
    setLayoutMsg("Tidied. Press Save layout to keep it.");
  };

  // ───────── writes
  const saveWire = async (d: WireDraft, editing: Wire | null) => {
    const data = { order: d.order, net: d.net, netClass: d.netClass, from: d.from, fromPin: d.fromPin, to: d.to, toPin: d.toPin, via: d.via };
    if (editing) {
      await wiresApi.patch(editing.item.id, { title: d.name, body: d.note, status: d.status, data });
      return;
    }
    const item = await wiresApi.add({ section: store, title: d.name, body: d.note, data, status: "to solder" });
    setSel({ kind: "wire", id: item.id });
  };

  const removeWire = async (w: Wire) => {
    await wiresApi.remove(w.item.id);
    setSel(null);
  };

  const addPin = async (part: Part, pin: string) => {
    await partsApi.patch(part.item.id, { data: { pins: [...part.extraPins, pin] } });
  };

  const placePart = async (part: Part, at: XY | null, pin: string) => {
    await partsApi.patch(part.item.id, { data: at ? { pins: [...part.extraPins, pin], schematic: at } : { pins: [...part.extraPins, pin] } });
    if (at) setOverlay((o) => ({ ...o, [nodeId(part.ref)]: at }));
    setSel({ kind: "part", ref: part.ref });
  };

  const removePin = (part: Part, pin: string) => {
    void partsApi.patch(part.item.id, { data: { pins: part.extraPins.filter((x) => x !== pin) } });
  };

  const onConnect = useCallback((c: ConnectRequest) => setDialog({ kind: "wire", mode: { kind: "new", ...c } }), []);
  const onEditWire = useCallback((w: Wire) => setDialog({ kind: "wire", mode: { kind: "edit", wire: w } }), []);
  const onAddPinRequest = useCallback(
    (ref: string) => {
      const part = parts.find((p) => p.ref === ref);
      if (part) setDialog({ kind: "pin", part });
      else setSel({ kind: "part", ref });
    },
    [parts]
  );
  const onPlace = useCallback(
    (ref: string, at: XY | null) => {
      const part = parts.find((p) => p.ref === ref);
      if (part) setDialog({ kind: "place", part, at });
    },
    [parts]
  );

  const pickCheck = (c: Check) => {
    if (c.wireIds.length) setSel({ kind: "wire", id: c.wireIds[0] });
    else if (c.refs.length === 1 && graph.byId.has(nodeId(c.refs[0]))) setSel({ kind: "part", ref: c.refs[0] });
  };

  const fileSpecs = useMemo(() => {
    const base = slug(project.name);
    const meta = () => ({ concept: project.name, generatedAt: new Date() });
    const n = wires.length;
    return [
      {
        key: "csv",
        label: "Wiring list (CSV)",
        detail: `${n} ${n === 1 ? "row" : "rows"} in soldering order: order, name, net, class, from ref, from pin, to ref, to pin, via, note, status.`,
        make: (): GeneratedFile[] => [{ name: `${base}-wiring-list.csv`, mime: "text/csv;charset=utf-8", text: wiringCsv(wires), format: "wiring-list-csv" }],
      },
      {
        key: "netlist",
        label: "Netlist (text and KiCad-style)",
        detail: `${nets.length} named ${nets.length === 1 ? "net" : "nets"} as plain text, plus an S-expression netlist (.net) where pins wired together share one net.`,
        note: "The .net file is a simple netlist for reference, not a validated KiCad project. A part in series on a wire is given pin 1 on the from side and pin 2 on the to side.",
        make: (): GeneratedFile[] => {
          const m = meta();
          return [
            { name: `${base}-netlist.txt`, mime: "text/plain;charset=utf-8", text: netlistText(wires, m), format: "netlist-text" },
            { name: `${base}-netlist.net`, mime: "text/plain;charset=utf-8", text: netlistKicad(parts, wires, m), format: "kicad-style-netlist" },
          ];
        },
      },
      {
        key: "svg",
        label: "Schematic (SVG)",
        detail: `Drawn from the positions on the canvas now (${graph.nodes.length} ${graph.nodes.length === 1 ? "node" : "nodes"}, every net class), with a title block.`,
        make: (): GeneratedFile[] => [{ name: `${base}-schematic.svg`, mime: "image/svg+xml", text: schematicSvg(graph, meta()), format: "schematic-svg" }],
      },
    ];
  }, [project.name, wires, parts, nets, graph]);

  // ───────── render
  if (partsApi.loading || wiresApi.loading) return <p className="text-sm text-secondary">Loading the schematic.</p>;
  const loadError = partsApi.error || wiresApi.error;

  const enter = { initial: reduce ? false : { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: "easeOut" as const } };

  if (!parts.length && !wires.length) {
    return (
      <motion.div {...enter} className="space-y-3">
        {loadError && <ErrorLine>{loadError}</ErrorLine>}
        <div className="rounded-xl border border-dashed border-hairline bg-subtle px-6 py-12 text-center">
          <Cable className="mx-auto h-6 w-6 text-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-primary">No parts to connect yet</p>
          <p className="mx-auto mt-1 max-w-lg text-sm text-secondary">
            The schematic draws the parts in the bill of materials and the wires between their pins. Add the parts first, each with a ref such as U1 or R2.
          </p>
          <Button asChild className="mt-4">
            <Link href="/s/design/bom">Open the bill of materials</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  const dialogs = (
    <>
      {dialog?.kind === "wire" && (
        <WireDialog
          key={dialog.mode.kind === "edit" ? `e${dialog.mode.wire.item.id}` : "new"}
          mode={dialog.mode}
          parts={parts}
          nets={nets}
          pinsByRef={pinsByRef}
          nextOrder={nextOrder}
          statuses={statuses}
          onClose={() => setDialog(null)}
          onSave={(d) => saveWire(d, dialog.mode.kind === "edit" ? dialog.mode.wire : null)}
          onDelete={dialog.mode.kind === "edit" ? () => removeWire((dialog.mode as { wire: Wire }).wire) : undefined}
        />
      )}
      {dialog?.kind === "pin" && (
        <PinDialog
          title={`Add a pin to ${dialog.part.ref}`}
          description={`${dialog.part.title}. The pin shows on the part straight away; drag from it to wire it.`}
          existing={pinsByRef.get(dialog.part.ref) ?? []}
          submitLabel="Add pin"
          onClose={() => setDialog(null)}
          onSave={(pin) => addPin(dialog.part, pin)}
        />
      )}
      {dialog?.kind === "place" && (
        <PinDialog
          title={`Place ${dialog.part.ref}`}
          description={`${dialog.part.title}. A part shows on the schematic once it has a pin. Name the first one.`}
          existing={pinsByRef.get(dialog.part.ref) ?? []}
          submitLabel="Place part"
          onClose={() => setDialog(null)}
          onSave={(pin) => placePart(dialog.part, dialog.at, pin)}
        />
      )}
      {dialog?.kind === "first" && (
        <Modal open onClose={() => setDialog(null)} title="Add first connection" description="Two parts and the pins the wire joins. It is saved with status to solder." width="560px">
          <FirstConnection parts={parts} nextOrder={nextOrder} onSave={(d) => saveWire(d, null)} onDone={() => setDialog(null)} />
        </Modal>
      )}
    </>
  );

  // parts exist but nothing has a pin or a wire yet: no canvas to drag on
  if (!graph.nodes.length) {
    return (
      <motion.div {...enter} className="space-y-4">
        {loadError && <ErrorLine>{loadError}</ErrorLine>}
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-dashed border-hairline bg-subtle p-6">
            <p className={EYEBROW}>Start the schematic</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-primary">No wires yet</h3>
            <p className="mt-2 text-sm text-secondary">
              A part appears on the canvas once it has a pin. Then drag from one pin to another to add a wire. To begin, type the first connection here, or place a part and name its first pin.
            </p>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {palette.map((p) => (
                <li key={p.item.id}>
                  <button
                    type="button"
                    onClick={() => onPlace(p.ref, null)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2 py-1 text-xs transition-colors duration-150 hover:border-dutchOrange/40"
                    title={`Place ${p.ref} and name its first pin`}
                  >
                    <span className="font-mono font-semibold text-dutchOrange">{p.ref}</span>
                    <span className="max-w-[160px] truncate text-secondary">{p.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-hairline bg-surface p-6">
            <p className={EYEBROW}>Add first connection</p>
            <div className="mt-3">
              <FirstConnection parts={parts} nextOrder={nextOrder} onSave={(d) => saveWire(d, null)} />
            </div>
          </div>
        </div>
        {dialogs}
      </motion.div>
    );
  }

  const canvasParts = graph.nodes.filter((n) => n.kind === "part" && n.part).map((n) => n.ref);

  return (
    <motion.div {...enter} className="space-y-4">
      {loadError && <ErrorLine>{loadError}</ErrorLine>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted" aria-live="polite">
          {layoutMsg ||
            (unsaved.length
              ? anySaved
                ? `${unsaved.length} ${unsaved.length === 1 ? "position is" : "positions are"} not saved yet.`
                : "The layout is automatic until you move a part or press Save layout."
              : "Layout saved. Moving a part saves its new position.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialog({ kind: "wire", mode: { kind: "new", from: canvasParts[0] ?? parts[0]?.ref ?? "", fromPin: "", to: canvasParts[1] ?? canvasParts[0] ?? parts[0]?.ref ?? "", toPin: "" } })}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add wire
          </Button>
          <Button variant="outline" size="sm" onClick={tidy}>
            <Wand2 className="h-3.5 w-3.5" aria-hidden /> Tidy layout
          </Button>
          <Button size="sm" onClick={saveLayout} disabled={!unsaved.length}>
            <Save className="h-3.5 w-3.5" aria-hidden /> Save layout
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} aria-controls="schematic-panel">
            {panelOpen ? <PanelRightClose className="h-4 w-4" aria-hidden /> : <PanelRightOpen className="h-4 w-4" aria-hidden />}
            {panelOpen ? "Hide panel" : "Show panel"}
          </Button>
        </div>
      </div>

      <div className={`grid gap-4 ${panelOpen ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"}`}>
        <div className="min-w-0">
          <ReactFlowProvider>
            <SchematicCanvas
              graph={graph}
              wires={wires}
              sel={sel}
              hidden={hidden}
              onToggleClass={(c) =>
                setHidden((h) => {
                  const next = new Set(h);
                  if (next.has(c)) next.delete(c);
                  else next.add(c);
                  return next;
                })
              }
              hoverNet={hoverNet}
              highlight={highlight}
              onMove={onMove}
              onDragStop={onDragStop}
              onSelect={setSel}
              onConnect={onConnect}
              onEditWire={onEditWire}
              onAddPin={onAddPinRequest}
              palette={palette}
              onPlace={onPlace}
              banner={
                !wires.length ? (
                  <div className="max-w-md rounded-xl border border-hairline bg-surface px-4 py-3 text-center shadow-plate">
                    <p className="text-sm font-medium text-primary">No wires yet</p>
                    <p className="mt-0.5 text-xs text-secondary">Drag from one pin to another to connect them, or type the pins in.</p>
                    <Button size="sm" className="mt-2" onClick={() => setDialog({ kind: "first" })}>
                      <Plus className="h-3.5 w-3.5" aria-hidden /> Add first connection
                    </Button>
                  </div>
                ) : undefined
              }
            />
          </ReactFlowProvider>
        </div>
        {panelOpen && (
          <aside id="schematic-panel" aria-label="Selection details" className="max-h-[clamp(620px,72vh,900px)] overflow-y-auto rounded-xl border border-hairline bg-surface p-4 xl:sticky xl:top-4">
            <SidePanel
              sel={sel}
              graph={graph}
              parts={parts}
              wires={wires}
              nets={nets}
              statuses={statuses}
              hoverNet={hoverNet}
              onHoverNet={setHoverNet}
              onSelect={setSel}
              onEditWire={onEditWire}
              onPatchWire={(w, change) =>
                void wiresApi.patch(w.item.id, {
                  ...(change.status !== undefined ? { status: change.status } : {}),
                  ...(change.order !== undefined ? { data: { order: change.order } } : {}),
                })
              }
              onRemovePin={removePin}
            />
          </aside>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChecksPanel checks={checks} wireCount={wires.length} partCount={parts.length} onPick={pickCheck} />
        <FilesPanel projectId={project.id} specs={fileSpecs} disabled={!wires.length} />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> The same wires drive the{" "}
        <Link href="/s/prototype/wiring" className="text-link hover:underline">
          wiring and soldering build sheet
        </Link>
        .
      </p>
      {dialogs}
    </motion.div>
  );
}
