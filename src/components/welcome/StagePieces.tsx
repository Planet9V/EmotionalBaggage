"use client";

// The drawings that move with time: the puck coming apart and going back together, a shell printing, a pulse
// crossing the schematic, the parts cost stacking up to its total. Each one runs off a single looping value
// (useLoop): 0 to 1, over and over, while the drawing is on screen. At rest that value is 1, and every drawing is
// built so that 1 is its finished pose: the puck apart with its labels, the print complete, the stack whole and
// the total showing. That is also what the server sends, so nothing here depends on script to be read.
import { useRef, type ReactNode } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { AdFan, IsoBox, IsoCyl, IsoRing, ListingCard, SchematicFragment, Svg, T, iso } from "./Illustrations";
import { useLoop } from "./useAnimated";
import { ADS_NOTE, COST, EXAMPLE, LISTING_NOTE, PRINT_NOTE, PUCK_LAYERS, SCHEMATIC_NOTE } from "./content";

const ORANGE = "var(--accent-orange)";
const smooth = (v: number) => v * v * (3 - 2 * v);
const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 before `from`, 1 after `to`, eased between. */
const ramp = (v: number, from: number, to: number) => smooth(clamp((v - from) / (to - from)));

// ───────── the puck

const GAP = 60; // between layers when apart
const CLOSED = 16; // and when together

function Layer({ i, apart, reach, children }: { i: number; apart: MotionValue<number>; reach: number; children: ReactNode }) {
  const y = useTransform(apart, (a) => -(i - 2) * (GAP - CLOSED) * (1 - a));
  // the leader line draws in, and its label follows, once the layers are nearly apart
  const drawn = useTransform(apart, (a) => clamp((a - 0.55) / 0.4));
  return (
    <motion.g style={{ y }}>
      <g transform={`translate(90 ${52 + i * GAP})`}>
        {children}
        <motion.g style={{ opacity: drawn }}>
          <circle cx={reach} cy="6" r="2.5" fill="var(--text-primary)" stroke="none" />
          <motion.path d={`M${reach} 6H136`} strokeWidth="1.5" style={{ scaleX: drawn, transformOrigin: `${reach}px 6px`, transformBox: "view-box" }} />
          <T x={143} y={10} mono size={12}>{PUCK_LAYERS[i]}</T>
        </motion.g>
      </g>
    </motion.g>
  );
}

/** The puck in five isometric layers. Over a lap it closes up, rests, comes apart again and rests apart. */
function PuckExploded({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, 10);
  const apart = useTransform(t, (v) => (v < 0.4 ? 1 - ramp(v, 0.08, 0.3) : ramp(v, 0.42, 0.68)));
  return (
    <div ref={ref} className={`aspect-[350/340] ${className}`}>
    <Svg viewBox="0 0 350 340" className="block h-full w-full" label={`An exploded view of the puck. From the top: ${PUCK_LAYERS.join(", ")}.`}>
      <g>
        <path d="M90 40V300" stroke="var(--border-hairline)" strokeDasharray="3 5" strokeWidth="1.5" />
        <Layer i={4} apart={apart} reach={70}>
          <IsoCyl r={52} h={18} side="var(--bg-subtle)" top="var(--bg-surface)" />
          <IsoRing z={18} r={44} fill="var(--bg-subtle)" />
        </Layer>
        <Layer i={3} apart={apart} reach={62}>
          <IsoBox x={-34} y={-26} w={68} d={52} h={12} />
          {[-14, 0, 14].map((y) => {
            const [ax, ay] = iso(-22, y, 16);
            const [bx, by] = iso(22, y, 16);
            return (
              <g key={y}>
                <path d={`M${ax} ${ay}L${bx} ${by}`} strokeWidth="13" />
                <path d={`M${ax} ${ay}L${bx} ${by}`} strokeWidth="9" stroke="var(--bg-surface)" />
              </g>
            );
          })}
        </Layer>
        <Layer i={2} apart={apart} reach={62}>
          <IsoBox x={-34} y={-34} w={68} d={68} h={4} top="var(--success-soft)" left="var(--success-soft)" right="var(--success-soft)" />
          <IsoBox x={-12} y={-12} z={4} w={24} d={24} h={4} top="var(--text-primary)" left="var(--text-primary)" right="var(--text-primary)" />
          <IsoBox x={14} y={-28} z={4} w={12} d={18} h={3} />
          <IsoBox x={-28} y={12} z={4} w={18} d={10} h={3} />
        </Layer>
        <Layer i={1} apart={apart} reach={40}>
          <IsoCyl r={28} h={9} />
          <IsoRing z={9} r={19} fill="var(--bg-subtle)" />
          <IsoRing z={9} r={7} fill="var(--text-primary)" />
        </Layer>
        <Layer i={0} apart={apart} reach={70}>
          <IsoCyl r={52} h={12} side={ORANGE} top={ORANGE} />
          <IsoRing z={12} r={34} fill="#16181d" />
          <IsoRing z={12} r={23} stroke="#ffffff" strokeDasharray="1 6" />
          <IsoRing z={12} r={11} stroke="#ffffff" strokeDasharray="1 6" />
        </Layer>
      </g>
    </Svg>
    </div>
  );
}

