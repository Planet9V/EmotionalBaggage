// How the people are shaded: one standard material with a small addition, so cloth and skin read differently without
// a second draw call. Each vertex carries its kind of surface (0 cloth, 1 skin, 2 hard: shoes, a phone). Cloth is
// matte with a soft sheen at its edges; skin is smoother, a touch warm where light passes through it; hard things are
// glossier. A rim in the set's own rim colour separates the people from the set. An optional outline is a second
// copy of the body drawn inside out, pushed out along its normals.
import * as THREE from "three";

export type RimUniforms = { uRim: { value: THREE.Color }; uRimI: { value: number } };

export function figureMaterial() {
  const rim: RimUniforms = { uRim: { value: new THREE.Color("#ffe3c2") }, uRimI: { value: 0.9 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, rim);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float surface;\nvarying float vSurf;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSurf = surface;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vSurf;\nuniform vec3 uRim;\nuniform float uRimI;")
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nfloat isSkin = step(0.5, vSurf) * step(vSurf, 1.5);\nfloat isHard = step(1.5, vSurf);\nroughnessFactor = mix(mix(0.9, 0.56, isSkin), 0.34, isHard);",
      )
      .replace(
        "#include <opaque_fragment>",
        [
          "float facing = saturate(dot(normal, normalize(vViewPosition)));",
          "float fres = pow(1.0 - facing, 3.0);",
          // cloth: a soft sheen in its own colour at grazing angles
          "outgoingLight += diffuseColor.rgb * fres * 0.22 * (1.0 - isSkin - isHard);",
          // skin: a little warmth, as light passing through it would give
          "outgoingLight += diffuseColor.rgb * vec3(0.07, 0.025, 0.0) * isSkin;",
          // the set's rim light, strongest at the silhouette
          "outgoingLight += uRim * pow(1.0 - facing, 4.0) * 0.32 * uRimI;",
          "#include <opaque_fragment>",
        ].join("\n"),
      );
  };
  mat.customProgramCacheKey = () => "figure-look-1";
  return { mat, rim };
}

// the rim uniforms belong to the shader, not to React: this changes them by name
export function takeRim(rim: RimUniforms, scene: THREE.Scene) {
  const r = scene.userData.rim as { c: string; i: number } | undefined;
  if (!r) return;
  rim.uRim.value.set(r.c);
  rim.uRimI.value = r.i;
}

/** The outline: drawn inside out, pushed out along the normals by `width` (in metres), in a dark ink. */
export function outlineMaterial(width = 0.012) {
  const mat = new THREE.MeshBasicMaterial({ color: "#1b1d22", side: THREE.BackSide });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <skinning_vertex>", `#include <skinning_vertex>\ntransformed += normalize(objectNormal) * ${width.toFixed(4)};`);
  };
  mat.customProgramCacheKey = () => "figure-outline-1";
  return mat;
}
