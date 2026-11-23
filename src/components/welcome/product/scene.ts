// The tag as a scene: its parts built once (build.ts), and everything that then changes about them by name: how
// they are drawn (finished, see-through, as a line drawing), how far apart they are pulled, which door is open,
// which part is chosen and what it is joined to. Plain three.js, no React: ProductCanvas owns one of these, turns
// it and draws it. All sizes are the film's units (build.ts lays millimetres into them).
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { TAG_ARM, tagMaterial, tagPerform, type TagUniforms } from "../scenes/film/tag";
import { MM, buildProduct, type Built } from "./build";
import type { Product, ProductPart } from "./model";

export type ViewerMode = "solid" | "translucent" | "wireframe";
export type Open = "coin" | "tracker" | null;

const NET: Record<string, string> = { power: "#f0a04a", ground: "#9aa3b2", signal: "#6ea8ff", audio: "#c5a7f5" };
const CHOSEN = new THREE.Color("#ff8a3d");
/** Where an opened door is held, from its seat, in mm: out from its face and aside. */
const DOOR_OUT = { coinDoor: [-25, 3, 15], trackerDoor: [27, -3, -17] } as const;

type Uniform = { value: number };

export class ProductScene {
  /** everything, about the tag's middle */
  readonly root = new THREE.Group();
  readonly parts: ProductPart[];
  private built: Built;
  private skins = new Map<string, THREE.Mesh>();
  private solidMat: THREE.MeshStandardMaterial;
  private ghostMat: THREE.MeshStandardMaterial;
  private looks: TagUniforms[] = [];
  private inner: THREE.Mesh;
  private innerMat: THREE.MeshStandardMaterial;
  private edges: THREE.LineSegments;
  private edgeMat: THREE.LineBasicMaterial;
  private joins: LineSegments2;
  private joinMat: LineMaterial;
  private uExplode: Uniform = { value: 0 };
  private baseInner: Float32Array;
  private baseEdges: Float32Array;
  private mode: ViewerMode = "solid";
  private chosen: string | null = null;
  private doors = { coinDoor: 0, trackerDoor: 0 };
  private byRef: Map<string, ProductPart>;

