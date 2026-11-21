// The concept frame is Y up; STL and slicers are Z up (file x, y, z = scene x, minus z, y). This is a quarter turn
// about x, written once for a triangle soup here and as the same rotation of a three.js group in export.ts.

/** A mesh with its positions (x, y, z per vertex) turned from the Y-up scene frame to the Z-up print frame. Other fields are kept. */
export function meshToZUp<M extends { positions: Float32Array }>(m: M): M {
  const p = new Float32Array(m.positions.length);
  for (let i = 0; i < p.length; i += 3) {
    p[i] = m.positions[i];
    p[i + 1] = -m.positions[i + 2];
    p[i + 2] = m.positions[i + 1];
  }
  return { ...m, positions: p };
}
