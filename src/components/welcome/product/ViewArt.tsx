// Each view of the product as a drawing, in code: the small pictures of the view strip, and what stands in the
// viewer where the live model cannot (no script, no WebGL, a device too slow for it). Drawn from the same numbers
// as the tag everywhere else (TagArt, tagShape) and, for what is inside, from the parts' own sizes and places
// (model.ts). The one exception is the tag on a suitcase handle, which is a render from the example's CAD.
import { FACE, SLOT, STRAP, TAG_MM, tagPath } from "../scenes/film/tagShape";
import { TagArt, tagViewBox } from "../TagArt";
import type { Product, ProductPart } from "./model";
import type { View } from "./views";

const { w: W, h: H, t: T } = TAG_MM;
/** The exploded render the example keeps in Files, as the copy this page serves. */
const EXPLODED_RENDER = "/landing/BaggageClaims_Tag_RevD_A_exploded.webp";
const TAN = "#b0703f";
const EDGE = "#7a4722";
const BOX = tagViewBox(6, 4);
const FILL: Partial<Record<ProductPart["look"], string>> = { board: "#1f6a47", cell: "#c4c8ce", supercap: "#22366b", speaker: "#2b2d31", tracker: "#f1f0ec", switch: "#a9adb5", button: "#a9adb5" };

/** What is inside, seen from the front: each part with a place of its own, at its size. */
function Inside({ product, lines }: { product: Product; lines: boolean }) {
  return (
    <>
      {product.parts
        .filter((p) => p.body && p.body.shape !== "design" && (p.placed === "row" || p.look === "chip"))
        .map((p) => {
          const b = p.body!;
          const [x, y] = [b.at[0], -b.at[1]];
          const paint = lines ? { fill: "none", stroke: "#f3e3cc", strokeWidth: 0.7 } : { fill: FILL[p.look] ?? "#191b1f", stroke: "#000", strokeOpacity: 0.35, strokeWidth: 0.3 };
          if (b.shape === "cylinder" && b.axis === "z") return <circle key={p.ref} cx={x} cy={y} r={b.size[0]! / 2} {...paint} />;
          const [w, h] = b.shape === "cylinder" ? (b.axis === "y" ? [b.size[0]!, b.size[1]!] : [b.size[1]!, b.size[0]!]) : [b.size[0]!, b.size[1]!];
          return <rect key={p.ref} x={x - w / 2} y={y - h / 2} width={w} height={h} rx={0.6} {...paint} />;
        })}
    </>
  );
}

function Outline({ fill, stroke, opacity = 1 }: { fill: string; stroke: string; opacity?: number }) {
  return <path d={tagPath(1)} transform={`translate(0 ${-H / 2})`} fill={fill} fillOpacity={opacity} stroke={stroke} strokeWidth={0.9} strokeLinejoin="round" />;
}

const TAG = "block h-full w-full";

