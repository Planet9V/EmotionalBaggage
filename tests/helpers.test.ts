// @vitest-environment jsdom
// Small shared helpers: sha256, clamp, today, the dark-theme hook and the Z-up turn.
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import * as THREE from "three";
import { sha256 } from "@/lib/hash";
import { clamp } from "@/lib/math";
import { todayLocal, todayUtc } from "@/lib/format";
import { useDark } from "@/lib/useDark";
import { meshToZUp } from "@/lib/geometry/zup";
import { groupToZUp } from "@/lib/geometry/export";

describe("sha256", () => {
  it("is lower-case hex of a string as UTF-8 or of bytes", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256(new TextEncoder().encode("abc"))).toBe(sha256("abc"));
    expect(sha256(Buffer.from("é"))).toBe(sha256("é"));
  });
});

describe("clamp", () => {
  it("holds a value between its bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
    expect(clamp(3, -2, 2)).toBe(2);
  });
});

describe("today", () => {
  it("is a day, in UTC and in local time", () => {
    expect(todayUtc()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const d = new Date();
    expect(todayLocal()).toBe(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  });
});

describe("useDark", () => {
  it("follows the dark class on the page", async () => {
    document.documentElement.classList.remove("dark");
    const { result } = renderHook(() => useDark());
    expect(result.current).toBe(false);
    await act(async () => {
      document.documentElement.classList.add("dark");
      await Promise.resolve();
    });
    expect(result.current).toBe(true);
    document.documentElement.classList.remove("dark");
  });
});

describe("Z up", () => {
  it("the triangle soup and the three.js group are turned the same way", () => {
    const positions = new Float32Array([1, 2, 3, -4, 5, 6.5]);
    const turned = meshToZUp({ positions, indices: [0, 1, 2] });
    expect(Array.from(turned.positions)).toEqual([1, -3, 2, -4, -6.5, 5]);
    expect(turned.indices).toEqual([0, 1, 2]);
    // the same vertices through the group's quarter turn about x
    const mesh = new THREE.Mesh();
    const wrap = groupToZUp(mesh);
    for (let i = 0; i < positions.length; i += 3) {
      const v = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(wrap.matrixWorld);
      expect([v.x, v.y, v.z].map((n) => Number(n.toFixed(5)))).toEqual(Array.from(turned.positions.slice(i, i + 3)).map((n) => Number(n.toFixed(5))));
    }
  });
});
