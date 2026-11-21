"use client";

// Query keys and fetchers for the chat screen. Kept beside the screen (not in src/lib/queries.ts) because
// nothing else reads chats.
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/http";
import type { ChatSource } from "@/lib/chat/shared";

export type ChatSummary = { id: number; projectId: string; title: string; createdAt: string; updatedAt: string; messages?: number };
export type SavedMessage = { id: number; role: "user" | "assistant"; content: string; sources: ChatSource[]; model: string; createdAt: string };

export type ChatSetup = {
  reasoning: { ok: true; model: string; provider: string } | { ok: false; missing: string; reason: string };
  meaning: { ok: true; model: string; dims: number } | { ok: false; missing: string; reason: string; model?: string; dims?: number };
};

export type IndexResult = {
  ok: true;
  indexed: number;
  skipped: number;
  failed: number;
  research: { indexed: number; skipped: number; failed: number };
  model: string;
  dims: number;
  index: string;
  search: string;
  error?: string;
};

const enc = encodeURIComponent;

export const chatKeys = {
  list: (projectId: string) => ["chats", projectId] as const,
  one: (chatId: number) => ["chat", chatId] as const,
};

export const chatQueries = {
  list: (projectId: string) =>
    queryOptions({
      queryKey: chatKeys.list(projectId),
      queryFn: ({ signal }) => api<{ chats: ChatSummary[]; setup: ChatSetup }>(`/api/projects/${enc(projectId)}/chats`, { signal }),
    }),
  one: (chatId: number) =>
    queryOptions({
      queryKey: chatKeys.one(chatId),
      queryFn: ({ signal }) => api<{ chat: ChatSummary; messages: SavedMessage[] }>(`/api/chats/${chatId}`, { signal }),
      // A chat's saved messages seed useChat once; refetching under it would not change what is shown.
      staleTime: Infinity,
    }),
};

export const createChat = (projectId: string) =>
  api<{ chat: ChatSummary }>(`/api/projects/${enc(projectId)}/chats`, { method: "POST", body: JSON.stringify({}) }).then((r) => r.chat);

export const deleteChat = (chatId: number) => api<{ ok: true }>(`/api/chats/${chatId}`, { method: "DELETE" });

export const indexConcept = (projectId: string) => api<IndexResult>("/api/index", { method: "POST", body: JSON.stringify({ projectId }) });

/** The sentence inside an error from the chat stream: the server answers JSON `{ error }` before streaming. */
export function errorSentence(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  try {
    const j = JSON.parse(raw) as { error?: unknown };
    if (typeof j.error === "string") return j.error;
  } catch {
    // not JSON: a sentence already
  }
  return raw || "The answer could not be fetched.";
}
