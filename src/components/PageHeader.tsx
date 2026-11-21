"use client";

import { NextStepStrip } from "@/components/process/NextStepStrip";

/**
 * The title block of every page. Under it, the current concept's next step (plan 3.1): one line
 * saying what to do and why, with a link. Pages that show the next step in full (the overview,
 * the Process page) or that are not about the open concept (the wizard) pass `nextStep={false}`.
 */
export function PageHeader({
  eyebrow,
  title,
  blurb,
  children,
  nextStep = true,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
  children?: React.ReactNode;
  nextStep?: boolean;
}) {
  return (
    <header className="border-b border-hairline bg-surface">
      <div className="px-8 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">{eyebrow}</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-primary">{title}</h1>
            {blurb && <p className="mt-1 max-w-3xl text-sm text-secondary">{blurb}</p>}
          </div>
          {children && <div className="no-print flex flex-wrap items-center gap-2">{children}</div>}
        </div>
      </div>
      {nextStep && <NextStepStrip />}
    </header>
  );
}
