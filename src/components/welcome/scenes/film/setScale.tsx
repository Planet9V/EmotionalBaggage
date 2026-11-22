"use client";

// The check-in scale, used twice: scene 2 (the agent lifts the bag on, the display climbs to 62 lbs, the bag takes
// offence) and the closing button (script 0:45 and 2:10). The place is cool blues and white with one signal colour
// on the counter fronts; the display is the prop the joke hangs on, so it is large, faces the camera and stays in the
// shot where the line lands. The button comes back to the same desk at the end of the day: low sun through the high
// window, the queue packed away, new angles (low, from the bag's side), and the souvenirs themselves.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { sceneOf } from "../scenes";
import { bagVoice } from "../speech";
import { E, bump, clamp01, kf, mix } from "./ease";
import { buttonCast, scaleCast } from "./castScale";
import { A, BAG_TOP, Bag, Built, C, Contact, Sign, Stage, useClock, type BagPose, type Kit, type Look, type Shot, type Staged, type V3 } from "./kit";
import { Figure } from "./people";

const PLATE = 0.1;
const BAG_Z = 0.05;
const SET_DOWN = 1500;
const POUNDS = 62;
const MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace";
const SIGNAL = "#2f6fed";

const LOOK: Look = {
  sky: ["#c7dbf5", "#eaf2fb"],
  fog: ["#e3ecf7", 10, 36],
  floor: "#cbd5e1",
  key: { c: "#fff5e8", i: 2.5, p: [3.5, 8, 6] },
  fill: { sky: "#dce9ff", ground: "#aab4c4", i: 0.55 },
  rim: { c: "#ffe3c2", i: 0.9, p: [-5, 4, -6] },
  env: 0.34,
};
/** The button: the same hall at the end of the day, lit low and warm from the high window, the far side in dusk. */
const EVENING: Look = {
  sky: ["#4d5c96", "#f2b48a"],
  fog: ["#d9b9a8", 9, 30],
  floor: "#c9c3c8",
  key: { c: "#ffd2a0", i: 2.9, p: [-6.5, 3.4, 5.5] },
  fill: { sky: "#9ea3d8", ground: "#8d7f86", i: 0.6 },
  rim: { c: "#ff9f73", i: 1.1, p: [5, 3, -6] },
  env: 0.3,
};

/** What the display reads in scene 2: nothing until the bag is down, then a climb that overshoots and settles. */
function weightAt(t: number): number {
  if (t < SET_DOWN + 120) return 0;
  const p = clamp01((t - SET_DOWN - 120) / 3000);
  return p < 0.8 ? 64.4 * E.io(p / 0.8) : mix(64.4, POUNDS, E.io((p - 0.8) / 0.2));
}
const OVER_AT = sceneOf("scale").litAt;
const SCREEN = { w: 768, h: 448 };

// the canvas and its texture are changed in place, outside React's data flow; this does it by name
function drawReadout(canvas: HTMLCanvasElement, texture: THREE.CanvasTexture, pounds: number, over: boolean, lamp: boolean) {
  const g = canvas.getContext("2d");
  if (!g) return;
  g.fillStyle = "#0b0c0e";
  g.fillRect(0, 0, SCREEN.w, SCREEN.h);
  // the digits sit on split flaps, like the departures board further up the page
  const text = pounds.toFixed(1).padStart(4, " ");
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.font = `600 176px ${MONO}`;
  [...text].forEach((ch, i) => {
    const x = 36 + i * 136;
    g.fillStyle = "#20242c";
    g.beginPath();
    g.roundRect(x, 40, 124, 110, [12, 12, 0, 0]);
    g.fill();
    g.fillStyle = "#191c22";
    g.beginPath();
    g.roundRect(x, 150, 124, 110, [0, 0, 12, 12]);
    g.fill();
    g.fillStyle = over ? "#ff6a5c" : "#ffffff";
    g.fillText(ch, x + 62, 158);
    g.fillStyle = "#0b0c0e";
    g.fillRect(x, 148, 124, 4);
  });
  g.font = `600 84px ${MONO}`;
  g.textAlign = "left";
  g.fillStyle = "#c2c8d2";
  g.fillText("lbs", 592, 204);
  // the lamp and its one word
  g.fillStyle = over && lamp ? "#ff4d3d" : "#3a1f1d";
  g.beginPath();
  g.arc(78, 354, 30, 0, Math.PI * 2);
  g.fill();
  if (over && lamp) {
    g.fillStyle = "rgba(255,77,61,0.28)";
    g.beginPath();
    g.arc(78, 354, 46, 0, Math.PI * 2);
    g.fill();
  }
  g.font = `700 76px ${MONO}`;
  g.fillStyle = over ? "#ff6a5c" : "#2a2d34";
  g.fillText("OVERWEIGHT", 140, 360);
  texture.needsUpdate = true;
}

