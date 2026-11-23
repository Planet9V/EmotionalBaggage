// Four outputs of the worked example, as the hero shows them beside the product: the schematic, the unit cost, an
// ad and the marketplace listing. Each is drawn in markup or vector SVG from the example's seeded rows (HeroFacts,
// storyData.ts): the words and numbers are the example's own, and the schematic is its real netlist, so nothing
// here is typed in and everything is sharp at any pixel density. Drawn by the server; the only script is the
// schematic card's way in to the proof block's Schematic tab.
import type { ReactNode } from "react";
import { TONE_CLASS, approvalStatusTone } from "@/lib/statusTones";
import type { HeroFacts } from "./storyData";
import type { NetClassName, SchematicCrop } from "./get/heroArt";
import { HERO_STAGE, PROOF_TAB_EVENT } from "./content";

export const ARTEFACT_KEYS = ["schematic", "cost", "ad", "listing"] as const;
export type ArtefactKey = (typeof ARTEFACT_KEYS)[number];

function Pill({ children }: { children: string }) {
  return <span className={`inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border px-1.5 text-[13px] leading-none ${TONE_CLASS[approvalStatusTone(children)]}`}>{children}</span>;
}

/** One output: what it is, where it stands, the thing itself, and a line under it. */
function Card({ name, status, foot, children }: { name: string; status?: string; foot: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-hairline bg-surface/85 p-3 text-left sm:p-3.5 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-[2px]">
      <p className="flex items-center justify-between gap-1.5">
        <span className="whitespace-nowrap text-[13px] font-medium text-secondary">{name}</span>
        {status ? <Pill>{status}</Pill> : null}
      </p>
      <div className="flex min-h-0 flex-1 flex-col justify-center py-2">{children}</div>
      <p className="text-[13px] leading-snug text-muted">{foot}</p>
    </div>
  );
}

const NET_STROKE: Record<NetClassName, string> = { power: "var(--net-power)", ground: "var(--net-ground)", signal: "var(--net-signal)", audio: "var(--net-audio)" };
const INK = "var(--text-primary, #fff)";

/**
 * A crop of the product's real schematic (get/heroArt.ts): the app's own symbols for the controller, the chip
 * beside it, the amplifier and the speaker, their pin stubs, and each net between them in its class's colour.
 */
function Schematic({ crop }: { crop: SchematicCrop }) {
  const [x, y, w, h] = crop.box;
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} className="mx-auto h-auto w-full" role="img" aria-label={HERO_STAGE.cards.schematicAlt(crop.symbols.map((s) => `${s.ref}, ${s.title}`), crop.nets, crop.of)}>
      {crop.routes.map((r) => (
        <path key={r.net} d={r.d} fill="none" stroke={NET_STROKE[r.netClass]} strokeWidth={1.3} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      ))}
      {crop.symbols.map((s) => (
        <g key={s.ref}>
          {s.stubs.map((p, i) => (
            <path key={i} d={`M${p.line[0]} ${p.line[1]}L${p.line[2]} ${p.line[3]}`} stroke={p.netClass ? NET_STROKE[p.netClass] : "var(--text-muted)"} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
          ))}
          {s.rect ? <rect x={s.rect[0]} y={s.rect[1]} width={s.rect[2]} height={s.rect[3]} fill="var(--bg-surface, #131519)" stroke={INK} strokeWidth={1.4} vectorEffect="non-scaling-stroke" /> : null}
          {s.strokes.map((k, i) => (
            <path key={i} d={k.d} fill={k.fill ? INK : "none"} stroke={INK} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {s.circles.map((k, i) => (
            <circle key={i} cx={k[0]} cy={k[1]} r={Math.max(0.5, k[2])} fill={k[3] ? INK : "none"} stroke={INK} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          ))}
          <text x={s.label[0]} y={s.label[1]} fontSize="5.6" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill="var(--accent-orange)">
            {s.ref}
          </text>
        </g>
      ))}
      {crop.routes.map((r) =>
        r.name ? (
          <text key={r.net} x={r.name[0]} y={r.name[1] - 1.2} textAnchor="middle" fontSize="3.9" fontFamily="var(--font-mono, monospace)" fill="var(--text-secondary, #d4d4d8)" stroke="var(--bg-surface, #131519)" strokeWidth="1.6" paintOrder="stroke">
            {r.net}
          </text>
        ) : null,
      )}
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
        // the card is the way in to the whole schematic: the proof block, on its Schematic tab
        <a href="#proof" data-track="example:hero-schematic" onClick={() => window.dispatchEvent(new CustomEvent(PROOF_TAB_EVENT, { detail: "schematic" }))} className="block h-full rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
          <Card name={c.schematic} foot={c.wires(f.wires)}>
            {f.schematic ? <Schematic crop={f.schematic} /> : null}
          </Card>
          <span className="sr-only">{c.schematicOpen}</span>
        </a>
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
