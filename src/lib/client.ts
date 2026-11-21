"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { api } from "./http";
import { itemWriteKey, keys, messageOf, queries } from "./queries";
import type { Item, Project } from "./types";

export { api };

export type ProjectState = {
  projects: Project[];
  project: Project | null;
  loading: boolean;
  error: string;
  select: (id: string) => void;
  reload: () => Promise<void>;
};

export const ProjectContext = createContext<ProjectState>({
  projects: [], project: null, loading: true, error: "", select: () => {}, reload: async () => {},
});

/** The concept currently open. Every view reads its project from here. */
export const useProject = () => useContext(ProjectContext);

/** `why`: an optional reason, kept on the change in the history; it is not a field of the row. */
export type ItemChange = Partial<Pick<Item, "title" | "body" | "status" | "sort">> & { data?: Record<string, unknown>; why?: string };
export type NewItem = { section: string; title: string; body?: string; data?: Record<string, unknown>; status?: string };

const SCALARS = ["title", "body", "status", "sort"] as const;

/**
 * A row after a PATCH, worked out the way the server does it (src/app/api/items/[id]/route.ts):
 * title, body, status and sort are replaced only when given (COALESCE), and `data` is merged
 * key by key (`data || change`), so a key that is not sent keeps its value.
 * The server also validates `data` against the section's schema, which can fill defaults (a part's
 * geometry gains `basis` and `explode`); those appear when the server's reply replaces the row.
 */
export function applyChange(item: Item, change: ItemChange): Item {
  const next: Item = { ...item };
  for (const k of SCALARS) if (change[k] != null) (next as Record<string, unknown>)[k] = change[k];
  if (change.data) next.data = { ...item.data, ...change.data };
  return next;
}

/** Undo one change on the row as it is now: only the fields that change touched go back, so another write in flight keeps its own fields. */
function revertChange(current: Item, before: Item, change: ItemChange): Item {
  const next: Item = { ...current };
  for (const k of SCALARS) if (change[k] != null) (next as Record<string, unknown>)[k] = before[k];
  if (change.data) {
    const data = { ...current.data };
    for (const k of Object.keys(change.data)) {
      if (k in before.data) data[k] = before.data[k];
      else delete data[k];
    }
    next.data = data;
  }
  return next;
}

/** Apply `fn` to one row in every cached item list of the concept (each store and the all-items list). */
function updateRow(qc: QueryClient, projectId: string, id: number, fn: (x: Item) => Item) {
  qc.setQueriesData<Item[]>({ queryKey: keys.itemsOf(projectId) }, (xs) => (xs && xs.some((x) => x.id === id) ? xs.map((x) => (x.id === id ? fn(x) : x)) : xs));
}

/** Stores written since the last refresh, per query client and concept; the last write to settle refreshes all of them at once. */
const touched = new WeakMap<QueryClient, Map<string, Set<string | null>>>();
function touch(qc: QueryClient, projectId: string, store: string | null) {
  const byProject = touched.get(qc) ?? new Map<string, Set<string | null>>();
  touched.set(qc, byProject);
  const set = byProject.get(projectId) ?? new Set<string | null>();
  byProject.set(projectId, set);
  set.add(store);
}

/**
 * After an item write settles, refresh what depends on it: the store's list, the concept's
 * all-items list, the plan and the event log. While other item writes of the same concept are
 * still in flight nothing is refetched, so a refetch cannot overwrite their optimistic values;
 * the last one to settle refreshes every store written in the meantime.
 */
function refreshAfterWrite(qc: QueryClient, projectId: string) {
  // onSettled runs while this mutation still counts as pending, so 1 means "this is the last one".
  if (qc.isMutating({ mutationKey: itemWriteKey(projectId) }) > 1) return;
  const stores = touched.get(qc)?.get(projectId) ?? new Set<string | null>();
  touched.get(qc)?.delete(projectId);
  const targets: QueryKey[] = stores.has(null)
    ? [keys.itemsOf(projectId)]
    : [...[...stores].map((s) => keys.items(projectId, s)), keys.items(projectId, null)];
  for (const queryKey of [...targets, keys.plan(projectId), keys.events(projectId)]) void qc.invalidateQueries({ queryKey });
}

/**
 * The returned promise rejects on failure so a caller's try/catch runs. A caller that does not
 * wait for it (`void patch(...)`) is not left with an unhandled rejection: the failure is in
 * `writeError` instead, for the view to show.
 */
function settled<T>(p: Promise<T>): Promise<T> {
  p.catch(() => {});
  return p;
}

/** The latest write started on each row, per query client: only the latest write's reply may replace the cached row. */
const latestWrite = new WeakMap<QueryClient, Map<number, number>>();
let writeSeq = 0;
function startWrite(qc: QueryClient, id: number) {
  const byRow = latestWrite.get(qc) ?? new Map<number, number>();
  latestWrite.set(qc, byRow);
  byRow.set(id, ++writeSeq);
  return writeSeq;
}
const isLatestWrite = (qc: QueryClient, id: number, seq: number) => latestWrite.get(qc)?.get(id) === seq;

const NO_ITEMS: Item[] = [];

/**
 * Items of one store ("stage/section") for the open concept, or every item of the concept when
 * `store` is null, with the three writes every view needs. Built on TanStack Query: two hooks on
 * the same (concept, store) share one request and one cached list, so a write in one view is seen
 * in every other view of that store at once.
 *
 * - `patch` is optimistic, rolls back on failure and rejects.
 * - `remove` is optimistic, puts the row back on failure and rejects.
 * - `add` appends the row the server returns.
 * - `error` is a failed load; `writeError` is the last failed write (cleared when the next write starts).
 */
