"use client";

/**
 * Every query key and fetcher the browser uses, in one place.
 *
 * Two hooks that ask for the same data use the same key, so TanStack Query sends one request,
 * keeps one cached copy and re-renders both when it changes. Every fetcher passes on the
 * `signal` TanStack Query gives it, so a request is cancelled when nothing needs it any more.
 */
import { queryOptions } from "@tanstack/react-query";
import { api } from "./http";
import type { EventRow, FileMeta, Item, Plan, Project } from "./types";

export type ResearchEntry = { id: number; query: string; answer: string; citations: string[]; model: string; createdAt: string };
export type ResearchState = { configured: boolean; model: string; entries: ResearchEntry[] };
export type ChallengeMessage = { id: number; role: string; content: string; createdAt: string };
export type ChallengeState = { configured: boolean; model: string; messages: ChallengeMessage[] };
export type Integration = {
  key: string;
  name: string;
  purpose: string;
  /** environment variables still honoured as fallbacks when Admin has nothing saved */
  env: string[];
  configured: boolean;
  built: "yes" | "partial" | "no";
  note: string;
  source?: "admin" | "environment" | "mixed" | null;
  /** the part of Admin where it is set; null when there is nothing to set */
  admin?: "credentials" | "settings" | "printers" | null;
};
export type IntegrationsReport = {
  integrations: Integration[];
  database: { connected: boolean; vector: boolean; version?: string };
  planner: { connected: boolean; networkx?: string; error?: string; reason?: string; note?: string };
};
export type PrinterStatus = { configured: boolean; kind?: string; state?: string; file?: string | null; progress?: number | null; secondsLeft?: number | null; error?: string; note?: string };
export type SearchResult = { mode: string; items: Item[] };

/** The store key for "every row of the concept". Real store keys always contain a slash, so this cannot collide. */
const ALL_ITEMS = "all";

export const keys = {
  concepts: () => ["projects"] as const,
  /** Prefix of every items query of one concept: invalidating it refreshes each store and the all-items list. */
  itemsOf: (projectId: string) => ["items", projectId] as const,
  items: (projectId: string, store: string | null) => ["items", projectId, store ?? ALL_ITEMS] as const,
  plan: (projectId: string) => ["plan", projectId] as const,
  events: (projectId: string) => ["events", projectId] as const,
  files: (projectId: string) => ["files", projectId] as const,
  research: (projectId: string) => ["research", projectId] as const,
  challenge: (projectId: string) => ["challenge", projectId] as const,
  integrations: () => ["integrations"] as const,
  printer: () => ["printer"] as const,
  search: (projectId: string, term: string) => ["search", projectId, term] as const,
};

/** Key of every item write of one concept, so concurrent writes can be counted with `isMutating`. */
export const itemWriteKey = (projectId: string) => ["items-write", projectId] as const;

const enc = encodeURIComponent;
type Ctx = { signal?: AbortSignal };

const fetchers = {
  concepts: ({ signal }: Ctx = {}) => api<{ projects: Project[] }>("/api/projects", { signal }).then((r) => r.projects),
  items: (projectId: string, store: string | null, { signal }: Ctx = {}) =>
    api<{ items: Item[] }>(`/api/projects/${enc(projectId)}/items${store ? `?section=${enc(store)}` : ""}`, { signal }).then((r) => r.items),
  plan: (projectId: string, { signal }: Ctx = {}) => api<Plan>(`/api/projects/${enc(projectId)}/plan`, { signal }),
  events: (projectId: string, { signal }: Ctx = {}) => api<{ events: EventRow[] }>(`/api/projects/${enc(projectId)}/events`, { signal }).then((r) => r.events),
  files: (projectId: string, { signal }: Ctx = {}) => api<{ files: FileMeta[] }>(`/api/projects/${enc(projectId)}/files`, { signal }).then((r) => r.files),
  research: (projectId: string, { signal }: Ctx = {}) => api<ResearchState>(`/api/research?projectId=${enc(projectId)}`, { signal }),
  challenge: (projectId: string, { signal }: Ctx = {}) => api<ChallengeState>(`/api/challenge?projectId=${enc(projectId)}`, { signal }),
  integrations: ({ signal }: Ctx = {}) => api<IntegrationsReport>("/api/integrations", { signal }),
  printer: ({ signal }: Ctx = {}) => api<PrinterStatus>("/api/printer", { signal }),
  search: (projectId: string, term: string, { signal }: Ctx = {}) =>
    api<SearchResult>(`/api/search?projectId=${enc(projectId)}&q=${enc(term)}`, { signal }),
};

export const queries = {
  concepts: () => queryOptions({ queryKey: keys.concepts(), queryFn: ({ signal }) => fetchers.concepts({ signal }) }),
  items: (projectId: string, store: string | null) =>
    queryOptions({ queryKey: keys.items(projectId, store), queryFn: ({ signal }) => fetchers.items(projectId, store, { signal }) }),
  plan: (projectId: string) => queryOptions({ queryKey: keys.plan(projectId), queryFn: ({ signal }) => fetchers.plan(projectId, { signal }) }),
  events: (projectId: string) => queryOptions({ queryKey: keys.events(projectId), queryFn: ({ signal }) => fetchers.events(projectId, { signal }) }),
  files: (projectId: string) => queryOptions({ queryKey: keys.files(projectId), queryFn: ({ signal }) => fetchers.files(projectId, { signal }) }),
  research: (projectId: string) => queryOptions({ queryKey: keys.research(projectId), queryFn: ({ signal }) => fetchers.research(projectId, { signal }) }),
  challenge: (projectId: string) => queryOptions({ queryKey: keys.challenge(projectId), queryFn: ({ signal }) => fetchers.challenge(projectId, { signal }) }),
  integrations: () => queryOptions({ queryKey: keys.integrations(), queryFn: ({ signal }) => fetchers.integrations({ signal }) }),
  /** Printer status is polled every 10 s while a component shows it. */
  printer: () => queryOptions({ queryKey: keys.printer(), queryFn: ({ signal }) => fetchers.printer({ signal }), refetchInterval: 10_000 }),
  search: (projectId: string, term: string) =>
    queryOptions({ queryKey: keys.search(projectId, term), queryFn: ({ signal }) => fetchers.search(projectId, term, { signal }), enabled: term.trim() !== "" }),
};

/** The message of a query or mutation error, or "" when there is none. */
export const messageOf = (e: unknown) => (e ? (e instanceof Error ? e.message : String(e)) : "");
