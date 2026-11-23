// The owner's tag (Rev D, A1 "Saddle") as a drawing: the front face, square on, at any size. Everything is worked
// out from the same numbers the film builds its 3D tag from (scenes/film/tagShape.ts): the shouldered outline, the
// stitch line 3 mm in, every hole of the perforated panel on its lattice, the coin door, the oval maker's mark and
// the tagline, and the strap through its slot. Drawn in millimetres, so one unit of the drawing is one millimetre of
// the tag. No script: a server component can render it, and it is what the hero shows before (and without) its 3D.
import { useId } from "react";
import { FACE, HOLE, SLOT, STRAP, TAG_MM, perforationRuns, rounded, stitchRuns, tagOutline, tagPath, type P2 } from "./scenes/film/tagShape";

const { w: W, h: H } = TAG_MM;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** mm about the tag's middle, y up -> the drawing (origin at the tag's middle, y down) */
const Y = (y: number) => r2(-y);

// worked out once: the drawing is the same wherever it is used
const OUTLINE = tagPath(1);
const BEVEL = tagPath(1, 0.7);
const STITCH = stitchRuns(tagOutline(3, 6).map(([x, y]): P2 => [x, -y]), 3.4, 2.2, 0.49)
  .map(([a, b]) => `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`)
  .join("");
const holes = (through: boolean) =>
  perforationRuns()
    .filter((r) => r.through === through)
    .map((r) => `M${r2(r.x)} ${Y(r.y)}h${r2(Math.max(0.01, (r.n - 1) * HOLE.pitch))}`)
    .join("");
const BLIND = holes(false);
const THROUGH = holes(true);
const SLOT_Y = -(H / 2 - SLOT.down);

const INK = "#4a2810";
const LIP = "#ffe2be";
const THREAD = "#f1e4c3";

/** The words pressed into the face: darker, with a hair of light along the lower lip of the stamp. */
function Stamped({ y, size, spacing, children }: { y: number; size: number; spacing: number; children: string }) {
  return (
    <>
      <text x={0} y={y + 0.3} fontSize={size} letterSpacing={spacing} fill={LIP} fillOpacity={0.3}>{children}</text>
      <text x={0} y={y} fontSize={size} letterSpacing={spacing} fill={INK} fillOpacity={0.72}>{children}</text>
    </>
  );
}

/** What is on the front: the perforated panel, the maker's mark, the tagline and the stitch line. */
function Front() {
  const { panel: p, door: d, oval: o } = FACE;
  return (
    <>
      {/* the perforated panel: pressed smooth, its holes, the coin door's parting line and coin slot */}
      <rect x={p.x0} y={Y(p.y1)} width={p.x1 - p.x0} height={p.y1 - p.y0} rx="2.5" fill="#bb7c49" fillOpacity="0.55" />
      <rect x={p.x0} y={Y(p.y1) + 0.3} width={p.x1 - p.x0} height={p.y1 - p.y0} rx="2.5" fill="none" stroke={LIP} strokeOpacity="0.32" strokeWidth="0.35" />
      <rect x={p.x0} y={Y(p.y1)} width={p.x1 - p.x0} height={p.y1 - p.y0} rx="2.5" fill="none" stroke="#3c1e0a" strokeOpacity="0.5" strokeWidth="0.35" />
      <g fill="none" strokeLinecap="round" strokeWidth={HOLE.r * 2} strokeDasharray={`0 ${HOLE.pitch}`}>
        <path d={BLIND} stroke="#5a3115" strokeOpacity="0.62" />
        <path d={THROUGH} stroke="#160b04" strokeOpacity="0.92" />
      </g>
      <circle cx={d.x} cy={Y(d.y)} r={d.r} fill="none" stroke="#3c1e0a" strokeOpacity="0.55" strokeWidth="0.35" />
      <rect x={d.x - 4} y={Y(d.y) - 0.5} width="8" height="1" rx="0.5" fill="#281408" fillOpacity="0.75" />

      {/* the maker's mark and the tagline, blind-stamped */}
      <ellipse cx={o.x} cy={Y(o.y) + 0.3} rx={o.rx} ry={o.ry} fill="none" stroke={LIP} strokeOpacity="0.28" strokeWidth="0.6" />
      <ellipse cx={o.x} cy={Y(o.y)} rx={o.rx} ry={o.ry} fill="#9c5f31" fillOpacity="0.22" stroke={INK} strokeOpacity="0.6" strokeWidth="0.6" />
      <g fontFamily="var(--font-sans, 'Inter Variable', Inter, system-ui, sans-serif)" fontWeight="800" textAnchor="middle" dominantBaseline="central">
        <Stamped y={12.5} size={6.2} spacing={0.7}>BAGGAGE</Stamped>
        <Stamped y={19.1} size={6.2} spacing={0.7}>CLAIMS</Stamped>
        <Stamped y={25.6} size={4} spacing={1.2}>MK1</Stamped>
        <Stamped y={33.8} size={4.3} spacing={0.15}>Your luggage</Stamped>
        <Stamped y={38.4} size={4.3} spacing={0.15}>finally talks back.</Stamped>
      </g>
      <path d="M-13 25.6h8M5 25.6h8" stroke={INK} strokeOpacity="0.6" strokeWidth="0.5" />

      {/* saddle stitching, 3 mm in: a shadow under each stitch, then the cream thread */}
      <g fill="none" strokeLinecap="round">
        <path d={STITCH} transform="translate(0.25 0.35)" stroke="#3c1e0a" strokeOpacity="0.45" strokeWidth="1" />
        <path d={STITCH} stroke={THREAD} strokeWidth="0.9" />
      </g>

    </>
  );
}