export function useItems(projectId: string | undefined, store: string | null) {
  const qc = useQueryClient();
  const pid = projectId ?? "";
  const query = useQuery({ ...queries.items(pid, store), enabled: !!projectId });
  const [writeError, setWriteError] = useState("");
  const mutationKey = itemWriteKey(pid);

  const started = async () => {
    setWriteError("");
    touch(qc, pid, store);
    await qc.cancelQueries({ queryKey: keys.itemsOf(pid) });
  };
  const failed = (e: unknown) => setWriteError(messageOf(e) || "The change was not saved.");
  const done = () => refreshAfterWrite(qc, pid);

  const patchM = useMutation({
    mutationKey,
    mutationFn: ({ id, change }: { id: number; change: ItemChange }) =>
      api<{ item: Item }>(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(change) }).then((r) => r.item),
    onMutate: async ({ id, change }) => {
      await started();
      const lists = qc.getQueriesData<Item[]>({ queryKey: keys.itemsOf(pid) });
      const before = lists.flatMap(([, xs]) => xs ?? []).find((x) => x.id === id);
      updateRow(qc, pid, id, (x) => applyChange(x, change));
      return { before, seq: startWrite(qc, id) };
    },
    onSuccess: (row, _vars, ctx) => {
      // A reply carries the row as it was when this write reached the server. If a later write to the
      // same row has started since, that reply is out of date: keep the merged optimistic row, and the
      // later write's reply (or the refresh after the last write) brings the truth.
      if (ctx && isLatestWrite(qc, row.id, ctx.seq)) updateRow(qc, pid, row.id, () => row);
    },
    onError: (e, { id, change }, ctx) => {
      if (ctx?.before) {
        const before = ctx.before;
        updateRow(qc, pid, id, (x) => revertChange(x, before, change));
      }
      failed(e);
    },
    onSettled: done,
  });

  const removeM = useMutation({
    mutationKey,
    mutationFn: (id: number) => api<{ ok: boolean }>(`/api/items/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await started();
      const spots: { key: QueryKey; index: number; row: Item }[] = [];
      for (const [key, xs] of qc.getQueriesData<Item[]>({ queryKey: keys.itemsOf(pid) })) {
        const index = xs?.findIndex((x) => x.id === id) ?? -1;
        if (xs && index >= 0) spots.push({ key, index, row: xs[index] });
      }
      qc.setQueriesData<Item[]>({ queryKey: keys.itemsOf(pid) }, (xs) => (xs && xs.some((x) => x.id === id) ? xs.filter((x) => x.id !== id) : xs));
      return { spots };
    },
    onError: (e, id, ctx) => {
      for (const s of ctx?.spots ?? []) {
        qc.setQueryData<Item[]>(s.key, (xs) => {
          if (!xs || xs.some((x) => x.id === id)) return xs;
          const out = [...xs];
          out.splice(Math.min(s.index, out.length), 0, s.row);
          return out;
        });
      }
      failed(e);
    },
    onSettled: done,
  });

  const addM = useMutation({
    mutationKey,
    mutationFn: (it: NewItem) => api<{ item: Item }>(`/api/projects/${encodeURIComponent(pid)}/items`, { method: "POST", body: JSON.stringify(it) }).then((r) => r.item),
    onMutate: async (it) => {
      setWriteError("");
      touch(qc, pid, it.section);
    },
    onSuccess: (row) => {
      for (const key of [keys.items(pid, row.section), keys.items(pid, null)]) {
        qc.setQueryData<Item[]>(key, (xs) => (xs && !xs.some((x) => x.id === row.id) ? [...xs, row] : xs));
      }
    },
    onError: failed,
    onSettled: done,
  });

  const { mutateAsync: patchAsync } = patchM;
  const { mutateAsync: removeAsync } = removeM;
  const { mutateAsync: addAsync } = addM;
  const patch = useCallback((id: number, change: ItemChange) => settled(patchAsync({ id, change }).then(() => undefined)), [patchAsync]);
  const remove = useCallback((id: number) => settled(removeAsync(id).then(() => undefined)), [removeAsync]);
  const add = useCallback((it: NewItem) => settled(addAsync(it)), [addAsync]);
  const { refetch } = query;
  const reload = useCallback(async () => {
    if (projectId) await refetch();
  }, [projectId, refetch]);

  return {
    items: query.data ?? NO_ITEMS,
    loading: !!projectId && query.isPending,
    error: messageOf(query.error),
    writeError,
    reload,
    add,
    patch,
    remove,
  };
}

/** The STL and other files of a concept changed (upload or delete): refresh every view that lists them, and the event log. */
export function useFilesChanged(projectId: string) {
  const qc = useQueryClient();
  return useCallback(
    () => Promise.all([qc.invalidateQueries({ queryKey: keys.files(projectId) }), qc.invalidateQueries({ queryKey: keys.events(projectId) })]).then(() => undefined),
    [qc, projectId]
  );
}

/** For an InlineEdit onSave: wait for the write and hand back its error message, so the field stays open and shows it. */
export const saveOrMessage = (p: Promise<unknown>): Promise<string | void> => p.then(
  () => undefined,
  (e: unknown) => messageOf(e) || "That did not save."
);
