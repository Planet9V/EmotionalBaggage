"use client";

// A claim's evidence, shown on the Claims to verify board (cards and the editor) and on the Ask screen:
// the status with its reason in words, then each source with its title, verdict, quote and when it
// was judged. A source can be removed here; the server then sets the status from what is left.
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { hostname } from "@/components/wizard/shared";
import { evidenceOf, useEvidence } from "@/lib/research/client";
import type { EvidenceEntry, Verdict } from "@/lib/research/schemas";
import { statusReason } from "@/lib/research/status";
import type { StatusTone } from "@/lib/statusTones";
import type { Item } from "@/lib/types";
import { fmtDate } from "@/lib/format";

const VERDICT: Record<Verdict, { word: string; tone: StatusTone }> = {
  supports: { word: "Supports", tone: "success" },
  contradicts: { word: "Contradicts", tone: "danger" },
  unclear: { word: "Unclear", tone: "neutral" },
};

/** "20 Nov 2026", or "" when the stored time cannot be read. */
function judgedOn(iso: string): string {
  return fmtDate(iso);
}

const sourceName = (e: EvidenceEntry) => e.title?.trim() || hostname(e.url);

export function ClaimEvidence({ item, projectId, compact = false, hint = true }: { item: Item; projectId: string; compact?: boolean; hint?: boolean }) {
  const { remove } = useEvidence(projectId);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const evidence = evidenceOf(item);
  const reason = statusReason(item.status, evidence);

  const drop = async (url: string) => {
    setError("");
    setRemoving(url);
    try {
      await remove.mutateAsync({ claimId: item.id, url });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"} data-claim-evidence={item.id}>
      <p className={`${compact ? "text-[11px]" : "text-xs"} leading-snug text-secondary`}>{reason}</p>
      {evidence.length === 0 ? (
        !compact && hint && (
          <p className="text-xs text-muted">
            Add a source from a saved answer in{" "}
            <Link href="/s/research/ask" className="text-link hover:underline">
              Ask
            </Link>
            : choose Use as evidence beside it.
          </p>
        )
      ) : (
        <ul aria-label={`Evidence for ${item.title}`} className={compact ? "space-y-1.5" : "space-y-2.5"}>
          {evidence.map((e) => {
            const name = sourceName(e);
            const on = judgedOn(e.addedAt);
            const busy = removing === e.url;
            return (
              <li key={e.url} className={`min-w-0 rounded-md border border-hairline bg-canvas ${compact ? "p-1.5" : "p-2.5"}`}>
                <div className="flex min-w-0 items-start gap-1.5">
                  <StatusBadge tone={VERDICT[e.verdict].tone} className={compact ? "px-1.5 py-0 text-[10px]" : ""}>
                    {VERDICT[e.verdict].word}
                  </StatusBadge>
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={e.url}
                    className={`min-w-0 flex-1 font-medium text-primary hover:text-link hover:underline focus-visible:underline focus-visible:outline-hidden ${compact ? "line-clamp-2 text-[11px] leading-snug" : "text-xs wrap-anywhere"}`}
                  >
                    {name}
                  </a>
                </div>
                {e.quote && (
                  <blockquote className={`mt-1 border-l-2 border-hairline pl-2 text-secondary ${compact ? "line-clamp-2 text-[11px]" : "text-xs"}`}>
                    {e.quote}
                  </blockquote>
                )}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted">
                    {e.title?.trim() ? `${hostname(e.url)} · ` : ""}
                    {on ? `judged ${on}` : "date not recorded"}
                  </span>
                  <Button
                    type="button"
                    size="chip"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => void drop(e.url)}
                    aria-label={`Remove ${name} from the evidence for ${item.title}`}
                    className="text-secondary hover:text-danger"
                  >
                    {busy ? "Removing" : "Remove"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger wrap-anywhere">
          {error}
        </p>
      )}
    </div>
  );
}