const DISPLAY: V3 = [0.84, 0, -0.28];
const SCREEN_Y = 1.22;
/** The scale's display: drawn on a small canvas whenever the number or the lamp changes. */
function Display({ read }: { read: (t: number) => { pounds: number; over: boolean; blink: boolean } }) {
  const canvas = useMemo(() => Object.assign(document.createElement("canvas"), { width: SCREEN.w, height: SCREEN.h }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const shown = useRef("");
  const clock = useClock();
  useEffect(() => {
    // the page's mono face may arrive after the first drawing
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) shown.current = "";
    });
    return () => {
      live = false;
      texture.dispose();
    };
  }, [texture]);
  useFrame(() => {
    const r = read(clock.t);
    const key = `${r.pounds.toFixed(1)}${r.over}${r.blink}`;
    if (key !== shown.current) {
      shown.current = key;
      drawReadout(canvas, texture, r.pounds, r.over, r.blink);
    }
  });
  return (
    <mesh position={[DISPLAY[0], SCREEN_Y, DISPLAY[2] + 0.062]} rotation={[-0.05, -0.1, 0]}>
      <planeGeometry args={[0.86, 0.5]} />
      <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
    </mesh>
  );
}

const DESK_X = -1.9;
function desk(k: Kit, x: number, screen = true, feed = 1.95) {
  k.at([x, 0, -0.55], [0, 0, 0], () => {
    k.box([1.5, 1.0, 0.72], "#f3f6f9", [0, 0.5, 0], { r: 0.06 });
    k.box([1.3, 0.56, 0.03], SIGNAL, [0, 0.56, 0.365], { r: 0.012, seg: 1 });
    k.box([1.3, 0.05, 0.032], "#ffffff", [0, 0.2, 0.366]);
    k.box([1.64, 0.06, 0.86], "#d5dde7", [0, 1.03, 0], { r: 0.025, seg: 2 });
    if (screen) {
      k.cyl(0.03, 0.16, C.ink, [-0.45, 1.14, -0.1], { seg: 8 });
      k.box([0.46, 0.32, 0.04], C.ink, [-0.45, 1.34, -0.1], { rot: [-0.12, 0.5, 0], r: 0.015, seg: 1 });
      k.box([0.4, 0.26, 0.01], "#a9cdfb", [-0.439, 1.343, -0.08], { rot: [-0.12, 0.5, 0] });
      k.box([0.36, 0.02, 0.13], "#c2cad5", [0.2, 1.07, 0.1], { r: 0.008, seg: 1 });
    }
    // the feeder belt beside it, with its rubber slats, running back to the collector
    k.box([0.92, 0.34, 1.5], "#b7c1ce", [feed, 0.17, -0.6], { r: 0.03, seg: 1 });
    k.box([0.74, 0.03, 1.5], "#3b414b", [feed, 0.35, -0.6]);
    for (let i = 0; i < 10; i++) k.box([0.74, 0.014, 0.035], "#59616f", [feed, 0.37, -1.3 + i * 0.155]);
  });
}

