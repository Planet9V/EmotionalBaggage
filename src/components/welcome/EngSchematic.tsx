"use client";

// The Schematic tab of the engineering stage: the app's own two schematic canvases (SymbolCanvas and
// SchematicCanvas, as the Schematic page mounts them), fed by the app's own derivations (buildCircuit,
// buildSymbolGraph, buildGraph, the elkjs layouts) on the example's seeded parts and wires. Read-only: the
// canvases are given `readOnly`, so nothing is dragged, connected or saved; pan, zoom, the net-class switches and
// lighting a pin or a wire all work. The wires carry a moving dash (CSS on the canvas's own edge paths).
import { useEffect, useMemo, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { type NetClass } from "@/lib/domain";
import type { Item } from "@/lib/types";
import { buildCircuit, pinKey } from "@/lib/parts/circuit";
import { symbolLayout } from "@/lib/parts/symbols";
import { elkLayout, elkLayoutRouted, type LayoutNode } from "@/lib/graphLayout";
import { SymbolCanvas } from "@/components/schematic/SymbolCanvas";
import { SchematicCanvas } from "@/components/schematic/SchematicCanvas";
import { buildSymbolGraph, symbolNodeSize, SCALE, withRoutes } from "@/components/schematic/symbolGraph";
import { buildGraph, computeNets, nodeHeight, NODE_W, HEADER_H, ROW_H, refParts, readWires, type XY } from "@/components/schematic/model";
import type { Selection } from "@/components/schematic/SidePanel";
import { useAnimated } from "./useAnimated";
import { ENGINEERING } from "./content";
import { CHIP, CHIP_OFF, CHIP_ON, StageBar, StageFoot, StageView, Waiting } from "./StageParts";

const SIDE = { left: "WEST", right: "EAST", top: "NORTH", bottom: "SOUTH" } as const;
const NO_MOVES = {};
const noop = () => {};
type View = keyof typeof ENGINEERING.schematic.views;
const VIEWS = Object.keys(ENGINEERING.schematic.views) as View[];

export default function EngSchematic({ parts: partItems, wires: wireItems }: { parts: Item[]; wires: Item[] }) {
  const animated = useAnimated();
  const [view, setView] = useState<View>("symbols");
  const [sel, setSel] = useState<Selection>(null);
  const [hidden, setHidden] = useState<Set<NetClass>>(new Set());
  const [symLayout, setSymLayout] = useState<Record<string, XY> | null>(null);
  const [symRoutes, setSymRoutes] = useState<Record<string, XY[]>>({});
  const [pinsLayout, setPinsLayout] = useState<Record<string, XY> | null>(null);

  const circuit = useMemo(() => buildCircuit(partItems, wireItems, []), [partItems, wireItems]);
  const parts = useMemo(
    () =>
      refParts(partItems).map((p) => {
        const cp = circuit.byRef.get(p.ref);
        return cp && cp.item.id === p.item.id ? { ...p, pins: cp.pins.map((x) => x.name) } : p;
      }),
    [partItems, circuit],
  );
  const wires = useMemo(() => readWires(wireItems), [wireItems]);
  const nets = useMemo(() => computeNets(wires), [wires]);
  const symGraph = useMemo(() => buildSymbolGraph(circuit, symLayout ?? NO_MOVES, NO_MOVES), [circuit, symLayout]);
  const symEdges = useMemo(() => withRoutes(symGraph.edges, symGraph.nodes, symLayout ?? NO_MOVES, symRoutes), [symGraph, symLayout, symRoutes]);
  const graph = useMemo(() => buildGraph(parts, wires, NO_MOVES, false, pinsLayout ?? undefined), [parts, wires, pinsLayout]);

  // the same automatic layouts the Schematic page asks elkjs for
  useEffect(() => {
    let live = true;
    const nodes: LayoutNode[] = circuit.parts
      .filter((p) => p.pins.length)
      .map((p) => {
        const layout = symbolLayout(p.symbol, p.pins);
        const { width, height, origin } = symbolNodeSize(layout);
        return { id: p.ref, width, height, ports: layout.pins.map((sp) => ({ id: `${p.ref}\u0000${sp.name}`, side: SIDE[sp.side], x: origin.x + sp.x * SCALE, y: origin.y + sp.y * SCALE })) };
      });
    const edges = circuit.wires
      .filter((w) => {
        const net = circuit.netOf.get(pinKey(w.from, w.fromPin));
        return net && net.netClass !== "power" && net.netClass !== "ground";
      })
      .map((w) => ({ id: String(w.item.id), source: w.from, sourcePort: `${w.from}\u0000${w.fromPin}`, target: w.to, targetPort: `${w.to}\u0000${w.toPin}` }));
    elkLayoutRouted(nodes, edges, { node: 90, layer: 150 })
      .then((out) => {
        if (!live) return;
        setSymRoutes(out.routes);
        setSymLayout(out.positions);
      })
      .catch(() => live && setSymLayout({}));
    return () => {
      live = false;
    };
  }, [circuit]);

  const pinsKey = useMemo(() => graph.nodes.map((n) => `${n.id}:${n.pins.map((x) => x.name + x.side).join(",")}`).join("|"), [graph]);
  useEffect(() => {
    let live = true;
    const nodes: LayoutNode[] = graph.nodes
      .filter((n) => n.kind === "part")
      .map((n) => ({
        id: n.ref,
        width: NODE_W,
        height: nodeHeight(n.pins.length),
        ports: n.pins.map((p, i) => ({ id: `${n.ref}\u0000${p.name}`, side: p.side === "left" ? ("WEST" as const) : ("EAST" as const), x: p.side === "left" ? 0 : NODE_W, y: HEADER_H + ROW_H * (i + 0.5) })),
      }));
    const edges = wires.map((w) => ({ id: String(w.item.id), source: w.from, sourcePort: `${w.from}\u0000${w.fromPin || "?"}`, target: w.to, targetPort: `${w.to}\u0000${w.toPin || "?"}` }));
    elkLayout(nodes, edges)
      .then((pos) => live && setPinsLayout(pos))
      .catch(() => live && setPinsLayout({}));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- laid out once per set of parts and pins, as the Schematic page does
  }, [pinsKey]);

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

  const picked = (() => {
    if (sel?.kind === "wire") {
      const w = wires.find((x) => x.item.id === sel.id);
      return w ? `${w.name}: ${w.from}.${w.fromPin} to ${w.to}.${w.toPin}, net ${w.net || "unnamed"}` : "";
    }
    if (sel?.kind === "pin") return `${sel.ref}.${sel.pin}: ${litWires.size} ${litWires.size === 1 ? "wire" : "wires"}`;
    if (sel?.kind === "part") return `${sel.ref}: ${parts.find((p) => p.ref === sel.ref)?.title ?? ""}`;
    return "";
  })();
  const ready = view === "symbols" ? symLayout !== null : pinsLayout !== null;

  return (
    <>
      <StageBar path="/s/design/schematic">
        <div className="flex gap-1.5" role="group" aria-label="How the schematic is drawn">
          {VIEWS.map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`${CHIP} ${view === v ? CHIP_ON : CHIP_OFF}`}>
              {ENGINEERING.schematic.views[v]}
            </button>
          ))}
        </div>
      </StageBar>
      <StageView className={`wl-sch ${animated ? "wl-sch-live" : ""} ${view === "pins" ? "flex flex-col p-2" : ""}`}>
        {!ready ? (
          <Waiting label={ENGINEERING.schematic.waiting} />
        ) : (
          <ReactFlowProvider key={view}>
            {view === "symbols" ? (
              <SymbolCanvas nodes={symGraph.nodes} edges={symEdges} sel={sel} litPins={litPins} litWires={litWires} onMove={noop} onDragStop={noop} onSelect={setSel} onConnect={noop} titleBlock={null} readOnly heightClass="h-full rounded-none! border-0!" />
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
                hoverNet={null}
                highlight={litPins}
                litWires={litWires}
                onPickPin={(ref, pin) => setSel({ kind: "pin", ref, pin })}
                onMove={noop}
                onDragStop={noop}
                onSelect={setSel}
                onConnect={noop}
                onEditWire={noop}
                onAddPin={noop}
                palette={[]}
                onPlace={noop}
                readOnly
                heightClass="min-h-0 flex-1"
              />
            )}
          </ReactFlowProvider>
        )}
      </StageView>
      <StageFoot hint={<><span className="sm:hidden">{ENGINEERING.panTouch}</span><span className="hidden sm:inline">{ENGINEERING.schematic.hint}</span></>} live={picked}>
        {circuit.parts.filter((p) => p.pins.length).length} parts, {wires.length} wires, {nets.length} nets
      </StageFoot>
    </>
  );
}