const PLATE = FACE.plate;
const CARD = FACE.card;
const DOOR = FACE.tracker;
const BACK_STITCH = stitchRuns(
  rounded(
    [
      [PLATE.x0 + 2.2, -PLATE.y0 - 2.2],
      [PLATE.x1 - 2.2, -PLATE.y0 - 2.2],
      [PLATE.x1 - 2.2, -PLATE.y1 + 2.2],
      [PLATE.x0 + 2.2, -PLATE.y1 + 2.2],
    ],
    [2, 2, 2, 2],
  ),
  3.4,
  2.2,
  0.49,
)
  .map(([a, b]) => `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`)
  .join("");

/** What is on the back, as seen from the back: the plate with its own stitching, the name card in its window, the tracker door and its line. */
function Back() {
  return (
    <>
      <rect x={PLATE.x0} y={Y(PLATE.y1)} width={PLATE.x1 - PLATE.x0} height={PLATE.y1 - PLATE.y0} rx="3" fill="none" stroke="#281408" strokeOpacity="0.65" strokeWidth="0.4" />
      <g fill="none" strokeLinecap="round">
        <path d={BACK_STITCH} transform="translate(0.25 0.35)" stroke="#3c1e0a" strokeOpacity="0.45" strokeWidth="1" />
        <path d={BACK_STITCH} stroke={THREAD} strokeWidth="0.9" />
      </g>
      <rect x={CARD.x0} y={Y(CARD.y1)} width={CARD.x1 - CARD.x0} height={CARD.y1 - CARD.y0} rx="1.6" fill="#f6f1e6" stroke="#281408" strokeOpacity="0.55" strokeWidth="0.5" />
      <path d={`M${CARD.x0 + 13} ${Y(CARD.y1) + 6.8}h30M${CARD.x0 + 5} ${Y(CARD.y1) + 12.8}h38M${CARD.x0 + 19} ${Y(CARD.y1) + 18.8}h24`} stroke="#a9a49a" strokeWidth="1.6" />
      <circle cx={DOOR.x} cy={Y(DOOR.y)} r={DOOR.r} fill="#9c5f31" fillOpacity="0.18" stroke="#281408" strokeOpacity="0.6" strokeWidth="0.4" />
      <rect x={DOOR.x - 3} y={Y(DOOR.y) - 12.4} width="6" height="1" rx="0.5" fill="#281408" fillOpacity="0.7" />
      <g fontFamily="var(--font-sans, 'Inter Variable', Inter, system-ui, sans-serif)" textAnchor="middle" dominantBaseline="central">
        <text x={DOOR.x} y={Y(DOOR.y) - 5.9} fontSize="6" fontWeight="800" fill={THREAD}>FRAGILE</text>
        <g fontWeight="700" transform={`translate(${DOOR.x} ${Y(DOOR.y)})`}>
          <Stamped y={0.2} size={3.6} spacing={0.2}>— and —</Stamped>
          <Stamped y={4.9} size={4.3} spacing={0.15}>emotionally</Stamped>
          <Stamped y={9.2} size={4.3} spacing={0.15}>unstable.</Stamped>
        </g>
      </g>
    </>
  );
}