export function ViewArt({ view, product, big = false, label }: { view: View; product: Product; /** the viewer's own picture rather than a thumbnail: with its grain and shadow */ big?: boolean; label?: string }) {
  const rich = { shadow: big, grain: big, strap: 6, margin: 4, label, className: TAG } as const;
  switch (view.key) {
    case "front":
      return <TagArt {...rich} />;
    case "back":
      return <TagArt {...rich} side="back" />;
    case "left":
    case "right":
      return (
        <div className="h-full w-full [perspective:420px]" role={label ? "img" : undefined} aria-label={label}>
          <div className="h-full w-full" style={{ transform: `rotateY(${view.key === "left" ? 34 : -34}deg)` }}>
            <TagArt {...rich} label={undefined} />
          </div>
        </div>
      );
    case "handle":
      // eslint-disable-next-line @next/next/no-img-element -- a small static file from public/, at the size it is shown
      return <img src={view.render} alt={label ?? ""} loading="lazy" decoding="async" className="h-full w-full rounded-[inherit] object-cover" />;
    case "coin":
    case "tracker": {
      const coin = view.key === "coin";
      const at = coin ? { x: FACE.door.x, y: -FACE.door.y, r: FACE.door.r } : { x: FACE.tracker.x, y: -FACE.tracker.y, r: FACE.tracker.r };
      const part = product.parts.find((p) => p.look === (coin ? "cell" : "tracker"));
      return (
        <div className="relative h-full w-full" role={label ? "img" : undefined} aria-label={label}>
          <TagArt {...rich} label={undefined} side={coin ? "front" : "back"} />
          <svg viewBox={BOX} className="absolute inset-0 h-full w-full" aria-hidden="true">
            {/* the opening, what is in it, and the door held aside */}
            <circle cx={at.x} cy={at.y} r={at.r} fill="#120b06" />
            <circle cx={at.x} cy={at.y} r={(part?.body?.size[0] ?? at.r * 1.6) / 2} fill={coin ? "#c4c8ce" : "#f1f0ec"} stroke="#000" strokeOpacity={0.3} strokeWidth={0.4} />
            <circle cx={at.x + (coin ? -9 : 10)} cy={at.y - at.r * 1.15} r={at.r} fill={TAN} stroke={EDGE} strokeWidth={0.8} strokeDasharray="2 1.4" />
          </svg>
        </div>
      );
    }
    case "exploded":
      // the viewer's own picture where the live model cannot run: the design's exploded render, with its parts named
      // eslint-disable-next-line @next/next/no-img-element -- a small static copy in public/, at the size it is shown
      if (big) return <img src={EXPLODED_RENDER} alt={label ?? ""} loading="lazy" decoding="async" className="h-full w-full rounded-[inherit] object-contain" />;
      return (
        <svg viewBox="-46 -52 92 104" className={TAG} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
          {[-1, 0, 1].map((k) => (
            <g key={k} transform={`translate(${k * 13} ${k * 9}) scale(0.62)`}>
              <Outline fill={k === 0 ? "#1f6a47" : TAN} stroke={k === 0 ? "#7fd2a4" : EDGE} opacity={k === 0 ? 0.55 : 0.9} />
            </g>
          ))}
        </svg>
      );
    case "inside":
    case "lines":
      return (
        <svg viewBox={BOX} className={TAG} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
          <Outline fill={TAN} stroke={view.key === "lines" ? "#f3e3cc" : EDGE} opacity={view.key === "lines" ? 0.06 : 0.3} />
          <Inside product={product} lines={view.key === "lines"} />
        </svg>
      );
    case "edge":
      return (
        <svg viewBox={BOX} className={TAG} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
          <rect x={-STRAP.t - T / 2} y={-H / 2 - 6} width={STRAP.t * 2 + T} height={SLOT.down + 8} rx={1.4} fill="#1d1f23" />
          <rect x={-T / 2} y={-H / 2} width={T} height={H} rx={2.2} fill={TAN} stroke={EDGE} strokeWidth={0.9} />
          {product.parts
            .filter((p) => p.look === "switch" || p.look === "button")
            .map((p) => (
              <rect key={p.ref} x={-1.1} y={-p.body!.at[1] - p.body!.size[1]! / 2} width={2.2} height={p.body!.size[1]!} rx={0.6} fill="#101113" />
            ))}
        </svg>
      );
    default:
      return (
        <svg viewBox="-40 -26 80 52" className={TAG} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
          <rect x={-W / 2} y={-T / 2} width={W} height={T} rx={2.4} fill={TAN} stroke={EDGE} strokeWidth={0.9} />
          <rect x={-STRAP.w / 2} y={-T / 2 - STRAP.t} width={STRAP.w} height={T + STRAP.t * 2} rx={1} fill="#1d1f23" />
          <rect x={-SLOT.w / 2} y={-SLOT.h / 2} width={SLOT.w} height={SLOT.h} rx={SLOT.h / 2} fill="#0b0b0c" />
        </svg>
      );
  }
}
