// Four outputs of the worked example, as the hero shows them beside the product: the schematic, the unit cost, an
// ad and the marketplace listing. Each is drawn in markup or vector SVG from the example's seeded rows (HeroFacts,
// storyData.ts): the words and numbers are the example's own, and the schematic is its real netlist, so nothing
// here is typed in and everything is sharp at any pixel density. No script.
import type { ReactNode } from "react";
import { TONE_CLASS, approvalStatusTone } from "@/lib/statusTones";
import type { HeroFacts } from "./storyData";
import type { NetClassName, Wheel } from "./get/heroArt";
import { HERO_STAGE } from "./content";

export const ARTEFACT_KEYS = ["schematic", "cost", "ad", "listing"] as const;
export type ArtefactKey = (typeof ARTEFACT_KEYS)[number];

function Pill({ children }: { children: string }) {
  return <span className={`inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border px-2 text-[13px] leading-none ${TONE_CLASS[approvalStatusTone(children)]}`}>{children}</span>;
}

/** One output: what it is, where it stands, the thing itself, and a line under it. */
function Card({ name, status, foot, children }: { name: string; status?: string; foot: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-hairline bg-surface/85 p-3.5 text-left shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-[2px]">
      <p className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-secondary">{name}</span>
        {status ? <Pill>{status}</Pill> : null}
      </p>
      <div className="flex min-h-0 flex-1 flex-col justify-center py-2">{children}</div>
      <p className="text-[13px] leading-snug text-muted">{foot}</p>
    </div>
  );
}

const NET_STYLE: Record<NetClassName, { stroke: string; width: number; dash?: string }> = {
  power: { stroke: "var(--net-power)", width: 1.6 },
  ground: { stroke: "var(--net-ground)", width: 1.1, dash: "3 2" },
  signal: { stroke: "var(--net-signal)", width: 1 },
  audio: { stroke: "var(--net-audio)", width: 1.1, dash: "1 2" },
};

/** The netlist as a wheel: every wire of the example, the hub part in the middle, by net class (colour and line). */
function NetWheel({ wheel }: { wheel: Wheel }) {
  return (
    <svg viewBox={`4 4 ${wheel.size - 8} ${wheel.size - 8}`} className="mx-auto h-auto w-full max-w-[168px]" role="img" aria-label={`The example's ${wheel.links.length} wires, part to part, by net class.`}>
      {wheel.links.map((l, i) => {
        const st = NET_STYLE[l.netClass] ?? NET_STYLE.signal;
        return <path key={i} d={l.d} fill="none" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.9} />;
      })}
      {wheel.nodes.map((n) => (
        <g key={n.ref}>
          <rect x={n.x - (n.hub ? 12 : 9.5)} y={n.y - 5.5} width={n.hub ? 24 : 19} height={11} rx={2.5} fill="var(--bg-surface, #131519)" stroke={n.hub ? "var(--accent-orange)" : "currentColor"} className="text-muted" strokeWidth={n.hub ? 1.4 : 0.8} vectorEffect="non-scaling-stroke" />
          <text x={n.x} y={n.y + 2.5} textAnchor="middle" fontSize="6.6" fontWeight="600" fontFamily="var(--font-mono, monospace)" className="fill-current text-primary">
            {n.ref}
          </text>
        </g>
      ))}
    </svg>
  );
}

const num = (s: string) => Number((/[\d.]+/.exec(s.replace(/,/g, "")) ?? ["0"])[0]);

/** The unit cost at each volume as a falling line, its points the example's own estimates. */
function CostLine({ rows }: { rows: { volume: string; cogs: string }[] }) {
  const pts = rows.map((r) => ({ v: num(r.volume), c: num(r.cogs) })).filter((p) => p.v > 0 && p.c > 0);
  if (pts.length < 2) return null;
  const lx = pts.map((p) => Math.log10(p.v));
  const max = Math.max(...pts.map((p) => p.c));
  const X = (i: number) => 5 + ((lx[i]! - lx[0]!) / Math.max(1e-6, lx[lx.length - 1]! - lx[0]!)) * 110;
  const Y = (c: number) => 5 + (1 - c / max) * 40;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.c).toFixed(1)}`).join("");
  return (
    <svg viewBox="0 0 120 36" className="mt-2 h-auto w-full" aria-hidden="true">
      <path d={`${line}L${X(pts.length - 1).toFixed(1)} 36L${X(0).toFixed(1)} 36Z`} fill="var(--accent-orange)" fillOpacity={0.12} />
      <path d={line} fill="none" stroke="var(--accent-orange)" strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={X(i)} cy={Y(p.c)} r={2.2} fill="var(--bg-surface, #131519)" stroke="var(--accent-orange)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

const FIGURE = "text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-primary";

export function Artefact({ kind, facts: f }: { kind: ArtefactKey; facts: HeroFacts }) {
  const c = HERO_STAGE.cards;
  switch (kind) {
    case "schematic":
      return (
        <Card name={c.schematic} foot={c.wires(f.wires)}>
          <NetWheel wheel={f.wheel} />
        </Card>
      );
    case "cost": {
      const [first, then] = f.cost.rows;
      return (
        <Card name={c.cost} status={f.cost.status} foot={then ? c.each(then.volume) : first ? c.each(first.volume) : ""}>
          {first && then ? (
            <p className="text-[15px] tabular-nums text-muted">
              <span className="sr-only">{c.from(first.volume)} </span>
              <s className="decoration-[var(--accent-orange)] decoration-2">{first.cogs}</s> <span aria-hidden>{c.at(first.volume)}</span>
            </p>
          ) : null}
          <p className={`mt-1 ${FIGURE}`}>{(then ?? first)?.cogs}</p>
          <CostLine rows={f.cost.rows} />
        </Card>
      );
    }
    case "ad":
      return (
        <Card name={c.ad} status={f.ad.status} foot={c.variants(f.ad.count)}>
          <p className="text-[15px] font-medium leading-snug text-primary">&ldquo;{f.ad.text}&rdquo;</p>
        </Card>
      );
    case "listing":
      return (
        <Card name={c.listing} status={f.channel.status} foot={c.net(f.channel.net)}>
          <p className="text-[15px] leading-snug text-secondary">{f.channel.title}</p>
          <p className={`mt-1.5 ${FIGURE}`}>{f.channel.price}</p>
        </Card>
      );
  }
}
