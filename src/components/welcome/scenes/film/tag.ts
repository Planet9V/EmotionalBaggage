// The gadget as the owner chose it (22 Nov): the Rev D tag, direction A "Heritage", colourway A1 "Saddle". A slim
// leather-look luggage tag, 62 by 92 by 12.8 mm, with shoulders cut at 45 degrees, a black strap looped through a
// slot at the top, cream saddle stitching round the edge, a perforated speaker panel (a round field over the coin
// door and a rectangular field over the speaker), a blind-stamped oval "BAGGAGE CLAIMS / MK1" with the tagline
// below it; on the back a card window and the round tracker door with "FRAGILE, and emotionally unstable."
//
// Built in code, as everything in the film is: the outline is extruded, the strap is a few flat boxes, and the
// tag's body and its strap are one mesh with one material. The stitches and the lettering are drawn once on a small
// canvas; the perforations, the pebble grain and the speaking glow are worked out in the material's shader from
// where a point is on the tag, so they stay crisp and cost no geometry. Sizes are the design's own, in mm, at the
// bag's scale (a 55 cm carry-on is 0.7 units tall, so a millimetre is 1.25 thousandths of a unit).
import * as THREE from "three";
import type { Kit, V3 } from "./kit";
import { FACE, SLOT, STRAP, TAG_MM, rounded, stitchRuns, tagOutline, type P2 } from "./tagShape";

const { h: H, t: T } = TAG_MM;

/** One millimetre of the real tag, in the film's units (the bag's scale). */
const MM = 1.25 / 1000;
const BEVEL = 1.0;
/** The strap's thickness, in units. */
export const STRAP_T = STRAP.t * MM;
/** From the strap's pivot (where it leaves the bag) to the tag's top edge. */
const TOP_GAP = 0.012;
/** The tag's middle, below the pivot: the length of the pendulum. */
export const TAG_ARM = TOP_GAP + (H / 2) * MM;
/** Half the tag's thickness, in units, so the swing can keep it off the bag. */
const TAG_HALF_T = (T / 2) * MM;

const SADDLE = "#a8683a";
/** The strap: black TPU. */
export const STRAP_INK = "#1d1f23";

// ---- the build -----------------------------------------------------------------------------------------------------

/** The body: the outline extruded to the tag's thickness, with rounded (burnished) edges and the strap slot through it. */
function bodyGeometry() {
  const shape = new THREE.Shape(tagOutline(BEVEL).map(([x, y]) => new THREE.Vector2(x, y)));
  const hole = new THREE.Path();
  const sx = SLOT.w / 2 - BEVEL;
  const sy = H / 2 - SLOT.down;
  const sr = Math.max(0.3, SLOT.h / 2 - BEVEL * 0.6);
  hole.absarc(sx - sr, sy, sr, -Math.PI / 2, Math.PI / 2, false);
  hole.absarc(-sx + sr, sy, sr, Math.PI / 2, (Math.PI * 3) / 2, false);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: T - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(T - BEVEL * 2) / 2);
  g.scale(MM, MM, MM);
  return g;
}

/** A flat band of strap from `a` to `b` (each [y, z]) at x = 0. */
export function band(k: Kit, a: [number, number], b: [number, number], c: string, width = STRAP.w * MM, thick = STRAP.t * MM, x = 0) {
  const dy = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dy, dz) + thick * 0.9;
  k.box([width, thick, len], c, [x, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { rot: [Math.atan2(-dy, dz), 0, 0] });
}

/** The middle of the tag in its own group (the strap's pivot is the group's origin): straight below it. */
const TAG_MID: V3 = [0, -TAG_ARM, 0];

/**
 * The tag and the end of its strap, in the swinging group (origin at the pivot, hanging down -y, front +z): the two
 * strands of the loop come down either side of the top edge and meet through the slot. One mesh: the strap is
 * surface 0, the leather surface 2 (the material tells them apart).
 */
export function tagBuild(k: Kit) {
  const topY = -TOP_GAP;
  const slotY = topY - SLOT.down * MM;
  const zf = TAG_HALF_T + (STRAP.t * MM) / 2;
  k.surface(0, () => {
    [1, -1].forEach((side) => {
      band(k, [0, 0], [topY, side * zf], STRAP_INK);
      band(k, [topY, side * zf], [slotY, side * zf], STRAP_INK);
    });
    // through the slot
    k.box([STRAP.w * MM, STRAP.t * MM, zf * 2], STRAP_INK, [0, slotY, 0]);
  });
  k.surface(2, () => k.geo(bodyGeometry(), SADDLE, TAG_MID));
}

