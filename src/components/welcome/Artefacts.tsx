// The stage outputs as small artefacts: a brief line, a claim with its source, the top of the parts list with its
// total, the netlist as a wheel, the 3D model, the printed case, the unit cost and its fall with volume, an ad draft
// and a sales channel. Each is drawn in markup or vector SVG from the worked example's seeded rows (HeroFacts,
// storyData.ts): the words and numbers are the example's own, and the drawings come from its real geometry (the
// parts' sizes and places, the wires, the enclosure's outer size and the print job's layer height), so they are
// sharp at any pixel density. Used by the hero's idea-in, outputs-out visual. No script; the model assembles and
// the print rises in CSS, and both stand finished under reduced motion.
import type { CSSProperties, ReactNode } from "react";
import { TONE_CLASS, approvalStatusTone } from "@/lib/statusTones";
import type { HeroFacts } from "./storyData";
import { ModelStill } from "./get/ModelStill";
import type { NetClassName, PrintLayers, Wheel } from "./get/heroArt";

export const ARTEFACT_KEYS = ["brief", "claim", "parts", "schematic", "model", "print", "cost", "ad", "channel"] as const;
export type ArtefactKey = (typeof ARTEFACT_KEYS)[number];


function Pill({ children }: { children: string }) {
  return <span className={`inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded-full px-1.5 font-mono text-[10px] ${TONE_CLASS[approvalStatusTone(children)]}`}>{children}</span>;
}

function Frame({ stage, kind, status, children }: { stage: string; kind: string; status?: string; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[112px] flex-col overflow-hidden rounded-lg border border-hairline bg-surface text-left shadow-[var(--shadow-card)]">
      <p className="flex h-6 shrink-0 items-center gap-1.5 border-b border-hairline bg-subtle px-2 font-mono text-[10px] text-muted">
        <span className="text-link">{stage}</span>
        <span className="min-w-0 flex-1 truncate text-secondary">{kind}</span>
        {status ? <Pill>{status}</Pill> : null}
      </p>
      <div className="flex min-h-0 flex-1 flex-col justify-center px-2 py-1.5">{children}</div>
    </div>
  );
}

const BODY = "text-[11px] leading-snug text-primary";
const FOOT = "mt-1 truncate font-mono text-[10px] text-muted";

const NET_STYLE: Record<NetClassName, { stroke: string; width: number; dash?: string }> = {
  power: { stroke: "var(--net-power)", width: 1.6 },
  ground: { stroke: "var(--net-ground)", width: 1.1, dash: "3 2" },
  signal: { stroke: "var(--net-signal)", width: 1 },
  audio: { stroke: "var(--net-audio)", width: 1.1, dash: "1 2" },
};