// ───────── the print

const LAYERS = 10;
const LAYER_H = 6;
const PRINT_FROM = 0.1; // the lap: clear the bed, print to PRINT_TO, then hold the finished part
const PRINT_TO = 0.78;
const layerAt = (i: number) => PRINT_FROM + (i / LAYERS) * (PRINT_TO - PRINT_FROM);

function PrintLayer({ i, t }: { i: number; t: MotionValue<number> }) {
  const opacity = useTransform(t, (v) => (v < PRINT_FROM ? 1 - clamp(v / 0.05) : clamp((v - layerAt(i)) / 0.03)));
  return (
    <motion.g style={{ opacity }}>
      <IsoCyl z={8 + i * LAYER_H} r={46} h={LAYER_H} side={ORANGE} top={ORANGE} />
      <IsoRing z={8 + (i + 1) * LAYER_H} r={38} fill={i < 2 ? ORANGE : "var(--bg-subtle)"} />
    </motion.g>
  );
}

/** The shell base on the print bed: ten layers laid one after another under a nozzle that moves, then a rest. */
export function PrintBuild({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, 11);
  const top = 8 + LAYERS * LAYER_H;
  // the nozzle climbs with the part and sweeps across it while it prints; parked at the top otherwise
  const lift = useTransform(t, (v) => (1 - clamp((v - PRINT_FROM) / (PRINT_TO - PRINT_FROM))) * (LAYERS * LAYER_H));
  const sweep = useTransform(t, (v) => (v > PRINT_FROM && v < PRINT_TO ? Math.sin(v * Math.PI * 2 * 16) * 44 : 0));
  return (
    <div ref={ref} className={`aspect-[320/250] ${className}`}>
    <Svg viewBox="0 0 320 250" className="block h-full w-full">
      <g transform="translate(160 150)">
        <IsoBox x={-74} y={-74} w={148} d={148} h={8} />
        {Array.from({ length: LAYERS }, (_, i) => (
          <PrintLayer key={i} i={i} t={t} />
        ))}
        <motion.g style={{ y: lift }}>
          <path d={`M-150 ${-top - 44}H150`} stroke="var(--border-hairline)" strokeWidth="6" />
          <motion.g style={{ x: sweep }}>
            <rect x="-15" y={-top - 58} width="30" height="30" rx="4" fill="var(--bg-surface)" />
            <path d={`M-9 ${-top - 28}h18l-9 14z`} fill="var(--text-primary)" />
          </motion.g>
        </motion.g>
      </g>
    </Svg>
    </div>
  );
}

// ───────── the schematic

/** A pulse leaves the MCU pin, passes the resistor, enters the audio module, and the speaker sounds. */
function SchematicLive() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, 4.5);
  const x = useTransform(t, [0.05, 0.5], [12, 150], { clamp: true });
  const dot = useTransform(t, [0, 0.05, 0.47, 0.5], [0, 1, 1, 0]);
  const x2 = useTransform(t, [0.56, 0.72], [250, 302], { clamp: true });
  const dot2 = useTransform(t, [0.54, 0.56, 0.7, 0.72], [0, 1, 1, 0]);
  const lit = useTransform(t, [0.48, 0.53, 0.62], [0, 0.9, 0]);
  const wave1 = useTransform(t, [0.7, 0.76, 0.9], [0, 1, 0]);
  const wave2 = useTransform(t, [0.76, 0.82, 0.96], [0, 1, 0]);
  return (
    <div ref={ref} className="mt-2">
    <SchematicFragment className="block h-auto w-full">
      <motion.rect x="150" y="52" width="100" height="96" rx="4" stroke={ORANGE} strokeWidth="3" style={{ opacity: lit }} />
      <motion.circle cy="84" r="5" fill="var(--net-signal)" stroke="none" style={{ x, opacity: dot }} />
      <motion.circle cy="84" r="5" fill="var(--net-audio)" stroke="none" style={{ x: x2, opacity: dot2 }} />
      <motion.circle cy="116" r="5" fill="var(--net-audio)" stroke="none" style={{ x: x2, opacity: dot2 }} />
      <motion.path d="M342 84a22 22 0 0 1 0 32" stroke="var(--net-audio)" style={{ opacity: wave1 }} />
      <motion.path d="M349 74a36 36 0 0 1 0 52" stroke="var(--net-audio)" style={{ opacity: wave2 }} />
    </SchematicFragment>
    </div>
  );
}

// ───────── the cost