// ---- the drawn face ----------------------------------------------------------------------------------------------

const PX = 8; // canvas pixels per mm
const HALF_W = 64; // mm across each half of the canvas (front left, back right)
const SPAN_H = 96; // mm down the canvas
const FONT = "'Inter Variable', Inter, system-ui, sans-serif";
const CREAM = "#f1e4c3";
const STAMP = "rgba(74, 40, 16, 0.6)";
/** The tagline is pressed a little deeper than the mark, so it reads at arm's length (and in the close-up). */
const TAGLINE = "rgba(66, 34, 12, 0.75)";
const STAMP_LIT = "rgba(255, 226, 190, 0.28)";

function stitches(g: CanvasRenderingContext2D, path: P2[], pitch: number, len: number, slant: number) {
  // a dash every `pitch` mm along the closed path, each turned `slant` off it as a saddle stitch is (tagShape.ts)
  g.strokeStyle = CREAM;
  g.lineWidth = 1.0;
  g.lineCap = "round";
  for (const [a, b] of stitchRuns(path, pitch, len, slant)) {
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  }
}

/** Blind-stamped words: pressed darker, with a hair of light along the lower lip of the stamp. */
function stamped(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, weight = 700, spacing = 0.6, ink = STAMP) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  // a canvas that knows letter spacing tracks the stamp out; one that does not draws it tight
  const ctx = g as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  g.fillStyle = STAMP_LIT;
  g.fillText(text, x, y + 0.28);
  g.fillStyle = ink;
  g.fillText(text, x, y);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}

