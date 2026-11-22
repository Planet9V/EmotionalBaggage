"use client";

// The face as a mesh: a canvas laid over the front of the head, redrawn only when the face changes, and the face's
// state at a moment worked out from the pose's cues and the figure's own blinking.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { blinkAt, mouthFor, pupilFor, type FaceState, type Mouth } from "./face";
import { FACE_ACROSS, FACE_H, FACE_UPDOWN, FACE_W, drawFace, faceKey } from "./faceDraw";
import { HEAD_C, HEAD_R, NECK } from "./body";

/** What a pose may say about the face. */
type FaceCues = { brow?: number; browIn?: number; mouth?: Mouth; talk?: number; lids?: number; squint?: number; blink?: number };

// the canvas and its texture are changed in place, outside React's data flow; this does it by name
function repaint(canvas: HTMLCanvasElement, texture: THREE.CanvasTexture, f: FaceState, skin: string) {
  const g = canvas.getContext("2d");
  if (!g) return;
  drawFace(g, f, skin);
  texture.needsUpdate = true;
}

/** The face's canvas, texture and mesh, one per figure; the canvas is redrawn only when the face changes. */
export function useFace(skin: string) {
  const canvas = useMemo(() => Object.assign(document.createElement("canvas"), { width: FACE_W, height: FACE_H }), []);
  const parts = useMemo(() => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const geo = new THREE.SphereGeometry(HEAD_R + 0.004, 24, 16, Math.PI / 2 - FACE_ACROSS, 2 * FACE_ACROSS, Math.PI / 2 - FACE_UPDOWN, 2 * FACE_UPDOWN);
    const mat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.04, depthWrite: false, roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, HEAD_C - NECK, 0);
    mesh.renderOrder = 1;
    return { texture, geo, mat, mesh };
  }, [canvas]);
  useEffect(
    () => () => {
      parts.texture.dispose();
      parts.geo.dispose();
      parts.mat.dispose();
    },
    [parts],
  );
  const shown = useRef("");
  const paint = (f: FaceState) => {
    const key = faceKey(f);
    if (key === shown.current) return;
    shown.current = key;
    repaint(canvas, parts.texture, f, skin);
  };
  return { mesh: parts.mesh, paint };
}

/** The face at one moment, from the pose and the figure's own blinking. `aim` is the look target in the head's frame. */
export function faceOf(q: FaceCues, t: number, seed: number, aim: THREE.Vector3 | null): FaceState {
  const [lookX, lookY] = aim ? pupilFor(aim.x, aim.y, aim.z) : [0, 0];
  const m = mouthFor(q.mouth, q.talk ?? 0);
  const lid = Math.max(q.lids ?? 0, blinkAt(t, seed), q.blink ?? 0);
  return { lookX, lookY, lid: Math.min(1, lid), squint: q.squint ?? 0, brow: q.brow ?? 0, browIn: q.browIn ?? 0, mouth: m.mouth, open: m.open };
}