const STACK_SCALE = 2.5; // px per dollar
const CALLED_OUT = ["MCU dev board", "Battery holder", "Enclosure"];
const STACK_FROM = 0.06; // the lap: clear, stack to STACK_TO, then hold the whole stack and its total
const STACK_TO = 0.66;
const SLABS = EXAMPLE.partLines.map(([name, price], i) => ({
  name,
  price,
  i,
  at: EXAMPLE.partLines.slice(0, i).reduce((sum, [, p]) => sum + p * STACK_SCALE, 0),
  lands: STACK_FROM + ((i + 1) / EXAMPLE.partLines.length) * (STACK_TO - STACK_FROM),
  sum: EXAMPLE.partLines.slice(0, i + 1).reduce((sum, [, p]) => sum + p, 0),
}));

function Slab({ s, t }: { s: (typeof SLABS)[number]; t: MotionValue<number> }) {
  const hot = CALLED_OUT.includes(s.name);
  const opacity = useTransform(t, (v) => (v < STACK_FROM ? 1 - clamp(v / 0.04) : clamp((v - (s.lands - 0.03)) / 0.02)));
  const y = useTransform(t, (v) => (v < STACK_FROM ? 0 : (1 - ramp(v, s.lands - 0.03, s.lands)) * -18));
  const [x, ly] = iso(60, 30, s.at + (s.price * STACK_SCALE) / 2);
  return (
    <motion.g style={{ opacity, y }}>
      <IsoBox x={0} y={0} z={s.at} w={60} d={60} h={Math.max(1, s.price * STACK_SCALE)} top={hot ? ORANGE : "var(--bg-surface)"} left={hot ? ORANGE : "var(--bg-surface)"} right={hot ? ORANGE : "var(--bg-subtle)"} />
      {hot ? (
        <>
          <path d={`M${x + 4} ${ly}h26`} stroke="var(--border-hairline)" />
          <T x={x + 36} y={ly - 1} size={11} fill="var(--text-primary)">{s.name}</T>
          <T x={x + 36} y={ly + 12} mono size={10}>${s.price.toFixed(2)}</T>
        </>
      ) : null}
    </motion.g>
  );
}

/**
 * The parts list as a stack, sixteen slabs each as tall as its price, landing one by one while the total beside
 * them adds up; then the whole stack and the full total hold before the next lap.
 */
export function CostBuild({ className = "", figureClassName = "text-3xl" }: { className?: string; figureClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLSpanElement>(null);
  const t = useLoop(ref, 13);
  useMotionValueEvent(t, "change", (v) => {
    const landed = v < STACK_FROM ? SLABS.length : SLABS.filter((s) => v >= s.lands).length;
    const text = (landed ? SLABS[landed - 1]!.sum : 0).toFixed(2);
    if (figure.current && figure.current.textContent !== text) figure.current.textContent = text;
  });
  return (
    <div ref={ref} className={`flex items-center gap-3 ${className}`}>
      <Svg viewBox="0 0 300 246" className="block h-full min-w-0 max-w-full">
        <g transform="translate(92 184)">
          <path d={`M${iso(-12, -12).join(" ")}L${iso(72, -12).join(" ")}L${iso(72, 72).join(" ")}L${iso(-12, 72).join(" ")}z`} fill="var(--bg-subtle)" stroke="var(--border-hairline)" />
          {SLABS.map((s) => (
            <Slab key={s.i} s={s} t={t} />
          ))}
        </g>
      </Svg>
      <p className={`shrink-0 font-mono font-semibold tabular-nums tracking-tight text-primary ${figureClassName}`}>
        <span className="sr-only">${COST.value.toFixed(2)}</span>
        <span aria-hidden="true">
          $<span ref={figure}>{COST.value.toFixed(2)}</span>
        </span>
      </p>
    </div>
  );
}

// ───────── the boxes they sit in, inside the journey

function Box({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <figure className="rounded-xl border border-hairline bg-surface p-4">
      <figcaption className="text-sm font-semibold text-primary">{title}</figcaption>
      {children}
      {note ? <p className="mt-2 text-[13px] leading-relaxed text-secondary">{note}</p> : null}
    </figure>
  );
}

const PICTURE = "mx-auto mt-2 w-full max-w-[250px]";
const FLAT = "mx-auto mt-2 block h-auto w-full max-w-[250px]";

export const STAGE_PICTURE = {
  exploded: (
    <Box title="The puck, taken apart">
      <PuckExploded className={PICTURE} />
    </Box>
  ),
  schematic: (
    <Box title="A corner of the schematic" note={SCHEMATIC_NOTE}>
      <SchematicLive />
    </Box>
  ),
  layers: (
    <Box title="The shell base, layer by layer" note={PRINT_NOTE}>
      <PrintBuild className={PICTURE} />
    </Box>
  ),
  cost: (
    <Box title="The parts cost, stacked" note={COST.label}>
      <CostBuild className="mt-2 h-[190px]" figureClassName="text-2xl" />
    </Box>
  ),
  ads: (
    <Box title="Ad drafts" note={ADS_NOTE}>
      <AdFan className={FLAT} />
    </Box>
  ),
  listing: (
    <Box title="The listing" note={LISTING_NOTE}>
      <ListingCard className={FLAT} />
    </Box>
  ),
} as const;