function checkIn(evening: boolean) {
  return (k: Kit) => {
    // the back wall: pale panels, a blue dado, a strip of high window (at the end of the day, the sky in it is low sun)
    k.box([26, 5.2, 0.3], evening ? "#d9dbe6" : "#e4eaf2", [0, 2.6, -4.0]);
    k.box([26, 0.9, 0.34], "#b5c7e0", [0, 0.45, -3.99]);
    k.box([26, 1.1, 0.32], evening ? "#f6c08f" : "#bcd8f4", [0, 3.9, -3.99]);
    for (let x = -11; x <= 11; x += 2.2) k.box([0.05, 5.2, 0.33], "#dbe3ee", [x, 2.6, -3.99]);
    for (let x = -11; x <= 11; x += 2.2) k.box([0.08, 1.1, 0.36], "#c9d2de", [x, 3.9, -3.98]);
    // the collector belt along the wall
    k.box([20, 0.42, 0.95], "#b7c1ce", [0, 0.21, -2.35], { r: 0.03, seg: 1 });
    k.box([20, 0.03, 0.78], "#3b414b", [0, 0.43, -2.35]);
    for (let x = -9.6; x <= 9.6; x += 0.4) k.box([0.035, 0.012, 0.78], "#59616f", [x, 0.45, -2.35]);
    // three desks in a row: the scale's own, and a neighbour each side
    desk(k, DESK_X, true, -DESK_X);
    desk(k, -5.8, false);
    desk(k, 2.3, false);
    // the platform scale: a low deck with a hazard edge
    k.box([1.08, 0.085, 0.86], "#aab4c0", [0, 0.0425, BAG_Z], { r: 0.02, seg: 1 });
    k.box([1.08, 0.03, 0.05], C.yellow, [0, 0.07, BAG_Z + 0.42]);
    // the display's post and housing
    k.cyl(0.18, 0.03, "#8f99a6", [DISPLAY[0], 0.015, DISPLAY[2]], { seg: 20 });
    k.cyl(0.035, SCREEN_Y - 0.2, "#aab4c0", [DISPLAY[0], (SCREEN_Y - 0.2) / 2, DISPLAY[2]], { seg: 12 });
    k.box([0.98, 0.62, 0.11], "#1c2740", [DISPLAY[0], SCREEN_Y, DISPLAY[2]], { rot: [-0.05, -0.1, 0], r: 0.045 });
    if (evening) {
      // closing time: the queue posts gathered in a huddle by the wall, a bin of tags, the floor line alone
      [[-4.3, -1.3], [-4.05, -1.45], [-4.2, -1.05], [-3.95, -1.2]].forEach(([x, z]) => {
        k.cyl(0.16, 0.035, "#59616f", [x!, 0.018, z!], { seg: 18 });
        k.cyl(0.032, 0.95, "#c9d0d8", [x!, 0.5, z!], { seg: 10 });
        k.cyl(0.045, 0.09, "#59616f", [x!, 0.97, z!], { seg: 10 });
      });
      k.box([0.5, 0.4, 0.4], "#59616f", [3.6, 0.2, -1.3], { r: 0.03, seg: 1 });
    } else {
      // the queue: posts joined by a belt ribbon, and the line to wait behind
      [-4.6, -3.4, -2.2].forEach((x, i) => {
        k.cyl(0.16, 0.035, "#59616f", [x, 0.018, 2.3], { seg: 18 });
        k.cyl(0.032, 0.95, "#c9d0d8", [x, 0.5, 2.3], { seg: 10 });
        k.cyl(0.045, 0.09, "#59616f", [x, 0.97, 2.3], { seg: 10 });
        if (i) k.box([1.2, 0.07, 0.012], SIGNAL, [x - 0.6, 0.93, 2.3]);
      });
    }
    k.box([1.9, 0.004, 0.07], C.yellow, [0, 0.002, 1.25]);
    // the sign's hangers and frame
    [-1.1, 1.1].forEach((x) => k.cyl(0.015, 1.6, "#aab4c0", [x - 0.9, 3.9, -1.7], { seg: 6 }));
    k.box([2.86, 0.66, 0.08], "#16233d", [-0.9, 2.95, -1.7], { r: 0.03, seg: 1 });
  };
}
const DAY_SET = checkIn(false);
const EVENING_SET = checkIn(true);


const TILT = 0.2;
// ---- the huff ---------------------------------------------------------------------------------------------------

