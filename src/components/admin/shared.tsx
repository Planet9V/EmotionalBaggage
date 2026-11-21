"use client";

// The inline result of a connection test, which only the Admin tabs show. The states, fields and dialogs
// they use are the shared ones in components/ui.
import { CircleAlert, CircleCheck } from "lucide-react";
import type { TestResult } from "@/lib/admin/client";

/** The answer of a connection test, inline: a success or failure line with the server's message. */
export function TestOutcome({ result, error, pending }: { result?: TestResult | null; error?: string; pending?: boolean }) {
  if (pending) {
    return (
      <p role="status" className="text-sm text-secondary">
        Testing the connection.
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>The test could not run: {error}</span>
      </p>
    );
  }
  if (!result) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      data-ok={result.ok}
      className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${result.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
    >
      {result.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <span>
        <span className="font-medium">{result.ok ? "It works. " : "It failed. "}</span>
        {result.message}
      </span>
    </p>
  );
}
