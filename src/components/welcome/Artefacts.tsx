// The stage outputs as small artefacts: a brief line, a claim with its source, the top of the parts list with its
// total, a corner of the schematic, the enclosure as a 3D box, the print, the unit cost, an ad draft and a sales
// channel. Each is drawn in markup or SVG from the worked example's seeded rows (HeroFacts, storyData.ts): the
// words and numbers are the example's own, as they stand, so a draft reads "draft" and a plan reads "planned".
// Used by the hero's idea-in, outputs-out visual and by "What you get". No script; the hero adds the motion.
import type { ReactNode } from "react";
import { TONE_CLASS, approvalStatusTone } from "@/lib/statusTones";
import type { HeroFacts } from "./storyData";

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

/** A corner of the schematic: the audio module, its series resistor and the speaker, in the app's net colours. */
function SchematicCorner() {
  return (
    <svg viewBox="0 0 168 58" className="h-auto w-full" role="img" aria-label="A corner of the schematic: the MCU board, a series resistor, the audio module and the speaker, joined by wires.">
      <g fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M34 20h18M74 20h16M34 38h56" stroke="var(--net-signal, #4f9cf9)" />
        <path d="M124 22h18M124 36h18" stroke="var(--net-audio, #c084fc)" />
        <rect x="4" y="10" width="30" height="38" rx="3" stroke="currentColor" className="text-secondary" />
        <rect x="52" y="15" width="22" height="10" rx="2" stroke="currentColor" className="text-secondary" />
        <rect x="90" y="10" width="34" height="38" rx="3" stroke="currentColor" className="text-secondary" />
        <path d="M142 18h8l10-8v38l-10-8h-8z" stroke="var(--accent-orange)" />
      </g>
      <g className="fill-current text-muted" fontSize="7" fontFamily="var(--font-mono, monospace)">
        <text x="19" y="32" textAnchor="middle">U1</text>
        <text x="63" y="11" textAnchor="middle">R1</text>
        <text x="107" y="32" textAnchor="middle">U3</text>
        <text x="151" y="56" textAnchor="middle">SPK1</text>
      </g>
    </svg>
  );
}

/** The enclosure as a box in three faces, to the example's own outer size. */
function CaseBox({ lid = true }: { lid?: boolean }) {
  return (
    <svg viewBox="0 0 120 62" className="h-auto w-full" aria-hidden="true">
      <g strokeWidth="1.5" strokeLinejoin="round" stroke="var(--accent-orange)">
        <path d="M22 26 62 12l40 12-40 14z" fill="var(--accent-orange-subtle)" opacity={lid ? 1 : 0.35} />
        <path d="M22 26v20l40 14V38z" fill="none" stroke="currentColor" className="text-secondary" />
        <path d="M62 38v22l40-14V24z" fill="none" stroke="currentColor" className="text-secondary" />
        <path d="M22 26 62 12l40 12-40 14z" fill="none" />
      </g>
      <circle cx="74" cy="25" r="5" fill="none" stroke="var(--accent-orange)" strokeWidth="1.2" />
      <path d="M71 25h6M74 22v6" stroke="var(--accent-orange)" strokeWidth="1" />
    </svg>
  );
}

/** The base on the printer's bed, part way up: laid lines below, the outline still to print above. */
function PrintLayers() {
  return (
    <svg viewBox="0 0 120 62" className="h-auto w-full" aria-hidden="true">
      <path d="M10 56h100" stroke="currentColor" className="text-muted" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 52V18h64v34" fill="none" stroke="currentColor" className="text-muted" strokeWidth="1.2" strokeDasharray="3 3" />
      <g stroke="var(--accent-orange)" strokeWidth="2.4" strokeLinecap="round">
        <path d="M28 52h64M28 47.5h64M28 43h64M28 38.5h64M28 34h64" />
        <path d="M28 29.5h34" />
      </g>
      <path d="M62 14v11m-5 0h10l-5 5z" fill="currentColor" stroke="currentColor" className="text-secondary" strokeWidth="1.2" strokeLinejoin="round" />
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
          <SchematicCorner />
          <p className={FOOT}>{f.wires} wires, checked</p>
        </Frame>
      );
    case "model":
      return (
        <Frame stage="03" kind="3D model">
          <CaseBox />
          <p className={FOOT}>{f.case ? `${f.case.w} × ${f.case.d} × ${f.case.h} mm` : "Enclosure"}</p>
        </Frame>
      );
    case "print":
      return (
        <Frame stage="04" kind="Printed part" status="queued">
          <PrintLayers />
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
