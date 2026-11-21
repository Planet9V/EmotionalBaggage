import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyMatrix, eulerFromMatrix, isRotated, rotatedCorners, rotatedExtent, rotatePoint, rotationMatrix, snap, transpose, wrapDegrees } from "@/lib/geometry/rotation";
import { bodyExtent, totalExtent } from "@/components/three/layout";
import { boxOf } from "@/components/layout/geom";
import { geometry, wireData } from "@/lib/domain/schemas";
import { readGeometry } from "@/lib/domain/part";

const close = (a: readonly number[], b: readonly number[], d = 1e-9) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9 - Math.round(-Math.log10(d)) + 0));

describe("rotation maths", () => {
  it("matches three.js Euler XYZ for arbitrary angles", () => {
    for (const deg of [[30, 0, 0], [0, 45, 0], [0, 0, 60], [10, 20, 30], [-75, 120, 15]]) {
      const e = new THREE.Euler((deg[0] * Math.PI) / 180, (deg[1] * Math.PI) / 180, (deg[2] * Math.PI) / 180, "XYZ");
      const m4 = new THREE.Matrix4().makeRotationFromEuler(e);
      const p = new THREE.Vector3(3, -4, 5).applyMatrix4(m4);
      close(rotatePoint([3, -4, 5], deg), [p.x, p.y, p.z]);
    }
  });

  it("turns 90 degrees about y so x goes to -z and z goes to x", () => {
    close(rotatePoint([1, 0, 0], [0, 90, 0]), [0, 0, -1]);
    close(rotatePoint([0, 0, 1], [0, 90, 0]), [1, 0, 0]);
  });

  it("swaps x and z of the extent for a quarter turn about y", () => {
    close(rotatedExtent([10, 20, 30], [0, 90, 0]), [30, 20, 10]);
    close(rotatedExtent([10, 20, 30], [90, 0, 0]), [10, 30, 20]);
    close(rotatedExtent([10, 20, 30], [0, 0, 90]), [20, 10, 30]);
  });

  it("grows a 10 x 10 square to its diagonal at 45 degrees", () => {
    close(rotatedExtent([10, 4, 10], [0, 45, 0]), [10 * Math.SQRT2, 4, 10 * Math.SQRT2]);
  });

  it("leaves an unrotated or zero rotation exactly as it was", () => {
    expect(rotatedExtent([1, 2, 3], undefined)).toEqual([1, 2, 3]);
    expect(rotatedExtent([1, 2, 3], [0, 0, 0])).toEqual([1, 2, 3]);
    expect(isRotated([0, 0, 0])).toBe(false);
    expect(isRotated([0, 0, 1])).toBe(true);
  });

  it("the transpose undoes the rotation, and Euler angles read back out", () => {
    const m = rotationMatrix([20, 35, -50]);
    close(applyMatrix(transpose(m), applyMatrix(m, [1, 2, 3])), [1, 2, 3]);
    close(eulerFromMatrix(m), [20, 35, -50], 1e-6);
  });

  it("the corner box of a rotated cuboid agrees with the extent", () => {
    const c = rotatedCorners([10, 20, 30], [15, 30, 45]);
    const ext = [0, 1, 2].map((k) => Math.max(...c.map((v) => v[k])) - Math.min(...c.map((v) => v[k])));
    close(ext, rotatedExtent([10, 20, 30], [15, 30, 45]));
  });

  it("snaps to steps and wraps angles", () => {
    expect(snap(7.4, 1)).toBe(7);
    expect(snap(-0.2, 1)).toBe(0);
    expect(Object.is(snap(-0.2, 1), 0)).toBe(true);
    expect(snap(52, 15)).toBe(45);
    expect(snap(53, 15)).toBe(60);
    expect(wrapDegrees(190)).toBe(-170);
    expect(wrapDegrees(-190)).toBe(170);
    expect(wrapDegrees(360)).toBe(0);
  });
});

describe("rotation in the domain schema", () => {
  const base: Record<string, unknown> = { shape: "box", size: [10, 20, 30], pos: [0, 10, 0], basis: "typical" };
  it("keeps a rotation and drops a zero one", () => {
    expect(geometry.parse({ ...base, rotation: [0, 90, 0] }).rotation).toEqual([0, 90, 0]);
    expect(geometry.parse({ ...base, rotation: [0, 0, 0] }).rotation).toBeUndefined();
    expect(geometry.parse({ ...base, rotation: ["0", "15", "0"] }).rotation).toEqual([0, 15, 0]);
  });
  it("refuses a bad rotation", () => {
    expect(geometry.safeParse({ ...base, rotation: [0, 90] }).success).toBe(false);
    expect(geometry.safeParse({ ...base, rotation: [0, "x", 0] }).success).toBe(false);
    expect(geometry.safeParse({ ...base, rotation: [0, 99999, 0] }).success).toBe(false);
    expect(readGeometry({ ...base, rotation: [1, 2] })).toBeNull();
  });
  it("refuses a rotated enclosure shell, and a file on anything but a box", () => {
    const r = geometry.safeParse({ ...base, shape: "shell", rotation: [0, 10, 0] });
    expect(r.success).toBe(false);
    expect(geometry.safeParse({ ...base, shape: "shell", rotation: [0, 0, 0] }).success).toBe(true);
    expect(geometry.safeParse({ ...base, shape: "cylinder", size: [5, 5], file: { id: 1, name: "a.stl", format: "stl" } }).success).toBe(false);
  });
  it("keeps an attached file with its confirmed scale", () => {
    const g = geometry.parse({ ...base, file: { id: 4, name: "board.stl", format: "stl" } });
    expect(g.file).toEqual({ id: 4, name: "board.stl", format: "stl", scale: 1 });
    expect(geometry.parse({ ...base, file: { id: 4, name: "b.step", format: "step", scale: 25.4 } }).file?.scale).toBe(25.4);
    expect(geometry.safeParse({ ...base, file: { id: 4, name: "b.obj", format: "obj" } }).success).toBe(false);
  });
  it("wire rows may carry a routed length", () => {
    const w = wireData.parse({ routedLengthMm: 123.4, routedCellMm: 2, routedAt: "2026-11-20T10:00:00Z", routedPath: [[0, 0, 0], [1, 1, 1]] });
    expect(w.routedLengthMm).toBe(123.4);
    expect(wireData.safeParse({ routedLengthMm: -1 }).success).toBe(false);
  });
});

describe("rotation in the layout and 3D extents", () => {
  const g = geometry.parse({ shape: "box", size: [10, 20, 30], pos: [5, 10, 7], basis: "typical", rotation: [0, 90, 0] });
  it("the part's box around it uses the rotated extent", () => {
    close(totalExtent(g), [30, 20, 10]);
    const b = boxOf(g);
    close(b.min, [5 - 15, 0, 7 - 5]);
    close(b.max, [5 + 15, 20, 7 + 5]);
  });
  it("without rotation nothing changes", () => {
    const flat = geometry.parse({ shape: "box", size: [10, 20, 30], pos: [0, 10, 0], basis: "typical" });
    expect(totalExtent(flat)).toEqual([10, 20, 30]);
  });
  it("counted bodies are turned with the part", () => {
    const g3 = geometry.parse({ shape: "box", size: [10, 10, 10], pos: [0, 5, 0], basis: "typical", count: 3, rotation: [0, 90, 0] });
    // three bodies in a row along x become a row along z after the quarter turn
    const e = totalExtent(g3);
    expect(e[0]).toBeCloseTo(10, 6);
    expect(e[2]).toBeCloseTo(bodyExtent(g3)[0] * 3 + 2 * 0.5, 6);
  });
});
