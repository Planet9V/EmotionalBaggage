import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { settle, springTurn, stepSpring, type SpringDef, type SpringState } from "@/components/welcome/scenes/film/springs";

const scarf: SpringDef = { rest: [0, -0.15, 0], k: 70, c: 5, max: 0.7 };
const still = new THREE.Quaternion();

describe("a loose part on a spring", () => {
  it("lags behind a sudden move, swings past, and settles where it hangs", () => {
    const s: SpringState = { tip: new THREE.Vector3(), vel: new THREE.Vector3() };
    const pivot = new THREE.Vector3(0, 1.37, 0);
    settle(s, scarf, pivot, still, 1);
    expect(s.tip.y).toBeCloseTo(1.22, 6);
    // the body moves 0.2 m to the side at once
    pivot.x = 0.2;
    stepSpring(s, scarf, pivot, still, 1, 1 / 90);
    expect(s.tip.x).toBeLessThan(0.2);
    let most = 0;
    for (let i = 0; i < 90 * 3; i++) {
      stepSpring(s, scarf, pivot, still, 1, 1 / 90);
      most = Math.max(most, s.tip.x);
    }
    expect(most).toBeGreaterThan(0.2);
    expect(s.tip.x).toBeCloseTo(0.2, 3);
    expect(s.tip.y).toBeCloseTo(1.22, 3);
  });

  it("keeps its length from the pivot", () => {
    const s: SpringState = { tip: new THREE.Vector3(), vel: new THREE.Vector3() };
    const pivot = new THREE.Vector3();
    settle(s, scarf, pivot, still, 1);
    pivot.set(0.3, 0.1, -0.2);
    for (let i = 0; i < 20; i++) {
      stepSpring(s, scarf, pivot, still, 1, 1 / 90);
      expect(s.tip.distanceTo(pivot)).toBeCloseTo(0.15, 6);
    }
  });

  it("does not move while the scene's time is stopped", () => {
    const s: SpringState = { tip: new THREE.Vector3(), vel: new THREE.Vector3(1, 0, 0) };
    const before = s.tip.clone();
    stepSpring(s, scarf, new THREE.Vector3(), still, 1, 0);
    expect(s.tip.equals(before)).toBe(true);
  });

  it("turns its bone toward the tip, never further than allowed", () => {
    const s: SpringState = { tip: new THREE.Vector3(0.15, 0, 0), vel: new THREE.Vector3() };
    const q = springTurn(s, scarf, new THREE.Vector3(), still, new THREE.Quaternion());
    const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    expect(angle).toBeCloseTo(0.7, 5);
  });
});
