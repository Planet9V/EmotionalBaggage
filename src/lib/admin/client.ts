"use client";

/**
 * Query keys, fetchers and hooks for the Admin screens (/admin), in the same pattern as src/lib/queries.ts.
 *
 * Secrets: a value typed into a password field goes to the server in a PUT or POST body and nowhere else.
 * It is never put in a query key, the cache, a URL or a log. Optimistic updates mark a field as set but
 * leave its last four characters empty until the server answers with them.
 */
import { keepPreviousData, queryOptions, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/http";
import type { ProviderView } from "@/lib/admin/credentials";
import type { AuditEntry } from "@/lib/admin/audit";
import type { AdminSettings } from "@/lib/admin/settings";
import type { PrinterView } from "@/lib/admin/printers";
import type { PrinterFamily } from "@/lib/admin/printerFamilies";
import type { StatusItem } from "@/lib/admin/status";
import type { AuditRow } from "@/lib/auditLog";
import type { ModelChoice } from "@/lib/settings";
import { downloadFile } from "@/lib/download";

export type { ProviderView, AuditEntry, AdminSettings, PrinterView, PrinterFamily, ModelChoice };

export type AdminStatus = { complete: boolean; items: StatusItem[]; defaultPassword: boolean };
export type TestResult = { ok: boolean; message: string; detail?: Record<string, unknown> };
export type AuditConcept = { id: string; name: string; exists: boolean };
export type AuditPage = { entries: AuditRow[]; next: number | null; concepts: AuditConcept[] };
export type AuditFilters = { project?: string; action?: string; q?: string; /** leave out actions that start with this */ hide?: string };
export type ConnectionTest =
  | { kind: "model"; provider: ModelChoice["provider"]; baseUrl: string; model?: string; apiKey?: string }
  | { kind: "embedding"; provider: ModelChoice["provider"]; baseUrl: string; model: string; dims: number; apiKey?: string }
  | { kind: "perplexity"; apiKey?: string }
  | { kind: "printer"; id?: number; family?: string; access?: Record<string, string | null> }
  | { kind: "planner"; url?: string }
  | { kind: "slicer"; url?: string }
  | { kind: "database" }
  | { kind: "amazon-sp" | "x" | "instagram" };
export type IndexResult = { ok: true; indexed: number; skipped: number; failed: number; model: string; dims: number; search: string; error?: string };
export type SettingsChange = Partial<Pick<AdminSettings, "reasoningModel" | "embeddingModel" | "plannerUrl" | "slicerUrl">>;
export type PrinterInput = { name?: string; family?: string; model?: string; enabled?: boolean; access?: Record<string, string | null> };

/** The tabs of /admin, in order. The tab is kept in the address as ?tab=. */
export const ADMIN_TABS = ["setup", "credentials", "models", "printers", "audit", "access"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];
export const isAdminTab = (v: string | null | undefined): v is AdminTab => !!v && (ADMIN_TABS as readonly string[]).includes(v);

/** Where each part of Admin named by the API lives. The API says "settings" for the models and the planner. */
export const TAB_OF: Record<"settings" | "credentials" | "printers", AdminTab> = { settings: "models", credentials: "credentials", printers: "printers" };

const PAGE = 100;

/** The query string for the audit log: only filters that are set, in a fixed order, and `before` for the next page. */
export function auditQueryString(f: AuditFilters, extra: { before?: number | null; limit?: number } = {}): string {
  const p = new URLSearchParams();
  if (f.project) p.set("project", f.project);
  if (f.action) p.set("action", f.action);
  if (f.hide) p.set("hide", f.hide);
  const text = f.q?.trim();
  if (text) p.set("q", text);
  if (extra.before) p.set("before", String(extra.before));
  if (extra.limit) p.set("limit", String(extra.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

const adminKeys = {
  all: () => ["admin"] as const,
  status: () => ["admin", "status"] as const,
  credentials: () => ["admin", "credentials"] as const,
  credentialsAudit: () => ["admin", "credentials-audit"] as const,
  settings: () => ["admin", "settings"] as const,
  printers: () => ["admin", "printers"] as const,
  families: () => ["admin", "printer-families"] as const,
  audit: (f: AuditFilters) => ["admin", "audit", f.project ?? "", f.action ?? "", f.hide ?? "", f.q?.trim() ?? ""] as const,
};

type Ctx = { signal?: AbortSignal };

const adminFetchers = {
  status: ({ signal }: Ctx = {}) => api<AdminStatus>("/api/admin/status", { signal }),
  credentials: ({ signal }: Ctx = {}) => api<{ providers: ProviderView[] }>("/api/admin/credentials", { signal }).then((r) => r.providers),
  credentialsAudit: ({ signal }: Ctx = {}) => api<{ entries: AuditEntry[] }>("/api/admin/credentials/audit", { signal }).then((r) => r.entries),
  settings: ({ signal }: Ctx = {}) => api<{ settings: AdminSettings }>("/api/admin/settings", { signal }).then((r) => r.settings),
  printers: ({ signal }: Ctx = {}) => api<{ printers: PrinterView[] }>("/api/admin/printers", { signal }).then((r) => r.printers),
  families: ({ signal }: Ctx = {}) => api<{ families: PrinterFamily[] }>("/api/admin/printer-families", { signal }).then((r) => r.families),
  audit: (f: AuditFilters, before: number | null, { signal }: Ctx = {}) =>
    api<AuditPage>(`/api/admin/audit${auditQueryString(f, { before, limit: PAGE })}`, { signal }),
};

const adminQueries = {
  status: () => queryOptions({ queryKey: adminKeys.status(), queryFn: ({ signal }) => adminFetchers.status({ signal }) }),
  credentials: () => queryOptions({ queryKey: adminKeys.credentials(), queryFn: ({ signal }) => adminFetchers.credentials({ signal }) }),
  credentialsAudit: () => queryOptions({ queryKey: adminKeys.credentialsAudit(), queryFn: ({ signal }) => adminFetchers.credentialsAudit({ signal }) }),
  settings: () => queryOptions({ queryKey: adminKeys.settings(), queryFn: ({ signal }) => adminFetchers.settings({ signal }) }),
  printers: () => queryOptions({ queryKey: adminKeys.printers(), queryFn: ({ signal }) => adminFetchers.printers({ signal }) }),
  families: () => queryOptions({ queryKey: adminKeys.families(), queryFn: ({ signal }) => adminFetchers.families({ signal }), staleTime: Infinity }),
};

export const useAdminStatus = () => useQuery(adminQueries.status());
export const useCredentials = () => useQuery(adminQueries.credentials());
export const useCredentialsAudit = () => useQuery(adminQueries.credentialsAudit());
export const useAdminSettings = () => useQuery(adminQueries.settings());
export const usePrinters = () => useQuery(adminQueries.printers());
export const usePrinterFamilies = () => useQuery(adminQueries.families());

/** After any save: the first-run checklist and the integrations report may have changed. */
function useRefreshDerived() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: adminKeys.status() });
    void qc.invalidateQueries({ queryKey: ["integrations"] });
  };
}

