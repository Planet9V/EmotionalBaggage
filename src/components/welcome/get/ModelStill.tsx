// The example's 3D model as a vector drawing (projection.ts): what the hero shows, and what the 3D stage of "What
// you get" shows until its live view is mounted. Each face is filled in its part's theme colour, shaded by how it
// faces the light, and edged with a hairline that stays one pixel wide at any size. With `assemble`, each part
// glides in from its exploded place at its step of the build sheet's order, holds, and leaves again (CSS only;
// nothing moves under reduced motion). No script: a server component can render it.
import type { CSSProperties } from "react";
import type { Still } from "./projection";

const LAP_S = 8;

export function ModelStill({ still, assemble = false, label, className = "" }: { still: Still; assemble?: boolean; label?: string; className?: string }) {
  const parts = new Map(still.parts.map((p) => [p.id, p]));
  const steps = Math.max(1, ...still.parts.map((p) => p.step));
  const [x, y, w, h] = still.box;
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} className={`h-auto w-full ${className}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {still.faces.map((f, i) => {
        const p = parts.get(f.part);
        const tone = p ? `var(${p.tone})` : "var(--text-muted)";
        const moves = assemble && p && !p.shell;
        const style: CSSProperties | undefined = moves
          ? ({ "--asm-dx": `${p.explode[0] * 0.55}px`, "--asm-dy": `${p.explode[1] * 0.55}px`, "--asm-lap": `${LAP_S}s`, animationDelay: `${(p.step / steps) * LAP_S * 0.42}s`, transformBox: "view-box" } as CSSProperties)
          : undefined;
        if (f.shell) {
          const front = f.depth > 0;
          return <path key={i} d={f.d} fill="var(--accent-orange)" fillOpacity={front ? 0.07 : 0.04} stroke="var(--accent-orange)" strokeOpacity={front ? 0.95 : 0.4} strokeDasharray={front ? undefined : "2 2"} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
        }
        return (
          <path
            key={i}
            d={f.d}
            className={moves ? "wl-asm" : undefined}
            style={style}
            fill={`color-mix(in oklab, ${tone} ${Math.round(38 + f.shade * 50)}%, #0b0c0e)`}
            stroke={`color-mix(in oklab, ${tone} 55%, #ffffff)`}
            strokeOpacity={0.75}
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
