"use client";

import { Check, Minus, X } from "lucide-react";
import type { CheckLine } from "./derive";
import { Card } from "@/components/ui/Card";

const WORD = { pass: "Pass", fail: "Fail", na: "Not applicable" } as const;

export function Checklist({ lines }: { lines: CheckLine[] }) {
  const ready = lines.every((l) => l.result !== "fail");
  return (
    <Card variant="flat" className="print:break-inside-avoid">
      <ul className="divide-y divide-hairline">
        {lines.map((l) => (
          <li key={l.id} className="flex items-start gap-3 px-4 py-3">
            <span
              aria-hidden
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                l.result === "pass" ? "bg-success-soft text-success" : l.result === "fail" ? "bg-danger-soft text-danger" : "bg-subtle text-muted"
              }`}
            >
              {l.result === "pass" ? <Check className="h-3 w-3" /> : l.result === "fail" ? <X className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-primary">{l.label}</p>
              <p className="text-xs text-secondary">{l.detail}</p>
            </div>
            <span className={`font-mono text-[11px] ${l.result === "pass" ? "text-success" : l.result === "fail" ? "text-danger" : "text-muted"}`}>{WORD[l.result]}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-hairline px-4 py-2.5 text-xs text-secondary" role="status">
        {ready ? "Every line passes." : "Not ready for power. Clear the failing lines first."}
      </p>
    </Card>
  );
}
