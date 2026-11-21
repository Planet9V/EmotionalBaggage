"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { Missing } from "@/lib/economics/compute";

/** A panel with a title: the unit of layout on the economics screens. */
export function Panel({ title, note, action, children, id }: { title: string; note?: ReactNode; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id ? `${id}-h` : undefined} id={id} className="rounded-xl border border-hairline bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <h2 id={id ? `${id}-h` : undefined} className="text-sm font-semibold tracking-tight text-primary">
            {title}
          </h2>
          {note ? <p className="mt-0.5 max-w-3xl text-xs text-secondary">{note}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

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

export function PanelLoading({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-3">
      <div className="h-8 w-72 animate-pulse rounded-md bg-subtle" />
      <div className="h-56 animate-pulse rounded-xl bg-subtle" />
      <div className="h-40 animate-pulse rounded-xl bg-subtle" />
    </div>
  );
}
