"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Copy, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorLine, Field, Select, Textarea } from "@/components/parts/controls";
import { Modal } from "@/components/parts/Modal";
import { api, useItems } from "@/lib/client";
import { statusTone } from "@/lib/statusTones";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ViewProps } from "./types";

type Integration = { key: string; name: string; configured: boolean; built: "yes" | "partial" | "no" };

const CHANNELS = ["X", "Instagram", "TikTok", "other"];
const X_LIMIT = 280;
const FALLBACK = ["draft", "approved", "posted"];
const len = (s: string) => Array.from(s).length;
const channelOf = (it: Item) => (typeof it.data.channel === "string" && it.data.channel ? it.data.channel : "other");
const firstLine = (t: string) => {
  const l = t.trim().split("\n")[0];
  return l.length > 60 ? `${l.slice(0, 57)}...` : l;
};

export function SocialView({ project, section, store }: ViewProps) {
  const { items, loading, error, add, patch, remove } = useItems(project.id, store);
  const reduce = useReducedMotion();
  const columns = section.statuses?.length ? section.statuses : FALLBACK;
  const [integ, setInteg] = useState<Integration[]>([]);
  const [integError, setIntegError] = useState("");
  const [compose, setCompose] = useState<{ item: Item | null } | null>(null);
  const [del, setDel] = useState<Item | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const dragged = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ integrations: Integration[] }>("/api/integrations")
      .then((r) => { if (alive) setInteg(r.integrations.filter((i) => i.key === "x" || i.key === "instagram")); })
      .catch((e: Error) => { if (alive) setIntegError(e.message); });
    return () => { alive = false; };
  }, []);

  const move = (it: Item, status: string) => {
    if (it.status !== status) void patch(it.id, { status });
  };
  const copy = async (it: Item) => {
    try {
      await navigator.clipboard.writeText(it.body);
      setCopied(it.id);
      setTimeout(() => setCopied((c) => (c === it.id ? null : c)), 1800);
    } catch {
      setActionError("The browser blocked copying. Select the text and copy it by hand.");
    }
  };

  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-5">
      <section aria-label="Connections" className="rounded-xl border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {integ.map((i) => (
            <span key={i.key} className="flex items-center gap-2 text-sm text-primary">
              {i.name}
              <StatusBadge tone={i.configured ? "info" : "neutral"}>{i.configured ? "Credentials present" : "Not connected"}</StatusBadge>
            </span>
          ))}
          {integError ? <span className="text-sm text-danger">{integError}</span> : null}
        </div>
        <p className="mt-2 text-sm text-secondary">
          Posting and reading replies are not built yet, so this app cannot post for you. Copy an approved post, publish it yourself, then move it to posted by hand.
        </p>
      </section>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Drag a post to another column, or use the buttons on the post.</p>
        <Button onClick={() => setCompose({ item: null })}><Plus className="h-4 w-4" aria-hidden /> {section.addLabel ?? "Add draft post"}</Button>
      </div>
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      {actionError ? <ErrorLine>{actionError}</ErrorLine> : null}

      {loading ? (
        <p className="text-sm text-secondary">Loading the posts.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {columns.map((col, ci) => {
            const posts = items.filter((i) => i.status === col);
            return (
              <section
                key={col}
                aria-label={`${col}, ${posts.length} posts`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== col) setOver(col); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = Number(e.dataTransfer.getData("text/plain")) || dragged.current;
                  dragged.current = null;
                  const it = items.find((x) => x.id === id);
                  if (it) move(it, col);
                }}
                className={cn("flex min-h-[12rem] flex-col rounded-xl border border-hairline bg-subtle transition-shadow", over === col && "ring-2 ring-dutchOrange")}
              >
                <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
                  <StatusBadge tone={statusTone(col)}>{col}</StatusBadge>
                  <span className="font-mono text-xs text-muted">{posts.length}</span>
                </div>
                <ul className="flex-1 space-y-2 p-2">
                  {posts.length === 0 && <li className="px-1 py-3 text-xs text-muted">Nothing here.</li>}
                  {posts.map((p) => {
                    const ch = channelOf(p);
                    const n = len(p.body);
                    return (
                      <li
                        key={p.id}
                        draggable
                        onDragStart={(e) => { dragged.current = p.id; e.dataTransfer.setData("text/plain", String(p.id)); e.dataTransfer.effectAllowed = "move"; }}
                        className="rounded-xl border border-hairline bg-surface p-3"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                            <GripVertical className="h-3.5 w-3.5" aria-hidden /> {ch}
                          </span>
                          {ch === "X" && (
                            <span className={cn("font-mono text-[11px]", n > X_LIMIT ? "text-danger" : "text-muted")} aria-label={`${n} of ${X_LIMIT} characters`}>{n}/{X_LIMIT}</span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm text-primary">{p.body || p.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {ci > 0 && (
                            <Button size="chip" variant="outline" onClick={() => move(p, columns[ci - 1])} aria-label={`Move to ${columns[ci - 1]}`}>
                              <ArrowLeft className="h-3 w-3" aria-hidden /> {columns[ci - 1]}
                            </Button>
                          )}
                          {ci < columns.length - 1 && (
                            <Button size="chip" variant="outline" onClick={() => move(p, columns[ci + 1])} aria-label={`Move to ${columns[ci + 1]}`}>
                              {columns[ci + 1] === "posted" ? "Mark as posted" : columns[ci + 1]} <ArrowRight className="h-3 w-3" aria-hidden />
                            </Button>
                          )}
                          {col === "approved" && (
                            <Button size="chip" variant="subtle" onClick={() => void copy(p)}>
                              {copied === p.id ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />} {copied === p.id ? "Copied" : "Copy"}
                            </Button>
                          )}
                          <span className="ml-auto flex">
                            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit post" onClick={() => setCompose({ item: p })}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Delete post" onClick={() => setDel(p)}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {!loading && items.some((i) => !columns.includes(i.status)) && (
        <p className="text-xs text-warning">Some posts have a status that is not a column here, so they are not shown.</p>
      )}

      {compose && (
        <ComposeDialog
          key={compose.item?.id ?? "new"}
          item={compose.item}
          onClose={() => setCompose(null)}
          onSave={async (v) => {
            if (compose.item) await patch(compose.item.id, { title: firstLine(v.text), body: v.text, data: { channel: v.channel } });
            else await add({ section: store, title: firstLine(v.text), body: v.text, status: columns[0], data: { channel: v.channel } });
          }}
        />
      )}
      <Modal open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this post?" description="This cannot be undone. A post you already published stays published.">
        <p className="line-clamp-3 text-sm text-primary">{del?.body || del?.title}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDel(null)}>Keep it</Button>
          <Button onClick={async () => {
            if (!del) return;
            try { setActionError(""); await remove(del.id); } catch (e) { setActionError((e as Error).message); }
            setDel(null);
          }}>Delete post</Button>
        </div>
      </Modal>
    </motion.div>
  );
}

function ComposeDialog({ item, onClose, onSave }: { item: Item | null; onClose: () => void; onSave: (v: { text: string; channel: string }) => Promise<void> }) {
  const [text, setText] = useState(item?.body ?? "");
  const [channel, setChannel] = useState(item ? channelOf(item) : "X");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const n = len(text);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return setErr("Write the post first.");
    setBusy(true);
    try {
      await onSave({ text, channel });
      onClose();
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={item ? "Edit post" : "New draft post"}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Channel">
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        </Field>
        <Field label="Post text">
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </Field>
        {channel === "X" && (
          <p className={cn("font-mono text-xs", n > X_LIMIT ? "text-danger" : "text-muted")} aria-live="polite">
            {n}/{X_LIMIT} characters{n > X_LIMIT ? `, ${n - X_LIMIT} over the limit` : ""}
          </p>
        )}
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving" : item ? "Save post" : "Save draft"}</Button>
        </div>
      </form>
    </Modal>
  );
}