const replaceProvider = (list: ProviderView[] | undefined, p: ProviderView) => list?.map((x) => (x.id === p.id ? p : x));

/** Saves one or more fields of a provider. Blank fields are not sent. Optimistic: the fields show as set at once. */
export function useSaveCredentials() {
  const qc = useQueryClient();
  const refresh = useRefreshDerived();
  return useMutation({
    mutationFn: ({ provider, fields }: { provider: string; fields: Record<string, string> }) =>
      api<{ provider: ProviderView }>(`/api/admin/credentials/${encodeURIComponent(provider)}`, { method: "PUT", body: JSON.stringify({ fields }) }).then((r) => r.provider),
    onMutate: async ({ provider, fields }) => {
      await qc.cancelQueries({ queryKey: adminKeys.credentials() });
      const before = qc.getQueryData<ProviderView[]>(adminKeys.credentials());
      const names = new Set(Object.keys(fields));
      qc.setQueryData<ProviderView[]>(adminKeys.credentials(), (list) =>
        list?.map((p) =>
          p.id !== provider
            ? p
            : {
                ...p,
                // never the typed value: only "set", with the last four left for the server to give
                fields: p.fields.map((f) => (names.has(f.name) ? { ...f, set: true, source: "admin" as const, last4: f.secret ? null : f.last4, value: f.secret ? null : fields[f.name] } : f)),
              }
        )
      );
      return { before };
    },
    onError: (_e, _v, c) => qc.setQueryData(adminKeys.credentials(), c?.before),
    onSuccess: (p) => qc.setQueryData<ProviderView[]>(adminKeys.credentials(), (list) => replaceProvider(list, p)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.credentialsAudit() });
      refresh();
    },
  });
}

/** Removes one saved field. Optimistic: the field shows as not set at once. */
export function useRemoveCredential() {
  const qc = useQueryClient();
  const refresh = useRefreshDerived();
  return useMutation({
    mutationFn: ({ provider, field }: { provider: string; field: string }) =>
      api<{ provider: ProviderView }>(`/api/admin/credentials/${encodeURIComponent(provider)}/${encodeURIComponent(field)}`, { method: "DELETE" }).then((r) => r.provider),
    onMutate: async ({ provider, field }) => {
      await qc.cancelQueries({ queryKey: adminKeys.credentials() });
      const before = qc.getQueryData<ProviderView[]>(adminKeys.credentials());
      qc.setQueryData<ProviderView[]>(adminKeys.credentials(), (list) =>
        list?.map((p) => (p.id !== provider ? p : { ...p, fields: p.fields.map((f) => (f.name === field ? { ...f, set: false, source: null, last4: null, value: null, updatedAt: null } : f)) }))
      );
      return { before };
    },
    onError: (_e, _v, c) => qc.setQueryData(adminKeys.credentials(), c?.before),
    onSuccess: (p) => qc.setQueryData<ProviderView[]>(adminKeys.credentials(), (list) => replaceProvider(list, p)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.credentialsAudit() });
      refresh();
    },
  });
}