  constructor(product: Product, strapUp: number, strapLoop: boolean) {
    this.parts = product.parts.filter((p) => p.body);
    this.byRef = new Map(this.parts.map((p) => [p.ref, p]));
    this.built = buildProduct(this.parts, strapUp, strapLoop);
    const film = new THREE.Group();
    // the film's tag hangs below its pivot: lift it so the tag's middle is this scene's middle
    film.position.set(0, TAG_ARM, 0);
    this.root.add(film);

    const solid = tagMaterial();
    const ghost = tagMaterial();
    this.solidMat = solid.mat;
    this.ghostMat = ghost.mat;
    this.ghostMat.transparent = true;
    this.ghostMat.opacity = 0.2;
    this.ghostMat.depthWrite = false;
    this.ghostMat.side = THREE.DoubleSide;
    this.looks = [solid.u, ghost.u];
    for (const s of this.built.leather) {
      const m = new THREE.Mesh(s.geometry, this.solidMat);
      m.renderOrder = 2;
      this.skins.set(s.ref, m);
      film.add(m);
    }

    const hook = (sh: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }, metal: boolean) => {
      sh.uniforms.uExplode = this.uExplode;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", `#include <common>\nattribute vec3 aOut;\nuniform float uExplode;${metal ? "\nattribute float surface;\nvarying float vFinish;" : ""}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\ntransformed += aOut * uExplode;${metal ? "\nvFinish = surface;" : ""}`);
      if (metal)
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying float vFinish;")
          .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.66, 0.3, vFinish);")
          .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(0.0, 0.85, vFinish);");
    };
    this.innerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0 });
    this.innerMat.onBeforeCompile = (sh) => hook(sh, true);
    this.innerMat.customProgramCacheKey = () => "product-inner-1";
    this.inner = new THREE.Mesh(this.built.inner, this.innerMat);
    this.inner.frustumCulled = false;
    this.inner.renderOrder = 1;
    film.add(this.inner);
    this.baseInner = Float32Array.from(this.built.inner.getAttribute("color")?.array ?? []);

    this.edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthTest: false });
    this.edgeMat.onBeforeCompile = (sh) => hook(sh, false);
    this.edgeMat.customProgramCacheKey = () => "product-edges-1";
    this.edges = new THREE.LineSegments(this.built.edges, this.edgeMat);
    this.edges.frustumCulled = false;
    this.edges.renderOrder = 4;
    film.add(this.edges);
    this.baseEdges = Float32Array.from(this.built.edges.getAttribute("color")?.array ?? []);

    this.joinMat = new LineMaterial({ vertexColors: true, linewidth: 2.5, transparent: true, depthTest: false });
    this.joins = new LineSegments2(new LineSegmentsGeometry(), this.joinMat);
    this.joins.frustumCulled = false;
    this.joins.renderOrder = 5;
    this.joins.visible = false;
    this.root.add(this.joins);
    this.paint();
  }

  /** A part's middle now, about the tag's middle, with the tag pulled apart as far as it is. */
  middle(ref: string, into = new THREE.Vector3()) {
    const b = this.built.boxes.get(ref);
    const p = this.byRef.get(ref);
    if (!b || !p) return null;
    into.copy(b.mid).addScaledVector(new THREE.Vector3(p.out[0], p.out[1], p.out[2]), this.uExplode.value * MM);
    const door = p.look === "coinDoor" || p.look === "trackerDoor" ? this.doors[p.look] : 0;
    if (door) into.add(new THREE.Vector3(...DOOR_OUT[p.look as "coinDoor"]).multiplyScalar(door * MM));
    return into;
  }

  setMode(mode: ViewerMode) {
    this.mode = mode;
    this.paint();
  }
  setChosen(ref: string | null) {
    this.chosen = ref && this.byRef.has(ref) ? ref : null;
    this.paint();
    this.join();
  }
  /** How far apart the parts are (0 to 1) and how far each door is open (0 to 1); the speaker's light, 0 to 1. */
  pose(explode: number, coin: number, tracker: number, glow: number) {
    const moved = explode !== this.uExplode.value || coin !== this.doors.coinDoor || tracker !== this.doors.trackerDoor;
    this.uExplode.value = explode;
    this.doors.coinDoor = coin;
    this.doors.trackerDoor = tracker;
    for (const [ref, m] of this.skins) {
      const p = this.byRef.get(ref)!;
      m.position.set(p.out[0], p.out[1], p.out[2]).multiplyScalar(explode * MM);
      const door = p.look === "coinDoor" || p.look === "trackerDoor" ? this.doors[p.look] : 0;
      if (door) m.position.add(new THREE.Vector3(...DOOR_OUT[p.look as "coinDoor"]).multiplyScalar(door * MM));
    }
    for (const u of this.looks) tagPerform(u, 0, 0, glow);
    if (moved && this.chosen) this.join();
  }
  /** The line drawing's and the joins' lines are drawn in pixels: they need the canvas's size. */
  resize(w: number, h: number) {
    this.joinMat.resolution.set(w, h);
  }

  /** Colours every part for the look and the choice: the chosen part and what it joins stand out, the rest stands back. */
  private paint() {
    const { mode, chosen } = this;
    const linked = new Set(chosen ? (this.byRef.get(chosen)?.nets.flatMap((n) => n.to) ?? []) : []);
    const weight = (ref: string) => (!chosen ? 1 : ref === chosen ? 1 : linked.has(ref) ? 0.85 : 0.16);
    for (const [ref, m] of this.skins) {
      m.visible = mode !== "wireframe";
      const front = mode === "solid" && (!chosen || ref === chosen);
      m.material = front ? this.solidMat : this.ghostMat;
      m.renderOrder = front ? 2 : 3;
    }
    this.ghostMat.opacity = chosen ? 0.1 : 0.2;
    const col = this.built.inner.getAttribute("color") as THREE.BufferAttribute | undefined;
    if (col) {
      const a = col.array as Float32Array;
      a.set(this.baseInner);
      for (const [ref, [at, n]] of this.built.ranges.inner) {
        const w = weight(ref);
        for (let i = at; i < at + n; i++) {
          if (ref === chosen) {
            a[i * 4] = a[i * 4]! * 0.72 + CHOSEN.r * 0.28;
            a[i * 4 + 1] = a[i * 4 + 1]! * 0.72 + CHOSEN.g * 0.28;
            a[i * 4 + 2] = a[i * 4 + 2]! * 0.72 + CHOSEN.b * 0.28;
          }
          a[i * 4 + 3] = mode === "wireframe" ? 0.07 * w : w;
        }
      }
      col.needsUpdate = true;
    }
    const faded = !!chosen || mode === "wireframe";
    if (this.innerMat.transparent !== faded) {
      this.innerMat.transparent = faded;
      this.innerMat.depthWrite = !faded || mode !== "wireframe";
      this.innerMat.needsUpdate = true;
    }
    this.innerMat.depthWrite = mode !== "wireframe";
    const ec = this.built.edges.getAttribute("color") as THREE.BufferAttribute | undefined;
    if (ec) {
      const a = ec.array as Float32Array;
      a.set(this.baseEdges);
      for (const [ref, [at, n]] of this.built.ranges.edges) {
        for (let i = at; i < at + n; i++) {
          if (ref === chosen) a.set([CHOSEN.r, CHOSEN.g, CHOSEN.b, 1], i * 4);
          else a[i * 4 + 3] = mode === "wireframe" ? (chosen ? (linked.has(ref) ? 0.8 : 0.22) : 0.92) : 0;
        }
      }
      ec.needsUpdate = true;
    }
    this.edges.visible = mode === "wireframe" || !!chosen;
  }

  /** The lines from the chosen part to each part a net joins it to, coloured by the net's class. */
  private join() {
    const part = this.chosen ? this.byRef.get(this.chosen) : null;
    const from = part ? this.middle(part.ref) : null;
    const pos: number[] = [];
    const col: number[] = [];
    if (part && from) {
      const seen = new Set<string>();
      for (const n of part.nets) {
        const c = new THREE.Color(NET[n.netClass] ?? "#ffffff");
        for (const to of n.to) {
          const at = this.middle(to);
          if (!at || seen.has(`${to}:${n.netClass}`)) continue;
          seen.add(`${to}:${n.netClass}`);
          pos.push(from.x, from.y, from.z, at.x, at.y, at.z);
          col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
      }
    }
    this.joins.visible = pos.length > 0;
    if (!pos.length) return;
    const g = new LineSegmentsGeometry();
    g.setPositions(pos);
    g.setColors(col);
    this.joins.geometry.dispose();
    this.joins.geometry = g;
  }

  /**
   * The part under a ray (given in this scene's own frame): the nearest part the ray enters. In the finished look
   * with the tag closed only what is on the outside can be picked; the body and its back plate stand behind
   * whatever is inside them.
   */
  pick(ray: THREE.Ray): string | null {
    const closed = this.mode === "solid" && this.uExplode.value < 0.05;
    const box = new THREE.Box3();
    const hit = new THREE.Vector3();
    let best: { ref: string; d: number; rank: number } | null = null;
    for (const p of this.parts) {
      const outside = p.group === "enclosure" && p.look !== "gasket";
      const shown = (p.look === "cell" && this.doors.coinDoor > 0.5) || (p.look === "tracker" && this.doors.trackerDoor > 0.5);
      if (closed && !outside && !shown) continue;
      const mid = this.middle(p.ref);
      const b = this.built.boxes.get(p.ref);
      if (!mid || !b) continue;
      box.setFromCenterAndSize(mid, b.half.clone().multiplyScalar(2));
      if (!ray.intersectBox(box, hit)) continue;
      const rank = p.look === "shell" || p.look === "plate" ? 2 : p.look === "gasket" || p.look === "board" ? 1 : 0;
      const d = hit.distanceTo(ray.origin);
      if (!best || rank < best.rank || (rank === best.rank && d < best.d)) best = { ref: p.ref, d, rank };
    }
    return best?.ref ?? null;
  }

  dispose() {
    for (const s of this.built.leather) s.geometry.dispose();
    this.built.inner.dispose();
    this.built.edges.dispose();
    this.joins.geometry.dispose();
    for (const m of [this.solidMat, this.ghostMat, this.innerMat, this.edgeMat, this.joinMat]) m.dispose();
  }
}
