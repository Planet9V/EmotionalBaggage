// The suitcase with the puck strapped to it: an original drawing in plain shapes, used by the hero, the deck and
// the toy. Decorative: the words beside it carry the meaning. Colours come from the theme tokens, so it follows
// light and dark.
//
// It is always rolling: the wheels turn, the bag leans a little and bobs, the ground slides past underneath and
// the tag swings. `hurry` spins the wheels and the ground faster for a moment (the hero sets it as a new line
// lands). `speaking` pulses the ring round the puck's speaker for as long as it is set, or three times for
// "briefly". All of it is CSS, and off under reduced motion.
import { PuckFace, Svg } from "./Illustrations";

const INK = "var(--text-primary)";

function Wheel({ cx }: { cx: number }) {
  return (
    <g className="wl-wheel">
      <circle cx={cx} cy="290" r="12" fill="var(--bg-subtle)" />
      <path d={`M${cx} 278v24M${cx - 10.4} 284l20.8 12M${cx - 10.4} 296l20.8-12`} strokeWidth="1.5" />
      <circle cx={cx} cy="290" r="3.5" fill="var(--accent-orange)" stroke="none" />
    </g>
  );
}

export function Bag({ speaking = false, hurry = false, className = "" }: { speaking?: boolean | "briefly"; hurry?: boolean; className?: string }) {
  return (
    <Svg viewBox="0 0 240 320" className={`${hurry ? "wl-hurry" : ""} ${className}`}>
      {/* the ground, sliding past */}
      <path d="M-30 306H300" className="wl-ground" stroke="var(--text-muted)" strokeDasharray="14 10" />
      <g className="wl-roll">
        {/* the handle and its tag */}
        <path d="M96 58V28a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v30" />
        <path d="M104 58V32h32v26" />
        <path d="M144 34c14 2 21 9 24 20" strokeWidth="1.5" />
        <g className="wl-swing">
          <g transform="rotate(14 171 72)">
            <path d="M162 54h18l3 6v28a3 3 0 0 1-3 3h-18a3 3 0 0 1-3-3V60z" fill="var(--bg-surface)" stroke="var(--accent-orange)" />
            <circle cx="171" cy="62" r="2.5" fill="var(--accent-orange)" stroke="none" />
            <path d="M165 74h12M165 81h12" stroke="var(--text-muted)" strokeWidth="1.5" />
          </g>
        </g>
        {/* the shell */}
        <rect x="40" y="58" width="160" height="220" rx="22" fill="var(--bg-surface)" />
        <path d="M72 82v174M96 82v52M96 198v58M144 82v52M144 198v58M168 82v174" stroke="var(--border-hairline)" />
        {/* the strap and the puck */}
        <rect x="38" y="151" width="164" height="30" rx="3" fill={INK} />
        <path d="M50 166h28M162 166h28" stroke="var(--bg-surface)" strokeDasharray="1 6" />
        <circle cx="120" cy="166" r="36" className={speaking === "briefly" ? "wl-ring wl-ring-brief" : speaking ? "wl-ring wl-ring-on" : "wl-ring"} stroke="var(--accent-orange)" strokeWidth="3" opacity="0" />
        <PuckFace cx={120} cy={166} r={36} />
        {/* wheel housings, then the wheels */}
        <path d="M66 278v6M90 278v6M150 278v6M174 278v6" />
        <Wheel cx={78} />
        <Wheel cx={162} />
      </g>
    </Svg>
  );
}
