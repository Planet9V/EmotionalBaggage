import React from "react";
import type { StatusTone } from "@/lib/statusTones";

const TONE: Record<StatusTone, string> = {
  neutral: "border-hairline bg-subtle text-secondary",
  info: "border-transparent bg-info-soft text-info",
  success: "border-transparent bg-success-soft text-success",
  warning: "border-transparent bg-warning-soft text-warning",
  danger: "border-transparent bg-danger-soft text-danger",
};

type Props = React.HTMLAttributes<HTMLSpanElement> & { tone: StatusTone; children: React.ReactNode };

/** A status as a labelled pill: the word always carries the meaning, the tone only supports it. */
export function StatusBadge({ tone, children, className = "", ...rest }: Props) {
  return (
    <span {...rest} data-tone={tone} className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}
