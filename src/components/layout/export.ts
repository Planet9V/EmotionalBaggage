/**
 * Builds the three-view layout sheet as a standalone SVG string. Colours are read from the live
 * theme tokens at click time, so the file matches what the user sees. Geometry is drawn in mm
 * inside scaled groups, so every part is to scale.
 */
import { bodiesInView, boxRect, fmtMm, footprint, innerBox, niceStep, VIEW_DEFS, type Box, type LayoutPart, type ViewDef } from "./geom";

export type Palette = {
  canvas: string; surface: string; subtle: string; primary: string; secondary: string; muted: string; hairline: string; danger: string; link: string; accent: string;
};

const FALLBACK: Palette = {
  canvas: "#FAF8F5", surface: "#FFFFFF", subtle: "#F4F1EC", primary: "#111111", secondary: "#3F3F46", muted: "#71717A", hairline: "#E4E0D8", danger: "#B42318", link: "#9C3204", accent: "#E05A10",
};

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    canvas: v("--bg-canvas", FALLBACK.canvas),
    surface: v("--bg-surface", FALLBACK.surface),
    subtle: v("--bg-subtle", FALLBACK.subtle),
    primary: v("--text-primary", FALLBACK.primary),
    secondary: v("--text-secondary", FALLBACK.secondary),
    muted: v("--text-muted", FALLBACK.muted),
    hairline: v("--border-hairline", FALLBACK.hairline),
    danger: v("--danger", FALLBACK.danger),
    link: v("--link", FALLBACK.link),
    accent: v("--accent-orange", FALLBACK.accent),
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = (n: number) => Number(n.toFixed(3));

type Range = { x0: number; y0: number; x1: number; y1: number };

function rangeFor(view: ViewDef, all: LayoutPart[]): Range {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of all) {
    const f = footprint(view, p.geometry);
    x0 = Math.min(x0, f.x); y0 = Math.min(y0, f.y); x1 = Math.max(x1, f.x + f.w); y1 = Math.max(y1, f.y + f.h);
  }
  return { x0, y0, x1, y1 };
}

export type SheetInput = {
  conceptName: string;
  parts: LayoutPart[];
  shells: LayoutPart[];
  wall: number;
  overlapping: Set<number>;
  palette: Palette;
  date: string;
};

export type Sheet = { svg: string; scaleNote: string; width: number; height: number };