/** The drawing's box, for anything laid over it: the tag about its middle, `strap` mm of strap above, `margin` mm round it. */
export const tagViewBox = (strap: number, margin: number) => `${-W / 2 - margin} ${-H / 2 - strap} ${W + margin * 2} ${H + strap + margin + 3}`;

/**
 * The tag. `strap` is how many millimetres of strap rise above its top edge (0 leaves the strap out); `margin` is
 * the clear space round it, for its shadow. `label` names it for a reader; without one it is decoration.
 */
export function TagArt({ strap = 22, margin = 5, shadow = true, grain = true, side = "front", label, className = "" }: { strap?: number; margin?: number; shadow?: boolean; /** the leather's grain: left out of the small drawings */ grain?: boolean; side?: "front" | "back"; label?: string; className?: string }) {
  const id = `wl-tag-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const top = -H / 2 - strap;
  const back = side === "back";
  return (
    <svg viewBox={tagViewBox(strap, margin)} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <defs>
        <linearGradient id={`${id}-leather`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#cf9763" />
          <stop offset="0.42" stopColor="#b0703f" />
          <stop offset="1" stopColor="#8e5429" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0dc" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff0dc" stopOpacity="0" />
          <stop offset="1" stopColor="#2a1206" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`${id}-strap`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#15171a" />
          <stop offset="0.3" stopColor="#34383f" />
          <stop offset="1" stopColor="#121316" />
        </linearGradient>
        {/* the pebble grain of the leather-look print: fine noise, darkening only, kept off the pressed areas */}
        <filter id={`${id}-grain`} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.7" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 0.18  0 0 0 0 0.08  0 0 0 0 0.02  0 0 0 -1.6 1.02" />
        </filter>
        <filter id={`${id}-soft`} x="-0.3" y="-0.3" width="1.6" height="1.6">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <clipPath id={`${id}-body`}>
          <path d={OUTLINE} transform={`translate(0 ${-H / 2})`} />
        </clipPath>
      </defs>

      {shadow ? <path d={OUTLINE} transform={`translate(2.2 ${-H / 2 + 3})`} fill="#000" opacity="0.5" filter={`url(#${id}-soft)`} /> : null}
      {/* the strap's far strand, behind the tag */}
      {strap > 0 ? <rect x={-STRAP.w / 2 + 0.8} y={top + 1} width={STRAP.w - 1.6} height={strap + 4} fill="#0c0d0f" /> : null}

      <g transform={`translate(0 ${-H / 2})`}>
        <path d={OUTLINE} fill={`url(#${id}-leather)`} />
      </g>
      {grain ? <rect x={-W / 2} y={-H / 2} width={W} height={H} filter={`url(#${id}-grain)`} clipPath={`url(#${id}-body)`} opacity="0.2" /> : null}
      <g transform={`translate(0 ${-H / 2})`} fill="none">
        <path d={BEVEL} stroke={`url(#${id}-edge)`} strokeWidth="1.1" />
        <path d={OUTLINE} stroke="#5f3516" strokeWidth="0.5" />
      </g>

      {back ? <Back /> : <Front />}

      {/* the slot, and the strap's near strand rising from it */}
      <rect x={-SLOT.w / 2} y={SLOT_Y - SLOT.h / 2} width={SLOT.w} height={SLOT.h} rx={SLOT.h / 2} fill="#0b0b0c" />
      {strap > 0 ? (
        <>
          <rect x={-STRAP.w / 2} y={top} width={STRAP.w} height={SLOT_Y - top + 0.4} rx="1.6" fill={`url(#${id}-strap)`} />
          <path d={`M${-STRAP.w / 2} ${-H / 2 - 0.2}h${STRAP.w}`} stroke="#000" strokeOpacity="0.35" strokeWidth="0.6" />
        </>
      ) : null}
    </svg>
  );
}
