"use client";

import { useId, type ReactNode } from "react";

/**
 * A panel: hairline border, surface fill, one heading, an optional line under it and actions at the right.
 * `compact` is the dense form for screens made of many panels (economics, production, marketing lists):
 * the header sits over a rule and the body is tighter. `id` becomes the section's anchor.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  id,
  compact = false,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  compact?: boolean;
}) {
  const generated = useId();
  const h = id ? `${id}-h` : generated;
  if (compact) {
    return (
      <section aria-labelledby={h} id={id} className="rounded-xl border border-hairline bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3">
          <div className="min-w-0">
            <h2 id={h} className="text-sm font-semibold tracking-tight text-primary">
              {title}
            </h2>
            {description ? <p className="mt-0.5 max-w-3xl text-xs text-secondary">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <div className="p-4">{children}</div>
      </section>
    );
  }
  return (
    <section aria-labelledby={h} id={id} className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={h} className="text-base font-semibold tracking-tight text-primary">
            {title}
          </h2>
          {description ? <div className="mt-1 max-w-2xl text-sm text-secondary">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
