"use client";

// Pieces every channel screen shares: the "not yet run against the real service" line, the X cost
// statement with its acknowledgement, and the one confirmation dialog through which anything is sent.
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorLine } from "@/components/parts/controls";
import { Modal } from "@/components/parts/Modal";
import { channelQueries, useChannelActions, useChannelStatus } from "@/lib/channels/client";
import type { SendKind } from "@/lib/channels/send";
import type { ChannelStatus } from "@/lib/channels/status";
import { messageOf } from "@/lib/queries";

export const CREDENTIALS_HREF = "/admin?tab=credentials";

/** Said plainly on every channel screen. */
export function NotRealNote({ service }: { service: string }) {
  return (
    <p className="text-xs text-muted">
      {service} is built to the service&apos;s own documentation and tested against a stand-in. It has not yet been run against the real service.
    </p>
  );
}

export function NotConnected({ service, what }: { service: string; what: string }) {
  return (
    <p className="text-sm text-secondary">
      {service} is not connected, so {what}. Save its credentials in{" "}
      <Link href={CREDENTIALS_HREF} className="text-link hover:underline">
        Admin, Credentials
      </Link>{" "}
      and press Test connection.
    </p>
  );
}

/** X's pricing, as read, with the date, and the tick that records the user read it. */
export function CostStatement({ projectId, status }: { projectId: string; status: ChannelStatus }) {
  const { ackCost } = useChannelActions(projectId);
  const [ticked, setTicked] = useState(false);
  const [error, setError] = useState("");
  const s = status.x.statement;
  const ack = status.x.acknowledged;
  const id = `x-cost-${projectId}`;
  return (
    <section aria-labelledby={`${id}-h`} className="rounded-xl border border-hairline bg-subtle p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-h`} className="font-semibold text-primary">What X charges</h3>
        <StatusBadge tone={ack ? "success" : "warning"}>{ack ? "Read" : "Not read yet"}</StatusBadge>
      </div>
      <p className="mt-1 text-secondary">
        {s.tier}. Read from{" "}
        <a href={s.url} target="_blank" rel="noreferrer" className="text-link hover:underline">
          X&apos;s pricing page <ExternalLink className="inline h-3 w-3" aria-hidden />
        </a>{" "}
        on <span className="font-mono">{s.read}</span>.
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-secondary">
        {s.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {ack ? (
        <p className="mt-2 text-xs text-muted">
          {ack.by} recorded reading this statement on {new Date(ack.at).toLocaleString()}.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-primary">
            <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="h-4 w-4 accent-[var(--color-dutchOrange)]" />I have read what X charges, as of {s.read}
          </label>
          <Button
            size="sm"
            disabled={!ticked || ackCost.isPending}
            onClick={() => {
              setError("");
              ackCost.mutate(s.version, { onError: (e) => setError(messageOf(e)) });
            }}
          >
            {ackCost.isPending ? "Recording" : "Record that I read it"}
          </Button>
        </div>
      )}
      {error ? <div className="mt-2"><ErrorLine>{error}</ErrorLine></div> : null}
    </section>
  );
}

const WHERE = { x: "X", instagram: "Instagram" } as const;

/**
 * The confirmation for one send. It shows exactly what goes where (the text, the account, the images,
 * the cost), every reason it cannot go yet, and one button. The server checks the same things again,
 * including that the text is the one shown here (by its SHA-256).
 */
export function SendDialog({ projectId, kind, itemId, onClose }: { projectId: string; kind: SendKind; itemId: number; onClose: () => void }) {
  const prev = useQuery(channelQueries.preview(projectId, kind, itemId));
  const status = useChannelStatus(projectId);
  const { send, setImage, resolveSend } = useChannelActions(projectId);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ id: string; url?: string } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [alt, setAlt] = useState<string | null>(null);
  const p = prev.data;
  const where = p ? WHERE[p.channel] : "";

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={p ? `Send this ${kind} to ${where}?` : "Send"} description="Nothing is sent until you press the button at the bottom." wide>
      {prev.isPending ? (
        <div className="space-y-2" aria-label="Reading what would be sent">
          <Skeleton className="h-4 w-1/2 bg-subtle" />
          <Skeleton className="h-20 w-full bg-subtle" />
        </div>
      ) : prev.isError ? (
        <div className="space-y-2">
          <ErrorLine>{messageOf(prev.error)}</ErrorLine>
          <Button variant="outline" size="sm" onClick={() => void prev.refetch()}>Try again</Button>
        </div>
      ) : done ? (
        <div className="space-y-3 text-sm">
          <p className="text-primary">
            Sent to {where}. {where} gave it the id <span className="font-mono">{done.id}</span>.
          </p>
          {done.url ? (
            <a href={done.url} target="_blank" rel="noreferrer" className="text-link hover:underline">Open it on {where}</a>
          ) : null}
          <div className="flex justify-end"><Button onClick={onClose}>Close</Button></div>
        </div>
      ) : p ? (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">Where</dt>
            <dd className="text-primary">{where}{p.account ? `, as ${p.account}` : ""}{p.replyTo ? `, in reply to ${p.replyTo}` : ""}</dd>
            <dt className="text-muted">Status</dt>
            <dd className="text-primary">{p.status}</dd>
            {p.cost ? (
              <>
                <dt className="text-muted">Cost</dt>
                <dd className="text-primary">
                  <span className="font-mono">${p.cost.usd.toFixed(3)}</span> ({p.cost.rule}), per X&apos;s pricing page read on {p.cost.read}
                </dd>
              </>
            ) : null}
          </dl>
          <div>
            <p className="mb-1 text-xs font-medium text-secondary">Text, exactly as it will be sent</p>
            <p className="whitespace-pre-wrap rounded-md border border-hairline bg-surface p-3 text-primary wrap-anywhere">{p.text || "(no text)"}</p>
            <p className="mt-1 font-mono text-[11px] text-muted">{Array.from(p.text).length} characters</p>
          </div>
          {p.media.length ? (
            <div>
              <p className="mb-1 text-xs font-medium text-secondary">Images from Imagery</p>
              <ul className="space-y-0.5">
                {p.media.map((m) => (
                  <li key={m.shotKey} className={m.ok ? "text-primary" : "text-danger"}>{m.shotKey}: {m.ok ? `file #${m.fileId}` : m.problem}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {p.cost && !p.cost.acknowledged && status.data ? <CostStatement projectId={projectId} status={status.data} /> : null}
          {p.channel === "instagram" && kind === "post" ? (
            <div className="space-y-2 rounded-xl border border-hairline bg-subtle p-3">
              <p className="text-secondary">
                Instagram fetches the image itself from a public https address when you publish, and takes JPEG only. This app is behind sign-in, so give the address of a copy you host elsewhere.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-secondary">Public image address (JPEG)</span>
                <Input value={imageUrl ?? p.imageUrl ?? ""} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/images/hero.jpg" spellCheck={false} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-secondary">Alt text (optional)</span>
                <Input value={alt ?? ""} onChange={(e) => setAlt(e.target.value)} placeholder="What the image shows" />
              </label>
              <Button
                size="sm"
                variant="outline"
                disabled={setImage.isPending || (imageUrl === null && alt === null)}
                onClick={() => {
                  setError("");
                  setImage.mutate(
                    { itemId, imageUrl: (imageUrl ?? p.imageUrl ?? "").trim(), ...(alt !== null ? { altText: alt } : {}) },
                    { onSuccess: () => { setImageUrl(null); setAlt(null); void prev.refetch(); }, onError: (e) => setError(messageOf(e)) }
                  );
                }}
              >
                {setImage.isPending ? "Saving" : "Save the address"}
              </Button>
            </div>
          ) : null}
          {p.blocked ? <p role="status" className="rounded-md bg-warning-soft px-3 py-2 text-warning">{p.blocked}</p> : null}
          {p.outcomeUnknown ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-subtle p-3">
              <p className="w-full text-secondary">Open {where} and look for this {kind}. Then record what you found; it is kept in the activity list.</p>
              {(["not-posted", "posted"] as const).map((outcome) => (
                <Button
                  key={outcome}
                  size="sm"
                  variant="outline"
                  disabled={resolveSend.isPending}
                  onClick={() => {
                    setError("");
                    resolveSend.mutate({ kind, itemId, outcome }, { onSuccess: () => void prev.refetch(), onError: (e) => setError(messageOf(e)) });
                  }}
                >
                  {outcome === "posted" ? `It is on ${where}` : `It is not on ${where}`}
                </Button>
              ))}
            </div>
          ) : null}
          {error ? <ErrorLine>{error}</ErrorLine> : null}
          <NotRealNote service={`Sending to ${where}`} />
          <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!p.sendable || send.isPending}
              onClick={() => {
                setError("");
                send.mutate(
                  { kind, itemId, confirm: { channel: p.channel, itemId, textSha256: p.textSha256, ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}) } },
                  { onSuccess: (r) => setDone({ id: r.id, url: r.url }), onError: (e) => { setError(messageOf(e)); void prev.refetch(); } }
                );
              }}
            >
              <Send className="h-4 w-4" aria-hidden /> {send.isPending ? "Sending" : `Send this ${kind} to ${where}`}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
