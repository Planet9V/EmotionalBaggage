"use client";

// Browser side of claim evidence: add or remove one source on a claim through /api/research/evidence.
// The server sets the claim's status, so after each change the concept's item lists and event log
// are refetched (keys from src/lib/queries.ts).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import { keys } from "@/lib/queries";
import type { Item } from "@/lib/types";
import type { EvidenceEntry, Verdict } from "./schemas";

export type EvidenceInput = { claimId: number; url: string; title?: string; quote?: string; researchId?: number; verdict: Verdict };
export type EvidenceResult = { item: Item; status: string; disputed: boolean; evidence: EvidenceEntry[] };

/** The mutation key of an evidence change, so the impact notice hears it as it hears a row being saved. */
export const EVIDENCE_WRITE = "claim-evidence";

export function useEvidence(projectId: string) {
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: keys.itemsOf(projectId) }), qc.invalidateQueries({ queryKey: keys.events(projectId) })]);
  const add = useMutation({
    mutationKey: [EVIDENCE_WRITE, projectId],
    mutationFn: (b: EvidenceInput) => api<EvidenceResult>("/api/research/evidence", { method: "POST", body: JSON.stringify(b) }),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationKey: [EVIDENCE_WRITE, projectId],
    mutationFn: (b: { claimId: number; url: string }) => api<EvidenceResult>("/api/research/evidence", { method: "DELETE", body: JSON.stringify(b) }),
    onSettled: refresh,
  });
  return { add, remove };
}

/** A claim's evidence as stored, or an empty list when it has none or it is not a list. */
export function evidenceOf(item: Item): EvidenceEntry[] {
  const e = item.data?.evidence;
  return Array.isArray(e) ? (e.filter((x) => x && typeof x === "object" && typeof (x as EvidenceEntry).url === "string") as EvidenceEntry[]) : [];
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  supports: "Supports the claim",
  contradicts: "Contradicts the claim",
  unclear: "Unclear or off topic",
};
