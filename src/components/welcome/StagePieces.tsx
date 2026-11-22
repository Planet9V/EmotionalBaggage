"use client";

// The pictures that sit inside the journey, one per stage that has something to show: the puck taken apart
// (Design), a corner of its schematic (Design), a shell printing (Prototype), the parts cost as a stack with its
// total counting up (Production), the ad drafts (Marketing) and the listing (Sales). Each is drawn still and
// complete by the server. On a wide screen, for a visitor who has not asked for reduced motion, the puck and
// the print follow the scroll position of their own box and the total counts once when it comes into view.
import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useInView, useMotionValue, useScroll, useTransform, type MotionValue } from "motion/react";
import { AdFan, CostStack, IsoBox, IsoCyl, IsoRing, ListingCard, SchematicFragment, Svg, T, iso } from "./Illustrations";
import { useAnimated, useWide } from "./useAnimated";
import { ADS_NOTE, COST, LISTING_NOTE, PRINT_NOTE, PUCK_LAYERS, SCHEMATIC_NOTE } from "./content";

const BOX = "rounded-xl border border-hairline bg-surface p-5";
const ORANGE = "var(--accent-orange)";

/** 0 to 1 as the box rises from the bottom of the window to a third of the way down it. */
function useRise() {
  const ref = useRef<HTMLDivElement>(null);
  const animated = useAnimated();
  const wide = useWide();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.95", "start 0.3"] });
  return { ref, progress: scrollYProgress, linked: animated && wide };
}

type Follow = { progress: MotionValue<number>; linked: boolean };

const GAP = 60; // between layers when apart
const CLOSED = 16; // and when together

function Layer({ i, follow, reach, children }: { i: number; follow?: Follow; reach: number; children: ReactNode }) {
  const apart = useMotionValue(1);
  const y = useTransform(follow?.progress ?? apart, [0, 1], [-(i - 2) * (GAP - CLOSED), 0]);
  return (
    <motion.g style={follow?.linked ? { y } : undefined}>
      <g transform={`translate(90 ${52 + i * GAP})`}>
        {children}
        <circle cx={reach} cy="6" r="2.5" fill="var(--text-primary)" stroke="none" />
        <path d={`M${reach} 6H136`} strokeWidth="1.5" />
        <T x={143} y={10} mono size={12}>{PUCK_LAYERS[i]}</T>
      </g>
    </motion.g>
  );
}

/** The puck in five isometric layers, apart. With `follow`, the layers start together and separate with scroll. */
function PuckExploded({ follow, className }: { follow?: Follow; className?: string }) {
  return (
    <Svg viewBox="0 0 350 340" className={className} label={`An exploded view of the puck. From the top: ${PUCK_LAYERS.join(", ")}.`}>
      <path d="M90 40V300" stroke="var(--border-hairline)" strokeDasharray="3 5" strokeWidth="1.5" />
      <Layer i={4} follow={follow} reach={70}>
        <IsoCyl r={52} h={18} side="var(--bg-subtle)" top="var(--bg-surface)" />
        <IsoRing z={18} r={44} fill="var(--bg-subtle)" />
      </Layer>
      <Layer i={3} follow={follow} reach={62}>
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
      <Layer i={2} follow={follow} reach={62}>
        <IsoBox x={-34} y={-34} w={68} d={68} h={4} top="var(--success-soft)" left="var(--success-soft)" right="var(--success-soft)" />
        <IsoBox x={-12} y={-12} z={4} w={24} d={24} h={4} top="var(--text-primary)" left="var(--text-primary)" right="var(--text-primary)" />
        <IsoBox x={14} y={-28} z={4} w={12} d={18} h={3} />
        <IsoBox x={-28} y={12} z={4} w={18} d={10} h={3} />
      </Layer>
      <Layer i={1} follow={follow} reach={40}>
        <IsoCyl r={28} h={9} />
        <IsoRing z={9} r={19} fill="var(--bg-subtle)" />
        <IsoRing z={9} r={7} fill="var(--text-primary)" />
      </Layer>
      <Layer i={0} follow={follow} reach={70}>
        <IsoCyl r={52} h={12} side={ORANGE} top={ORANGE} />
        <IsoRing z={12} r={34} fill="#16181d" />
        <IsoRing z={12} r={23} stroke="#ffffff" strokeDasharray="1 6" />
        <IsoRing z={12} r={11} stroke="#ffffff" strokeDasharray="1 6" />
      </Layer>
    </Svg>
  );
}

const LAYERS = 10;
const LAYER_H = 6;

