"use client";

import { Fragment, Suspense, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, useItems } from "@/lib/client";
import { keys, messageOf, queries } from "@/lib/queries";
import { statusTone } from "@/lib/statusTones";
import { hostname, stamp } from "@/components/wizard/shared";
import { ClaimEvidence } from "@/components/research/ClaimEvidence";
import { VERDICT_LABEL, useEvidence } from "@/lib/research/client";
import { VERDICTS, type Verdict } from "@/lib/research/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "./types";
import { FromUrl } from "@/components/drafts/FromUrl";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingBlocks } from "@/components/ui/states";

type Source = { url: string; title?: string; snippet?: string; date?: string };
type Entry = { id: number; query: string; answer: string; citations: string[]; sources?: Source[]; model: string; createdAt: string };
type Resp = { configured: boolean; model: string; entries: Entry[] };
type AskResp = { entry: Entry; attached: { id: number; section: string; title: string } | null; effort: string | null; costUsd: number | null };
type Claims = ReturnType<typeof useItems>;

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};

export function ResearchView({ project }: ViewProps) {
  const qc = useQueryClient();
  const research = useQuery(queries.research(project.id));
  const state: Resp | null = research.data ?? null;
  const loadError = messageOf(research.error);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const box = useRef<HTMLInputElement>(null);
  const claims = useItems(project.id, "research/claims");
  // "Verify this" on a row arrives as ?ask=<the row's text>&claim=<id>: the question is filled in and
  // the claim is chosen in each evidence form.
  const [preferClaim, setPreferClaim] = useState("");
  // The row "Verify this" came from (?item=<id>): the next answer is attached to it, and it says so.
  const [attachTo, setAttachTo] = useState("");
  const [attachedNote, setAttachedNote] = useState("");

  const [cost, setCost] = useState("");
  const askM = useMutation({
    mutationFn: (q: string) =>
      api<AskResp>("/api/research", { method: "POST", body: JSON.stringify({ projectId: project.id, query: q, ...(attachTo ? { itemId: Number(attachTo) } : {}) }) }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.research(project.id) }),
        qc.invalidateQueries({ queryKey: keys.events(project.id) }),
        qc.invalidateQueries({ queryKey: ["items", project.id] }),
      ]),
  });
  const pending = askM.isPending;

  const ask = async () => {
    const q = query.trim();
    if (!q || pending) return;
    setError("");
    setCost("");
    try {
      const r = await askM.mutateAsync(q);
      setQuery("");
      if (r.attached) {
        setAttachTo("");
        setAttachedNote(
          r.attached.section === "research/claims"
            ? `The answer is attached to "${r.attached.title}". The claim stays unverified until you judge a source below: press Use as evidence beside it.`
            : `The answer is attached to "${r.attached.title}" in ${r.attached.section}.`
        );
      } else setAttachedNote("");
      if (typeof r.costUsd === "number") setCost(`Perplexity estimated the cost of that answer at $${r.costUsd.toFixed(4)}${r.effort ? ` (effort ${r.effort})` : ""}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loadError && !state) return <p role="alert" className="text-sm text-danger">{loadError}</p>;
  if (!state) return <LoadingBlocks rows={2} label="Loading" />;

  const on = state.configured;
  const unverified = claims.items.filter((c) => c.status === "unverified");

  return (
    <div className="max-w-4xl space-y-6">
      {!on && (
        <Card hoverEffect={false} innerClassName="p-[26px]" className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Not connected</p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-primary">Research is not connected</h2>
          <p className="mt-2 text-sm text-secondary">
            Ask a question and Perplexity searches the web, answers with sources, and the answer is saved here with its sources.
            You can then use one source as evidence for or against a claim.
          </p>
          <p className="mt-3 text-sm text-secondary">
            Perplexity is not connected. <a href="/admin?tab=credentials" className="text-link hover:underline">Add a key in Admin, Credentials</a>.
          </p>
        </Card>
      )}

      <Suspense fallback={null}>
        <FromUrl names={["ask", "claim", "item"]} onParams={(v) => { if (v.ask) setQuery(v.ask); if (v.claim) setPreferClaim(v.claim); if (v.item) setAttachTo(v.item); box.current?.focus(); }} />
      </Suspense>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
        <label htmlFor="rq" className="text-sm font-medium text-primary">Question</label>
        <div className="flex gap-2">
          <Input id="rq" ref={box} value={query} disabled={!on || pending} placeholder={on ? "Ask something the plan depends on" : "Connect Perplexity to ask"} onChange={(e) => setQuery(e.target.value)} />
          <Button type="submit" disabled={!on || pending || !query.trim()}>
            <Search className="h-4 w-4" aria-hidden /> {pending ? "Searching" : "Ask"}
          </Button>
        </div>
        <p className="text-xs text-muted">
          Each question is billed to your Perplexity account: model tokens plus a fee for each web search
          (Perplexity lists $0.001 per Fast Search, which the default effort uses). Perplexity reports an estimate after the answer. Effort: {state.model}.
        </p>
        {attachTo && !error && <p className="text-xs text-secondary">The answer will be attached to the row you came from. Attaching it does not verify anything.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {attachedNote && !error && <p role="status" className="text-sm text-primary">{attachedNote}</p>}
        {cost && !error && <p className="text-xs text-secondary">{cost}</p>}
        {unverified.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-link">From your unverified claims</p>
            <div className="flex flex-wrap gap-2">
              {unverified.map((c) => (
                <button key={c.id} type="button" disabled={!on || pending}
                  onClick={() => { setQuery(c.title); box.current?.focus(); }}
                  className="max-w-full truncate rounded-full border border-hairline bg-surface px-3 py-1 text-xs text-secondary transition-colors duration-150 hover:border-dutchOrange hover:text-link disabled:opacity-40">
                  Verify: {c.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      {state.entries.length === 0 ? (
        <p className="text-sm text-secondary">{on ? "No research saved yet." : "Saved research appears here once Perplexity is connected."}</p>
      ) : (
        <ul className="space-y-4">
          {state.entries.map((e) => (
            <li className="animate-enter" key={e.id} id={`research-${e.id}`}>
              <EntryCard entry={e} claims={claims} projectId={project.id} preferClaim={preferClaim} />
            </li>
          ))}
        </ul>
      )}

      <ClaimsEvidence claims={claims} projectId={project.id} />
    </div>
  );
}

function Answer({ text, citations }: { text: string; citations: string[] }) {
  const paras = text.split(/\n+/).filter((p) => p.trim());
  return (
    <div className="space-y-3 text-sm leading-relaxed text-primary">
      {paras.map((p, i) => (
        <p key={i}>
          {p.split(/(\[(?:web:)?\d+\])/g).map((part, j) => {
            const m = /^\[(?:web:)?(\d+)\]$/.exec(part);
            const url = m ? citations[Number(m[1]) - 1] : undefined;
            return url ? (
              <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="align-super font-mono text-[10px] text-link hover:underline">{part}</a>
            ) : (
              <Fragment key={j}>{part}</Fragment>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function EntryCard({ entry, claims, projectId, preferClaim = "" }: { entry: Entry; claims: Claims; projectId: string; preferClaim?: string }) {
  const [adding, setAdding] = useState<string | null>(null);
  const [using, setUsing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const sources: Source[] = entry.sources ?? entry.citations.map((url): Source => ({ url }));

  const addClaim = async () => {
    const title = (adding ?? "").trim();
    if (!title) return;
    setErr("");
    try {
      await claims.add({ section: "research/claims", title, data: { source: `Perplexity, ${day(entry.createdAt)}` }, status: "unverified" });
      setAdding(null);
      setNote("Added as an unverified claim.");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <Card hoverEffect={false} innerClassName="p-[22px]">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold tracking-tight text-primary">{entry.query}</h3>
        <span className="shrink-0 font-mono text-[10px] text-muted">{stamp(entry.createdAt)} · {entry.model}</span>
      </div>
      <div className="mt-3"><Answer text={entry.answer} citations={entry.citations} /></div>

      {sources.length > 0 ? (
        <ol className="mt-4 space-y-2 border-t border-hairline pt-3">
          {sources.map((src, i) => (
            <li key={src.url} className="text-xs">
              <div className="flex flex-wrap items-start gap-2">
                <span className="font-mono text-muted">[{i + 1}]</span>
                <SourceLine source={src} />
                <Button size="chip" variant="outline" aria-expanded={using === src.url} onClick={() => { setUsing(using === src.url ? null : src.url); setNote(""); }}>
                  Use as evidence
                </Button>
              </div>
              {using === src.url && (
                <EvidenceForm
                  key={src.url}
                  claims={claims.items}
                  source={src}
                  researchId={entry.id}
                  projectId={projectId}
                  preferClaim={preferClaim}
                  onCancel={() => setUsing(null)}
                  onDone={(msg) => { setUsing(null); setNote(msg); }}
                />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 border-t border-hairline pt-3 text-xs text-muted">This answer came back without sources, so it cannot be used as evidence.</p>
      )}

      <div className="mt-4 space-y-3 border-t border-hairline pt-3">
        {adding === null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setAdding(entry.query)}>Add as claim</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor={`claim-${entry.id}`} className="text-xs font-medium text-primary">Claim title</label>
            <Input id={`claim-${entry.id}`} value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addClaim(); } }} />
            <div className="flex gap-2">
              <Button size="sm" disabled={!adding.trim()} onClick={() => void addClaim()}>Save claim</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {err && <p role="alert" className="text-xs text-danger">{err}</p>}
        {note && !err && <p className="text-xs text-success">{note}</p>}
      </div>
    </Card>
  );
}

/** A source as a reader wants it: the title with the site's name, or the address when there is no title. */
function SourceLine({ source }: { source: Source }) {
  const title = source.title?.trim();
  return (
    <span className="min-w-0 flex-1">
      {title ? (
        <>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:text-link hover:underline">{title}</a>
          <span className="text-muted"> · {hostname(source.url)}{source.date ? ` · ${source.date}` : ""}</span>
        </>
      ) : (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all text-link hover:underline">{source.url}</a>
      )}
      {source.snippet && <span className="mt-0.5 block line-clamp-2 text-secondary">{source.snippet}</span>}
    </span>
  );
}

function EvidenceForm({ claims, source, researchId, projectId, preferClaim = "", onCancel, onDone }: {
  preferClaim?: string;
  claims: Item[];
  source: Source;
  researchId: number;
  projectId: string;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const { add } = useEvidence(projectId);
  const [claimId, setClaimId] = useState(() => (claims.some((c) => String(c.id) === preferClaim) ? preferClaim : ""));
  const [verdict, setVerdict] = useState<Verdict | "">("");
  const [quote, setQuote] = useState("");
  const [err, setErr] = useState("");
  const base = `ev-${researchId}-${encodeURIComponent(source.url)}`;

  const save = async () => {
    const claim = claims.find((c) => String(c.id) === claimId);
    if (!claim || !verdict) return;
    setErr("");
    try {
      const r = await add.mutateAsync({ claimId: claim.id, url: source.url, title: source.title?.trim() || undefined, quote: quote.trim() || undefined, researchId, verdict });
      onDone(`Saved as evidence on "${claim.title}". The claim is now ${r.status}${r.disputed ? " (disputed: sources disagree)" : ""}.`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mt-2 space-y-3 rounded-md border border-hairline p-3">
      <div className="space-y-1">
        <label htmlFor={`${base}-claim`} className="text-xs font-medium text-primary">Claim this source is evidence for</label>
        <NativeSelect id={`${base}-claim`} className="h-8 text-xs" value={claimId} onChange={(e) => setClaimId(e.target.value)}>
          <option value="">{claims.length ? "Pick a claim" : "No claims in this concept yet"}</option>
          {claims.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </NativeSelect>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-primary">What does this source say about the claim?</legend>
        {VERDICTS.map((v) => (
          <label key={v} className="flex items-center gap-2 text-xs text-secondary">
            <input type="radio" name={`${base}-verdict`} value={v} checked={verdict === v} onChange={() => setVerdict(v)} />
            {VERDICT_LABEL[v]}
          </label>
        ))}
      </fieldset>
      <div className="space-y-1">
        <label htmlFor={`${base}-quote`} className="text-xs font-medium text-primary">Quote from the source (optional)</label>
        <Textarea id={`${base}-quote`} rows={2} value={quote} onChange={(e) => setQuote(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!claimId || !verdict || add.isPending} onClick={() => void save()}>{add.isPending ? "Saving" : "Save evidence"}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
    </div>
  );
}

function ClaimsEvidence({ claims, projectId }: { claims: Claims; projectId: string }) {
  if (!claims.items.length) return null;
  return (
    <section aria-labelledby="claims-evidence" className="space-y-3">
      <h2 id="claims-evidence" className="text-base font-semibold tracking-tight text-primary">Claims and their evidence</h2>
      <p className="text-xs text-muted">A claim is verified when at least one source supports it and none contradicts it, and wrong when a source contradicts it and none supports it.</p>
      <ul className="space-y-3">
        {claims.items.map((c) => (
          <li key={c.id} data-claim={c.id}>
            <Card hoverEffect={false} innerClassName="p-[16px]">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-primary">{c.title}</span>
                <StatusBadge tone={statusTone(c.status)}>{c.status}</StatusBadge>
              </div>
              <ClaimEvidence item={c} projectId={projectId} hint={false} />
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
