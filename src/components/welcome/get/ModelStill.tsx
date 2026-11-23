// The example's 3D model as a vector drawing (projection.ts): what the hero shows, and what the 3D stage of "What
// you get" shows until its live view is mounted. Each face is filled in its part's theme colour, shaded by how it
// faces the light, and edged with a hairline that stays one pixel wide at any size. With `assemble`, each part
// glides in from its exploded place at its step of the build sheet's order, holds, and leaves again (CSS only;
// nothing moves under reduced motion). No script: a server component can render it.
import type { CSSProperties } from "react";
import { project, type Still } from "./projection";
import { TAG_TONE } from "./tagShell";

const LAP_S = 8;
/** Where on a lid its mark goes, from the lid's middle, on screen: toward the near left corner. */
const LID_MARK = project([-16, 0, 28]);

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

/**
 * The same drawing pulled apart, as an exploded view: each part at its exploded place (the parts' own explode
 * vectors, as the 3D view uses them), the shell's lid lifted clear, and a numbered mark on each part. The numbers
 * are the key to a list the caller sets beside it (the parts' references and names, from the parts list).
 */
export function ExplodedStill({ still, label, className = "" }: { still: Still; label: string; className?: string }) {
  const parts = new Map(still.parts.map((p) => [p.id, p]));
  const [x, y, w, h] = still.apart;
  const shift = (f: Still["faces"][number]) => {
    const p = parts.get(f.part);
    return `translate(${p?.explode[0] ?? 0} ${(p?.explode[1] ?? 0) - (f.lid ? still.lift : 0)})`;
  };
  // far to near, as drawn assembled; a lifted lid goes over everything, the tray under everything
  const faces = [...still.faces].sort((a, b) => (a.shell ? (a.lid ? 1 : -1) : 0) - (b.shell ? (b.lid ? 1 : -1) : 0) || a.depth - b.depth);
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} className={`h-auto w-full ${className}`} role="img" aria-label={label}>
      {/* where each part came from: a line from its place in the tag to where it is drawn */}
      {still.parts.filter((p) => !p.shell && (p.explode[0] || p.explode[1])).map((p) => (
        <path key={p.id} d={`M${p.at[0]} ${p.at[1]}l${p.explode[0]} ${p.explode[1]}`} stroke="var(--text-muted)" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="1.5 2.5" vectorEffect="non-scaling-stroke" fill="none" />
      ))}
      {faces.map((f, i) => {
        const p = parts.get(f.part);
        const tone = p ? `var(${p.tone})` : "var(--text-muted)";
        if (f.shell) return <path key={i} d={f.d} transform={shift(f)} fill={TAG_TONE} fillOpacity={f.lid ? 0.34 : f.depth > 0 ? 0.2 : 0.1} stroke={TAG_TONE} strokeOpacity={f.depth > 0 ? 1 : 0.45} strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
        return <path key={i} d={f.d} transform={shift(f)} fill={`color-mix(in oklab, ${tone} ${Math.round(38 + f.shade * 50)}%, #0b0c0e)`} stroke={`color-mix(in oklab, ${tone} 55%, #ffffff)`} strokeOpacity={0.75} strokeWidth={0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
      })}
      {still.parts.map((p, i) => {
        // the shell's mark sits on its lifted lid, toward the near corner, clear of the parts under the lid's middle
        const at = p.shell ? [p.at[0] + LID_MARK.x, p.at[1] + LID_MARK.y - still.lift - 4] : [p.at[0] + p.explode[0], p.at[1] + p.explode[1]];
        return (
          <g key={p.id} transform={`translate(${at[0]} ${at[1]})`}>
            <circle r={4.6} fill="#0b0c0e" stroke="#ffffff" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            <text y={2.1} textAnchor="middle" fontSize={5.6} fontWeight={700} fill="#ffffff" fontFamily="var(--font-sans, system-ui)">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}