/** Saves model choices and the planner address. Optimistic; a refused save rolls back. */
export function useSaveSettings() {
  const qc = useQueryClient();
  const refresh = useRefreshDerived();
  return useMutation({
    mutationFn: (change: SettingsChange) =>
      api<{ settings: AdminSettings; notices?: string[] }>("/api/admin/settings", { method: "PUT", body: JSON.stringify(change) }).then((r) => {
        // a model address moved to another host: the server says what happened to the saved key
        for (const n of r.notices ?? []) toast.warning(n, { duration: 20_000 });
        return r.settings;
      }),
    onMutate: async (change) => {
      await qc.cancelQueries({ queryKey: adminKeys.settings() });
      const before = qc.getQueryData<AdminSettings>(adminKeys.settings());
      if (before) qc.setQueryData<AdminSettings>(adminKeys.settings(), { ...before, ...change });
      return { before };
    },
    onError: (_e, _v, c) => qc.setQueryData(adminKeys.settings(), c?.before),
    onSuccess: (s) => qc.setQueryData(adminKeys.settings(), s),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.credentials() });
      refresh();
    },
  });
}

export function useAddPrinter() {
  const qc = useQueryClient();
  const refresh = useRefreshDerived();
  return useMutation({
    mutationFn: (p: PrinterInput) => api<{ printer: PrinterView }>("/api/admin/printers", { method: "POST", body: JSON.stringify(p) }).then((r) => r.printer),
    onSuccess: (p) => qc.setQueryData<PrinterView[]>(adminKeys.printers(), (list) => (list ? [...list, p] : [p])),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.printers() });
      refresh();
    },
  });
}

/** Changes a printer. Optimistic for name, model and enabled; access values wait for the server. */
export function useUpdatePrinter() {
  const qc = useQueryClient();
  const refresh = useRefreshDerived();
  return useMutation({
    mutationFn: ({ id, change }: { id: number; change: PrinterInput }) =>
      api<{ printer: PrinterView }>(`/api/admin/printers/${id}`, { method: "PATCH", body: JSON.stringify(change) }).then((r) => r.printer),
    onMutate: async ({ id, change }) => {
      await qc.cancelQueries({ queryKey: adminKeys.printers() });
      const before = qc.getQueryData<PrinterView[]>(adminKeys.printers());
      const { access: _access, family: _family, ...plain } = change;
      void _access;
      void _family;
      qc.setQueryData<PrinterView[]>(adminKeys.printers(), (list) => list?.map((p) => (p.id === id ? { ...p, ...plain } : p)));
      return { before };
    },
    onError: (_e, _v, c) => qc.setQueryData(adminKeys.printers(), c?.before),
    onSuccess: (p) => qc.setQueryData<PrinterView[]>(adminKeys.printers(), (list) => list?.map((x) => (x.id === p.id ? p : x))),
    onSettled: refresh,
  });
}

/** Removes a printer. Optimistic: it leaves the list at once and comes back if the server refuses. */
export function useRemovePrinter() {
  const qc = useQueryClient();
  const refresh = useRefreshDerived();
  return useMutation({
    mutationFn: (id: number) => api<{ deleted: number }>(`/api/admin/printers/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: adminKeys.printers() });
      const before = qc.getQueryData<PrinterView[]>(adminKeys.printers());
      qc.setQueryData<PrinterView[]>(adminKeys.printers(), (list) => list?.filter((p) => p.id !== id));
      return { before };
    },
    onError: (_e, _v, c) => qc.setQueryData(adminKeys.printers(), c?.before),
    onSettled: refresh,
  });
}

/** POST /api/admin/test. A failed test is a normal answer ({ ok: false }); only a refused request throws. */
export function useConnectionTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: ConnectionTest) => api<TestResult>("/api/admin/test", { method: "POST", body: JSON.stringify(t) }),
    onSettled: () => void qc.invalidateQueries({ queryKey: adminKeys.credentialsAudit() }),
  });
}

/** POST /api/index for one concept. A 503 (no pgvector, no model) throws with the server's sentence. */
export function useIndexConcept() {
  return useMutation({
    mutationFn: (projectId: string) => api<IndexResult>("/api/index", { method: "POST", body: JSON.stringify({ projectId }) }),
  });
}

/** The audit log, newest first, a page of 100 at a time; `fetchNextPage` asks for older lines. */
export function useAuditLog(f: AuditFilters) {
  return useInfiniteQuery({
    queryKey: adminKeys.audit(f),
    queryFn: ({ pageParam, signal }) => adminFetchers.audit(f, pageParam, { signal }),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

/** Downloads the audit log with the same filters as a file. Answers the file name. */
export async function downloadAuditLog(f: AuditFilters): Promise<string> {
  const res = await fetch(`/api/admin/audit/export${auditQueryString(f)}`);
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- session ended: full reload to sign in
    window.location.assign(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    throw new Error("Sign in to continue.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `The download failed (${res.status}).`);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "audit-log.ndjson";
  downloadFile(name, await res.blob(), "application/x-ndjson");
  return name;
}
