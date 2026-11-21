"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";

/** Defaults for every query: a short fresh window so moving between views reuses what is cached, one retry, no refetch on window focus. */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // A new client for each server render keeps requests apart; the browser keeps one for the whole session.
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
      {/* One toaster for the whole app; it follows the theme class on <html>. Error toasts are announced. */}
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
