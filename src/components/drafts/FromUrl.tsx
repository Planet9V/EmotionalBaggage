"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Hands the page the search parameters it asked for, once, after it loads. Used by the row editor
 * link (`?item=<id>`) and by "Verify this" (`?ask=<question>&claim=<id>`). Render it inside a
 * Suspense boundary: it reads the search parameters.
 */
export function FromUrl({ names, onParams }: { names: string[]; onParams: (values: Record<string, string>) => void }) {
  const params = useSearchParams();
  const done = useRef(false);
  const key = names.map((n) => `${n}=${params.get(n) ?? ""}`).join("&");
  useEffect(() => {
    if (done.current) return;
    const values = Object.fromEntries(names.map((n) => [n, params.get(n) ?? ""]).filter(([, v]) => v));
    if (!Object.keys(values).length) return;
    done.current = true;
    onParams(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per distinct set of parameters
  }, [key]);
  return null;
}
