"use client";

import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/http";

export type Me = { username: string; usingDefaultPassword: boolean } | null;

/** Who is signed in. One key, so the shell and the account page share one request. */
export const meQuery = () =>
  queryOptions({
    queryKey: ["auth", "me"] as const,
    queryFn: ({ signal }) => api<{ user: Me }>("/api/auth/me", { signal }).then((r) => r.user),
  });
