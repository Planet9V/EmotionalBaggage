// The drawn pictures of the welcome page: plain inline SVG in one hand. Every outline is a 2 px line in the ink
// colour that keeps its width at any size (the .wl-ill rule in globals.css), fills are the Eigenia tokens, and
// the one accent is Dutch orange. Nothing here is a photograph or a generated image; the app's own screenshots
// are the proof, these are the diagrams. All are decorative unless a caller gives them a label.
import type { CSSProperties, ReactNode } from "react";
import { EXAMPLE } from "./content";

const INK = "var(--text-primary)";
const PAPER = "var(--bg-surface)";
const SHADE = "var(--bg-subtle)";
const LINE = "var(--border-hairline)";
const ORANGE = "var(--accent-orange)";
const DARK = "#16181d";
const MONO = "var(--font-mono)";
const SANS = "var(--font-sans)";

export function Svg({ viewBox, className = "", label, children }: { viewBox: string; className?: string; label?: string; children: ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      className={`wl-ill ${className}`}
      fill="none"
      stroke={INK}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {children}
    </svg>
  );
}

/** Words inside a drawing: filled, never outlined. */
export function T({ x, y, size = 11, mono = false, bold = false, fill = "var(--text-secondary)", anchor, children }: { x: number; y: number; size?: number; mono?: boolean; bold?: boolean; fill?: string; anchor?: "middle" | "end"; children: ReactNode }) {
  return (
    <text x={x} y={y} fontSize={size} fontFamily={mono ? MONO : SANS} fontWeight={bold ? 600 : 400} fill={fill} stroke="none" textAnchor={anchor}>
      {children}
    </text>
  );
}

// Isometric projection: x runs down to the right, y down to the left, z straight up.
const COS = 0.866;
const SIN = 0.5;
type Pt = readonly [number, number];
export const iso = (x: number, y: number, z = 0): Pt => [(x - y) * COS, (x + y) * SIN - z];
const poly = (...p: Pt[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

/** A box standing on the ground plane at (x, y, z), w along x, d along y, h tall. */
export function IsoBox({ x, y, z = 0, w, d, h, top = PAPER, left = SHADE, right = SHADE }: { x: number; y: number; z?: number; w: number; d: number; h: number; top?: string; left?: string; right?: string }) {
  return (
    <>
      <polygon points={poly(iso(x, y + d, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x, y + d, z))} fill={left} />
      <polygon points={poly(iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z))} fill={right} />
      <polygon points={poly(iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h))} fill={top} />
    </>
  );
}

/** A cylinder of radius r standing at (cx, cy, z), h tall. A circle on the ground plane is an ellipse here. */
export function IsoCyl({ cx = 0, cy = 0, z = 0, r, h, side = SHADE, top = PAPER }: { cx?: number; cy?: number; z?: number; r: number; h: number; side?: string; top?: string }) {
  const [sx, sy] = iso(cx, cy, z + h);
  const rx = r * 1.2247;
  const ry = r * 0.7071;
  return (
    <>
      <path d={`M${sx - rx} ${sy}v${h}a${rx} ${ry} 0 0 0 ${rx * 2} 0v${-h}`} fill={side} />
      <ellipse cx={sx} cy={sy} rx={rx} ry={ry} fill={top} />
    </>
  );
}

/** The ellipse a circle of radius r makes on the ground plane, for holes, rims and cones. */
export function IsoRing({ cx = 0, cy = 0, z = 0, r, fill = "none", ...rest }: { cx?: number; cy?: number; z?: number; r: number; fill?: string; stroke?: string; strokeDasharray?: string }) {
  const [sx, sy] = iso(cx, cy, z);
  return <ellipse cx={sx} cy={sy} rx={r * 1.2247} ry={r * 0.7071} fill={fill} {...rest} />;
}

/**
 * The gadget seen from the front, as it sits on its straps: the real case is a box 80 by 60 mm (42 mm deep) with a
 * round speaker opening in the lid. Drawn upright, 1.5 r wide and 2 r tall, in the accent, with the dark grille.
 */
