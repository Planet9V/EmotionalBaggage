// The files the schematic can hand out (KiCad schematic, wiring list CSV, netlists, SVG): what each one
// says about itself and how it is made from the circuit as drawn now.
import { SCALE, type buildSymbolGraph } from "@/components/schematic/symbolGraph";
import { kicadSchematic } from "@/lib/parts/kicad";
import type { buildCircuit } from "@/lib/parts/circuit";
import type { Wire } from "@/lib/domain";
import { netlistKicad, netlistText, schematicSvg, wiringCsv, type WireCut, type computeNets, type Graph, type Part } from "@/components/schematic/model";
import { DEFAULT_ALLOWANCE, DEFAULT_ROUTING, partMap, sequence } from "@/components/buildsheet/derive";
import { specRows } from "@/components/buildsheet/wiresheet";
import type { Item } from "@/lib/types";

/** The cut length, its basis and the gauge per wire, as the build sheet works them out at its default allowance and routing factor. */
function wireCuts(bomItems: Item[], wires: Wire[]): Map<number, WireCut> {
  const rows = specRows(sequence(wires), partMap(bomItems), DEFAULT_ROUTING, DEFAULT_ALLOWANCE);
  return new Map(rows.map((r) => [r.wire.item.id, { cutMm: r.length?.mm ?? null, basis: r.length?.source ?? "", gauge: r.gauge.awg !== null ? `${r.gauge.awg} AWG` : r.gauge.label }]));
}
import type { GeneratedFile } from "@/components/schematic/FilesPanel";
import { fileSlug } from "@/lib/format";

export function schematicFileSpecs({
  projectName,
  wires,
  parts,
  nets,
  graph,
  circuit,
  symGraph,
  revision,
  date,
  bomItems = [],
}: {
  projectName: string;
  bomItems?: Item[];
  wires: Wire[];
  parts: Part[];
  nets: ReturnType<typeof computeNets>;
  graph: Graph;
  circuit: ReturnType<typeof buildCircuit>;
  symGraph: ReturnType<typeof buildSymbolGraph>;
  revision: string;
  date: string;
}) {
  const base = fileSlug(projectName);
  const meta = () => ({ concept: projectName, generatedAt: new Date() });
  const n = wires.length;
  const drawn = circuit.parts.filter((p) => p.pins.length).length;
  return [
    {
      key: "kicad",
      label: "KiCad schematic (.kicad_sch)",
      detail: `${drawn} ${drawn === 1 ? "symbol" : "symbols"} and ${circuit.nets.length} ${circuit.nets.length === 1 ? "net" : "nets"}, in KiCad 10's file format, with the title block. Opens in KiCad's schematic editor.`,
      note: "Each pin's net is carried by a label on a short wire, so the sheet is tidy to connect but not drawn as a finished schematic. Symbols are this workbench's own drawings, embedded in the file. Symbols keep their places from the symbol view.",
      make: (): GeneratedFile[] => {
        const positions: Record<string, { x: number; y: number }> = {};
        for (const nd of symGraph.nodes) if (nd.type === "symbol") positions[nd.data.ref] = { x: (nd.position.x + nd.data.origin.x) / SCALE, y: (nd.position.y + nd.data.origin.y) / SCALE };
        return [{ name: `${base}.kicad_sch`, mime: "text/plain;charset=utf-8", text: kicadSchematic(circuit, { title: projectName, revision, date, positions }), format: "kicad-schematic" }];
      },
    },
    {
      key: "csv",
      label: "Wiring list (CSV)",
      detail: `${n} ${n === 1 ? "row" : "rows"} in soldering order: order, name, net, class, from ref, from pin, to ref, to pin, cut length, length basis (routed or estimate), gauge, note, status.`,
      note: `Cut lengths and gauges are the build sheet's, at its default ${DEFAULT_ALLOWANCE} mm allowance and ${DEFAULT_ROUTING} routing factor for wires not yet routed.`,
      make: (): GeneratedFile[] => [{ name: `${base}-wiring-list.csv`, mime: "text/csv;charset=utf-8", text: wiringCsv(wires, wireCuts(bomItems, wires)), format: "wiring-list-csv" }],
    },
    {
      key: "netlist",
      label: "Netlist (text and KiCad-style)",
      detail: `${nets.length} ${nets.length === 1 ? "net" : "nets"} as plain text, plus an S-expression netlist (.net). In both, pins wired together share one net.`,
      note: "The .net file is a simple netlist for reference, not a validated KiCad project.",
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
      label: "Pins and wires (SVG)",
      detail: `Drawn from the positions in the pins and wires view now (${graph.nodes.length} ${graph.nodes.length === 1 ? "node" : "nodes"}, every net class), with a title block.`,
      make: (): GeneratedFile[] => [{ name: `${base}-schematic.svg`, mime: "image/svg+xml", text: schematicSvg(graph, meta()), format: "schematic-svg" }],
    },
  ];
}
