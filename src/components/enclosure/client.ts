// Browser side of the enclosure routes: what they answer, and how to turn a base64 STL back into a mesh.
import { api } from "@/lib/client";
import { parseStl } from "@/lib/enclosure/stl";
import type { CheckResult, EnclosureParams, GeneratedMesh, GeneratorKey } from "@/lib/enclosure/types";

export type GeneratorStatus = { available: boolean; code?: string; reason?: string };
export type EnclosureStatus = { casemaker: GeneratorStatus; yapp: GeneratorStatus };

export type ResultOk = {
  key: GeneratorKey;
  ok: true;
  version: string;
  seconds: number;
  notes: string[];
  checks: CheckResult[];
  baseStl: string;
  lidStl: string;
  lidPrintStl: string;
  source: { filename: string; text: string; note: string };
};
export type ResultFailed = { key: GeneratorKey; ok: false; code: string; error: string };
export type GenerateAnswer = { results: (ResultOk | ResultFailed)[] };

const enc = encodeURIComponent;

export const getStatus = (projectId: string) => api<EnclosureStatus>(`/api/projects/${enc(projectId)}/enclosure/status`);

export const generate = (projectId: string, generators: GeneratorKey[], params: EnclosureParams) =>
  api<GenerateAnswer>(`/api/projects/${enc(projectId)}/enclosure/generate`, { method: "POST", body: JSON.stringify({ generators, params }) });

export function bytesOf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const meshOf = (b64: string): GeneratedMesh => parseStl(bytesOf(b64));

/** Saves bytes or text as a file through a temporary link. */
export function download(name: string, data: Uint8Array | string, type: string) {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
