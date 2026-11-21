"use client";

// "Save to concept" and "Send to printing": the saved generator builds the base and lid on the server and
// stores them as concept files (Z up, on z = 0, STL and one 3MF), named with the generator and the parameter
// hash. "Send to printing" then opens New print job with the 3MF chosen. The last stored set is shown with
// its checks when the page loads. Nothing is sliced or sent here.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Download, Printer, Save } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { api } from "@/lib/client";
import { keys, messageOf } from "@/lib/queries";
import { GENERATORS } from "@/lib/enclosure/types";
import type { StoredEnclosure } from "@/lib/enclosure/stored";
import { fmtBytes } from "@/lib/format";
import { ChecksList } from "./ResultPanel";

type Answer = { generator: string; paramsHash: string; files: { id: number; name: string; piece: string }[]; failed: number };

const storedKey = (projectId: string) => ["enclosure-stored", projectId] as const;
const enc = encodeURIComponent;

/** Where "Send to printing" lands: the printing page with New print job open on this file. */
export const newJobHref = (fileId: number) => `/s/prototype/printing?newJob=${fileId}#new-print-job`;

const PIECE: Record<string, string> = { base: "Base", lid: "Lid, outer face down", both: "Base and lid together" };

/** `beforeSend` saves the generator and settings on screen first, so what is built is what is shown. */
export function SendToPrinting({ projectId, disabled, reason, beforeSend }: { projectId: string; disabled: boolean; reason: string; beforeSend: () => Promise<void> }) {
  const qc = useQueryClient();
  const router = useRouter();
  const stored = useQuery({ queryKey: storedKey(projectId), queryFn: () => api<{ stored: StoredEnclosure | null }>(`/api/projects/${enc(projectId)}/enclosure/print`).then((r) => r.stored) });
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [err, setErr] = useState("");

  const store = async (then: "save" | "send") => {
    setBusy(then);
    setErr("");
    try {
      await beforeSend();
      const r = await api<Answer>(`/api/projects/${enc(projectId)}/enclosure/print`, { method: "POST" });
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.files(projectId) }),
        qc.invalidateQueries({ queryKey: keys.events(projectId) }),
        qc.invalidateQueries({ queryKey: storedKey(projectId) }),
      ]);
      if (then === "send") {
        const pick = r.files.find((f) => f.piece === "both") ?? r.files[0];
        if (pick) router.push(newJobHref(pick.id));
      }
    } catch (e) {
      setErr(messageOf(e) || "The enclosure was not stored.");
    } finally {
      setBusy(null);
    }
  };

  const last = stored.data;
  const failed = last ? last.checks.filter((c) => !c.ok).length : 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void store("save")} disabled={!!busy || disabled} aria-describedby="send-to-printing-hint">
          <Save className="h-3.5 w-3.5" aria-hidden /> {busy === "save" ? "Building the base and lid" : "Save to concept"}
        </Button>
        <Button size="sm" onClick={() => void store("send")} disabled={!!busy || disabled} aria-describedby="send-to-printing-hint">
          <Printer className="h-3.5 w-3.5" aria-hidden /> {busy === "send" ? "Building the base and lid" : "Send to printing"}
        </Button>
        <span id="send-to-printing-hint" className="text-xs text-muted">
          {disabled ? reason : "Builds the saved choice and stores the base and the lid, Z up and turned for printing, as STL and 3MF files of this concept. Send to printing then opens a new print job with them."}
        </span>
      </div>
      {err && <ErrorLine>{err}</ErrorLine>}
      {stored.isPending ? (
        <LoadingBlocks rows={1} label="Loading the last saved enclosure" />
      ) : stored.isError ? (
        <div className="space-y-2">
          <ErrorLine>The last saved enclosure could not be read: {messageOf(stored.error)}</ErrorLine>
          <Button size="sm" variant="outline" onClick={() => void stored.refetch()}>Try again</Button>
        </div>
      ) : last ? (
        <section aria-labelledby="enclosure-saved-h" className="rounded-lg border border-hairline bg-canvas p-3">
          <h3 id="enclosure-saved-h" className="text-sm font-semibold text-primary">
            Saved to the concept: {GENERATORS[last.generator]?.label ?? last.generator}, settings {last.paramsHash}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Built {new Date(last.at).toLocaleString()}. Checks {failed ? `(${failed} not met)` : "(all met)"}, measured on this build:
          </p>
          <div className="mt-2">
            <ChecksList checks={last.checks.map((c) => ({ ...c, key: c.key as never }))} />
          </div>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Saved files">
            {last.files.map((f) => (
              <li key={f.id}>
                <a href={`/api/files/${f.id}`} download={f.name} className={buttonVariants({ variant: "outline", size: "sm" })} title={f.name}>
                  <Download className="h-3.5 w-3.5" aria-hidden /> {PIECE[f.piece] ?? f.piece} ({f.kind.toUpperCase()}, {fmtBytes(f.size)})
                </a>
              </li>
            ))}
            {last.files.length ? (
              <li>
                <Button size="sm" variant="ghost" onClick={() => router.push(newJobHref((last.files.find((f) => f.piece === "both") ?? last.files[0]).id))}>
                  <Printer className="h-3.5 w-3.5" aria-hidden /> New print job from these
                </Button>
              </li>
            ) : null}
          </ul>
        </section>
      ) : (
        <p className="text-xs text-secondary">Nothing is saved to the concept yet. A generated result is kept on this page only until you save it.</p>
      )}
    </div>
  );
}