export function DeviceFace({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const w = r * 1.5;
  const h = r * 2;
  return (
    <>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={r * 0.12} fill={ORANGE} />
      <circle cx={cx} cy={cy} r={r * 0.46} fill={DARK} />
      <circle cx={cx} cy={cy} r={r * 0.3} stroke="#ffffff" strokeOpacity="0.7" strokeDasharray="1 5" />
      <circle cx={cx} cy={cy} r={r * 0.14} stroke="#ffffff" strokeOpacity="0.7" strokeDasharray="1 5" />
    </>
  );
}

/** The story page with the pitch on it: the idea on screen in the first hour. */
export function IdeaScreen({ className }: { className?: string }) {
  return (
    <Svg viewBox="0 0 320 220" className={className}>
      <rect x="11" y="11" width="298" height="198" rx="12" fill={PAPER} />
      <path d="M11 41h298" />
      <circle cx="29" cy="26" r="4" fill={ORANGE} />
      <circle cx="45" cy="26" r="4" fill={SHADE} />
      <T x={64} y={30} mono>{EXAMPLE.name}</T>
      <T x={30} y={68} mono size={10} fill="var(--link)">Pitch</T>
      <T x={30} y={92} size={17} bold fill={INK}>A gadget that gives</T>
      <T x={30} y={114} size={17} bold fill={INK}>a suitcase a voice.</T>
      <path d="M196 100v17" className="wl-caret" stroke={ORANGE} />
      <path d="M30 136h260" stroke={LINE} />
      <T x={30} y={158} mono size={10}>Origin</T>
      <path d="M84 154h150" className="wl-grow" stroke={LINE} strokeWidth="6" />
      <T x={30} y={178} mono size={10}>Voice</T>
      <path d="M84 174h110" className="wl-grow" style={{ animationDelay: "-2s" }} stroke={LINE} strokeWidth="6" />
      <T x={30} y={198} mono size={10}>Sources</T>
      <rect x="84" y="187" width="92" height="16" rx="8" fill={SHADE} strokeWidth="1.5" />
      <T x={130} y={198.5} mono size={10} anchor="middle" fill={INK}>{EXAMPLE.documents} documents</T>
    </Svg>
  );
}

/** A corner of the schematic: the series resistor, the audio module and the speaker, in the app's net styles. */
export function SchematicFragment({ className, children }: { className?: string; /** drawn over the nets: the travelling pulse */ children?: ReactNode }) {
  return (
    <Svg viewBox="0 0 360 200" className={className}>
      {/* power in, ground out */}
      <path d="M200 52V26" stroke="var(--net-power)" strokeWidth="3" />
      <path d="M192 26h16M200 26v-9" stroke="var(--net-power)" />
      <T x={212} y={24} mono size={10}>VIN</T>
      <path d="M200 148v22" stroke="var(--net-ground)" strokeDasharray="5 4" />
      <path d="M188 170h24M193 176h14M197 182h6" stroke="var(--net-ground)" />
      <T x={218} y={176} mono size={10}>GND</T>
      {/* the signal, through its resistor */}
      <path d="M12 84h34" stroke="var(--net-signal)" />
      <path d="M46 84l5-8 9 16 9-16 9 16 9-16 5 8" fill="none" />
      <path d="M92 84h58" stroke="var(--net-signal)" />
      <circle cx="12" cy="84" r="3" fill={PAPER} />
      <T x={8} y={70} mono size={10}>U1 GPIO17</T>
      <T x={52} y={110} mono size={10}>R1 1 kΩ</T>
      <T x={100} y={76} mono size={9} fill="var(--net-signal)">UART_TX</T>
      {/* the audio module */}
      <rect x="150" y="52" width="100" height="96" rx="4" fill={PAPER} />
      <T x={156} y={46} mono size={10}>U3</T>
      <T x={158} y={88} mono size={10} fill={INK}>RX</T>
      <T x={242} y={88} mono size={10} fill={INK} anchor="end">SPK_1</T>
      <T x={242} y={120} mono size={10} fill={INK} anchor="end">SPK_2</T>
      <T x={200} y={140} size={10} anchor="middle">Audio module</T>
      {/* the speaker */}
      <path d="M250 84h52M250 116h52" stroke="var(--net-audio)" strokeDasharray="1 5" />
      <path d="M302 78h12v44h-12zM314 88l22-16v56l-22-16" fill={PAPER} />
      <T x={300} y={64} mono size={10}>SPK1</T>
      <T x={258} y={76} mono size={9} fill="var(--net-audio)">SPK_P</T>
      <T x={258} y={134} mono size={9} fill="var(--net-audio)">SPK_N</T>
      {children}
    </Svg>
  );
}

/** The example's three ad drafts fanned out, each still waiting for a yes. */
export function AdFan({ className }: { className?: string }) {
  const card = (name: string, turn: number, front: boolean) => (
    <g key={name} className="wl-fan" style={{ "--turn": `${turn}deg` } as CSSProperties}>
      <rect x="104" y="36" width="112" height="150" rx="10" fill={front ? PAPER : SHADE} />
      <DeviceFace cx={128} cy={60} r={11} />
      <T x={146} y={58} size={11} bold fill={INK}>{name}</T>
      <T x={146} y={71} mono size={9}>retargeting</T>
      <path d="M118 96h84M118 110h84M118 124h52" stroke={LINE} strokeWidth="6" />
      <g className={front ? "wl-breathe" : undefined}>
        <rect x="118" y="150" width="48" height="20" rx="10" fill={front ? "var(--accent-orange-subtle)" : "none"} stroke={ORANGE} strokeWidth="1.5" />
        <T x={142} y={164} mono size={10} anchor="middle" fill="var(--link)">Draft</T>
      </g>
    </g>
  );
  return (
    <Svg viewBox="0 0 320 210" className={className}>
      {card("Ad 1", -16, false)}
      {card("Ad 3", 16, false)}
      {card("Ad 2", 0, true)}
    </Svg>
  );
}

/** What a marketplace listing draft holds: the picture, the name, the points, and no price or stars, because none exist. */
export function ListingCard({ className }: { className?: string }) {
  return (
    <Svg viewBox="0 0 320 200" className={className}>
      <rect x="11" y="11" width="298" height="178" rx="12" fill={PAPER} />
      <rect x="27" y="27" width="112" height="146" rx="8" fill={SHADE} />
      {/* a soft band of light crossing the picture, as a product shot on a listing has */}
      <clipPath id="wl-listing-picture">
        <rect x="27" y="27" width="112" height="146" rx="8" />
      </clipPath>
      <g clipPath="url(#wl-listing-picture)">
        <rect x="27" y="27" width="46" height="146" fill={ORANGE} fillOpacity="0.16" stroke="none" className="wl-sheen" />
      </g>
      <g className="wl-float">
        <rect x="58" y="62" width="50" height="78" rx="9" fill={PAPER} />
        <path d="M72 62V50h22v12" />
        <rect x="56" y="90" width="54" height="7" rx="1" fill={INK} />
        <rect x="56" y="102" width="54" height="7" rx="1" fill={INK} />
        <DeviceFace cx={83} cy={99} r={13} />
      </g>
      <T x={156} y={48} size={14} bold fill={INK}>{EXAMPLE.name}</T>
      <T x={156} y={66} size={10}>Straps to a suitcase</T>
      <T x={156} y={79} size={10}>and heckles the trip.</T>
      {[100, 118, 136].map((y, i) => (
        <g key={y} className="wl-seq" style={{ animationDelay: `${i * 0.5}s` }}>
          <path d={`M157 ${y}l4 4 7-8`} stroke={ORANGE} />
          <path d={`M178 ${y}h${y === 136 ? 70 : 108}`} stroke={LINE} strokeWidth="6" />
        </g>
      ))}
      <g className="wl-breathe">
        <rect x="156" y="154" width="52" height="20" rx="10" fill="var(--accent-orange-subtle)" stroke={ORANGE} strokeWidth="1.5" />
        <T x={182} y={168} mono size={10} anchor="middle" fill="var(--link)">Draft</T>
      </g>
      <T x={218} y={168} mono size={10}>not live yet</T>
    </Svg>
  );
}
