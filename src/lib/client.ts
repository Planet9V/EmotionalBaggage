"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Item, Project } from "./types";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json", ...(init?.headers ?? {}) } : init?.headers,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

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

/** Items of one store ("stage/section") for the open concept, with the three writes every view needs. */
export function useItems(projectId: string | undefined, store: string | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!projectId) return;
    try {
      const qs = store ? `?section=${encodeURIComponent(store)}` : "";
      const r = await api<{ items: Item[] }>(`/api/projects/${projectId}/items${qs}`);
      setItems(r.items);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, store]);

  useEffect(() => {
    // Views are keyed by concept and section, so a new store always mounts a fresh hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads external data on mount
    void reload();
  }, [reload]);

  const add = async (it: { section: string; title: string; body?: string; data?: Record<string, unknown>; status?: string }) => {
    const r = await api<{ item: Item }>(`/api/projects/${projectId}/items`, { method: "POST", body: JSON.stringify(it) });
    setItems((xs) => [...xs, r.item]);
    return r.item;
  };
  const patch = async (id: number, change: Partial<Pick<Item, "title" | "body" | "status" | "sort">> & { data?: Record<string, unknown> }) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...change, data: { ...x.data, ...(change.data ?? {}) } } : x)));
    try {
      const r = await api<{ item: Item }>(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(change) });
      setItems((xs) => xs.map((x) => (x.id === id ? r.item : x)));
    } catch (e) {
      setError((e as Error).message);
      await reload();
    }
  };
  const remove = async (id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    await api(`/api/items/${id}`, { method: "DELETE" });
  };

  return { items, loading, error, reload, add, patch, remove };
}
