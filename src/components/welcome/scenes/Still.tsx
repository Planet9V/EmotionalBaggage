// The drawn frames: one per scene, in the manner of an airline safety card (the owner's plan for how the moments
// are shown): flat colour, one weight of line, pictogram people, a number in the corner, no words in the picture
// beyond what the set carries (the scale's display; the tag's stamp in the button frame's magnified detail).
// They are what shows before the film has loaded, when the browser has no 3D, when the device cannot keep pace,
// under reduced motion and without script; small, they are the chapter list's thumbnails. The line and the
// "sensed" label are set over them as real text by the stage.
import { useId, type ReactNode } from "react";
import type { SceneId } from "./scenes";
import { FACE, SLOT, TAG_MM, tagPath } from "./film/tagShape";

const INK = "#1c2740";
const PAPER = "#eef2f6";
const CARD = "#ffffff";
const BLUE = "#2f6fed";
const PALE = "#cfdcee";
const GREY = "#aab4c0";
const SHELL = "#ecdcb6";
const RIB = "#cdb98a";
const SADDLE = "#b0703f";
const SADDLE_DARK = "#8a522a";
const THREAD = "#f1e4c3";
const GLOW = "#ffb15e";
const RED = "#e5484d";
const YELLOW = "#f5c518";
const MONO = "var(--font-mono)";
const FLOOR = 372;

// the tag, the owner's Rev D A1 "Saddle", in drawing units: half as large again as on the bag, so its shape reads
// on the card (the film has it at the bag's true scale)
const S = 0.4;
const TAG_OUTLINE = tagPath(S);
const TAG_STITCH = tagPath(S, 3);
const TH = TAG_MM.h * S;
/** A point on the tag's face (mm about its middle, y up) in the tag's drawing units (top middle at 0, 0). */
const at = (x: number, y: number) => [x * S, TH / 2 - y * S] as const;
const PANEL = { x: at(FACE.panel.x0, FACE.panel.y1), w: (FACE.panel.x1 - FACE.panel.x0) * S, h: (FACE.panel.y1 - FACE.panel.y0) * S };
const DOOR = at(FACE.door.x, FACE.door.y);
const SPEAKER = { x: at(FACE.speaker.x0, FACE.speaker.y1), w: (FACE.speaker.x1 - FACE.speaker.x0) * S, h: (FACE.speaker.y1 - FACE.speaker.y0) * S };
const OVAL = at(FACE.oval.x, FACE.oval.y);
const SLOT_AT = at(0, TAG_MM.h / 2 - SLOT.down);

/** The tag, hanging from (0, 0): its strap, the shouldered outline, the stitch line, the perforated panel, the stamp. */
function Tag() {
  return (
    <g>
      <path d={`M0 0V${3 + SLOT_AT[1]}`} strokeWidth="4" />
      <g transform="translate(0 3)" strokeWidth="1.5">
        <path d={TAG_OUTLINE} fill={SADDLE} />
        <path d={TAG_STITCH} fill="none" stroke={THREAD} strokeWidth="0.9" strokeDasharray="1.4 1.3" />
        <rect x={PANEL.x[0]} y={PANEL.x[1]} width={PANEL.w} height={PANEL.h} rx="1.2" fill={SADDLE_DARK} stroke="none" opacity="0.45" />
        <circle cx={DOOR[0]} cy={DOOR[1]} r={FACE.door.r * S} fill="none" stroke={SADDLE_DARK} strokeWidth="0.8" />
        <rect x={SPEAKER.x[0]} y={SPEAKER.x[1]} width={SPEAKER.w} height={SPEAKER.h} rx="1" fill={SADDLE_DARK} stroke="none" />
        <ellipse cx={OVAL[0]} cy={OVAL[1]} rx={FACE.oval.rx * S} ry={FACE.oval.ry * S} fill="none" stroke={SADDLE_DARK} strokeWidth="0.9" />
        <rect x={-(SLOT.w * S) / 2} y={SLOT_AT[1] - (SLOT.h * S) / 2} width={SLOT.w * S} height={SLOT.h * S} rx={(SLOT.h * S) / 2} fill={INK} stroke="none" />
      </g>
    </g>
  );
}