/** The netlist as a wheel: every wire of the example, the hub part in the middle, by net class (colour and line). */
function NetWheel({ wheel }: { wheel: Wheel }) {
  return (
    <svg viewBox={`0 0 ${wheel.size} ${wheel.size}`} className="mx-auto h-auto w-full max-w-[150px]" role="img" aria-label={`The example's ${wheel.links.length} wires, part to part, by net class.`}>
      {wheel.links.map((l, i) => {
        const st = NET_STYLE[l.netClass] ?? NET_STYLE.signal;
        return <path key={i} d={l.d} fill="none" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.9} />;
      })}
      {wheel.nodes.map((n) => (
        <g key={n.ref}>
          <rect x={n.x - (n.hub ? 12 : 9)} y={n.y - 5} width={n.hub ? 24 : 18} height={10} rx={2} fill="var(--bg-surface, #131519)" stroke={n.hub ? "var(--accent-orange)" : "currentColor"} className="text-secondary" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          <text x={n.x} y={n.y + 2.4} textAnchor="middle" fontSize="6.2" fontFamily="var(--font-mono, monospace)" className="fill-current text-primary">
            {n.ref}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** The case on the print bed: its outline, and every tenth printed layer rising through it (CSS only). */
function PrintedCase({ layers }: { layers: PrintLayers }) {
  const [x, y, w, h] = layers.box;
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} className="mx-auto h-auto w-full max-w-[150px]" aria-hidden="true">
      <defs>
        <clipPath id="wl-print-clip">
          <rect className="wl-layers" style={{ transformBox: "view-box", "--asm-lap": "7s" } as CSSProperties} x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      <path d={layers.outline} fill="none" stroke="currentColor" className="text-muted" strokeWidth={0.8} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <g clipPath="url(#wl-print-clip)">
        <path d={layers.outline} fill="var(--accent-orange)" fillOpacity={0.12} stroke="var(--accent-orange)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {layers.levels.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--accent-orange)" strokeOpacity={0.55} strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}

/** The unit cost at each volume as a falling line, its points the example's own estimates. */
function CostLine({ rows }: { rows: { volume: string; cogs: string }[] }) {
  const pts = rows.map((r) => ({ v: Number(r.volume.replace(/,/g, "")), c: Number((/[\d.]+/.exec(r.cogs.replace(/,/g, "")) ?? ["0"])[0]) })).filter((p) => p.v > 0 && p.c > 0);
  if (pts.length < 2) return null;
  const lx = pts.map((p) => Math.log10(p.v));
  const max = Math.max(...pts.map((p) => p.c));
  const X = (i: number) => 4 + ((lx[i]! - lx[0]!) / Math.max(1e-6, lx[lx.length - 1]! - lx[0]!)) * 112;
  const Y = (c: number) => 4 + (1 - c / max) * 22;
  return (
    <svg viewBox="0 0 120 30" className="mt-1 h-auto w-full" aria-hidden="true">
      <path d={pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.c).toFixed(1)}`).join("")} fill="none" stroke="var(--accent-orange)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={X(i)} cy={Y(p.c)} r={1.8} fill="var(--accent-orange)" />
      ))}
    </svg>
  );
}

export function Artefact({ kind, facts: f }: { kind: ArtefactKey; facts: HeroFacts }) {
  switch (kind) {
    case "brief":
      return (
        <Frame stage="01" kind="Brief" status="done">
          <p className={`${BODY} line-clamp-3`}>{f.brief.body}</p>
          <p className={FOOT}>{f.brief.lines} lines in the brief</p>
        </Frame>
      );
    case "claim":
      return (
        <Frame stage="02" kind="Claim and source" status={f.claim.status}>
          <p className={`${BODY} line-clamp-3`}>{f.claim.title}</p>
          <p className={FOOT}>Stated in: {f.claim.source}</p>
        </Frame>
      );
    case "parts":
      return (
        <Frame stage="03" kind="Parts list">
          <ul className="font-mono text-[10px] leading-[1.45] text-secondary">
            {f.parts.rows.map((r) => (
              <li key={r.ref} className="flex gap-1.5">
                <span className="w-5 shrink-0 text-link">{r.ref}</span>
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="tabular-nums text-primary">{r.line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex items-baseline justify-between border-t border-hairline pt-1 font-mono text-[10px] text-muted">
            <span>and {f.parts.more} more</span>
            <span className="text-[13px] font-semibold tabular-nums text-primary">{f.parts.total}</span>
          </p>
        </Frame>
      );
    case "schematic":
      return (
        <Frame stage="03" kind="Schematic">
          <NetWheel wheel={f.wheel} />
          <p className={FOOT}>{f.wires} wires, checked</p>
        </Frame>
      );
    case "model":
      return (
        <Frame stage="03" kind="3D model">
          {f.still ? <ModelStill still={f.still} assemble className="mx-auto max-w-[156px]" /> : null}
          <p className={FOOT}>{f.case ? `${f.case.w} × ${f.case.d} × ${f.case.h} mm` : "Enclosure"}</p>
        </Frame>
      );
    case "print":
      return (
        <Frame stage="04" kind="Printed part" status="queued">
          {f.layers ? <PrintedCase layers={f.layers} /> : null}
          <p className={FOOT}>{[f.print.material, f.print.settings].filter(Boolean).join(", ")}</p>
        </Frame>
      );
    case "cost":
      return (
        <Frame stage="05" kind="Unit cost" status={f.cost.status}>
          <ul className="font-mono text-[10px] leading-[1.5] text-secondary">
            {f.cost.rows.map((r, i) => (
              <li key={r.title} className="flex items-baseline gap-1.5">
                <span className="min-w-0 flex-1 truncate">at {r.volume}</span>
                <span className={`tabular-nums text-primary ${i === 0 ? "text-[13px] font-semibold" : ""}`}>{r.cogs}</span>
              </li>
            ))}
          </ul>
          <CostLine rows={f.cost.rows} />
        </Frame>
      );
    case "ad":
      return (
        <Frame stage="06" kind="Ad" status={f.ad.status}>
          <p className={`${BODY} line-clamp-3 font-medium`}>&ldquo;{f.ad.text}&rdquo;</p>
          <p className={FOOT}>1 of {f.ad.count} variants</p>
        </Frame>
      );
    case "channel":
      return (
        <Frame stage="07" kind="Listing and channel" status={f.channel.status}>
          <p className={`${BODY} font-medium`}>{f.channel.title}</p>
          <p className="mt-0.5 flex items-baseline gap-2 font-mono text-[10px] text-muted">
            <span className="text-[13px] font-semibold tabular-nums text-primary">{f.channel.price}</span>
            net {f.channel.net}
          </p>
        </Frame>
      );
  }
}
