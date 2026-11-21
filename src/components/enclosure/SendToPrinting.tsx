"use client";

// "Send to printing": the saved generator builds the base and lid on the server and stores them as
// STL files of the concept, which the print flow then offers for a new job. Nothing is sliced or sent.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorLine } from "@/components/parts/controls";
import { api } from "@/lib/client";
import { keys, messageOf } from "@/lib/queries";

type Answer = { generator: string; files: { id: number; name: string }[]; failed: number };

/** `beforeSend` saves the generator and settings on screen first, so what is built is what is shown. */
export function SendToPrinting({ projectId, disabled, reason, beforeSend }: { projectId: string; disabled: boolean; reason: string; beforeSend: () => Promise<void> }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Answer | null>(null);
  const [err, setErr] = useState("");
  const send = async () => {
    setBusy(true);
    setErr("");
    setDone(null);
    try {
      await beforeSend();
      const r = await api<Answer>(`/api/projects/${encodeURIComponent(projectId)}/enclosure/print`, { method: "POST" });
      setDone(r);
      await Promise.all([qc.invalidateQueries({ queryKey: keys.files(projectId) }), qc.invalidateQueries({ queryKey: keys.events(projectId) })]);
    } catch (e) {
      setErr(messageOf(e) || "The enclosure was not stored for printing.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void send()} disabled={busy || disabled} aria-describedby="send-to-printing-hint">
          <Printer className="h-3.5 w-3.5" aria-hidden /> {busy ? "Building the base and lid" : "Send to printing"}
        </Button>
        <span id="send-to-printing-hint" className="text-xs text-muted">{disabled ? reason : "Builds the saved choice and stores the base and the lid, turned for printing, as files of this concept."}</span>
      </div>
      {err && <ErrorLine>{err}</ErrorLine>}
      {done && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          Stored {done.files.map((f) => f.name).join(" and ")}.{done.failed ? ` ${done.failed} of the checks failed on this build; read them above before printing.` : ""}{" "}
          <Link className="underline" href="/s/prototype/printing">Open 3D printing</Link> to make a job from them.
        </p>
      )}
    </div>
  );
}
