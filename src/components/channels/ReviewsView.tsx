"use client";

// Sales, Reviews and questions (plan 8.20): a log typed by hand, pasted or imported from CSV; topic and
// sentiment set by the user or suggested as drafts (Draft with AI, above); drafted replies; and "what
// customers keep asking", counted from the rows, with "Turn into a requirement".
import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DraftButton } from "@/components/drafts/DraftButton";
import type { ViewProps } from "@/components/views/types";
import { useItems } from "@/lib/client";
import { channelQueries, useChannelActions } from "@/lib/channels/client";
import { CHANNEL, SENTIMENTS } from "@/lib/channels/schemas";
import type { Group } from "@/lib/channels/reviews";
import { messageOf } from "@/lib/queries";
import { statusTone } from "@/lib/statusTones";
import type { Item } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

export function ReviewsView({ project, section, store }: ViewProps) {
  const { items, loading, error, writeError, add, patch, reload } = useItems(project.id, store);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toReq, setToReq] = useState<Group | null>(null);
  const [actionError, setActionError] = useState("");
  const statuses = section.statuses ?? ["new", "answered", "no reply needed"];
  const sorted = useMemo(() => [...items].sort((a, b) => String(b.data.date ?? "").localeCompare(String(a.data.date ?? "")) || b.id - a.id), [items]);
  const save = (it: Item, data: Record<string, unknown>) => void patch(it.id, { data: { ...it.data, ...data } }).catch((e) => setActionError((e as Error).message));

  return (
    <div className="animate-enter space-y-8">
      <section aria-labelledby="log-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="log-h" className="text-base font-semibold tracking-tight text-primary">The log</h2>
            <p className="max-w-3xl text-sm text-secondary">
              Amazon does not give sellers their reviews through its API (SP-API has review topics for brand owners, not the reviews), so reviews are typed, pasted or imported here from a file you export.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}><Upload className="h-4 w-4" aria-hidden /> Paste or import CSV</Button>
            <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> {section.addLabel ?? "Add"}</Button>
          </div>
        </div>
        {error ? <LoadError what="The log" message={error} onRetry={() => reload()} /> : null}
        {actionError || writeError ? <ErrorLine>{actionError || writeError}</ErrorLine> : null}
        {loading ? (
          <LoadingBlocks rows={2} label="Loading the log" />
        ) : sorted.length === 0 ? (
          <EmptyState title="No reviews or questions yet">Add one by hand, or paste a few, or import a CSV with a column for the text.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {sorted.map((r) => (
              <Card as="li" variant="flat" key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="neutral">{r.data.kind === "question" ? "question" : "review"}</StatusBadge>
                    {typeof r.data.rating === "number" ? <span className="font-mono text-primary"><span aria-hidden>{r.data.rating}/5</span><span className="sr-only">{`${r.data.rating} of 5 stars`}</span></span> : null}
                    {r.data.source ? <span className="text-secondary">{String(r.data.source)}</span> : null}
                    {r.data.date ? <span className="font-mono text-muted">{String(r.data.date)}</span> : null}
                    {r.data.productVersion ? <span className="text-muted">version {String(r.data.productVersion)}</span> : null}
                    <StatusBadge tone={statusTone(r.status === "answered" ? "done" : r.status)}>{r.status}</StatusBadge>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`topic-${r.id}`}>Topic</label>
                    <Input id={`topic-${r.id}`} defaultValue={String(r.data.topic ?? "")} placeholder="Topic" className="h-8 w-36 text-xs" onBlur={(e) => e.target.value.trim() !== String(r.data.topic ?? "") && save(r, { topic: e.target.value.trim().slice(0, 80) })} />
                    <label className="sr-only" htmlFor={`sent-${r.id}`}>Sentiment</label>
                    <NativeSelect id={`sent-${r.id}`} value={String(r.data.sentiment ?? "")} className="h-8 w-32 text-xs" onChange={(e) => save(r, { sentiment: e.target.value })}>
                      <option value="">sentiment</option>
                      {SENTIMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </NativeSelect>
                    <label className="sr-only" htmlFor={`st-${r.id}`}>Status</label>
                    <NativeSelect id={`st-${r.id}`} value={r.status} className="h-8 w-36 text-xs" onChange={(e) => void patch(r.id, { status: e.target.value }).catch((x) => setActionError((x as Error).message))}>
                      {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </NativeSelect>
                  </span>
                </div>
                {r.title && r.title !== r.body.split("\n")[0].slice(0, 120) ? <p className="mt-2 text-sm font-medium text-primary">{r.title}</p> : null}
                <p className="mt-1 whitespace-pre-wrap text-sm text-primary wrap-anywhere">{r.body}</p>
              </Card>
            ))}
          </ul>
        )}
      </section>

      <Card variant="flat" as="section" aria-labelledby="reply-h" className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <h2 id="reply-h" className="text-base font-semibold tracking-tight text-primary">Replies</h2>
          <p className="max-w-2xl text-sm text-secondary">
            Drafted in the brand voice for the new rows. Approved replies wait in <Link href="/s/marketing/replies" className="text-link underline">Replies to send</Link>; this app never posts a reply to a review for you.
          </p>
        </div>
        <DraftButton projectId={project.id} store={CHANNEL.replies} sectionLabel="Replies to send" />
      </Card>

      <AskedMost projectId={project.id} count={items.length} onTurn={setToReq} />

      {adding ? <AddReview onClose={() => setAdding(false)} onCreate={(v) => add({ section: store, title: v.title, body: v.body, data: v.data }).then(() => undefined)} /> : null}
      {importing ? <ImportDialog projectId={project.id} onClose={() => setImporting(false)} /> : null}
      {toReq ? <RequirementDialog projectId={project.id} group={toReq} onClose={() => setToReq(null)} /> : null}
    </div>
  );
}