export function buildSheet(inp: SheetInput): Sheet | null {
  const { parts, shells, palette: c } = inp;
  const all = [...shells, ...parts];
  if (!all.length) return null;
  const top = VIEW_DEFS.top, front = VIEW_DEFS.front, side = VIEW_DEFS.side;
  // One range per scene axis so the three views line up like a drawing.
  const rt = rangeFor(top, all), rf = rangeFor(front, all), rs = rangeFor(side, all);
  const X = rt.x1 - rt.x0, Z = rt.y1 - rt.y0, Y = rf.y1 - rf.y0;
  const gap = 16; // mm between views
  const ruler = 26; // px margin for rulers
  const pad = 24; // px sheet margin
  const titleH = 78;
  const colR = Math.max(X, Z);
  const s1 = (1500 - 2 * pad - 2 * ruler - 40) / (X + colR + gap);
  const s2 = (900 - 2 * pad - 2 * ruler - titleH - 20) / Math.max(Z, 2 * Y + gap);
  const s = Number(Math.max(0.5, Math.min(8, s1, s2)).toFixed(2));

  const wTop = X * s, hTop = Z * s;
  const wFront = X * s, hFront = Y * s;
  const wSide = Z * s, hSide = Y * s;
  const leftW = wTop + ruler;
  const rightW = Math.max(wFront, wSide) + ruler;
  const bodyH = Math.max(hTop + ruler, hFront + hSide + gap * s + 2 * ruler);
  const W = Math.ceil(pad * 2 + leftW + gap * s + rightW);
  const H = Math.ceil(pad * 2 + bodyH + titleH);

  const parts_: string[] = [];
  // Pattern units follow the scaled group, so size the tile in mm to read as 6 px on the sheet.
  const hatchTile = Number((6 / s).toFixed(4));
  const hatchLine = Number((1.6 / s).toFixed(4));

  const drawView = (view: ViewDef, r: Range, ox: number, oy: number, label: string) => {
    const w = (r.x1 - r.x0) * s, h = (r.y1 - r.y0) * s;
    const out: string[] = [];
    // frame: origin of the group is the top-left of the drawing area, scaled to mm
    out.push(`<g transform="translate(${n2(ox)} ${n2(oy)})">`);
    out.push(`<rect x="0" y="0" width="${n2(w)}" height="${n2(h)}" fill="${c.surface}" stroke="${c.hairline}"/>`);
    out.push(`<g transform="scale(${s}) translate(${n2(-r.x0)} ${n2(-r.y0)})">`);
    const sw = (px: number) => n2(px / s);
    // grid
    const minor: string[] = [], major: string[] = [];
    for (let x = Math.ceil(r.x0 / 5) * 5; x <= r.x1 + 1e-6; x += 5) (Math.round(x) % 10 === 0 ? major : minor).push(`M${x} ${r.y0}V${r.y1}`);
    for (let y = Math.ceil(r.y0 / 5) * 5; y <= r.y1 + 1e-6; y += 5) (Math.round(y) % 10 === 0 ? major : minor).push(`M${r.x0} ${y}H${r.x1}`);
    if (5 * s >= 3) out.push(`<path d="${minor.join("")}" fill="none" stroke="${c.hairline}" stroke-width="${sw(0.5)}"/>`);
    if (10 * s >= 3) out.push(`<path d="${major.join("")}" fill="none" stroke="${c.muted}" stroke-opacity="0.45" stroke-width="${sw(0.6)}"/>`);
    // shells
    for (const sh of shells) {
      const [b] = bodiesInView(view, sh.geometry);
      if (b.kind !== "rect") continue;
      out.push(`<rect x="${n2(b.x)}" y="${n2(b.y)}" width="${n2(b.w)}" height="${n2(b.h)}" fill="${c.canvas}" fill-opacity="0.7" stroke="${c.primary}" stroke-width="${sw(1.8)}"/>`);
      if (inp.wall > 0) {
        const ib: Box = innerBox(sh.geometry, inp.wall);
        if (ib.max[0] > ib.min[0] && ib.max[1] > ib.min[1] && ib.max[2] > ib.min[2]) {
          const f = boxRect(view, ib);
          out.push(`<rect x="${n2(f.x)}" y="${n2(f.y)}" width="${n2(f.w)}" height="${n2(f.h)}" fill="none" stroke="${c.muted}" stroke-width="${sw(0.9)}" stroke-dasharray="${sw(4)} ${sw(3)}"/>`);
        }
      }
    }
    // parts, large first
    const ordered = [...parts].sort((a, b) => {
      const fa = footprint(view, a.geometry), fb = footprint(view, b.geometry);
      return fb.w * fb.h - fa.w * fa.h;
    });
    for (const p of ordered) {
      const over = inp.overlapping.has(p.id);
      const stroke = over ? c.danger : c.secondary;
      for (const b of bodiesInView(view, p.geometry)) {
        if (b.kind === "rect") {
          out.push(`<rect x="${n2(b.x)}" y="${n2(b.y)}" width="${n2(b.w)}" height="${n2(b.h)}" fill="${c.surface}" fill-opacity="0.75" stroke="${stroke}" stroke-width="${sw(1.2)}"/>`);
          if (over) out.push(`<rect x="${n2(b.x)}" y="${n2(b.y)}" width="${n2(b.w)}" height="${n2(b.h)}" fill="url(#hatch-${view.key})"/>`);
        } else {
          out.push(`<circle cx="${n2(b.cx)}" cy="${n2(b.cy)}" r="${n2(b.r)}" fill="${c.surface}" fill-opacity="0.75" stroke="${stroke}" stroke-width="${sw(1.2)}"/>`);
          if (over) out.push(`<circle cx="${n2(b.cx)}" cy="${n2(b.cy)}" r="${n2(b.r)}" fill="url(#hatch-${view.key})"/>`);
        }
      }
    }
    for (const p of ordered) {
      const f = footprint(view, p.geometry);
      const small = f.w * s < 26 || f.h * s < 12;
      out.push(
        `<text x="${n2(f.x + f.w / 2)}" y="${n2(small ? f.y - 5 / s : f.y + f.h / 2)}" text-anchor="middle" dominant-baseline="central" font-family="monospace" font-size="${sw(10)}" fill="${c.primary}" stroke="${c.canvas}" stroke-width="${sw(3)}" stroke-linejoin="round" paint-order="stroke">${esc(p.label)}</text>`
      );
    }
    for (const sh of shells) {
      const [b] = bodiesInView(view, sh.geometry);
      if (b.kind === "rect") out.push(`<text x="${n2(b.x + 4 / s)}" y="${n2(b.y + 13 / s)}" font-family="monospace" font-size="${sw(10)}" fill="${c.secondary}">${esc(sh.label)}</text>`);
    }
    out.push(`</g>`);
    // rulers, drawn in px outside the frame
    const step = niceStep(s, 50);
    const rl: string[] = [];
    for (let t = Math.ceil(r.x0 / step) * step; t <= r.x1 + 1e-6; t += step) {
      const px = (t - r.x0) * s;
      rl.push(`<path d="M${n2(px)} -5V0" stroke="${c.muted}"/><text x="${n2(px + 2)}" y="-8" font-family="monospace" font-size="9" fill="${c.muted}">${fmtMm(n2(t))}</text>`);
    }
    const vA = view.flip ? -r.y1 : r.y0, vB = view.flip ? -r.y0 : r.y1;
    for (let t = Math.ceil(vA / step) * step; t <= vB + 1e-6; t += step) {
      const py = ((view.flip ? -t : t) - r.y0) * s;
      rl.push(`<path d="M-5 ${n2(py)}H0" stroke="${c.muted}"/><text x="-8" y="${n2(py - 2)}" text-anchor="end" font-family="monospace" font-size="9" fill="${c.muted}">${fmtMm(n2(t))}</text>`);
    }
    out.push(...rl);
    out.push(`<text x="0" y="${n2(h + 14)}" font-family="monospace" font-size="10" letter-spacing="1.5" fill="${c.link}">${esc(label.toUpperCase())} (${view.hName} right, ${view.vName} ${view.flip ? "up" : "down"})</text>`);
    out.push(`</g>`);
    return out.join("");
  };

  // hatch per view id (patterns are shared, so alias the id the shapes use)
  const hatchDefs = ["top", "front", "side"]
    .map((k) => `<pattern id="hatch-${k}" width="${hatchTile}" height="${hatchTile}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${hatchTile}" stroke="${c.danger}" stroke-width="${hatchLine}"/></pattern>`)
    .join("");

  const ox = pad + ruler;
  const oy = pad + ruler;
  parts_.push(drawView(top, rt, ox, oy, "Top"));
  const rx = ox + wTop + gap * s + ruler;
  parts_.push(drawView(front, rf, rx, oy, "Front"));
  parts_.push(drawView(side, rs, rx, oy + hFront + gap * s + ruler, "Side"));

  const scaleNote = `Drawn to scale: 1 mm is ${s} units in this file. Grid 5 mm minor, 10 mm major. Dashed line is the inner wall (${fmtMm(inp.wall)} mm). Overlaps use bounding boxes.`;
  const ty = H - titleH + 10;
  const title = `
<g>
<rect x="${pad}" y="${ty}" width="${W - pad * 2}" height="${titleH - 20}" fill="${c.surface}" stroke="${c.hairline}"/>
<text x="${pad + 14}" y="${ty + 22}" font-family="sans-serif" font-size="15" font-weight="600" fill="${c.primary}">${esc(inp.conceptName)}</text>
<text x="${pad + 14}" y="${ty + 40}" font-family="monospace" font-size="10" letter-spacing="1.5" fill="${c.link}">Physical layout</text>
<text x="${pad + 14}" y="${ty + 54}" font-family="sans-serif" font-size="10" fill="${c.secondary}">${esc(scaleNote)}</text>
<text x="${W - pad - 14}" y="${ty + 22}" text-anchor="end" font-family="monospace" font-size="11" fill="${c.secondary}">${esc(inp.date)}</text>
</g>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(inp.conceptName)} physical layout">
<defs>${hatchDefs}</defs>
<rect width="${W}" height="${H}" fill="${c.canvas}"/>
${parts_.join("\n")}
${title}
</svg>
`;
  return { svg, scaleNote, width: W, height: H };
}
