"use client";

/**
 * Loads the STL or STEP file attached to each part as its real shape, parses it (three's STLLoader,
 * or the OpenCascade reader for STEP) and gives the triangles in the scene's axes, centred on the
 * part and scaled by the unit factor the user confirmed. While a file loads, or if it cannot be
 * read, the part keeps showing its bounding box and the status says why.
 */
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { Geometry } from "@/lib/domain";
import { fileToScene } from "./shapes";
import { parseShape } from "./meshFile";

export type ShapeStatus = { state: "loading" | "ready" | "error"; message: string };

type Loaded = { positions: Float32Array; triangles: number };

async function load(file: NonNullable<Geometry["file"]>): Promise<Loaded> {
  const res = await fetch(`/api/files/${file.id}`);
  if (!res.ok) throw new Error(`The file ${file.name} could not be fetched (${res.status}).`);
  const parsed = await parseShape(file.name, await res.arrayBuffer());
  return { positions: fileToScene(parsed.soup, file.scale).positions, triangles: parsed.triangles };
}

export function useShapes(parts: { id: number; geometry: Geometry | null }[]) {
  const withFile = useMemo(() => parts.filter((p) => p.geometry?.file), [parts]);
  const results = useQueries({
    queries: withFile.map((p) => {
      const f = p.geometry!.file!;
      return {
        queryKey: ["shape", f.id, f.format, f.scale],
        queryFn: () => load(f),
        // A stored file never changes under its id.
        staleTime: Infinity,
        gcTime: 10 * 60_000,
        retry: false,
      };
    }),
  });
  // A signature of what each query holds, so the maps below change only when a file loads or fails.
  const sig = results.map((r) => `${r.status}:${r.dataUpdatedAt}:${r.errorUpdatedAt}`).join("|");
  return useMemo(() => {
    const shapes = new Map<number, Float32Array>();
    const status = new Map<number, ShapeStatus>();
    withFile.forEach((p, i) => {
      const r = results[i];
      if (r.data) {
        shapes.set(p.id, r.data.positions);
        status.set(p.id, { state: "ready", message: `${r.data.triangles} triangles` });
      } else if (r.error) status.set(p.id, { state: "error", message: (r.error as Error).message });
      else status.set(p.id, { state: "loading", message: "Reading the shape file." });
    });
    return { shapes, status };
    // results is a new array each render; sig says when its contents changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withFile, sig]);
}
