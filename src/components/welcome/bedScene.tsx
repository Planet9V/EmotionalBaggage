"use client";

// Framing the pieces on the print bed, for the print view of "What you get".
import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

const VIEW_FROM = new THREE.Vector3(0.55, 0.62, 0.86).normalize();

/**
 * Frames the pieces: the camera looks at the middle of their box from a three-quarter view, from just far enough
 * that the whole box is inside the view both ways, whatever the shape of the canvas (wide on a desk, tall on a
 * phone). The preview's own framing leaves them small and, on a wide canvas, cut off at the bottom.
 */
export function FitBox({ box, closer = 1.02, token = 0 }: { box: THREE.Box3; /** distance factor; below 1 frames tighter */ closer?: number; /** a change frames again */ token?: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!controls || !size.width || !size.height) return;
    const centre = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const vertical = (camera.fov * Math.PI) / 360;
    const horizontal = Math.atan(Math.tan(vertical) * (size.width / size.height));
    const distance = (radius / Math.sin(Math.min(vertical, horizontal))) * closer;
    controls.target.copy(centre);
    camera.position.copy(centre).addScaledVector(VIEW_FROM, distance);
    controls.update();
    invalidate();
  }, [camera, controls, box, size.width, size.height, invalidate, closer, token]);
  return null;
}

