import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { aimDown, twoBone } from "@/components/welcome/scenes/film/rig";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe("a two-bone limb", () => {
  const root = v(0.27, 1.31, 0);
  const a = 0.235;
  const b = 0.31;

  it("reaches a target within its length, keeping both bones their length", () => {
    const target = v(0.4, 1.0, 0.3);
    const l = twoBone(root, target, a, b, v(0.3, -1, -0.5));
    expect(l.stretch).toBe(1);
    expect(l.end.distanceTo(target)).toBeLessThan(1e-6);
    expect(l.mid.distanceTo(root)).toBeCloseTo(a, 6);
    expect(l.mid.distanceTo(l.end)).toBeCloseTo(b, 6);
  });

  it("bends toward the hint", () => {
    const target = v(0.27, 1.31, 0.4);
    const down = twoBone(root, target, a, b, v(0, -1, 0));
    expect(down.mid.y).toBeLessThan(root.y);
    const up = twoBone(root, target, a, b, v(0, 1, 0));
    expect(up.mid.y).toBeGreaterThan(root.y);
    // the hinge is at right angles to both bones
    expect(Math.abs(down.hinge.dot(down.mid.clone().sub(root)))).toBeLessThan(1e-6);
    expect(Math.abs(down.hinge.dot(down.end.clone().sub(down.mid)))).toBeLessThan(1e-6);
  });

  it("lengthens both bones together past full reach, up to a limit, then stops short on the line", () => {
    const near = v(0.27 + (a + b) * 1.1, 1.31, 0);
    const l = twoBone(root, near, a, b, v(0, -1, 0), 1.3);
    expect(l.stretch).toBeCloseTo(1.1 / 0.999, 3);
    expect(l.end.distanceTo(near)).toBeLessThan(0.002);
    expect(l.mid.distanceTo(root) / l.end.distanceTo(l.mid)).toBeCloseTo(a / b, 4);
    const far = v(0.27 + (a + b) * 2, 1.31, 0);
    const f = twoBone(root, far, a, b, v(0, -1, 0), 1.3);
    expect(f.stretch).toBe(1.3);
    expect(f.end.distanceTo(root)).toBeLessThanOrEqual((a + b) * 1.3 + 1e-9);
    expect(f.end.y).toBeCloseTo(1.31, 6);
  });

  it("folds no further than its lengths allow", () => {
    const l = twoBone(root, root.clone(), a, b, v(0, -1, 0));
    expect(l.end.distanceTo(root)).toBeGreaterThanOrEqual(Math.abs(a - b) - 1e-6);
    expect(Number.isFinite(l.mid.x)).toBe(true);
  });
});

describe("aiming a bone", () => {
  it("turns a bone's -y toward the direction, with x as asked", () => {
    const q = aimDown(v(0, 0, 1), v(1, 0, 0), new THREE.Quaternion());
    const down = v(0, -1, 0).applyQuaternion(q);
    expect(down.distanceTo(v(0, 0, 1))).toBeLessThan(1e-6);
    expect(v(1, 0, 0).applyQuaternion(q).distanceTo(v(1, 0, 0))).toBeLessThan(1e-6);
  });
});
