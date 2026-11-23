// The frame every tab of the engineering stage shares: a bar with the page's address in the app and the tab's
// view controls, the view itself, and a foot with the hint and the true counts. The stage has one fixed height
// (set in Engineering.tsx); the view takes what the bar and the foot leave, so nothing moves when a tab loads.
import type { ReactNode } from "react";

export const CHIP = "h-8 shrink-0 rounded-md border px-3 text-[13px] transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus";
export const CHIP_ON = "border-transparent bg-action text-white";
export const CHIP_OFF = "border-hairline text-secondary hover:border-dutchOrange hover:text-primary";
export const ICON = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-secondary transition-colors duration-150 hover:border-dutchOrange hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus";

export function StageBar({ path, children }: { path: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[49px] shrink-0 items-center gap-x-4 gap-y-2 overflow-x-auto border-b border-hairline px-3 py-2 sm:px-4">
      <p className="mr-auto hidden shrink-0 text-[13px] text-muted sm:block">{path}</p>
      {children}
    </div>
  );
}

export function StageView({ className = "", children, tabIndex, label }: { className?: string; children: ReactNode; tabIndex?: number; label?: string }) {
  return (
    <div className={`relative min-h-0 flex-1 ${className}`} {...(tabIndex === undefined ? {} : { tabIndex, role: "group", "aria-label": label })}>
      {children}
    </div>
  );
}

export function StageFoot({ hint, live, children }: { hint: ReactNode; /** what the visitor last picked, read out politely */ live?: string; children: ReactNode }) {
  return (
    <div className="flex h-[41px] shrink-0 items-center gap-x-4 overflow-hidden border-t border-hairline px-3 sm:px-4">
      <p className="min-w-0 flex-1 truncate text-[13px] text-muted" aria-live="polite">
        {live ? <span className="text-primary">{live}</span> : hint}
      </p>
      <p className="hidden shrink-0 text-[13px] text-muted md:block">{children}</p>
    </div>
  );
}

export function Waiting({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" role="status">
      <p className="text-[13px] text-muted">{label}</p>
    </div>
  );
}
