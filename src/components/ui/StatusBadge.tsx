import React from "react";
import { TONE_CLASS, type StatusTone } from "@/lib/statusTones";

type Props = React.HTMLAttributes<HTMLSpanElement> & { tone: StatusTone; children: React.ReactNode };

/** A status as a labelled pill: the word always carries the meaning, the tone only supports it. */
export function StatusBadge({ tone, children, className = "", ...rest }: Props) {
  return (
    <span {...rest} data-tone={tone} className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}
