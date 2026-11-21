"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import { api, useItems } from "@/lib/client";
import { keys, messageOf, queries } from "@/lib/queries";
import type { Item } from "@/lib/types";
import { NotConnected } from "@/components/wizard/shared";
import type { ViewProps } from "./types";
import { storeLink } from "@/lib/menuLookup";
import { Textarea } from "@/components/ui/textarea";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { LoadingBlocks } from "@/components/ui/states";
import { fmtStamp } from "@/lib/format";

type Msg = { id: number | string; role: string; content: string; createdAt?: string; itemId?: number | null; item?: { section: string; title: string } };
type Resp = { configured: boolean; model: string; messages: Msg[] };

const STARTERS = ["Attack the weakest assumption", "What would make this fail in the first 90 days?", "Which claim should I verify first?"];

export function ChallengeView({ project }: ViewProps) {
  const reduce = useReducedMotion();
  const qc = useQueryClient();
  const challengeKey = keys.challenge(project.id);
  const challenge = useQuery(queries.challenge(project.id));
  const state: Resp | null = challenge.data ?? null;
  const loadError = messageOf(challenge.error);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<{ id: number | string; text: string } | null>(null);
  const [saved, setSaved] = useState<Set<number | string>>(new Set());
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const brief = useItems(project.id, "concept/brief");
  const questions = useItems(project.id, "concept/questions");
  const claims = useItems(project.id, "research/claims");

  // The message shows at once; it is taken out again if the request fails, and the thread is refetched after either outcome.
  const sendM = useMutation({
    mutationFn: (message: string) => api<{ reply: string }>("/api/challenge", { method: "POST", body: JSON.stringify({ projectId: project.id, message }) }),
    onMutate: async (message: string) => {
      await qc.cancelQueries({ queryKey: challengeKey });
      const tmp: Msg = { id: `tmp-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() };
      qc.setQueryData<Resp>(challengeKey, (s) => (s ? { ...s, messages: [...s.messages, tmp] } : s));
      return { tmp };
    },
    onError: (_e, _message, ctx) => {
      qc.setQueryData<Resp>(challengeKey, (s) => (s && ctx ? { ...s, messages: s.messages.filter((m) => m.id !== ctx.tmp.id) } : s));
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: challengeKey }), qc.invalidateQueries({ queryKey: keys.events(project.id) })]),
  });
  const pending = sendM.isPending;

  const count = state?.messages.length ?? 0;
  useEffect(() => { end.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" }); }, [count, pending, reduce]);

  const send = async () => {
    const message = text.trim();
    if (!message || pending || !state) return;
    setError("");
    setText("");
    try {
      await sendM.mutateAsync(message);
    } catch (e) {
      setError((e as Error).message);
      setText(message);
    } finally {
      box.current?.focus();
    }
  };

  const saveQuestion = async () => {
    if (!saving) return;
    const t = saving.text.trim();
    if (!t) return;
    const src = state?.messages.find((m) => m.id === saving.id);
    try {
      await questions.add({ section: "concept/questions", title: t.slice(0, 120), body: src?.content ?? "", status: "open" });
      setSaved((s) => new Set(s).add(saving.id));
      setSaving(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loadError && !state) return <p role="alert" className="text-sm text-danger">{loadError}</p>;
  if (!state) return <LoadingBlocks rows={2} label="Loading" />;

  const on = state.configured;
  const unverified = claims.items.filter((c) => c.status === "unverified");
  const openQs = questions.items.filter((q) => q.status === "open");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        {!on && (
          <NotConnected
            title="The AI reviewer is not connected"
            does="The reviewer reads your brief, open questions and unverified claims, then pushes back on the proposition: who buys it, what it replaces, what would make it fail."
            needs="It needs a reasoning model, served by Ollama, LM Studio or OpenRouter. Choose one in Admin, Models."
          />
        )}

        <Card hoverEffect={false} innerClassName="flex min-h-[420px] flex-col">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Reviewer</p>
            <p className="font-mono text-xs text-muted">{state.model}</p>
          </div>

          <div className="max-h-[560px] flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite">
            {state.messages.length === 0 && !pending && (
              <p className="text-sm text-secondary">
                {on ? "No messages yet. Pick a prompt below or write your own." : "No messages. The conversation appears here once the reviewer is connected."}
              </p>
            )}
            {state.messages.map((m) => {
              const mine = m.role === "user";
              return (
                <div className={`animate-enter flex flex-col ${mine ? "items-end" : "items-start"}`} key={m.id}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm ${mine ? "bg-subtle text-primary" : "border border-hairline bg-surface text-primary"}`}>
                    {m.content}
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="font-mono text-[10px] text-muted">{mine ? "You" : "Reviewer"} {fmtStamp(m.createdAt)}</span>
                    {mine && m.item && typeof m.itemId === "number" && (
                      <Link href={`${storeLink(m.item.section)}?item=${m.itemId}`} className="max-w-64 truncate text-xs text-link hover:underline">About: {m.item.title}</Link>
                    )}
                    {!mine && typeof m.id === "number" && (
                      saved.has(m.id) ? (
                        <span className="text-xs text-success">Saved as open question</span>
                      ) : (
                        <button type="button" className="text-xs text-link hover:underline" onClick={() => setSaving({ id: m.id, text: m.content.slice(0, 120) })}>
                          Save as open question
                        </button>
                      )
                    )}
                  </div>
                  {saving?.id === m.id && (
                    <Card variant="well" className="mt-2 w-full max-w-[85%] p-3">
                      <label htmlFor="q-edit" className="text-xs font-medium text-primary">Question (the first 120 characters become the title)</label>
                      <Textarea id="q-edit" rows={3} className="mt-1.5" value={saving.text} onChange={(e) => setSaving({ id: saving.id, text: e.target.value })} />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" disabled={!saving.text.trim()} onClick={() => void saveQuestion()}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setSaving(null)}>Cancel</Button>
                      </div>
                    </Card>
                  )}
                </div>
              );
            })}
            {pending && <p className="text-sm text-muted">The reviewer is thinking.</p>}
            <div ref={end} />
          </div>

          <div className="border-t border-hairline px-5 py-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!on || pending}
                  onClick={() => { setText(s); box.current?.focus(); }}
                  className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs text-secondary transition-colors duration-150 hover:border-dutchOrange hover:text-link disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
            {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
            <div className="flex items-end gap-2">
              <Textarea
                ref={box}
                rows={2}
                aria-label="Message to the reviewer"
                disabled={!on || pending}
                value={text}
                placeholder={on ? "Write a message. Enter sends, Shift+Enter adds a line." : "Connect the reviewer to write here."}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
                }}
              />
              <Button onClick={() => void send()} disabled={!on || pending || !text.trim()} aria-label="Send">
                <Send className="h-4 w-4" aria-hidden /> Send
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <aside className="space-y-4" aria-label="What the reviewer is given">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Given to the reviewer</p>
        <Rail title="Brief" href="/s/concept/brief" items={brief.items} empty="Nothing in the brief yet." />
        <Rail title="Open questions" href="/s/concept/questions" items={openQs} empty="No open questions." />
        <Rail title="Unverified claims" href="/s/research/claims" items={unverified} empty="No unverified claims." />
      </aside>
    </div>
  );
}

function Rail({ title, href, items, empty }: { title: string; href: string; items: Item[]; empty: string }) {
  return (
    <Card variant="flat" as="section" className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-primary">{title} <span className="font-mono text-xs text-muted">{items.length}</span></h3>
        <Link href={href} className="text-xs text-link hover:underline">Open</Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((i) => (
            <li key={i.id} className="text-xs">
              <Link href={href} className="block text-secondary hover:text-primary">
                <span className="line-clamp-2">{i.title}</span>
              </Link>
              {title !== "Brief" && <StatusBadge tone={statusTone(i.status)} className="mt-1">{i.status}</StatusBadge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
