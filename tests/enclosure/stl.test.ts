import { describe, expect, it } from "vitest";
import { parseStl, writeBinaryStl } from "@/lib/enclosure/stl";

// A box, 12 triangles on 8 shared vertices. Read and written by three's STLLoader and STLExporter.
const box = () => ({
  positions: new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 5.5, 10, 0, 5, 10, 10, 5, 0, 10, 5.5]),
  indices: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]),
});

describe("enclosure STL", () => {
  it("writes 84 + 50 bytes per triangle, with the name in the header, and reads it back welded", () => {
    const bytes = writeBinaryStl(box(), "base");
    expect(bytes.byteLength).toBe(84 + 12 * 50);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe("base");
    expect(new DataView(bytes.buffer).getUint32(80, true)).toBe(12);
    const m = parseStl(bytes);
    expect(m.positions.length / 3).toBe(8);
    expect(m.indices.length).toBe(36);
    // vertices are numbered in the order the triangles meet them, so compare the set of corners
    const corners = (p: Float32Array) => Array.from({ length: p.length / 3 }, (_, i) => `${p[i * 3]},${p[i * 3 + 1]},${p[i * 3 + 2]}`).sort();
    expect(corners(m.positions)).toEqual(corners(box().positions));
  });
  it("reads a Uint8Array that is a view into a larger buffer, and ASCII", () => {
    const bytes = writeBinaryStl(box());
    const padded = new Uint8Array(bytes.length + 7);
    padded.set(bytes, 7);
    expect(parseStl(padded.subarray(7)).indices.length).toBe(36);
    const ascii = "solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n";
    const m = parseStl(ascii);
    expect(m.indices.length).toBe(3);
    expect(m.positions.length).toBe(9);
  });
  it("drops triangles that collapse after welding, and refuses what is not an STL in a plain sentence", () => {
    const flat = writeBinaryStl({ positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0.00001, 0, 1, 0]), indices: new Uint32Array([0, 1, 2, 0, 1, 3]) });
    expect(parseStl(flat).indices.length).toBe(3);
    for (const bad of [new Uint8Array(10), "hello", new Uint8Array(200)]) expect(() => parseStl(bad)).toThrow("The file is not a valid STL.");
  });
});
