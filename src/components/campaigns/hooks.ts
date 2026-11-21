"use client";

// What the campaign screens read and write beyond item rows (those go through useItems). One place for
// the keys, so a result saved in one screen refreshes every other screen that shows it.
import { useMemo } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { processKey } from "@/lib/process/client";
import { api } from "@/lib/http";
import { messageOf } from "@/lib/queries";
import { formatMoney, parseMinor, toInputText } from "@/lib/economics/money";
import type { LinkClickRow } from "@/lib/campaigns/analyze";
import type { ChannelMargin } from "@/lib/campaigns/margin";
import type { ResultRow } from "@/lib/campaigns/metrics";
import type { SavedMapping } from "@/lib/campaigns/schemas";
import type { MEDIA } from "@/lib/campaigns/links";
import type { toLink } from "@/lib/campaigns/linkRows";

const enc = encodeURIComponent;
const base = (p: string) => `/api/projects/${enc(p)}/campaigns`;

export const campaignKeys = {
  all: (p: string) => ["campaigns", p] as const,
  summary: (p: string) => ["campaigns", p, "summary"] as const,
  results: (p: string) => ["campaigns", p, "results"] as const,
  links: (p: string) => ["campaigns", p, "links"] as const,
  mapping: (p: string, ch: string) => ["campaigns", p, "mapping", ch] as const,
};

export type Summary = { currency: string; margins: ChannelMargin[] };
export type ResultsPayload = { rows: ResultRow[]; linkClicks: LinkClickRow[] };
export type LinkView = ReturnType<typeof toLink>;
export type LinksPayload = { links: LinkView[]; convention: string[] };

export const summaryQuery = (p: string) => queryOptions({ queryKey: campaignKeys.summary(p), queryFn: ({ signal }) => api<Summary>(`${base(p)}/summary`, { signal }) });
export const resultsQuery = (p: string) => queryOptions({ queryKey: campaignKeys.results(p), queryFn: ({ signal }) => api<ResultsPayload>(`${base(p)}/results`, { signal }) });
export const linksQuery = (p: string) => queryOptions({ queryKey: campaignKeys.links(p), queryFn: ({ signal }) => api<LinksPayload>(`${base(p)}/links`, { signal }) });

export function useSummary(projectId: string) {
  const q = useQuery(summaryQuery(projectId));
  return { summary: q.data, loading: q.isPending, error: messageOf(q.error), retry: () => void q.refetch() };
}

export function useResults(projectId: string) {
  const q = useQuery(resultsQuery(projectId));
  return { data: q.data, loading: q.isPending, error: messageOf(q.error), retry: () => void q.refetch() };
}

export function useLinks(projectId: string) {
  const q = useQuery(linksQuery(projectId));
  return { data: q.data, loading: q.isPending, error: messageOf(q.error), retry: () => void q.refetch() };
}

export type NewResultRow = { day: string; creativeId?: number | null; spend: number; impressions: number; clicks: number; orders: number; revenue: number };

export function useSaveResults(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { campaignId: number; source: "manual" | "paste" | "csv"; rows: NewResultRow[] }) =>
      api<{ added: number; replaced: number }>(`${base(projectId)}/results`, { method: "POST", body: JSON.stringify(b) }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: campaignKeys.results(projectId) });
      void qc.invalidateQueries({ queryKey: ["events"] });
      // the gates count results: the next step follows
      void qc.invalidateQueries({ queryKey: processKey(projectId) });
    },
  });
}

export function useRemoveResults(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { campaignId: number; ids: number[] }) => api<{ removed: number }>(`${base(projectId)}/results`, { method: "DELETE", body: JSON.stringify(b) }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: campaignKeys.results(projectId) });
      void qc.invalidateQueries({ queryKey: processKey(projectId) });
    },
  });
}

export type NewLink = {
  campaignId: number;
  creativeId?: number | null;
  baseUrl: string;
  source: string;
  medium: (typeof MEDIA)[number];
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  short: boolean;
};

export function useMakeLink(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: NewLink) => api<{ link: LinkView; notes: string[] }>(`${base(projectId)}/links`, { method: "POST", body: JSON.stringify(b) }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: campaignKeys.links(projectId) });
      void qc.invalidateQueries({ queryKey: processKey(projectId) });
    },
  });
}

export function useChangeLink(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { id: number; disabled?: boolean; remove?: boolean }) =>
      b.remove ? api(`${base(projectId)}/links/${b.id}`, { method: "DELETE" }) : api(`${base(projectId)}/links/${b.id}`, { method: "PATCH", body: JSON.stringify({ disabled: b.disabled }) }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: campaignKeys.links(projectId) });
      void qc.invalidateQueries({ queryKey: processKey(projectId) });
    },
  });
}

export const fetchMapping = (projectId: string, channel: string) =>
  api<{ channel: string; saved: SavedMapping | null }>(`${base(projectId)}/csv-mapping?channel=${enc(channel)}`);

export const saveMapping = (projectId: string, channel: string, saved: SavedMapping) =>
  api(`${base(projectId)}/csv-mapping`, { method: "PUT", body: JSON.stringify({ channel, saved }) });

export type Explanation = {
  verdict: string;
  headline: string;
  numbers: { label: string; value: string }[];
  warnings: string[];
  modelText: { explanation: string; suggestion: string };
  model: string;
  label: string;
};

export const explain = (projectId: string, campaignId: number) =>
  api<Explanation>(`${base(projectId)}/explain`, { method: "POST", body: JSON.stringify({ campaignId }) });

export const startLaunch = (projectId: string, b: { template: string; launchDate: string; title?: string }) =>
  api<{ launchKey: string; steps: number }>(`${base(projectId)}/launch`, { method: "POST", body: JSON.stringify(b) });

/** Money helpers for one currency: show a minor amount, read a typed major amount back. */
export function useMoney(currency: string | undefined) {
  return useMemo(() => {
    const c = currency || "USD";
    return {
      currency: c,
      format: (minor: number) => formatMoney(minor, c),
      /** a minor amount as the text of an input, "12.50" */
      toInput: (minor: number | null | undefined) => (minor === null || minor === undefined ? "" : toInputText(minor, c)),
      /** typed text as a minor amount, null when empty, NaN when it is not a number */
      fromInput: (text: string): number | null => {
        if (text.trim() === "") return null;
        return parseMinor(text, c) ?? Number.NaN;
      },
    };
  }, [currency]);
}