function drawFront(g: CanvasRenderingContext2D) {
  // the stitch line, 3 mm in
  stitches(g, tagOutline(3, 6).map(([x, y]): P2 => [x, -y]), 3.4, 2.2, 0.49);
  // the perforated panel's pressed edge, and the coin door's parting line (the holes are the shader's)
  const p = FACE.panel;
  g.lineWidth = 0.35;
  g.strokeStyle = "rgba(255, 226, 190, 0.3)";
  g.beginPath();
  g.roundRect(p.x0, -p.y1 + 0.3, p.x1 - p.x0, p.y1 - p.y0, 2.5);
  g.stroke();
  g.strokeStyle = "rgba(60, 30, 10, 0.45)";
  g.beginPath();
  g.roundRect(p.x0, -p.y1, p.x1 - p.x0, p.y1 - p.y0, 2.5);
  g.stroke();
  const d = FACE.door;
  g.lineWidth = 0.3;
  g.beginPath();
  g.arc(d.x, -d.y, d.r, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(40, 20, 8, 0.7)";
  g.beginPath();
  g.roundRect(d.x - 4, -d.y - 0.5, 8, 1, 0.5);
  g.fill();
  // the maker's mark: an oval, two rules, the name stacked, MK1 between the rules
  const o = FACE.oval;
  g.lineWidth = 0.6;
  g.strokeStyle = "rgba(255, 226, 190, 0.26)";
  g.beginPath();
  g.ellipse(o.x, -o.y + 0.3, o.rx, o.ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = STAMP;
  g.beginPath();
  g.ellipse(o.x, -o.y, o.rx, o.ry, 0, 0, Math.PI * 2);
  g.stroke();
  stamped(g, "BAGGAGE", 0, 12.5, 6.2, 800, 0.7);
  stamped(g, "CLAIMS", 0, 19.1, 6.2, 800, 0.7);
  stamped(g, "MK1", 0, 25.6, 4.0, 700, 1.2);
  g.lineWidth = 0.5;
  g.strokeStyle = STAMP;
  g.beginPath();
  g.moveTo(-13, 25.6);
  g.lineTo(-5, 25.6);
  g.moveTo(5, 25.6);
  g.lineTo(13, 25.6);
  g.stroke();
  // the tagline, stamped below it
  stamped(g, "Your luggage", 0, 33.8, 4.3, 800, 0.15, TAGLINE);
  stamped(g, "finally talks back.", 0, 38.4, 4.3, 800, 0.15, TAGLINE);
}

function drawBack(g: CanvasRenderingContext2D) {
  // the back plate's parting line and its own stitching
  const pl = FACE.plate;
  g.lineWidth = 0.4;
  g.strokeStyle = "rgba(40, 20, 8, 0.65)";
  g.beginPath();
  g.roundRect(pl.x0, -pl.y1, pl.x1 - pl.x0, pl.y1 - pl.y0, 3);
  g.stroke();
  const inset: P2[] = rounded(
    [
      [pl.x0 + 2.2, pl.y0 + 2.2],
      [pl.x1 - 2.2, pl.y0 + 2.2],
      [pl.x1 - 2.2, pl.y1 - 2.2],
      [pl.x0 + 2.2, pl.y1 - 2.2],
    ].map(([x, y]) => [x!, -y!] as P2),
    [2, 2, 2, 2],
  );
  stitches(g, inset, 3.4, 2.2, 0.49);
  // the name card behind its window
  const c = FACE.card;
  g.fillStyle = "#f6f1e6";
  g.beginPath();
  g.roundRect(c.x0, -c.y1, c.x1 - c.x0, c.y1 - c.y0, 1.6);
  g.fill();
  g.fillStyle = "#a9a49a";
  g.fillRect(c.x0 + 13, -c.y1 + 6, 30, 1.6);
  g.fillRect(c.x0 + 5, -c.y1 + 12, 38, 1.6);
  g.fillRect(c.x0 + 19, -c.y1 + 18, 24, 1.6);
  g.strokeStyle = "rgba(40, 20, 8, 0.55)";
  g.lineWidth = 0.5;
  g.beginPath();
  g.roundRect(c.x0, -c.y1, c.x1 - c.x0, c.y1 - c.y0, 1.6);
  g.stroke();
  // the tracker door: its parting ring, its coin slot, and the owner's line
  const d = FACE.tracker;
  g.lineWidth = 0.4;
  g.strokeStyle = "rgba(40, 20, 8, 0.6)";
  g.beginPath();
  g.arc(d.x, -d.y, d.r, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(40, 20, 8, 0.7)";
  g.beginPath();
  g.roundRect(d.x - 3, -d.y - 11.9, 6, 1, 0.5);
  g.fill();
  g.font = `800 6px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = CREAM;
  g.fillText("FRAGILE", d.x, -d.y - 5.9);
  stamped(g, "— and —", d.x, -d.y + 0.2, 3.6, 700, 0.2);
  stamped(g, "emotionally", d.x, -d.y + 4.9, 4.3, 700, 0.15);
  stamped(g, "unstable.", d.x, -d.y + 9.2, 4.3, 700, 0.15);
}

function paintArt(canvas: HTMLCanvasElement) {
  const g = canvas.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, canvas.width, canvas.height);
  // each half in mm about the tag's middle, y down (the shader reads it back the same way)
  for (const [half, draw] of [
    [0, drawFront],
    [1, drawBack],
  ] as const) {
    g.save();
    g.translate((half + 0.5) * HALF_W * PX, (SPAN_H / 2) * PX);
    g.scale(PX, PX);
    draw(g);
    g.restore();
  }
}

let art: THREE.CanvasTexture | null = null;
/** The stitches and the stamped words, front and back side by side, drawn once (again when the fonts arrive). */
function artTexture() {
  if (!art) {
    const canvas = Object.assign(document.createElement("canvas"), { width: HALF_W * PX * 2, height: SPAN_H * PX });
    paintArt(canvas);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    art = tex;
    void document.fonts?.ready.then(() => {
      paintArt(canvas);
      tex.needsUpdate = true;
    });
  }
  return art;
}

// ---- the material ------------------------------------------------------------------------------------------------

export type TagUniforms = { uArt: { value: THREE.Texture | null }; uSpeak: { value: number }; uOn: { value: number }; uGlow: { value: number } };

const f = (n: number) => n.toFixed(3);
const PARS = /* glsl */ `
varying vec3 vObj;
varying vec3 vObjN;
varying float vSurf;
uniform sampler2D uArt;
uniform float uSpeak;
uniform float uOn;
uniform float uGlow;
float tagHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 tagHash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
// pebble grain: the creases between jittered cells (1 on a pebble, 0 in a crease)
float tagGrain(vec2 p) {
  vec2 c = floor(p);
  vec2 q = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 r = o + 0.15 + 0.7 * tagHash2(c + o) - q;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return smoothstep(0.0, 0.22, sqrt(d2) - sqrt(d1));
}
float tagNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(tagHash(i), tagHash(i + vec2(1.0, 0.0)), u.x), mix(tagHash(i + vec2(0.0, 1.0)), tagHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float tagBox(vec2 p, vec4 r) { return step(r.x, p.x) * step(p.x, r.y) * step(r.z, p.y) * step(p.y, r.w); }
`;

/** Worked out once per pixel, after the vertex colour: where on the tag this is, and what it is made of there. */
function surfaceBlock() {
  const { panel: p, door: d, speaker: s, oval: o, card: c } = FACE;
  return /* glsl */ `
float leather = step(1.5, vSurf);
vec2 mm = vec2(vObj.x, vObj.y + ${f(TAG_ARM)}) / ${MM.toFixed(6)};
float fw = length(fwidth(mm));
float front = leather * step(0.6, vObjN.z);
float back = leather * step(vObjN.z, -0.6);
float edge = leather * (1.0 - front - back);
// on the back, x as seen from behind
vec2 bm = vec2(-mm.x, mm.y);
vec2 artUv = front > 0.5 ? vec2((mm.x + ${f(HALF_W / 2)}) / ${f(HALF_W * 2)}, (mm.y + ${f(SPAN_H / 2)}) / ${f(SPAN_H)})
                         : vec2(0.5 + (bm.x + ${f(HALF_W / 2)}) / ${f(HALF_W * 2)}, (mm.y + ${f(SPAN_H / 2)}) / ${f(SPAN_H)});
// the perforated panel: 1.3 mm holes on a 2.6 mm hexagonal lattice, centred on the coin door
float inPanel = front * tagBox(mm, vec4(${f(p.x0)}, ${f(p.x1)}, ${f(p.y0)}, ${f(p.y1)}));
vec2 lp = mm - vec2(${f(d.x)}, ${f(d.y)});
vec2 cell = vec2(2.6, 4.5033);
vec2 ha = mod(lp, cell) - cell * 0.5;
vec2 hb = mod(lp - cell * 0.5, cell) - cell * 0.5;
vec2 off = dot(ha, ha) < dot(hb, hb) ? ha : hb;
vec2 hc = mm - off;
float keep = tagBox(hc, vec4(${f(p.x0 + 1.4)}, ${f(p.x1 - 1.4)}, ${f(p.y0 + 1.4)}, ${f(p.y1 - 1.4)}));
float ring = abs(length(hc - vec2(${f(d.x)}, ${f(d.y)})) - ${f(d.r)});
keep *= step(0.95, ring);
keep *= 1.0 - tagBox(hc - vec2(${f(d.x)}, ${f(d.y)}), vec4(-5.2, 5.2, -1.6, 1.6));
float through = tagBox(hc, vec4(${f(s.x0)}, ${f(s.x1)}, ${f(s.y0)}, ${f(s.y1)}));
float aa = max(fw, 0.05);
float hole = 1.0 - smoothstep(0.65 - aa * 0.5, 0.65 + aa * 0.5, length(off));
// far off, a hole is smaller than a pixel: show the field's average instead of shimmering
float far = smoothstep(0.45, 1.1, fw);
hole = mix(hole, 0.227, far) * keep * inPanel;
// the stamp and the card window are pressed smooth; the grain is everywhere else on the faces
vec2 ov = (mm - vec2(${f(o.x)}, ${f(o.y)})) / vec2(${f(o.rx)}, ${f(o.ry)});
float smooth_ = max(inPanel, front * step(dot(ov, ov), 1.0));
smooth_ = max(smooth_, front * tagBox(mm, vec4(-24.0, 24.0, -40.6, -31.4)));
smooth_ = max(smooth_, back * tagBox(bm, vec4(${f(c.x0)}, ${f(c.x1)}, ${f(c.y0)}, ${f(c.y1)})));
float grainAmt = (front + back) * (1.0 - smooth_) * (1.0 - smoothstep(0.25, 0.7, fw));
float grain = tagGrain(mm / 1.8);
float mottle = tagNoise(mm / 7.0) * 0.6 + tagNoise(mm / 2.3) * 0.4;
vec3 leatherCol = diffuseColor.rgb * (0.9 + 0.16 * mottle) * mix(1.0, mix(0.86, 1.0, grain), grainAmt);
leatherCol *= mix(1.0, 0.78, edge);
leatherCol *= mix(1.0, 1.05, inPanel);
// holes: dark where they go through to the speaker, shaded where they are blind
leatherCol *= 1.0 - min(0.85, hole * mix(0.45, 0.9, through) * mix(1.0, 2.4, far));
vec4 artC = texture2D(uArt, artUv);
leatherCol = mix(leatherCol, artC.rgb, artC.a * (front + back));
diffuseColor.rgb = mix(diffuseColor.rgb, leatherCol, leather);
float tagBump = (grain - 1.0) * grainAmt * 0.2 - hole * (1.0 - far) * 0.6;
`;
}

/**
 * The tag's material: a standard one, with the perforations, the grain, the drawn face and the speaking glow added
 * in its shader. `u` is how the film drives it, frame by frame (tagPerform).
 */
export function tagMaterial() {
  const u: TagUniforms = { uArt: { value: null }, uSpeak: { value: 0 }, uOn: { value: 0 }, uGlow: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    u.uArt.value = artTexture();
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float surface;\nvarying vec3 vObj;\nvarying vec3 vObjN;\nvarying float vSurf;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;\nvObjN = normal;\nvSurf = surface;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${PARS}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${surfaceBlock()}`)
      // the leather-look print has a low sheen; the strap is a little glossier
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.5, mix(0.62, 0.72, edge), leather);")
      .replace(
        "#include <normal_fragment_maps>",
        [
          "#include <normal_fragment_maps>",
          // the grain and the holes as a bump: tilt the normal by how the height changes across the pixel
          "{",
          `  vec3 sp = -vViewPosition; float hh = tagBump * ${MM.toFixed(6)};`,
          "  vec3 dpx = dFdx(sp); vec3 dpy = dFdy(sp);",
          "  vec3 r1 = cross(dpy, normal); vec3 r2 = cross(normal, dpx);",
          "  float det = dot(dpx, r1);",
          "  vec3 grad = sign(det) * (dFdx(hh) * r1 + dFdy(hh) * r2);",
          "  normal = normalize(abs(det) * normal - grad);",
          "}",
        ].join("\n"),
      )
      .replace(
        "#include <emissivemap_fragment>",
        [
          "#include <emissivemap_fragment>",
          // the voice: light from inside comes through the holes over the speaker, a softer glow through the rest of
          // the panel, and the panel itself lightens a little round the speaker while it talks
          "float lit = 0.1 * uOn + 1.1 * uSpeak + 0.8 * uGlow;",
          `vec2 sc = (mm - vec2(${f((FACE.speaker.x0 + FACE.speaker.x1) / 2)}, ${f((FACE.speaker.y0 + FACE.speaker.y1) / 2)})) / vec2(18.0, 14.0);`,
          "float halo = inPanel * exp(-dot(sc, sc) * 1.6);",
          "totalEmissiveRadiance += vec3(1.0, 0.62, 0.3) * lit * hole * mix(0.35, 1.0, through) * 1.4;",
          "totalEmissiveRadiance += vec3(0.95, 0.55, 0.25) * (0.22 * uSpeak + 0.05 * uOn + 0.12 * uGlow) * halo;",
        ].join("\n"),
      );
  };
  mat.customProgramCacheKey = () => "tag-a1-1";
  return { mat, u };
}

// the tag's uniforms belong to the shader, not to React: this changes them by name
export function tagPerform(u: TagUniforms, level: number, on: number, glow: number) {
  u.uSpeak.value = level;
  u.uOn.value = on;
  u.uGlow.value = glow;
}

/** Where the speaker is on the tag, in its group: a light standing in front of it reads as light from the holes. */
export const SPEAKER_AT: V3 = [((FACE.speaker.x0 + FACE.speaker.x1) / 2) * MM, -TAG_ARM + ((FACE.speaker.y0 + FACE.speaker.y1) / 2) * MM, TAG_HALF_T + 0.3];

/** The point the close-up frames: on the tag's face, between the stamp and the tagline (22 mm below its middle). */
export const STAMP_AT: V3 = [0, -TAG_ARM - 22 * MM, TAG_HALF_T];