/** The suitcase, standing on (0, 0), with the tag strapped to its carry handle. `swing` turns the tag on its strap. */
function Bag({ swing = 6 }: { swing?: number }) {
  return (
    <g>
      <path d="M-16 -168v-22a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5v22" fill="none" />
      <rect x="-54" y="-168" width="108" height="150" rx="16" fill={SHELL} />
      <path d="M-32 -150v114M-16 -150v114M16 -150v114M32 -150v114" stroke={RIB} />
      {/* the carry handle on the top, and the tag's strap from it over the front edge */}
      <path d="M-12 -168v-6h48v6" fill="none" strokeWidth="2.5" />
      <path d="M26 -175V-156" strokeWidth="4" />
      <g transform={`translate(26 -156) rotate(${swing})`}>
        <Tag />
      </g>
      <circle cx="-30" cy="-9" r="9" fill={INK} />
      <circle cx="30" cy="-9" r="9" fill={INK} />
    </g>
  );
}

/** A pictogram person standing on (0, 0): a head, a body, legs. `arm` is a path for one raised arm. */
function Person({ fill = BLUE, arm, flip = false }: { fill?: string; arm?: string; flip?: boolean }) {
  return (
    <g transform={flip ? "scale(-1 1)" : undefined}>
      <rect x="-17" y="-92" width="34" height="92" rx="12" fill={INK} />
      <rect x="-27" y="-176" width="54" height="96" rx="22" fill={fill} />
      <circle cx="0" cy="-204" r="21" fill={CARD} />
      {arm ? <path d={arm} fill="none" stroke={fill} strokeWidth="17" /> : null}
      {arm ? <path d={arm} fill="none" /> : null}
    </g>
  );
}

// the close-up that opens the button scene, as a safety card draws one: a magnified circle with a leader to the tag
const DS = 1.25;
const DETAIL = tagPath(DS);
const DETAIL_STITCH = tagPath(DS, 3);
const dAt = (x: number, y: number) => [x * DS, (TAG_MM.h / 2 - y) * DS] as const;
function TagDetail() {
  // the frame is drawn more than once on the page (the stage and its thumbnail): each copy clips by its own id
  const clip = `wl-tag-detail-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [ox, oy] = dAt(FACE.oval.x, FACE.oval.y);
  const [, l1] = dAt(0, -33.8);
  const [, l2] = dAt(0, -38.4);
  const [px, py] = dAt(FACE.panel.x0, FACE.panel.y1);
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <circle cx="370" cy="182" r="64" />
        </clipPath>
      </defs>
      <path d="M432 198L520 220" strokeWidth="2" strokeDasharray="2 5" />
      <circle cx="370" cy="182" r="64" fill={CARD} />
      <g clipPath={`url(#${clip})`}>
        <g transform={`translate(370 ${182 - 60 * DS})`} strokeWidth="2">
          <path d={DETAIL} fill={SADDLE} />
          <path d={DETAIL_STITCH} fill="none" stroke={THREAD} strokeWidth="1.4" strokeDasharray="2.4 2" />
          <rect x={px} y={py} width={(FACE.panel.x1 - FACE.panel.x0) * DS} height={(FACE.panel.y1 - FACE.panel.y0) * DS} rx="3" fill={SADDLE_DARK} stroke="none" opacity="0.45" />
          <ellipse cx={ox} cy={oy} rx={FACE.oval.rx * DS} ry={FACE.oval.ry * DS} fill="none" stroke={SADDLE_DARK} strokeWidth="1.2" />
          <g fill={SADDLE_DARK} stroke="none" fontFamily="var(--font-sans, system-ui)" fontWeight="800" textAnchor="middle">
            <text x={ox} y={oy - 3} fontSize="7.4" letterSpacing="0.8">BAGGAGE</text>
            <text x={ox} y={oy + 5.4} fontSize="7.4" letterSpacing="0.8">CLAIMS</text>
            <text x={ox} y={oy + 12} fontSize="4.6" letterSpacing="1.4">MK1</text>
            <text x={0} y={l1 + 2} fontSize="5.2">Your luggage</text>
            <text x={0} y={l2 + 2} fontSize="5.2">finally talks back.</text>
          </g>
        </g>
      </g>
      <circle cx="370" cy="182" r="64" fill="none" strokeWidth="3" />
    </g>
  );
}