const HUFF_AT = 7520;
const HUFF_MS = 900;
/** Two jets of steam from the bag's top corners, as a cartoon kettle lets off: white, so the one that crosses the display reads. */
function Huff({ top }: { top: (t: number) => V3 }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const m = useMemo(() => new THREE.Object3D(), []);
  const clock = useClock();
  const N = 14;
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = clock.t;
    const all = (t - HUFF_AT) / HUFF_MS;
    g.visible = all > 0 && all < 1;
    if (!g.visible) return;
    const at = top(t);
    for (let i = 0; i < N; i++) {
      const side = i % 2 ? 1 : -1;
      const born = HUFF_AT + Math.floor(i / 2) * 55;
      const q = clamp01((t - born) / 520);
      const out = E.out(q);
      m.position.set(at[0] + side * (0.15 + 0.12 * out), at[1] + 0.04 + 0.55 * out + 0.04 * (i % 3), at[2] + 0.06);
      m.scale.setScalar(q <= 0 ? 0.0001 : (0.45 + 1.1 * out) * (1 - 0.6 * q * q));
      m.updateMatrix();
      g.setMatrixAt(i, m.matrix);
    }
    g.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.95 * (1 - all) ** 0.7;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} visible={false} frustumCulled={false}>
      <sphereGeometry args={[0.06, 12, 9]} />
      <meshBasicMaterial ref={mat} color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} fog={false} />
    </instancedMesh>
  );
}

