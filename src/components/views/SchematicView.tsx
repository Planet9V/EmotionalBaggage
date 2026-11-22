"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { LayoutGrid, PanelRightClose, PanelRightOpen, Plus, Printer, Save, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useItems } from "@/lib/client";
import { STORE, type NetClass, type Wire } from "@/lib/domain";
import { buildCircuit, pinKey as circuitPinKey } from "@/lib/parts/circuit";
import { checkCircuit, type Finding } from "@/lib/parts/erc";

import { usePins } from "@/lib/parts/client";
import { pinToDef } from "@/lib/parts/pins";
import { SymbolCanvas } from "@/components/schematic/SymbolCanvas";
import { buildSymbolGraph, symbolNodeSize, readSymbolPos, SCALE, withRoutes, type SymNode } from "@/components/schematic/symbolGraph";
import { ErcPanel } from "@/components/schematic/ErcPanel";
import { TitleBlock } from "@/components/schematic/TitleBlock";
import { elkLayout, elkLayoutRouted, type LayoutNode } from "@/lib/graphLayout";
import { symbolLayout } from "@/lib/parts/symbols";
import "@/components/schematic/print.css";
import { printSchematic } from "@/components/schematic/printSchematic";
import { buildGraph, computeChecks, netList, nodeId, nodeHeight, NODE_W, HEADER_H, ROW_H, pinsFor, refParts, readWires, type Check, type Part, type XY } from "@/components/schematic/model";
import { SchematicCanvas, type ConnectRequest } from "@/components/schematic/SchematicCanvas";
import { SidePanel, type Selection } from "@/components/schematic/SidePanel";
import { ChecksPanel, rowProblems } from "@/components/schematic/ChecksPanel";
import { FilesPanel } from "@/components/schematic/FilesPanel";
import { type WireDraft } from "@/components/schematic/WireDialog";

import type { ViewProps } from "./types";

import { ErrorLine, LoadingBlocks } from "@/components/ui/states";

import { schematicFileSpecs } from "./schematic/fileSpecs";
import { NoParts, StartSchematic } from "./schematic/SchematicEmpty";
import { SchematicDialogs, type DialogState } from "./schematic/SchematicDialogs";
import { Card } from "@/components/ui/Card";
import { todayLocal } from "@/lib/format";

const same = (a: XY | null, b: XY) => !!a && Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y);

type ViewMode = "symbols" | "pins";
const VIEW_KEY = "c2r.schematic.view";

/** `?select=wire:12`, `?select=pin:U1.GND` or `?select=part:U1`, as the electrical checks link to. */
function selectionFromUrl(): Selection {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("select") ?? "";
  const [kind, rest = ""] = [v.slice(0, v.indexOf(":")), v.slice(v.indexOf(":") + 1)];
  if (kind === "wire" && /^\d+$/.test(rest)) return { kind: "wire", id: Number(rest) };
  if (kind === "part" && rest) return { kind: "part", ref: rest };
  if (kind === "pin" && rest.includes(".")) return { kind: "pin", ref: rest.slice(0, rest.indexOf(".")), pin: rest.slice(rest.indexOf(".") + 1) };
  return null;
}

