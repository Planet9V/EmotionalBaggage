import type { Wire } from "@/lib/domain";
import {
  CHECK_TEXT, ROUND_TO, beforePower, connectionsByPart, consumables, counts, cutList, totalsByClass,
  type PartLite, type Step,
} from "./derive";

const cell = (s: string | number) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const row = (...c: (string | number)[]) => `| ${c.map(cell).join(" | ")} |`;

/** The whole sheet as Markdown, from the same derivations the screen uses. */
export function buildMarkdown(opts: {
  projectName: string;
  steps: Step[];
  parts: Map<string, PartLite>;
  routing: number;
  allowance: number;
}): string {
  const { projectName, steps, parts, routing, allowance } = opts;
  const wires = steps.map((s) => s.wire);
  const c = counts(steps);
  const title = (ref: string) => parts.get(ref)?.title ?? "not in the bill of materials";
  const end = (w: Wire, side: "from" | "to") => {
    const ref = side === "from" ? w.from : w.to;
    const pin = side === "from" ? w.fromPin : w.toPin;
    return `${ref} pin ${pin || "(none)"} (${title(ref)})`;
  };
  const L: string[] = [];
  L.push(`# Build sheet: ${projectName}`, "");
  L.push("Generated from the schematic (design/wiring) and the bill of materials (design/bom).", "");
  L.push(`Progress: ${c.soldered} soldered, ${c.tested} tested, of ${c.total} wires.`, "");

  L.push("## Soldering sequence", "");
  for (const { n, wire: w } of steps) {
    L.push(`### Step ${n}: ${w.name}`, "");
    L.push(`- Connect ${end(w, "from")} to ${end(w, "to")}`);
    L.push(`- Net ${w.net || "(none)"}, class ${w.netClass}`);
    if (w.via) L.push(`- Through ${w.via} (${title(w.via)})`);
    if (w.note) L.push(`- Instruction: ${w.note}`);
    L.push(`- Check: ${CHECK_TEXT[w.netClass]}`);
    L.push(`- Status: ${w.status}`, "");
  }

  L.push("## Connections by part", "");
  for (const p of connectionsByPart(steps)) {
    L.push(`### ${p.ref} ${title(p.ref)}`, "");
    L.push(row("Pin", "Connects to", "Net", "Class", "Via", "Status", "Shared joint"));
    L.push(row("---", "---", "---", "---", "---", "---", "---"));
    for (const r of p.rows) L.push(row(r.pin || "(none)", r.to, r.net, r.netClass, r.via, r.status, r.joint > 1 ? `${r.joint} wires meet here` : ""));
    L.push("");
  }

  const cuts = cutList(steps, parts, routing, allowance);
  L.push("## Wire cut list", "");
  const nRouted = cuts.filter((r) => r.length?.source === "routed").length;
  L.push(`Routed length = the planner's path through the enclosure + ${allowance} mm (strip and slack), rounded up to ${ROUND_TO} mm. Estimate (fallback where a wire is not routed, or its route is out of date) = straight-line distance between the two parts' assembled centres x ${routing} (routing factor) + ${allowance} mm, rounded up to ${ROUND_TO} mm. ${nRouted} of ${cuts.length} wires are routed. Colours are suggested.`, "");
  L.push(row("Step", "From", "To", "Class", "Suggested colour", "Length", "Basis"));
  L.push(row("---", "---", "---", "---", "---", "---", "---"));
  for (const r of cuts) {
    const w = r.wire;
    L.push(row(r.step, `${w.from}.${w.fromPin}`, `${w.to}.${w.toPin}`, w.netClass, `${r.colour} (suggested)`, r.length ? `${r.length.mm} mm` : "no geometry", r.length ? (r.length.source === "routed" ? "routed" : r.length.stale ? "estimate (route out of date)" : "estimate") : ""));
  }
  L.push("");
  for (const t of totalsByClass(cuts)) {
    L.push(`- ${t.netClass}: ${t.mm} mm (${t.routed} routed, ${t.counted - t.routed} estimated)${t.counted < t.wires ? ` (${t.counted} of ${t.wires} wires have geometry)` : ""}`);
  }
  L.push("");

  const k = consumables(wires);
  L.push("## Joints and consumables", "");
  L.push(`- Solder joints: ${k.joints} (${k.wireJoints} for ${wires.length} wires, ${k.viaJoints} for ${k.viaParts.length} parts in series)`);
  L.push(`- Parts in series: ${k.viaParts.length ? k.viaParts.map((r) => `${r} ${title(r)}${parts.get(r)?.spec ? `, ${parts.get(r)!.spec}` : ""}`).join("; ") : "none"}`);
  L.push(`- Parts with 3 or more pins (header pins): ${k.headers.length ? k.headers.map((h) => `${h.ref} ${title(h.ref)}, ${h.pins} pins`).join("; ") : "none"}`, "");

  L.push("## Before power", "");
  for (const l of beforePower(wires)) L.push(`- [${l.result === "pass" ? "x" : " "}] ${l.label}: ${l.result === "na" ? "n/a" : l.result} (${l.detail})`);
  L.push("");
  return L.join("\n");
}