function Scale({ lean, detail = false }: { lean: number; detail?: boolean }) {
  return (
    <>
      <g transform="translate(250 372)">
        <Person arm="M20 -150l34 30" />
      </g>
      <rect x="150" y="268" width="150" height="104" rx="10" fill={CARD} />
      <rect x="164" y="292" width="122" height="48" rx="4" fill={BLUE} stroke="none" />
      <rect x="385" y={FLOOR - 18} width="210" height="18" rx="5" fill={GREY} />
      <path d={`M385 ${FLOOR - 4}h210`} stroke={YELLOW} strokeWidth="5" />
      <g transform={`translate(490 ${FLOOR - 18}) rotate(${lean})`}>
        <Bag swing={lean < 0 ? 12 : -8} />
      </g>
      <path d={`M705 ${FLOOR}V250`} strokeWidth="6" />
      <rect x="622" y="118" width="212" height="134" rx="14" fill={INK} />
      <text x="776" y="196" fontFamily={MONO} fontSize="62" fontWeight="700" fill={CARD} stroke="none" textAnchor="end">62.0</text>
      <text x="782" y="196" fontFamily={MONO} fontSize="20" fill={PALE} stroke="none">lbs</text>
      <circle cx="652" cy="226" r="9" fill={RED} stroke="none" />
      <text x="670" y="233" fontFamily={MONO} fontSize="19" fontWeight="700" fill={RED} stroke="none">OVERWEIGHT</text>
      {detail ? <TagDetail /> : null}
    </>
  );
}

