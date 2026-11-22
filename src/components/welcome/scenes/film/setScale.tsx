"use client";

// The check-in scale, used twice: scene 2 (the agent lifts the bag on, the display climbs to 62 lbs, the bag takes
// offence) and the closing button (same set, the display still reads 62). Script: 0:45 and 2:10. The place is cool
// blues and white with one signal colour on the counter fronts; the display is the prop the joke hangs on, so it is
// large, faces the camera and stays in the shot where the line lands.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { bagSpeaking, sceneOf } from "../scenes";
import { E, bump, clamp01, kf, mix } from "./ease";
import { A, Bag, Built, C, Contact, Dust, Figure, HANDLE_Y, Sign, Stage, useClock, type BagPose, type FigPose, type Kit, type Look, type Shot, type Staged, type V3 } from "./kit";

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

function checkIn(k: Kit) {
  // the back wall: pale panels, a blue dado, a strip of high window
  k.box([26, 5.2, 0.3], "#e4eaf2", [0, 2.6, -4.0]);
  k.box([26, 0.9, 0.34], "#b5c7e0", [0, 0.45, -3.99]);
  k.box([26, 1.1, 0.32], "#bcd8f4", [0, 3.9, -3.99]);
  for (let x = -11; x <= 11; x += 2.2) k.box([0.05, 5.2, 0.33], "#dbe3ee", [x, 2.6, -3.99]);
  // the collector belt along the wall
  k.box([20, 0.42, 0.95], "#b7c1ce", [0, 0.21, -2.35], { r: 0.03, seg: 1 });
  k.box([20, 0.03, 0.78], "#3b414b", [0, 0.43, -2.35]);
  for (let x = -9.6; x <= 9.6; x += 0.4) k.box([0.035, 0.012, 0.78], "#59616f", [x, 0.45, -2.35]);
  // three desks in a row: the scale's own, and a neighbour each side
  desk(k, -2.3, true, 2.3);
  desk(k, -6.2, false);
  desk(k, 2.3, false);
  // the platform scale: a low deck with a hazard edge
  k.box([1.08, 0.085, 0.86], "#aab4c0", [0, 0.0425, BAG_Z], { r: 0.02, seg: 1 });
  k.box([1.08, 0.03, 0.05], C.yellow, [0, 0.07, BAG_Z + 0.42]);
  // the display's post and housing
  k.cyl(0.18, 0.03, "#8f99a6", [DISPLAY[0], 0.015, DISPLAY[2]], { seg: 20 });
  k.cyl(0.035, SCREEN_Y - 0.2, "#aab4c0", [DISPLAY[0], (SCREEN_Y - 0.2) / 2, DISPLAY[2]], { seg: 12 });
  k.box([0.98, 0.62, 0.11], "#1c2740", [DISPLAY[0], SCREEN_Y, DISPLAY[2]], { rot: [-0.05, -0.1, 0], r: 0.045 });
  // the queue: posts joined by a belt ribbon, and the line to wait behind
  [-4.6, -3.4, -2.2].forEach((x, i) => {
    k.cyl(0.16, 0.035, "#59616f", [x, 0.018, 2.3], { seg: 18 });
    k.cyl(0.032, 0.95, "#c9d0d8", [x, 0.5, 2.3], { seg: 10 });
    k.cyl(0.045, 0.09, "#59616f", [x, 0.97, 2.3], { seg: 10 });
    if (i) k.box([1.2, 0.07, 0.012], SIGNAL, [x - 0.6, 0.93, 2.3]);
  });
  k.box([1.9, 0.004, 0.07], C.yellow, [0, 0.002, 1.25]);
  // the sign's hangers and frame
  [-1.1, 1.1].forEach((x) => k.cyl(0.015, 1.6, "#aab4c0", [x - 0.9, 3.9, -1.7], { seg: 6 }));
  k.box([2.86, 0.66, 0.08], "#16233d", [-0.9, 2.95, -1.7], { r: 0.03, seg: 1 });
}

/** Small steps: a glide with a hop in it. */
const hop = (t: number, t0: number, t1: number, steps: number) => (t <= t0 || t >= t1 ? 0 : 0.045 * Math.abs(Math.sin(((t - t0) / (t1 - t0)) * Math.PI * steps)));

const AGENT_BACK: V3 = [-1.95, 0, -1.3];
const HOST: V3 = [3.2, 0, 0.8];
const HOST_YAW = -2.3;
const TILT = 0.2;