function PrintLayer({ i, follow }: { i: number; follow?: Follow }) {
  const done = useMotionValue(1);
  const opacity = useTransform(follow?.progress ?? done, [i / LAYERS, (i + 0.6) / LAYERS], [0, 1]);
  return (
    <motion.g style={follow?.linked ? { opacity } : undefined}>
      <IsoCyl z={8 + i * LAYER_H} r={46} h={LAYER_H} side={ORANGE} top={ORANGE} />
      <IsoRing z={8 + (i + 1) * LAYER_H} r={38} fill={i < 2 ? ORANGE : "var(--bg-subtle)"} />
    </motion.g>
  );
}

/** The shell base on the print bed, ten layers up. With `follow`, the layers appear in turn with scroll. */
export function PrintBuild({ follow, className }: { follow?: Follow; className?: string }) {
  const top = 8 + LAYERS * LAYER_H;
  return (
    <Svg viewBox="0 0 320 250" className={className}>
      <g transform="translate(160 150)">
        <IsoBox x={-74} y={-74} w={148} d={148} h={8} />
        {Array.from({ length: LAYERS }, (_, i) => (
          <PrintLayer key={i} i={i} follow={follow} />
        ))}
        {/* the gantry and the nozzle over the last layer */}
        <path d={`M-150 ${-top - 62}H150`} stroke="var(--border-hairline)" strokeWidth="6" />
        <rect x="42" y={-top - 76} width="30" height="30" rx="4" fill="var(--bg-surface)" />
        <path d={`M48 ${-top - 46}h18l-9 14z`} fill="var(--text-primary)" />
      </g>
    </Svg>
  );
}

function Box({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <figure className={BOX}>
      <figcaption className="text-sm font-semibold text-primary">{title}</figcaption>
      {children}
      {note ? <p className="mt-3 text-sm leading-relaxed text-secondary">{note}</p> : null}
    </figure>
  );
}

export function ExplodedPuck() {
  const { ref, progress, linked } = useRise();
  return (
    <div ref={ref}>
      <Box title="The puck, taken apart">
        <PuckExploded follow={{ progress, linked }} className="mx-auto mt-2 block h-auto w-full max-w-[250px]" />
      </Box>
    </div>
  );
}

export function PrintLayers() {
  const { ref, progress, linked } = useRise();
  return (
    <div ref={ref}>
      <Box title="The shell base, layer by layer" note={PRINT_NOTE}>
        <PrintBuild follow={{ progress, linked }} className="mx-auto mt-2 block h-auto w-full max-w-[250px]" />
      </Box>
    </div>
  );
}

export function SchematicCorner() {
  return (
    <Box title="A corner of the schematic" note={SCHEMATIC_NOTE}>
      <SchematicFragment className="mt-3 block h-auto w-full" />
    </Box>
  );
}

export function AdDrafts() {
  return (
    <Box title="Ad drafts" note={ADS_NOTE}>
      <AdFan className="mx-auto mt-2 block h-auto w-full max-w-[250px]" />
    </Box>
  );
}

export function ListingDraft() {
  return (
    <Box title="The listing" note={LISTING_NOTE}>
      <ListingCard className="mx-auto mt-3 block h-auto w-full max-w-[250px]" />
    </Box>
  );
}

/** The total, counting up once (0.4 s) when it comes into view; a still figure otherwise. */
export function CostFigure({ className = "" }: { className?: string }) {
  const box = useRef<HTMLParagraphElement>(null);
  const figure = useRef<HTMLSpanElement>(null);
  const animated = useAnimated();
  const seen = useInView(box, { once: true, amount: 0.7 });
  useEffect(() => {
    const el = figure.current;
    if (!animated || !seen || !el) return;
    const run = animate(0, COST.value, { duration: 0.4, ease: "easeOut", onUpdate: (v) => (el.textContent = v.toFixed(2)) });
    return () => {
      run.stop();
      el.textContent = COST.value.toFixed(2);
    };
  }, [animated, seen]);
  return (
    <p ref={box} className={`font-mono font-semibold tabular-nums tracking-tight text-primary ${className}`}>
      <span className="sr-only">${COST.value.toFixed(2)}</span>
      <span aria-hidden="true">
        $<span ref={figure}>{COST.value.toFixed(2)}</span>
      </span>
    </p>
  );
}

export function CostCount() {
  return (
    <div className={BOX}>
      <CostFigure className="text-4xl" />
      <p className="mt-2 text-sm leading-relaxed text-secondary">{COST.label}</p>
      <CostStack className="mx-auto mt-2 block h-auto w-full max-w-[230px]" />
    </div>
  );
}