function AskedMost({ projectId, count, onTurn }: { projectId: string; count: number; onTurn: (g: Group) => void }) {
  const [mode, setMode] = useState<"auto" | "tags">("auto");
  const groups = useQuery({ ...channelQueries.groups(projectId, mode), enabled: count > 0 });
  const g = groups.data;
  return (
    <section aria-labelledby="ask-h" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="ask-h" className="text-base font-semibold tracking-tight text-primary">What customers keep asking</h2>
          <p className="text-sm text-secondary">Counts of rows in the log, largest group first.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-secondary">
          Group by
          <NativeSelect value={mode} onChange={(e) => setMode(e.target.value as "auto" | "tags")} className="w-48">
            <option value="auto">meaning, when a model is set</option>
            <option value="tags">my topic tags</option>
          </NativeSelect>
        </label>
      </div>
      {count === 0 ? (
        <EmptyState title="Nothing to group yet">Groups appear once the log has rows.</EmptyState>
      ) : groups.isPending ? (
        <LoadingBlocks rows={2} label="Grouping the rows" />
      ) : groups.isError ? (
        <LoadError what="The groups" message={messageOf(groups.error)} onRetry={() => void groups.refetch()} />
      ) : g ? (
        <>
          <p className="text-xs text-muted">{g.note}{g.method === "tags" && g.untagged ? ` ${g.untagged} of ${g.total} rows have no topic yet and are not in any group.` : ""}</p>
          {g.groups.length === 0 ? (
            <EmptyState title="No groups yet">Set a topic on a few rows, or use Draft with AI above to suggest topics, or choose an embedding model in Admin to group by meaning.</EmptyState>
          ) : (
            <Card variant="flat" className="overflow-hidden">
              <Table>
                <caption className="sr-only">Groups of reviews and questions with their counts</caption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col">Group</TableHead>
                    <TableHead scope="col" className="text-right">Rows</TableHead>
                    <TableHead scope="col" className="text-right">Questions</TableHead>
                    <TableHead scope="col" className="text-right">Average rating</TableHead>
                    <TableHead scope="col">Example</TableHead>
                    <TableHead scope="col"><span className="sr-only">Action</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.groups.map((x) => (
                    <TableRow key={`${x.label}-${x.reviewIds[0]}`} className="align-top">
                      <TableCell className="font-medium text-primary">{x.label}</TableCell>
                      <TableCell className="text-right font-mono">{x.count}</TableCell>
                      <TableCell className="text-right font-mono">{x.questions}</TableCell>
                      <TableCell className="text-right font-mono">{x.averageRating ?? "none"}</TableCell>
                      <TableCell className="max-w-md text-secondary"><span className="line-clamp-2">{x.examples[0]}</span></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => onTurn(x)}><ClipboardList className="h-4 w-4" aria-hidden /> Turn into a requirement</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      ) : null}
    </section>
  );
}

function AddReview({ onClose, onCreate }: { onClose: () => void; onCreate: (v: { title: string; body: string; data: Record<string, unknown> }) => Promise<void> }) {
  const [f, setF] = useState({ kind: "review", text: "", rating: "", source: "", date: today(), productVersion: "", topic: "", sentiment: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.text.trim()) return setErr("Write or paste what the customer said.");
    const rating = f.rating ? Number(f.rating) : null;
    setBusy(true);
    try {
      await onCreate({
        title: f.text.trim().split("\n")[0].slice(0, 120),
        body: f.text.trim(),
        data: { kind: f.kind, rating, source: f.source.trim(), date: f.date, productVersion: f.productVersion.trim(), topic: f.topic.trim(), sentiment: f.sentiment },
      });
      onClose();
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Add a review or question" description="As the customer wrote it. Leave out their name and contact details.">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind"><NativeSelect value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="review">Review</option><option value="question">Question</option></NativeSelect></Field>
          <Field label="Rating (1 to 5)"><NativeSelect value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })}><option value="">none</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</NativeSelect></Field>
          <Field label="Where it was left"><Input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="Amazon, own site, e-mail" /></Field>
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Product version"><Input value={f.productVersion} onChange={(e) => setF({ ...f, productVersion: e.target.value })} /></Field>
          <Field label="Sentiment"><NativeSelect value={f.sentiment} onChange={(e) => setF({ ...f, sentiment: e.target.value })}><option value="">not set</option>{SENTIMENTS.map((s) => <option key={s} value={s}>{s}</option>)}</NativeSelect></Field>
        </div>
        <Field label="Topic"><Input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="battery life" /></Field>
        <Field label="What they wrote"><Textarea rows={5} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} autoFocus /></Field>
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Adding" : "Add"}</Button></div>
      </form>
    </Modal>
  );
}

function ImportDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { importReviews } = useChannelActions(projectId);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [kind, setKind] = useState<"" | "review" | "question">("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ added: number; skipped: number; problems: string[] } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Paste or import reviews and questions" description="A CSV with a header row (a column named text, review, body or question is required), or plain text with a blank line between entries." wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="CSV file">
            <input
              ref={file}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="text-sm text-secondary"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2_000_000) return setErr("That file is over 2 MB. Split it into smaller files.");
                setText(await f.text());
              }}
            />
          </Field>
          <Field label="Where they were left (when the file has no column for it)"><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Amazon" /></Field>
          <Field label="Kind (when the file has no column for it)"><NativeSelect value={kind} onChange={(e) => setKind(e.target.value as "" | "review" | "question")}><option value="">work it out</option><option value="review">reviews</option><option value="question">questions</option></NativeSelect></Field>
        </div>
        <Field label="Or paste here"><Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" /></Field>
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        {result ? (
          <div role="status" className="rounded-md bg-subtle p-3 text-sm text-primary">
            Added {result.added}; {result.skipped} were already in the log.
            {result.problems.length ? <ul className="mt-1 list-disc pl-5 text-xs text-warning">{result.problems.map((p) => <li key={p}>{p}</li>)}</ul> : null}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{result ? "Close" : "Cancel"}</Button>
          <Button
            disabled={!text.trim() || importReviews.isPending}
            onClick={() => {
              setErr("");
              importReviews.mutate({ text, ...(source.trim() ? { source: source.trim() } : {}), ...(kind ? { kind } : {}) }, { onSuccess: (r) => setResult(r), onError: (e) => setErr(messageOf(e)) });
            }}
          >
            {importReviews.isPending ? "Importing" : "Import"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RequirementDialog({ projectId, group, onClose }: { projectId: string; group: Group; onClose: () => void }) {
  const { toRequirement } = useChannelActions(projectId);
  const [title, setTitle] = useState(`Answer what customers ask about ${group.label}`.slice(0, 300));
  const [detail, setDetail] = useState(`${group.count} customer ${group.count === 1 ? "row" : "rows"} (${group.questions} ${group.questions === 1 ? "question" : "questions"}) raised this. Examples:\n${group.examples.map((e) => `- ${e}`).join("\n")}\n\nHow it will be tested: to be confirmed.`);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ key: string } | null>(null);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Turn this group into a requirement" description="It is saved as a draft that cites these rows. Approve it on the Drafts page or in Requirements; nothing changes until you do." wide>
      {done ? (
        <div className="space-y-3 text-sm">
          <p className="text-primary">Saved as a draft requirement, key <span className="font-mono">{done.key}</span>, citing {group.count} rows.</p>
          <div className="flex justify-end gap-2"><Link href="/drafts" className="text-link underline">Open Drafts</Link><Button onClick={onClose}>Close</Button></div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setErr("");
            toRequirement.mutate({ title, detail, reviewIds: group.reviewIds }, { onSuccess: (r) => setDone(r), onError: (x) => setErr(messageOf(x)) });
          }}
        >
          <Field label="Requirement"><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
          <Field label="In full, with how it will be tested"><Textarea rows={8} value={detail} onChange={(e) => setDetail(e.target.value)} /></Field>
          <p className="text-xs text-muted">Cites rows {group.reviewIds.map((i) => `#${i}`).join(", ")}.</p>
          {err ? <ErrorLine>{err}</ErrorLine> : null}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={toRequirement.isPending || !title.trim()}>{toRequirement.isPending ? "Saving" : "Save as a draft requirement"}</Button></div>
        </form>
      )}
    </Modal>
  );
}
