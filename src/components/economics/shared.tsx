"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Missing } from "@/lib/economics/compute";

/** What is missing, one line each, each with a link to the screen that has the row. */
export function MissingList({ items, title = "Not priced or not entered" }: { items: Missing[]; title?: string }) {
  if (!items.length) return null;
  return (
    <div role="status" className="rounded-lg border border-hairline bg-warning-soft px-3 py-2">
      <p className="text-xs font-medium text-warning">{title}</p>
      <ul className="mt-1 space-y-0.5 text-xs text-primary">
        {items.map((m) => (
          <li key={m.key} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{m.what}.</span>
            <span className="text-secondary">{capital(m.reason)}</span>
            <Link href={m.href} className="inline-flex items-center text-link hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
              Fix it <ChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The arithmetic behind a table: every row and how its figure was reached. Closed until asked for. */
export function HowThisIsWorkedOut({ lines }: { lines: { label: string; how: string }[] }) {
  if (!lines.length) return null;
  return (
    <details className="group mt-3 rounded-lg border border-hairline bg-subtle px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none font-medium text-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">How this is worked out</summary>
      <dl className="mt-2 space-y-1.5">
        {lines.map((l, i) => (
          <div key={`${l.label}-${i}`} className="grid gap-x-3 sm:grid-cols-[minmax(8rem,16rem)_1fr]">
            <dt className="text-secondary">{l.label}</dt>
            <dd className="font-mono text-[11px] text-primary wrap-anywhere">{l.how}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

