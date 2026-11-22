// The suitcase with the puck strapped to it: an original drawing in plain shapes, used by the hero, the deck and
// the toy. Decorative: the words beside it carry the meaning. Colours come from the theme tokens, so it follows
// light and dark. `speaking` pulses the ring round the puck's speaker for as long as it is set, or three times
// for "briefly" (CSS, off under reduced motion).
import { PuckFace, Svg } from "./Illustrations";

const INK = "var(--text-primary)";

export function Bag({ speaking = false, className = "" }: { speaking?: boolean | "briefly"; className?: string }) {
  return (
    <Svg viewBox="0 0 240 320" className={className}>
      {/* the handle and its tag */}
      <path d="M96 58V28a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v30" />
      <path d="M104 58V32h32v26" />
      <path d="M144 34c14 2 21 9 24 20" strokeWidth="1.5" />
      <g transform="rotate(14 171 72)">
        <path d="M162 54h18l3 6v28a3 3 0 0 1-3 3h-18a3 3 0 0 1-3-3V60z" fill="var(--bg-surface)" stroke="var(--accent-orange)" />
        <circle cx="171" cy="62" r="2.5" fill="var(--accent-orange)" stroke="none" />
        <path d="M165 74h12M165 81h12" stroke="var(--text-muted)" strokeWidth="1.5" />
      </g>
      {/* wheels, then the shell over them */}
      <circle cx="78" cy="292" r="10" fill="var(--bg-subtle)" />
      <circle cx="162" cy="292" r="10" fill="var(--bg-subtle)" />
      <rect x="40" y="58" width="160" height="226" rx="22" fill="var(--bg-surface)" />
      <path d="M72 82v180M96 82v52M96 198v64M144 82v52M144 198v64M168 82v180" stroke="var(--border-hairline)" />
      <path d="M58 284v-8M182 284v-8" stroke="var(--border-hairline)" />
      {/* the strap and the puck */}
      <rect x="38" y="151" width="164" height="30" rx="3" fill={INK} />
      <path d="M50 166h28M162 166h28" stroke="var(--bg-surface)" strokeDasharray="1 6" />
      <circle cx="120" cy="166" r="36" className={speaking === "briefly" ? "wl-ring wl-ring-brief" : speaking ? "wl-ring wl-ring-on" : "wl-ring"} stroke="var(--accent-orange)" strokeWidth="3" opacity="0" />
      <PuckFace cx={120} cy={166} r={36} />
    </Svg>
  );
}