function ScaleSet({ button }: { button: boolean }) {
  const scene = sceneOf(button ? "button" : "scale");
  const bag = (t: number): BagPose => {
    if (button) {
      const ask = kf(t, [[450, 0], [1150, 1], [2850, 1], [3300, 0]]);
      const proud = kf(t, [[3750, 0], [4050, 1, "back"]]);
      return {
        p: [0, PLATE + 0.1 * bump(t, 3800, 4120), BAG_Z],
        // it cranes round to read the display, then draws itself up
        roll: -0.15 * ask + 0.05 * proud,
        yaw: 0.22 * ask,
        sx: 1 + 0.07 * proud - 0.05 * bump(t, 3650, 3800),
        sy: 1 + 0.045 * proud - 0.06 * bump(t, 3650, 3800) - 0.05 * bump(t, 4120, 4300),
      };
    }
    const carried = 1 - kf(t, [[SET_DOWN - 150, 0], [SET_DOWN, 1]]);
    // the anticipation, then the slow, offended lean: away from the display
    const huff = kf(t, [[7300, 0], [7480, -0.16], [8150, 1, "back"]]);
    return {
      p: [kf(t, [[500, -0.3], [1300, 0]]), kf(t, [[0, 0.42], [500, 0.45], [1150, 0.36], [SET_DOWN, PLATE, "in"]]), BAG_Z],
      hang: 0.1 * Math.sin(t / 260) * carried,
      sy: 1 - 0.07 * bump(t, SET_DOWN, SET_DOWN + 220) + 0.04 * Math.max(0, huff) - 0.03 * bump(t, 7300, 7480),
      sx: 1 + 0.05 * bump(t, SET_DOWN, SET_DOWN + 220) + 0.08 * Math.max(0, huff),
      roll: TILT * huff,
      yaw: 0.2 * kf(t, [[5750, 0], [6300, 1], [7300, 1], [7600, 0]]),
    };
  };
  const agent = (t: number): FigPose => {
    if (button) return { p: AGENT_BACK, yaw: 0.42, head: 0.35 * kf(t, [[4300, 0], [4800, 1]]), nod: 0.2 * kf(t, [[4300, 0], [4800, 1]]) };
    // she sets it down, then walks round the end of the desk to her place behind it
    const x = kf(t, [[500, -0.78], [1300, -0.52], [1950, -0.52], [2500, -1.12], [3200, AGENT_BACK[0]]]);
    const b = bag(t).p;
    const holding = t < SET_DOWN + 150;
    const letGo = kf(t, [[SET_DOWN + 150, 0], [SET_DOWN + 420, 1]]);
    const hand = (side: number): V3 | null =>
      letGo >= 1 ? null : [mix(b[0], x + 0.06, letGo), mix(b[1] + HANDLE_Y - 0.01, 0.8, letGo), mix(b[2] - 0.03 + side * 0.09, 0.1 + side * 0.3, letGo)];
    // late, and little: a slow look down at the bag, then up at its owner
    const down = kf(t, [[8150, 0], [8650, 1], [9500, 1], [9900, 0]]);
    return {
      p: [x, hop(t, 1950, 3200, 4), kf(t, [[1950, 0.1], [2500, -1.2], [3200, AGENT_BACK[2]]])],
      yaw: kf(t, [[1950, Math.PI / 2], [2200, Math.PI + 0.4], [2500, Math.PI * 1.5], [3200, Math.PI * 1.5], [3650, Math.PI * 2 + 0.42]]),
      lean: holding ? 0.12 : 0.12 * (1 - letGo),
      head: 0.5 * down + 0.75 * kf(t, [[9900, 0], [10250, 1]]),
      nod: 0.3 * down,
      handL: hand(1),
      handR: hand(-1),
    };
  };
  const host = (t: number): FigPose => ({
    p: HOST,
    yaw: HOST_YAW,
    head: button ? 0.35 * kf(t, [[4500, 0], [5000, 1]]) : 0.55 * kf(t, [[9700, 0], [10150, 1]]),
    nod: button ? 0.3 * (bump(t, 5600, 5950) + bump(t, 6000, 6350)) : 0.22 * kf(t, [[6200, 0], [6800, 1], [9700, 1], [10150, 0]]),
  });
  return (
    <>
      <Stage look={LOOK} />
      <Built make={checkIn} />
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
      <Bag pose={bag} speaking={(t) => bagSpeaking(scene, t)} />
      {/* the small puff of indignation */}
      {button ? null : <Dust at={[-0.12, PLATE + 0.86, BAG_Z + 0.12]} progress={(t) => (t - 7560) / 800} c="#ffffff" size={0.3} />}
      <Figure pose={agent} role="agent" />
      <Figure pose={host} role="owner" tall={1.03} />
    </>
  );
}

export const ScaleScene: Staged = { Set: () => <ScaleSet button={false} />, shots: [
  // wide: the hall, the sign, the agent setting the bag down
  { at: 0, to: 2600, pos: [[0.7, 1.75, 9.2], [0.55, 1.6, 8.2]], look: [0.25, 1.3, 0], rise: 0.04 },
  // the push-in on stillness: the bag and the number, climbing
  { at: 2600, to: 5700, pos: [[0.5, 1.25, 6.6], [0.5, 1.1, 5.5]], look: [0.5, 1.0, 0], rise: 0.19 },
  // the line: the bag on the left third, the display on the right, 62 and the lamp over its shoulder
  { at: 5700, to: 8500, pos: [[0.4, 1.08, 5.75], [0.4, 1.08, 5.45]], look: [0.4, 1.02, 0], rise: 0.2 },
  // everyone, deadpan
  { at: 8500, pos: [[0.55, 1.3, 7.6], [0.55, 1.28, 7.2]], look: [0.55, 1.05, 0], rise: 0.17 },
] satisfies Shot[] };

export const ButtonScene: Staged = { Set: () => <ScaleSet button />, shots: [
  { at: 0, to: 2700, pos: [[0.5, 1.05, 5.7], [0.47, 1.05, 5.25]], look: [0.4, 0.95, 0], rise: 0.2 },
  { at: 2700, to: 5300, pos: [[-0.1, 1.05, 5.3], [0.0, 1.05, 5.0]], look: [0.42, 1.0, 0], rise: 0.2 },
  { at: 5300, pos: [[-1.0, 1.4, 6.8], [-0.85, 1.4, 6.5]], look: [1.45, 1.05, 0.3], rise: 0.17 },
] satisfies Shot[] };