/** Strain marks: three short ink strokes off the bag's top corner, as a comic draws a temper. In the bag's own frame. */
function strainGeometry() {
  const v: number[] = [];
  [2.05, 2.45, 2.85].forEach((a, i) => {
    const r1 = 0.07;
    const r2 = 0.2 + (i === 1 ? 0.04 : 0);
    const w = 0.014;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    v.push(r1 * c - w * sn * 0.4, r1 * sn + w * c * 0.4, 0, r2 * c - w * sn, r2 * sn + w * c, 0, r2 * c + w * sn, r2 * sn - w * c, 0);
    v.push(r1 * c - w * sn * 0.4, r1 * sn + w * c * 0.4, 0, r2 * c + w * sn, r2 * sn - w * c, 0, r1 * c + w * sn * 0.4, r1 * sn - w * c * 0.4, 0);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  return g;
}
function Strain() {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => strainGeometry(), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const clock = useClock();
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = clock.t;
    const on = t > HUFF_AT - 40 && t < HUFF_AT + 1300;
    g.visible = on;
    if (!on) return;
    // they snap out, twitch, and are gone
    g.scale.setScalar(E.back(clamp01((t - HUFF_AT + 40) / 160)) * (1 + 0.12 * Math.sin(t / 30)) * (1 - E.in(clamp01((t - HUFF_AT - 1050) / 250))));
  });
  return (
    <mesh ref={ref} geometry={geo} position={[-0.22, BAG_TOP + 0.02, 0.15]} visible={false}>
      <meshBasicMaterial color="#23262d" side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

// ---- the souvenirs ----------------------------------------------------------------------------------------------

const POP = 3820;
/** What "mostly SOUVENIRS" looks like: a snow globe, a little lattice tower and a pennant spring out of the top seam. */
function globe(k: Kit) {
  k.cyl(0.055, 0.045, "#3b414b", [0, 0.022, 0], { seg: 14 });
  k.ball(0.068, "#bfe0ff", [0, 0.1, 0], { seg: 14 });
  k.ball(0.03, "#f4f5f6", [0, 0.085, 0.01], { seg: 8 });
}
function tower(k: Kit) {
  k.cyl(0.06, 0.2, "#8f99a6", [0, 0.1, 0], { r2: 0.012, seg: 4 });
  k.box([0.09, 0.012, 0.09], "#6b7584", [0, 0.09, 0]);
  k.cyl(0.006, 0.06, "#6b7584", [0, 0.23, 0], { seg: 4 });
}
function pennant(k: Kit) {
  k.cyl(0.006, 0.3, "#59616f", [0, 0.15, 0], { seg: 6 });
  k.geo(new THREE.ConeGeometry(0.05, 0.18, 3), "#d1495b", [0.085, 0.25, 0], { rot: [0, 0, -Math.PI / 2], s: [1, 1, 0.12] });
}
const ITEMS: { make: (k: Kit) => void; x: number; delay: number; tilt: number }[] = [
  { make: tower, x: -0.11, delay: 0, tilt: 0.2 },
  { make: globe, x: 0.03, delay: 90, tilt: -0.1 },
  { make: pennant, x: 0.15, delay: 170, tilt: -0.35 },
];
function Souvenirs() {
  return (
    <>
      {/* the seam the bag has popped open */}
      <A f={(g, t) => void g.scale.set(1, 1, Math.max(0.001, kf(t, [[POP - 60, 0], [POP + 60, 1], [POP + 1700, 1], [POP + 2000, 0]])))} position={[0.02, BAG_TOP + 0.003, 0]}>
        <mesh>
          <boxGeometry args={[0.38, 0.006, 0.12]} />
          <meshBasicMaterial color="#15171c" />
        </mesh>
      </A>
      {ITEMS.map((it) => (
        <A
          key={it.x}
          f={(g, t) => {
            const up = kf(t, [[POP + it.delay, 0], [POP + it.delay + 260, 1, "back"], [POP + 1650, 1], [POP + 1950 + it.delay * 0.5, 0, "in"]]);
            g.visible = up > 0.001;
            g.position.set(it.x, BAG_TOP - 0.3 + 0.32 * up, 0);
            g.rotation.z = it.tilt * up + 0.08 * Math.sin(t / 90 + it.x * 10) * bump(t, POP + 200, POP + 900);
          }}
          visible={false}
        >
          <Built make={it.make} rough={0.5} receive={false} />
        </A>
      ))}
    </>
  );
}

function ScaleSet({ button }: { button: boolean }) {
  const scene = sceneOf(button ? "button" : "scale");
  const bag = (t: number): BagPose => {
    if (button) {
      // it stares up at the number, recoils, turns to us; crouches, and springs up proud as its souvenirs pop out
      const read = kf(t, [[200, 0], [800, 1], [1700, 1], [2700, 0]]);
      const recoil = bump(t, 900, 1500);
      const crouch = bump(t, 3500, POP);
      const proud = kf(t, [[POP - 20, 0], [POP + 250, 1, "back"], [6800, 1], [7500, 0.7]]);
      return {
        p: [0, PLATE + 0.12 * bump(t, POP - 20, POP + 260), BAG_Z],
        yaw: 0.55 * read,
        pitch: -0.12 * read + 0.06 * recoil,
        roll: -0.08 * recoil + 0.05 * proud * Math.sin(t / 380) * kf(t, [[4600, 0], [5000, 1]]),
        sx: 1 + 0.08 * crouch - 0.06 * bump(t, POP - 20, POP + 260) + 0.04 * proud,
        sy: 1 - 0.1 * crouch + 0.12 * bump(t, POP - 20, POP + 260) + 0.03 * proud - 0.04 * bump(t, 2100, 2600),
      };
    }
    const carried = 1 - kf(t, [[SET_DOWN - 150, 0], [SET_DOWN, 1]]);
    // the anticipation (it draws in a breath), then the slow, offended lean away from the display, swelled up
    const huff = kf(t, [[7250, 0], [7480, -0.2], [8150, 1, "back"]]);
    return {
      p: [kf(t, [[500, -0.3], [1300, 0]]), kf(t, [[0, 0.42], [500, 0.45], [1150, 0.36], [SET_DOWN, PLATE, "in"]]), BAG_Z],
      hang: 0.1 * Math.sin(t / 260) * carried,
      sy: 1 - 0.07 * bump(t, SET_DOWN, SET_DOWN + 220) + 0.06 * Math.max(0, huff) - 0.06 * bump(t, 7250, 7520),
      sx: 1 + 0.05 * bump(t, SET_DOWN, SET_DOWN + 220) + 0.1 * Math.max(0, huff) - 0.03 * bump(t, 7250, 7520),
      roll: TILT * huff,
      // it turns to the display as the number climbs, then back to us for the line
      yaw: 0.3 * kf(t, [[2900, 0], [3500, 1], [5400, 1], [5900, 0]]) - 0.12 * kf(t, [[5900, 0], [6400, 1], [7300, 1], [7600, 0]]),
    };
  };
  const cue = { bag, scene, setDown: SET_DOWN, display: [DISPLAY[0], SCREEN_Y, DISPLAY[2]] as V3, pop: POP };
  const { agent, host } = button ? buttonCast(cue) : scaleCast(cue);
  return (
    <>
      <Stage look={button ? EVENING : LOOK} />
      <Built make={button ? EVENING_SET : DAY_SET} />
      <Sign text="CHECK-IN" picto="bag" w={2.7} h={0.52} position={[-0.9, 2.95, -1.655]} />
      {/* the steel plate gives a little under the load */}
      <A f={(g, t) => void g.position.set(0, button ? -0.006 : -0.006 * kf(t, [[SET_DOWN, 0], [SET_DOWN + 150, 1.6], [SET_DOWN + 400, 1]]), 0)}>
        <mesh position={[0, PLATE - 0.008, BAG_Z]} receiveShadow castShadow>
          <boxGeometry args={[0.96, 0.02, 0.74]} />
          <meshStandardMaterial color="#dfe4ea" roughness={0.45} metalness={0.1} />
        </mesh>
      </A>
      <Display
        read={(t) =>
          button
            ? { pounds: POUNDS, over: true, blink: Math.floor(t / 520) % 2 === 0 || t > 2600 }
            : { pounds: weightAt(t), over: t >= OVER_AT, blink: t >= OVER_AT && (t - OVER_AT > 900 || Math.floor((t - OVER_AT) / 150) % 2 === 0) }
        }
      />
      <Contact at={(t) => ({ p: [bag(t).p[0], PLATE, BAG_Z], w: 0.82, d: 0.55, o: 0.5 * clamp01(1 - (bag(t).p[1] - PLATE) * 3) })} />
      <Bag pose={bag} voice={(t) => bagVoice(scene, t)}>
        {button ? <Souvenirs /> : <Strain />}
      </Bag>
      {button ? null : <Huff top={(t) => [bag(t).p[0] - 0.06 * Math.max(0, kf(t, [[7480, 0], [8150, 1]])), PLATE + BAG_TOP, BAG_Z]} />}
      <Figure pose={agent} role="agent" />
      <Figure pose={host} role="owner" tall={1.03} />
    </>
  );
}

export const ScaleScene: Staged = { Set: () => <ScaleSet button={false} />, shots: [
  // wide: the hall, the sign, the agent setting the bag down
  { at: 0, to: 2600, pos: [[0.4, 1.75, 9.2], [0.25, 1.6, 8.2]], look: [-0.1, 1.3, 0], rise: 0.04, ease: "soft" },
  // the push-in on stillness: the bag and the number, climbing
  { at: 2600, to: 5700, pos: [[0.5, 1.15, 5.6], [0.5, 1.08, 4.3]], look: [0.5, 1.04, 0], rise: 0.13, ease: "soft" },
  // the line: the agent behind her desk, the bag in the middle, the display on the right, all in one frame
  { at: 5700, to: 8500, pos: [[-0.3, 1.12, 5.05], [-0.28, 1.1, 4.7]], look: [-0.32, 1.0, 0], rise: 0.17, ease: "soft" },
  // everyone, deadpan
  { at: 8500, pos: [[0.6, 1.35, 8.6], [0.6, 1.33, 8.1]], look: [0.6, 1.05, 0], rise: 0.15, ease: "soft" },
] satisfies Shot[] };

export const ButtonScene: Staged = { Set: () => <ScaleSet button />, shots: [
  // low, from the bag's side: it looks up at the number looming over it
  { at: 0, to: 2700, pos: [[-1.0, 0.5, 2.55], [-0.88, 0.55, 2.3]], look: [0.4, 0.95, 0], fov: 34, rise: 0.17, ease: "soft" },
  // square on and close, for the line and the pop
  { at: 2700, to: 5300, pos: [[0.3, 0.9, 3.75], [0.3, 0.9, 3.4]], look: [0.32, 1.0, 0], rise: 0.13, ease: "soft" },
  // from the left: the bag, the display and its owner, who has something to tell us
  { at: 5300, pos: [[-2.95, 1.35, 3.95], [-2.7, 1.35, 3.65]], look: [0.75, 1.1, 0.45], rise: 0.1, ease: "soft" },
] satisfies Shot[] };
