// The drawn pictures of the welcome page: plain inline SVG in one hand. Every outline is a 2 px line in the ink
// colour that keeps its width at any size (the .wl-ill rule in globals.css), fills are the Eigenia tokens, and
// the one accent is Dutch orange. Nothing here is a photograph or a generated image; the app's own screenshots
// are the proof, these are the diagrams. All are decorative unless a caller gives them a label.
import type { ReactNode } from "react";
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

/** The puck seen from the front, as it sits on the strap: a disc, a dark speaker face, a ring of holes. */
export function PuckFace({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={ORANGE} />
      <circle cx={cx} cy={cy} r={r * 0.7} fill={DARK} />
      <circle cx={cx} cy={cy} r={r * 0.48} stroke="#ffffff" strokeOpacity="0.7" strokeDasharray="1 6" />
      <circle cx={cx} cy={cy} r={r * 0.24} stroke="#ffffff" strokeOpacity="0.7" strokeDasharray="1 6" />
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
      <path d="M30 136h260" stroke={LINE} />
      <T x={30} y={158} mono size={10}>Origin</T>
      <path d="M84 154h150" stroke={LINE} strokeWidth="6" />
      <T x={30} y={178} mono size={10}>Voice</T>
      <path d="M84 174h110" stroke={LINE} strokeWidth="6" />
      <T x={30} y={198} mono size={10}>Sources</T>
      <rect x="84" y="187" width="92" height="16" rx="8" fill={SHADE} strokeWidth="1.5" />
      <T x={130} y={198.5} mono size={10} anchor="middle" fill={INK}>{EXAMPLE.documents} documents</T>
    </Svg>
  );
}

/** A corner of the schematic: the series resistor, the audio module and the speaker, in the app's net styles. */
export function SchematicFragment({ className }: { className?: string }) {
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
      <T x={200} y={44} mono size={10} anchor="middle">U3</T>
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
    </Svg>
  );
}

const STACK_SCALE = 2.5; // px per dollar
const CALLED_OUT = ["MCU dev board", "Battery holder", "Enclosure"];

/** The parts list as a stack: sixteen slabs, each as tall as its price, adding up to the total. */
export function CostStack({ className }: { className?: string }) {
  const slabs = EXAMPLE.partLines.map(([name, price], i) => ({
    name,
    price,
    i,
    at: EXAMPLE.partLines.slice(0, i).reduce((sum, [, p]) => sum + p * STACK_SCALE, 0),
  }));
  return (
    <Svg viewBox="0 0 300 246" className={className}>
      <g transform="translate(92 184)">
        <polygon points={poly(iso(-12, -12), iso(72, -12), iso(72, 72), iso(-12, 72))} fill={SHADE} stroke={LINE} />
        {slabs.map((s) => {
          const hot = CALLED_OUT.includes(s.name);
          return <IsoBox key={s.i} x={0} y={0} z={s.at} w={60} d={60} h={Math.max(1, s.price * STACK_SCALE)} top={hot ? ORANGE : PAPER} left={hot ? ORANGE : PAPER} right={hot ? ORANGE : SHADE} />;
        })}
        {slabs
          .filter((s) => CALLED_OUT.includes(s.name))
          .map((s) => {
            const [x, y] = iso(60, 30, s.at + (s.price * STACK_SCALE) / 2);
            return (
              <g key={s.i}>
                <path d={`M${x + 4} ${y}h26`} stroke={LINE} />
                <T x={x + 36} y={y - 1} size={11} fill={INK}>{s.name}</T>
                <T x={x + 36} y={y + 12} mono size={10}>${s.price.toFixed(2)}</T>
              </g>
            );
          })}
      </g>
    </Svg>
  );
}

/** Three ad drafts fanned out, one per voice pack, each still waiting for a yes. */
export function AdFan({ className }: { className?: string }) {
  const card = (name: string, turn: number, front: boolean) => (
    <g key={name} transform={`rotate(${turn} 160 300)`}>
      <rect x="104" y="36" width="112" height="150" rx="10" fill={front ? PAPER : SHADE} />
      <PuckFace cx={128} cy={60} r={11} />
      <T x={146} y={58} size={11} bold fill={INK}>{name}</T>
      <T x={146} y={71} mono size={9}>voice pack</T>
      <path d="M118 96h84M118 110h84M118 124h52" stroke={LINE} strokeWidth="6" />
      <rect x="118" y="150" width="48" height="20" rx="10" fill={front ? "var(--accent-orange-subtle)" : "none"} stroke={ORANGE} strokeWidth="1.5" />
      <T x={142} y={164} mono size={10} anchor="middle" fill="var(--link)">Draft</T>
    </g>
  );
  const [a, b, c] = EXAMPLE.voicePacks;
  return (
    <Svg viewBox="0 0 320 210" className={className}>
      {card(a, -16, false)}
      {card(c, 16, false)}
      {card(b, 0, true)}
    </Svg>
  );
}

/** A marketplace listing in draft: the picture, the name, the points, and no price or stars, because none exist. */
export function ListingCard({ className }: { className?: string }) {
  return (
    <Svg viewBox="0 0 320 200" className={className}>
      <rect x="11" y="11" width="298" height="178" rx="12" fill={PAPER} />
      <rect x="27" y="27" width="112" height="146" rx="8" fill={SHADE} />
      <rect x="58" y="62" width="50" height="78" rx="9" fill={PAPER} />
      <path d="M72 62V50h22v12" />
      <rect x="56" y="92" width="54" height="14" rx="2" fill={INK} />
      <PuckFace cx={83} cy={99} r={14} />
      <T x={156} y={48} size={14} bold fill={INK}>{EXAMPLE.name}</T>
      <T x={156} y={66} size={10}>A puck that straps to a suitcase</T>
      <T x={156} y={79} size={10}>and heckles the trip.</T>
      {[100, 118, 136].map((y) => (
        <g key={y}>
          <path d={`M157 ${y}l4 4 7-8`} stroke={ORANGE} />
          <path d={`M178 ${y}h${y === 136 ? 70 : 108}`} stroke={LINE} strokeWidth="6" />
        </g>
      ))}
      <rect x="156" y="154" width="52" height="20" rx="10" fill="var(--accent-orange-subtle)" stroke={ORANGE} strokeWidth="1.5" />
      <T x={182} y={168} mono size={10} anchor="middle" fill="var(--link)">Draft</T>
      <T x={218} y={168} mono size={10}>not live yet</T>
    </Svg>
  );
}