export function SchematicView({ project, section, store }: ViewProps) {
  const partsApi = useItems(project.id, STORE.parts);
  const wiresApi = useItems(project.id, store);
  const buildsApi = useItems(project.id, STORE.builds);
  const pinsApi = usePins(project.id);

  const [view, setViewState] = useState<ViewMode>("symbols");
  const [overlay, setOverlay] = useState<Record<string, XY>>({});
  const [symOverlay, setSymOverlay] = useState<Record<string, XY>>({});
  const [sel, setSel] = useState<Selection>(null);
  const [hidden, setHidden] = useState<Set<NetClass>>(new Set());
  const [hoverNet, setHoverNet] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [layoutMsg, setLayoutMsg] = useState("");
  const [pinsLayout, setPinsLayout] = useState<Record<string, XY>>({});
  const [symLayout, setSymLayout] = useState<Record<string, XY>>({});
  const [symRoutes, setSymRoutes] = useState<Record<string, XY[]>>({});
  // the canvas mounts once the first layout settles, so its fit uses real positions
  const [laid, setLaid] = useState({ pins: false, sym: false });
  const [revisionPick, setRevisionPick] = useState("");
  const [date] = useState(todayLocal);

  useEffect(() => {
    // a link from a check selects its row; the view choice is remembered in this browser
    const fromUrl = selectionFromUrl();
    const saved = window.localStorage.getItem(VIEW_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the address and local storage after mount
    if (fromUrl) setSel(fromUrl);
    if (saved === "pins" || saved === "symbols") setViewState(saved);
  }, []);
  const setView = (v: ViewMode) => {
    setViewState(v);
    window.localStorage.setItem(VIEW_KEY, v);
  };

  const circuit = useMemo(() => buildCircuit(partsApi.items, wiresApi.items, pinsApi.pins), [partsApi.items, wiresApi.items, pinsApi.pins]);
  const findings = useMemo(() => checkCircuit(circuit, { projectId: project.id }), [circuit, project.id]);

  // the pins-and-wires view lists every pin a part has: its own, its library entry's or its kind's
  const parts = useMemo(
    () =>
      refParts(partsApi.items).map((p) => {
        const cp = circuit.byRef.get(p.ref);
        return cp && cp.item.id === p.item.id ? { ...p, pins: cp.pins.map((x) => x.name) } : p;
      }),
    [partsApi.items, circuit]
  );
  const wires = useMemo(() => readWires(wiresApi.items), [wiresApi.items]);
  const graph = useMemo(() => buildGraph(parts, wires, overlay, false, pinsLayout), [parts, wires, overlay, pinsLayout]);
  const checks = useMemo(() => computeChecks(parts, wires, netList(circuit.nets)).filter((c) => !c.id.startsWith("loose:")), [parts, wires, circuit]);
  // The net list is the circuit's own nets, the ones the electrical checks and the symbol view read.
  const nets = useMemo(() => netList(circuit.nets), [circuit]);
  const nextOrder = useMemo(() => wires.reduce((m, w) => Math.max(m, w.order), 0) + 1, [wires]);
  const statuses = section.statuses ?? [];
  const symGraph = useMemo(() => buildSymbolGraph(circuit, symLayout, symOverlay), [circuit, symLayout, symOverlay]);
  const symEdges = useMemo(() => withRoutes(symGraph.edges, symGraph.nodes, symLayout, symRoutes), [symGraph, symLayout, symRoutes]);

  const pinKind = useCallback(
    (ref: string, pin: string) => circuit.parts.find((p) => p.ref === ref)?.pins.find((x) => x.name === pin)?.kind ?? null,
    [circuit]
  );
  const pinsByRef = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of parts) m.set(p.ref, pinsFor(p.ref, wires, p.pins));
    return m;
  }, [parts, wires]);

  const palette = useMemo(() => {
    const seen = new Set<string>();
    return parts.filter((p) => {
      if (seen.has(p.ref)) return false;
      seen.add(p.ref);
      return !graph.byId.has(nodeId(p.ref));
    });
  }, [parts, graph]);

  // ───────── what the selection lights up, in both views
  const { litPins, litWires } = useMemo(() => {
    const pins = new Set<string>();
    const ws = new Set<number>();
    if (sel?.kind === "wire") {
      const w = wires.find((x) => x.item.id === sel.id);
      if (w) {
        ws.add(w.item.id);
        pins.add(`${w.from}.${w.fromPin}`);
        pins.add(`${w.to}.${w.toPin}`);
      }
    }
    if (sel?.kind === "pin") {
      pins.add(`${sel.ref}.${sel.pin}`);
      for (const w of wires) if ((w.from === sel.ref && w.fromPin === sel.pin) || (w.to === sel.ref && w.toPin === sel.pin)) ws.add(w.item.id);
    }
    return { litPins: pins, litWires: ws };
  }, [sel, wires]);

  // Pointing at a net lights its pins and its wires: the wires of that net, whatever name is typed on them.
  const hovered = useMemo(() => (hoverNet ? (nets.find((x) => x.name === hoverNet) ?? null) : null), [hoverNet, nets]);
  const highlight = useMemo(() => new Set([...(hovered ? hovered.members : []), ...litPins]), [hovered, litPins]);
  const hoverWires = useMemo(() => (hovered ? new Set(hovered.wires.map((w) => w.item.id)) : null), [hovered]);

  // ───────── automatic layouts with elkjs, for parts without a saved position
  const pinsLayoutKey = useMemo(() => graph.nodes.filter((n) => n.kind === "part").map((n) => `${n.id}:${n.kind === "part" ? n.pins.map((x) => x.name + x.side).join(",") : ""}`).join("|") + `#${wires.map((w) => w.item.id).join(",")}`, [graph, wires]);
  useEffect(() => {
    let live = true;
    const nodes: LayoutNode[] = graph.nodes
      .filter((n) => n.kind === "part")
      .map((n) => ({
        id: n.ref,
        width: NODE_W,
        height: nodeHeight(n.kind === "part" ? n.pins.length : 1),
        ports: n.kind === "part" ? n.pins.map((p, i) => ({ id: `${n.ref}\u0000${p.name}`, side: p.side === "left" ? "WEST" : "EAST", x: p.side === "left" ? 0 : NODE_W, y: HEADER_H + ROW_H * (i + 0.5) })) : [],
      }));
    const edges = wires.map((w) => ({ id: String(w.item.id), source: w.from, sourcePort: `${w.from}\u0000${w.fromPin || "?"}`, target: w.to, targetPort: `${w.to}\u0000${w.toPin || "?"}` }));
    elkLayout(nodes, edges)
      .then((pos) => live && setPinsLayout(pos))
      .catch(() => undefined) // the parts stay where they are
      .finally(() => live && setLaid((l) => (l.pins ? l : { ...l, pins: true })));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the parts, pins or wires change, not on every drag
  }, [pinsLayoutKey]);

  const symLayoutKey = useMemo(() => circuit.parts.map((p) => `${p.ref}:${p.symbol}:${p.pins.map((x) => x.name + x.side).join(",")}`).join("|") + `#${circuit.wires.map((w) => w.item.id).join(",")}`, [circuit]);
  useEffect(() => {
    let live = true;
    const SIDE = { left: "WEST", right: "EAST", top: "NORTH", bottom: "SOUTH" } as const;
    const nodes: LayoutNode[] = circuit.parts
      .filter((p) => p.pins.length)
      .map((p) => {
        const layout = symbolLayout(p.symbol, p.pins);
        const { width, height, origin } = symbolNodeSize(layout);
        return { id: p.ref, width, height, ports: layout.pins.map((sp) => ({ id: `${p.ref}\u0000${sp.name}`, side: SIDE[sp.side], x: origin.x + sp.x * SCALE, y: origin.y + sp.y * SCALE })) };
      });
    const edges = circuit.wires
      .filter((w) => {
        const net = circuit.netOf.get(circuitPinKey(w.from, w.fromPin));
        return net && net.netClass !== "power" && net.netClass !== "ground";
      })
      .map((w) => ({ id: String(w.item.id), source: w.from, sourcePort: `${w.from}\u0000${w.fromPin}`, target: w.to, targetPort: `${w.to}\u0000${w.toPin}` }));
    elkLayoutRouted(nodes, edges, { node: 90, layer: 150, edgeNode: 60, edgeEdge: 20 })
      .then((out) => {
        if (!live) return;
        setSymLayout(out.positions);
        setSymRoutes(out.routes);
      })
      .catch(() => undefined)
      .finally(() => live && setLaid((l) => (l.sym ? l : { ...l, sym: true })));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the parts, pins or wires change, not on every drag
  }, [symLayoutKey]);

  // positions not yet stored (automatic, tidied or dragged and waiting for the debounce)
  const unsaved = useMemo(() => {
    if (view === "symbols") return symGraph.nodes.filter((n): n is Extract<SymNode, { type: "symbol" }> => n.type === "symbol" && !same(readSymbolPos(n.part.item.data.symbolPos), n.position)).map((n) => ({ itemId: n.part.item.id, pos: n.position }));
    return graph.nodes
      .filter((n) => !!n.part && !same(n.part.schematic, n.pos))
      .map((n) => ({ itemId: n.part!.item.id, pos: n.pos }));
  }, [graph, symGraph, view]);
  const anySaved = view === "symbols" ? symGraph.nodes.some((n) => n.type === "symbol" && n.saved) : graph.nodes.some((n) => n.saved);

  // ───────── debounced position saves after a drag
  const latest = useRef({ graph, symGraph, patchPart: partsApi.patch });
  useEffect(() => {
    latest.current = { graph, symGraph, patchPart: partsApi.patch };
  });
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { graph: g, symGraph: sg, patchPart } = latest.current;
    for (const id of pending.current) {
      if (id.startsWith("s:")) {
        const n = sg.nodes.find((x) => x.id === id);
        if (n && n.type === "symbol" && !same(readSymbolPos(n.part.item.data.symbolPos), n.position)) void patchPart(n.part.item.id, { data: { symbolPos: n.position } });
        continue;
      }
      const n = g.byId.get(id);
      if (!n) continue;
      if (n.part && !same(n.part.schematic, n.pos)) void patchPart(n.part.item.id, { data: { schematic: n.pos } });
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
  const onSymMove = useCallback((moves: Record<string, XY>) => setSymOverlay((o) => ({ ...o, ...moves })), []);

  const saveLayout = async () => {
    setLayoutMsg("");
    const key = view === "symbols" ? "symbolPos" : "schematic";
    const jobs = unsaved.map((u) => partsApi.patch(u.itemId, { data: { [key]: u.pos } }));
    try {
      await Promise.all(jobs);
      setLayoutMsg(`Saved ${jobs.length} ${jobs.length === 1 ? "position" : "positions"}.`);
    } catch {
      // the error line shows the failed write (writeError); the positions go back to the saved ones
    }
  };

  const tidy = () => {
    if (view === "symbols") {
      const fresh = buildSymbolGraph(circuit, symLayout, {}, true);
      setSymOverlay(Object.fromEntries(fresh.nodes.filter((n) => n.type === "symbol").map((n) => [n.id, n.position])));
    } else {
      const fresh = buildGraph(parts, wires, {}, true, pinsLayout);
      setOverlay(Object.fromEntries(fresh.nodes.map((n) => [n.id, n.pos])));
    }
    setLayoutMsg("Tidied. Press Save layout to keep it.");
  };

  // ───────── writes
  const saveWire = async (d: WireDraft, editing: Wire | null) => {
    const data = { order: d.order, net: d.net, netClass: d.netClass, from: d.from, fromPin: d.fromPin, to: d.to, toPin: d.toPin };
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

  /** A part's pins as definitions, to change and store as its own. */
  const ownPins = (part: Part) => (circuit.byRef.get(part.ref)?.pins ?? []).map(pinToDef);

  const addPin = async (part: Part, pin: string) => {
    await pinsApi.setPins(part.item.id, [...ownPins(part), { name: pin, kind: null }]);
  };

  const placePart = async (part: Part, at: XY | null, pin: string) => {
    if (pin) await pinsApi.setPins(part.item.id, [...ownPins(part), { name: pin, kind: null }]);
    if (at) {
      await partsApi.patch(part.item.id, { data: { schematic: at } });
      setOverlay((o) => ({ ...o, [nodeId(part.ref)]: at }));
    }
    setSel({ kind: "part", ref: part.ref });
  };

  const removePin = (part: Part, pin: string) => {
    void pinsApi.setPins(part.item.id, ownPins(part).filter((x) => x.name !== pin)).catch(() => undefined);
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
      if (!part) return;
      // a part whose pins are known is placed at once; one with none needs its first pin named
      if (part.pins.length) void placePart(part, at, "");
      else setDialog({ kind: "place", part, at });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placePart reads the latest parts through closure
    [parts]
  );
  const onPickPin = useCallback((ref: string, pin: string) => setSel({ kind: "pin", ref, pin }), []);

  const pickCheck = (c: Check) => {
    if (c.wireIds.length) setSel({ kind: "wire", id: c.wireIds[0] });
    else if (c.refs.length === 1 && graph.byId.has(nodeId(c.refs[0]))) setSel({ kind: "part", ref: c.refs[0] });
  };
  const pickFinding = (f: Finding) => {
    if (f.wireIds.length) setSel({ kind: "wire", id: f.wireIds[0] });
    else if (f.pins.length) {
      const k = f.pins[0];
      setSel({ kind: "pin", ref: k.slice(0, k.indexOf(".")), pin: k.slice(k.indexOf(".") + 1) });
    } else if (f.refs.length) setSel({ kind: "part", ref: f.refs[0] });
  };

  // ───────── title block: the revision is a named build of this concept
  const revisions = useMemo(() => [...buildsApi.items].sort((a, b) => b.sort - a.sort || b.id - a.id).map((b) => b.title), [buildsApi.items]);
  const revision = revisionPick && revisions.includes(revisionPick) ? revisionPick : (revisions[0] ?? "Draft: no named build yet");

  const fileSpecs = useMemo(
    () => schematicFileSpecs({ projectName: project.name, wires, parts, nets, graph, circuit, symGraph, revision, date, bomItems: partsApi.items }),
    [project.name, wires, parts, nets, graph, circuit, symGraph, revision, date, partsApi.items]
  );

  // ───────── render
  if (partsApi.loading || wiresApi.loading) return <LoadingBlocks rows={2} label="Loading the schematic" />;
  const loadError = partsApi.error || wiresApi.error || partsApi.writeError || wiresApi.writeError || pinsApi.writeError;

  if (!parts.length && !wires.length) return <NoParts loadError={loadError} />;

  const dialogs = (
    <SchematicDialogs
      dialog={dialog}
      setDialog={setDialog}
      parts={parts}
      nets={nets}
      pinsByRef={pinsByRef}
      nextOrder={nextOrder}
      statuses={statuses}
      saveWire={saveWire}
      removeWire={removeWire}
      addPin={addPin}
      placePart={placePart}
      pinKind={pinKind}
    />
  );

  // parts exist but nothing has a pin or a wire yet: no canvas to drag on
  if (!graph.nodes.length && !symGraph.nodes.length) {
    return <StartSchematic loadError={loadError} palette={palette} parts={parts} nextOrder={nextOrder} onPlace={onPlace} saveWire={saveWire} dialogs={dialogs} />;
  }

  const canvasParts = graph.nodes.filter((n) => n.kind === "part" && n.part).map((n) => n.ref);
  const wiredParts = circuit.parts.filter((p) => circuit.wires.some((w) => w.from === p.ref || w.to === p.ref));
  const undescribed = wiredParts.filter((p) => p.source === "wires").map((p) => p.ref);
  const titleBlock = <TitleBlock concept={project.name} revision={revision} revisions={revisions} onRevision={setRevisionPick} date={date} view={view === "symbols" ? "Schematic, symbol view" : "Schematic, pins and wires"} />;

  return (
    <div className="animate-enter space-y-4">
      {loadError && <ErrorLine>{loadError}</ErrorLine>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Schematic view" className="inline-flex rounded-md border border-hairline bg-surface p-0.5 shadow-xs">
            {(
              [
                ["symbols", "Symbols"],
                ["pins", "Pins and wires"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={view === k}
                onClick={() => setView(k)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${view === k ? "bg-dutchOrange/10 text-primary" : "text-secondary hover:bg-subtle"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted" aria-live="polite">
            {layoutMsg ||
              (unsaved.length
                ? anySaved
                  ? `${unsaved.length} ${unsaved.length === 1 ? "position is" : "positions are"} not saved yet.`
                  : "The layout is automatic until you move a part or press Save layout."
                : "Layout saved. Moving a part saves its new position.")}
          </p>
        </div>
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
          <Button variant="outline" size="sm" onClick={() => void printSchematic()} title="Print the sheet, or save it as a PDF from the print dialog">
            <Printer className="h-3.5 w-3.5" aria-hidden /> Print or PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} aria-controls="schematic-panel">
            {panelOpen ? <PanelRightClose className="h-4 w-4" aria-hidden /> : <PanelRightOpen className="h-4 w-4" aria-hidden />}
            {panelOpen ? "Hide panel" : "Show panel"}
          </Button>
        </div>
      </div>

      <div className={`grid gap-4 ${panelOpen ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"}`}>
        <div className="schematic-print-area min-w-0">
          <ReactFlowProvider key={view}>
            {(view === "symbols" ? !laid.sym : !laid.pins) ? (
              <LoadingBlocks rows={2} label="Laying out the schematic" />
            ) : view === "symbols" ? (
              <SymbolCanvas
                nodes={symGraph.nodes}
                edges={symEdges}
                sel={sel}
                litPins={litPins}
                litWires={litWires}
                onMove={onSymMove}
                onDragStop={onDragStop}
                onSelect={setSel}
                onConnect={onConnect}
                titleBlock={titleBlock}
              />
            ) : (
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
                hoverWires={hoverWires}
                highlight={highlight}
                litWires={litWires}
                onPickPin={onPickPin}
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
                    <Card variant="flat" className="max-w-md px-4 py-3 text-center shadow-plate">
                      <p className="text-sm font-medium text-primary">No wires yet</p>
                      <p className="mt-0.5 text-xs text-secondary">Drag from one pin to another to connect them, or type the pins in.</p>
                      <Button size="sm" className="mt-2" onClick={() => setDialog({ kind: "first" })}>
                        <Plus className="h-3.5 w-3.5" aria-hidden /> Add first connection
                      </Button>
                    </Card>
                  ) : undefined
                }
              />
            )}
          </ReactFlowProvider>
          {view === "pins" && <div className="mt-2 flex justify-end">{titleBlock}</div>}
        </div>
        {panelOpen && (
          <aside id="schematic-panel" aria-label="Selection details" className="schematic-noprint max-h-[clamp(620px,72vh,900px)] overflow-y-auto rounded-xl border border-hairline bg-surface p-4 xl:sticky xl:top-4">
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
              circuit={circuit}
            />
          </aside>
        )}
      </div>

      <ErcPanel
        findings={findings}
        loading={pinsApi.loading}
        error={pinsApi.error ? `The pins could not be read: ${pinsApi.error}` : ""}
        onRetry={() => void pinsApi.reload()}
        onPick={pickFinding}
        undescribed={undescribed}
        rowProblems={rowProblems(checks)}
        rowChecks={<ChecksPanel checks={checks} wireCount={wires.length} partCount={parts.length} onPick={pickCheck} />}
      />
      <FilesPanel projectId={project.id} specs={fileSpecs} disabled={!wires.length} />

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> The same wires drive the{" "}
        <Link href="/s/prototype/wiring" className="text-link hover:underline">
          wiring and soldering build sheet
        </Link>
        .
      </p>
      {dialogs}
    </div>
  );
}
