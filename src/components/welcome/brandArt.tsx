// The product's mark and its social card, drawn in code from the tag's own outline (scenes/film/tagShape.ts), so the
// browser icon is the same shape as the tag in the hero and in the film. Nothing here runs in the app: the files the
// app serves (src/app/icon.svg, favicon.ico, apple-icon.png and public/landing/og.png) are written from these
// drawings by scripts/brand-art.mjs, which is run again whenever the drawings change.
import { SLOT, STRAP, TAG_MM, tagPath } from "./scenes/film/tagShape";
import { TagArt } from "./TagArt";
import { HERO, PRODUCT, HERO_STAGE, EXAMPLE } from "./content";

const { h: H } = TAG_MM;
const TAN = "#b8773f";
const TAN_EDGE = "#7a4722";
const THREAD = "#f4e7c8";
const DARK = "#17100a";

/** How much of the tag a size can carry: 16 px a silhouette and its slot; 32 px the stitch line and the speaker dots too; larger, the oval mark. */
export type MarkDetail = "silhouette" | "stitched" | "full";

const DOTS = [0, 1, 2].flatMap((row) => [0, 1, 2, 3].map((col) => [-13.5 + col * 9, -21 + row * 8.5] as const));

/** The tag itself, in mm about its middle (y down), with a stub of strap above it. */
function Mark({ detail, live = false }: { detail: MarkDetail; /** every level drawn, each shown by the icon's own size (CSS in the file) */ live?: boolean }) {
  const stitched = live || detail !== "silhouette";
  const full = live || detail === "full";
  // at 16 px the tag is its outline and the slot: no strap, and the slot larger than life so it survives
  const small = detail === "silhouette" && !live;
  return (
    <>
      {small ? null : <rect x={-STRAP.w / 2} y={-H / 2 - 9} width={STRAP.w} height={9 + SLOT.down} rx={2} fill="#2b2e34" />}
      <path d={tagPath(1)} transform={`translate(0 ${-H / 2})`} fill={TAN} stroke={TAN_EDGE} strokeWidth={small ? 0 : 1.6} strokeLinejoin="round" />
      {stitched ? (
        <g className={live ? "m" : undefined}>
          <path d={tagPath(1, 5.5)} transform={`translate(0 ${-H / 2})`} fill="none" stroke={THREAD} strokeWidth={2.6} strokeDasharray="5 4.4" strokeLinecap="round" />
          {DOTS.map(([x, y]) => (
            <circle key={`${x} ${y}`} cx={x} cy={y} r={2.5} fill={DARK} fillOpacity={0.78} />
          ))}
        </g>
      ) : null}
      {full ? (
        <g className={live ? "l" : undefined}>
          <ellipse cx={0} cy={19.5} rx={19} ry={8.5} fill="none" stroke={DARK} strokeOpacity={0.6} strokeWidth={2} />
          <path d="M-9 19.5h18" stroke={DARK} strokeOpacity={0.6} strokeWidth={2.2} strokeLinecap="round" />
        </g>
      ) : null}
      {/* the slot the strap comes through: wider than life at the smallest size, so it survives 16 px */}
      {small ? (
        <rect x={-13} y={-(H / 2 - SLOT.down) - 4} width={26} height={9} rx={4.5} fill={DARK} />
      ) : (
        <>
          <rect x={-SLOT.w / 2 - 1} y={-(H / 2 - SLOT.down) - 3} width={SLOT.w + 2} height={6} rx={3} fill={DARK} />
          <rect x={-STRAP.w / 2} y={-(H / 2 - SLOT.down) - 3.2} width={STRAP.w} height={3.4} fill="#2b2e34" />
        </>
      )}
    </>
  );
}

/** The browser's icon: the tag on a clear ground. As a file it shows more of the tag the larger it is drawn. */
export function TagIcon({ detail = "full", live = false }: { detail?: MarkDetail; live?: boolean }) {
  // the tag fills the square's height: 92 mm and its strap stub in 104 units
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={detail === "silhouette" && !live ? "-48 -48 96 96" : "-52 -56 104 104"}>
      {live ? <style>{`.m,.l{display:none}@media (min-width:24px){.m{display:inline}}@media (min-width:56px){.l{display:inline}}`}</style> : null}
      <Mark detail={detail} live={live} />
    </svg>
  );
}

/** The home-screen icon: the tag on the page's dark ground, full bleed (the phone rounds the corners). */
export function TagTile({ rounded = false }: { rounded?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
      <defs>
        <radialGradient id="tile" cx="0.5" cy="0.42" r="0.75">
          <stop offset="0" stopColor="#2a211b" />
          <stop offset="1" stopColor="#0b0c0e" />
        </radialGradient>
      </defs>
      <rect width="180" height="180" rx={rounded ? 40 : 0} fill="url(#tile)" />
      <g transform="translate(90 98) scale(1.42)">
        <Mark detail="full" />
      </g>
    </svg>
  );
}

/** The social card, 1200 by 630: the hero in one picture, the tag on the line from an idea to a sale. */
export function SocialCard() {
  return (
    <div style={{ position: "relative", width: 1200, height: 630, overflow: "hidden", background: "#0b0c0e", color: "#fff", fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 38% 62% at 76% 52%, rgba(214,138,82,0.3), rgba(214,138,82,0.07) 55%, transparent 80%)" }} />
      {/* the line from Idea to On sale */}
      <div style={{ position: "absolute", left: 72, right: 72, top: 78, display: "flex", alignItems: "center", gap: 20, fontSize: 24, fontWeight: 500 }}>
        <span>{HERO_STAGE.from}</span>
        <span style={{ flex: 1, height: 4, borderRadius: 2, background: "#e05a10" }} />
        <span style={{ background: "#c64405", borderRadius: 999, padding: "6px 18px" }}>{HERO_STAGE.to}</span>
      </div>
      <div style={{ position: "absolute", left: 72, top: 204, width: 660 }}>
        <div style={{ fontSize: 26, fontWeight: 600, color: "#ffa370" }}>{PRODUCT}</div>
        <div style={{ marginTop: 18, fontSize: 70, fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.03em" }}>{HERO.title}</div>
        <div style={{ marginTop: 30, fontSize: 25, lineHeight: 1.4, color: "#a1a1aa" }}>{`The worked example: ${EXAMPLE.name}. Planned, not yet built or sold.`}</div>
      </div>
      <div style={{ position: "absolute", left: 742, top: 92, width: 330 }}>
        <TagArt strap={12} margin={6} className="tag" />
      </div>
    </div>
  );
}