const FRAMES: Record<SceneId, { dark?: boolean; art: ReactNode }> = {
  handle: {
    art: (
      <>
        <path d={`M120 ${FLOOR + 26}h720`} stroke={GREY} strokeWidth="10" />
        <rect x="610" y="150" width="150" height="222" rx="6" fill={PALE} />
        <path d="M685 150v222" />
        <g transform={`translate(372 ${FLOOR})`}>
          <Person fill="#2f6b62" arm="M22 -156L112 -196" />
        </g>
        <g transform={`translate(498 ${FLOOR - 44}) rotate(7 0 -195)`}>
          <Bag swing={-14} />
        </g>
        <path d={`M452 ${FLOOR - 14}q46 22 92 0M470 ${FLOOR + 6}q28 12 56 0`} fill="none" stroke={GREY} />
        <path d="M580 300v-64m-14 16l14-16l14 16" fill="none" stroke={RED} strokeWidth="5" />
      </>
    ),
  },
  scale: { art: <Scale lean={-8} /> },
  button: { art: <Scale lean={6} detail /> },
  toss: {
    art: (
      <>
        <g transform={`translate(236 ${FLOOR})`}>
          <Person fill="#d9e021" arm="M22 -156L74 -216" />
        </g>
        <rect x="118" y="290" width="74" height="60" rx="8" fill={PALE} />
        <circle cx="136" cy="360" r="11" fill={INK} />
        <circle cx="176" cy="360" r="11" fill={INK} />
        <path d="M318 196Q470 20 640 250" fill="none" stroke={INK} strokeDasharray="4 16" strokeWidth="5" />
        <g transform="translate(500 236) rotate(152 0 -94) scale(0.82)">
          <Bag swing={-40} />
        </g>
        <path d={`M590 ${FLOOR - 62}h250l-12 22h-226z`} fill={GREY} />
        <path d={`M620 ${FLOOR - 40}v40M800 ${FLOOR - 40}v40`} />
        <path d="M640 270l-10 -26M664 262l4 -28M690 270l16 -22" fill="none" stroke={RED} strokeWidth="5" />
      </>
    ),
  },
  hold: {
    dark: true,
    art: (
      <>
        <path d="M150 62h660v310H150z" fill="#111a2e" stroke="none" />
        <path d="M150 110L412 372M150 220l152 152M230 62l310 310M370 62l310 310M510 62l300 300M650 62l160 160M810 110L548 372M810 220L658 372M730 62L420 372M590 62L280 372M450 62L150 362M310 62L150 222" stroke="#2a3a5c" fill="none" />
        <rect x="350" y={FLOOR - 26} width="270" height="16" rx="4" fill="#0b101c" stroke="#44557c" />
        <circle cx="400" cy={FLOOR - 2} r="11" fill="#0b101c" stroke="#44557c" />
        <circle cx="570" cy={FLOOR - 2} r="11" fill="#0b101c" stroke="#44557c" />
        <circle cx="521" cy={FLOOR - 160} r="40" fill={GLOW} opacity="0.22" stroke="none" />
        <g transform={`translate(486 ${FLOOR - 26}) rotate(4)`} stroke="#0b101c">
          <Bag swing={0} />
        </g>
        <text x="572" y={FLOOR - 196} fontFamily={MONO} fontSize="24" fontWeight="700" fill={PALE} stroke="none">z</text>
        <text x="596" y={FLOOR - 224} fontFamily={MONO} fontSize="32" fontWeight="700" fill={PALE} stroke="none">z</text>
        <text x="626" y={FLOOR - 258} fontFamily={MONO} fontSize="42" fontWeight="700" fill={PALE} stroke="none">z</text>
      </>
    ),
  },
  carousel: {
    art: (
      <>
        <ellipse cx="480" cy={FLOOR - 52} rx="330" ry="84" fill={INK} />
        <ellipse cx="480" cy={FLOOR - 64} rx="196" ry="42" fill={PALE} />
        <path d="M168 300l44 14M214 366l34-26M330 394l12-40M480 404v-40M630 394l-12-40M746 366l-34-26M792 300l-44 14" stroke={GREY} fill="none" />
        <rect x="236" y={FLOOR - 142} width="78" height="54" rx="10" fill={BLUE} />
        <rect x="652" y={FLOOR - 150} width="60" height="68" rx="12" fill="#2f8f83" />
        <g transform={`translate(486 ${FLOOR - 4}) rotate(-10)`}>
          <Bag swing={24} />
        </g>
        <path d="M604 144a150 44 0 0 1 150 62m-2 -26l2 26l-24 -8" fill="none" stroke={RED} strokeWidth="5" />
      </>
    ),
  },
};

/** One frame. `thumb` is the small one in the chapter list: the picture without the card's border and number. */
export function Still({ scene, n, thumb = false }: { scene: SceneId; n: number; thumb?: boolean }) {
  const frame = FRAMES[scene];
  return (
    <svg viewBox={thumb ? "150 62 660 371" : "0 0 960 540"} preserveAspectRatio="xMidYMid slice" className={thumb ? "wl-ill block h-full w-full" : "wl-ill absolute inset-0 h-full w-full"} fill="none" stroke={INK} strokeWidth={thumb ? 1.5 : 3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="-200" y="-100" width="1360" height="740" fill={PAPER} stroke="none" />
      <rect x="150" y="62" width="660" height="372" rx="18" fill={frame.dark ? "#0b101c" : CARD} stroke="none" />
      {frame.dark ? null : <path d={`M150 ${FLOOR}H810`} stroke={PALE} />}
      {frame.art}
      {thumb ? null : (
        <>
          <rect x="150" y="62" width="660" height="372" rx="18" strokeWidth="2" />
          <circle cx="196" cy="108" r="24" fill={INK} stroke="none" />
          <text x="196" y="118" fontFamily={MONO} fontSize="28" fontWeight="700" fill={CARD} stroke="none" textAnchor="middle">{n}</text>
        </>
      )}
    </svg>
  );
}
