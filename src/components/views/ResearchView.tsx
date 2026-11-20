"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import { api, useItems } from "@/lib/client";
import { selectClass } from "@/components/wizard/fields";
import { NotConnected, hostname, stamp } from "@/components/wizard/shared";
import type { ViewProps } from "./types";

type Entry = { id: number; query: string; answer: string; citations: string[]; model: string; createdAt: string };
type Resp = { configured: boolean; model: string; entries: Entry[] };

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};

export function ResearchView({ project }: ViewProps) {
  const reduce = useReducedMotion();
  const [state, setState] = useState<Resp | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLInputElement>(null);
  const claims = useItems(project.id, "research/claims");

  const fetchState = useCallback(() => api<Resp>(`/api/research?projectId=${encodeURIComponent(project.id)}`), [project.id]);
  useEffect(() => {
    let live = true;
    fetchState().then((r) => { if (live) setState(r); }).catch((e: Error) => { if (live) setLoadError(e.message); });
    return () => { live = false; };
  }, [fetchState]);

  const ask = async () => {
    const q = query.trim();
    if (!q || pending) return;
    setPending(true);
    setError("");
    try {
      await api("/api/research", { method: "POST", body: JSON.stringify({ projectId: project.id, query: q }) });
      setState(await fetchState());
      setQuery("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  if (loadError && !state) return <p role="alert" className="text-sm text-danger">{loadError}</p>;
  if (!state) return <p className="text-sm text-secondary">Loading.</p>;

  const on = state.configured;
  const unverified = claims.items.filter((c) => c.status === "unverified");

  return (
    <div className="max-w-4xl space-y-6">
      {!on && (
        <NotConnected
          title="Research is not connected"
          does="Ask a question and Perplexity searches the web, answers with sources, and the answer is saved here with its citations. You can then turn a result into a claim or mark an existing claim verified."
          envVar="PERPLEXITY_API_KEY"
        />
      )}

      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
        <label htmlFor="rq" className="text-sm font-medium text-primary">Question</label>
        <div className="flex gap-2">
          <Input id="rq" ref={box} value={query} disabled={!on || pending} placeholder={on ? "Ask something the plan depends on" : "Connect Perplexity to ask"} onChange={(e) => setQuery(e.target.value)} />
          <Button type="submit" disabled={!on || pending || !query.trim()}>
            <Search className="h-4 w-4" aria-hidden /> {pending ? "Searching" : "Ask"}
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
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
            <motion.li key={e.id} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
              <EntryCard entry={e} claims={claims} />
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Answer({ text, citations }: { text: string; citations: string[] }) {
  const paras = text.split(/\n+/).filter((p) => p.trim());
  return (
    <div className="space-y-3 text-sm leading-relaxed text-primary">
      {paras.map((p, i) => (
        <p key={i}>
          {p.split(/(\[\d+\])/g).map((part, j) => {
            const m = /^\[(\d+)\]$/.exec(part);
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

function EntryCard({ entry, claims }: { entry: Entry; claims: ReturnType<typeof useItems> }) {
  const [adding, setAdding] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

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

  const verify = async () => {
    const c = claims.items.find((x) => String(x.id) === pick);
    if (!c) return;
    setErr("");
    const urls = entry.citations.join("\n");
    const body = [c.body, `Verified by Perplexity, ${day(entry.createdAt)}. Sources:\n${urls}`].filter(Boolean).join("\n\n");
    try {
      await claims.patch(c.id, { status: "verified", body });
      setPick("");
      setNote(`Marked verified: ${c.title}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const open = claims.items.filter((c) => c.status !== "verified");

  return (
    <Card hoverEffect={false} innerClassName="p-[22px]">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold tracking-tight text-primary">{entry.query}</h3>
        <span className="shrink-0 font-mono text-[10px] text-muted">{stamp(entry.createdAt)} · {entry.model}</span>
      </div>
      <div className="mt-3"><Answer text={entry.answer} citations={entry.citations} /></div>

      {entry.citations.length > 0 ? (
        <ol className="mt-4 space-y-1 border-t border-hairline pt-3">
          {entry.citations.map((u, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className="font-mono text-muted">[{i + 1}]</span>
              <span className="min-w-0">
                <span className="text-primary">{hostname(u)}</span>{" "}
                <a href={u} target="_blank" rel="noopener noreferrer" className="break-all text-link hover:underline">{u}</a>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 border-t border-hairline pt-3 text-xs text-muted">This answer came back without citations.</p>
      )}

      <div className="mt-4 space-y-3 border-t border-hairline pt-3">
        {adding === null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setAdding(entry.query)}>Add as claim</Button>
            <select aria-label="Claim to mark verified" className={`${selectClass} h-8 w-auto max-w-xs text-xs`} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">{open.length ? "Pick a claim" : "No claims to verify"}</option>
              {open.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={!pick || entry.citations.length === 0} onClick={() => void verify()}>Mark claim verified</Button>
            {entry.citations.length === 0 && <span className="text-xs text-muted">No citations to attach.</span>}
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
