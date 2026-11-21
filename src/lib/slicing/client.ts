// The slicer service over HTTP (slicer/ in this repository). OrcaSlicer runs there, in its own container; this file only talks to it.
// Every call has a time limit. Failures are HttpError with a plain sentence.
import { HttpError } from "@/lib/api/route";
import { slicerUrl } from "./config";

export const NOT_SET_UP = "The slicer is not set up. Start it with `docker compose --profile slicer up -d --build` and set SLICER_URL, then try again.";
const SLICE_TIMEOUT_MS = 6 * 60_000;
const QUICK_TIMEOUT_MS = 15_000;

import type { SlicerCatalogue } from "./match";
export type { SlicerCatalogue, SlicerPrinter } from "./match";

export type SliceRequest = {
  file: { data: Uint8Array; name: string };
  maker: string;
  model: string;
  material: string;
  layerHeight: number;
  infill: number;
  supports: boolean;
};

export type SliceResponse = {
  id: string;
  orca: { version: string; profileCommit: string };
  profile: { machine: string; process: string; filament: string; note: string };
  settings: { layerHeight: number; infill: number; supports: boolean; material: string };
  result: { seconds: number; filamentMm: number; filamentG: number; filamentCm3: number; supportG: number | null; layers: number | null; readFrom: string };
  warnings: string[];
  files: { gcode: { name: string; url: string }; project: { name: string; url: string } | null; statistics: { name: string; url: string } | null };
};

async function base(): Promise<string> {
  const u = await slicerUrl();
  if (!u) throw new HttpError(503, NOT_SET_UP);
  return u;
}

async function call(path: string, init: RequestInit, ms: number): Promise<Response> {
  const root = await base();
  try {
    return await fetch(`${root}${path}`, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") throw new HttpError(504, `The slicer did not answer within ${Math.round(ms / 1000)} seconds.`);
    throw new HttpError(503, "The slicer could not be reached. Check that its container is running.");
  }
}

async function failure(res: Response): Promise<HttpError> {
  let msg = `The slicer answered with an error (HTTP ${res.status}).`;
  try {
    const j = (await res.json()) as { detail?: unknown };
    if (typeof j.detail === "string" && j.detail) msg = j.detail;
  } catch {
    /* keep the generic sentence */
  }
  // A refusal of the request (422, 413) is the user's to fix; anything else is the service's problem.
  const status = res.status === 422 || res.status === 413 ? 422 : res.status === 504 ? 504 : 502;
  return new HttpError(status, msg);
}

export async function catalogue(): Promise<SlicerCatalogue> {
  const res = await call("/profiles", {}, QUICK_TIMEOUT_MS);
  if (!res.ok) throw await failure(res);
  return (await res.json()) as SlicerCatalogue;
}

export async function health(): Promise<{ ok: boolean; message: string; orcaVersion?: string }> {
  try {
    const res = await call("/health", {}, QUICK_TIMEOUT_MS);
    if (!res.ok) return { ok: false, message: `The slicer answered HTTP ${res.status}.` };
    const j = (await res.json()) as { slicerInstalled?: boolean; orcaVersion?: string };
    if (!j.slicerInstalled) return { ok: false, message: "The slicer service is running but OrcaSlicer is not installed in it." };
    return { ok: true, message: `OrcaSlicer ${j.orcaVersion ?? ""} is ready.`.replace("  ", " "), orcaVersion: j.orcaVersion };
  } catch (e) {
    return { ok: false, message: e instanceof HttpError ? e.message : "The slicer could not be reached." };
  }
}

export async function slice(r: SliceRequest): Promise<SliceResponse> {
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(r.file.data)]), r.file.name);
  form.set("maker", r.maker);
  form.set("model", r.model);
  form.set("material", r.material);
  form.set("layer_height", String(r.layerHeight));
  form.set("infill", String(Math.round(r.infill)));
  form.set("supports", r.supports ? "true" : "false");
  const res = await call("/slice", { method: "POST", body: form }, SLICE_TIMEOUT_MS);
  if (!res.ok) throw await failure(res);
  return (await res.json()) as SliceResponse;
}

/** The bytes of one result file. The path comes from the slicer's own answer and is checked to stay under /jobs/. */
export async function fetchResult(path: string): Promise<Uint8Array> {
  if (!/^\/jobs\/[0-9a-f]{32}\/(gcode|project|statistics)$/.test(path)) throw new HttpError(502, "The slicer named a file in a way that was not expected.");
  const res = await call(path, {}, 60_000);
  if (!res.ok) throw await failure(res);
  return new Uint8Array(await res.arrayBuffer());
}

export async function discard(id: string): Promise<void> {
  if (!/^[0-9a-f]{32}$/.test(id)) return;
  await call(`/jobs/${id}`, { method: "DELETE" }, QUICK_TIMEOUT_MS).catch(() => undefined);
}
