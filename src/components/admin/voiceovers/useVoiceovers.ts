"use client";

// Data for Admin, Voice-overs: the cues (GET /api/admin/voiceovers), the live speech models of the configured
// service (GET /api/admin/voiceovers/models, platform administrator only) and the tool's actions.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/http";
import { messageOf } from "@/lib/queries";
import type { Speaker } from "@/components/welcome/scenes/voiceScript";
import type { Catalog } from "@/lib/voice/catalog";
import type { DirectionMode } from "@/lib/voice/direction";
import type { CastChoice } from "@/lib/voice/voiceovers";
import type { Estimate, VoiceoverRow } from "@/lib/voice/takes";

export type View = {
  rows: VoiceoverRow[];
  cast: Record<string, CastChoice>;
  notes: Record<Speaker, string>;
  voice: { configured: true; provider: "kokoro" | "openrouter"; model?: string; voice?: string; speed?: number } | { configured: false; reason: string };
  canWrite: boolean;
};

type GenerateAction = { action: "generate"; cue: string; count?: number; model?: string; voice?: string; speed?: number; direction?: string; inlineTags?: string; mode?: DirectionMode | "auto" };
export type Action =
  | GenerateAction
  | { action: "star"; cue: string; take: string }
  | { action: "publish" | "discard"; cue: string; take?: string }
  | { action: "direct"; cue: string; direction: string; inlineTags: string }
  | { action: "reset-direction"; cue: string }
  | ({ action: "cast"; speaker: Speaker } & CastChoice);

const KEY = ["admin", "voiceovers"] as const;

export function useVoiceovers() {
  return useQuery<View>({ queryKey: KEY, queryFn: ({ signal }) => api<View>("/api/admin/voiceovers", { signal }) });
}

/** The configured service's speech models, asked for only when the administrator can use them. */
export function useSpeechModels(enabled: boolean) {
  return useQuery<Catalog>({ queryKey: [...KEY, "models"], enabled, staleTime: 5 * 60_000, queryFn: ({ signal }) => api<Catalog>("/api/admin/voiceovers/models", { signal }) });
}

export function useVoiceoverAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: Action) => api<{ ok: boolean; failed?: string | null }>("/api/admin/voiceovers", { method: "POST", body: JSON.stringify(a) }),
    onSuccess: (r) => {
      if (r.failed) toast.error(`Some takes were made; the last one failed: ${r.failed}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e) => toast.error(messageOf(e)),
  });
}

export const estimate = (count: number) => api<Estimate & { ok: boolean }>("/api/admin/voiceovers", { method: "POST", body: JSON.stringify({ action: "estimate", count }) });

export const seconds = (n: number) => `${n.toFixed(1)} s`;
export const MODE_LABEL: Record<DirectionMode, string> = {
  inline: "Bracket cues in the line",
  instructions: "As instructions",
  "provider-options": "As OpenAI instructions (provider options)",
  none: "Not at all",
};
