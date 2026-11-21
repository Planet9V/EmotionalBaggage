"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { History, Pencil, Printer, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, LoadError, LoadingBlocks, NoConcept } from "@/components/ui/states";
import { DraftButton } from "@/components/drafts/DraftButton";
import { DraftPanel } from "@/components/drafts/DraftPanel";
import { draftQueries } from "@/components/drafts/api";
import { HistoryPanel } from "@/components/trace/HistoryPanel";
import { useItems, useProject } from "@/lib/client";
import { CLOSED } from "@/lib/menu";
import { statusTone } from "@/lib/statusTones";
import { SOURCES_STORE, STORY_PARTS, STORY_STORE, type StoryClaim, type StoryExample, type StoryPart } from "@/lib/story/parts";
import type { Item, Project } from "@/lib/types";
import { Claims, Examples, PullOut, SourceLinks, StoryProse } from "./prose";
import { StoryEditor } from "./StoryEditor";

const PRINT_CSS = `
@media print {
  @page { margin: 16mm; }
  html, body, .bg-canvas { background: #fff !important; }
  .story-doc, .story-doc * { color: #000 !important; box-shadow: none !important; }
  .story-doc figure, .story-doc li { break-inside: avoid; }
  .story-doc h2 { break-after: avoid; }
  .story-doc .story-grid { display: block !important; }
}
`;

export function StoryView() {
  const { project, loading } = useProject();
  if (!project) {
    return (
      <>
        <PageHeader eyebrow="Whole concept" title="Concept story" />
        <NoConcept loading={loading} />
      </>
    );
  }
  return <StoryBody key={project.id} project={project} />;
}

function StoryBody({ project }: { project: Project }) {
  const story = useItems(project.id, STORY_STORE);
  const sources = useItems(project.id, SOURCES_STORE);
  const questions = useItems(project.id, "concept/questions");
  const decisions = useItems(project.id, "concept/decisions");
  const byPart = useMemo(() => new Map(story.items.map((i) => [String(i.data.part), i])), [story.items]);
  const sourceMap = useMemo(() => new Map(sources.items.map((s) => [s.id, s])), [sources.items]);
  const written = STORY_PARTS.filter((p) => byPart.has(p.key)).length;

  return (
    <div className="story-doc">
      <style>{PRINT_CSS}</style>
      <PageHeader eyebrow={`Whole concept · ${project.name}`} title="Concept story" blurb="The concept told in full, for anyone meeting it for the first time: the idea, where it came from, why it should work, and what it costs to find out.">
        <DraftButton projectId={project.id} store={STORY_STORE} sectionLabel="Concept story" />
        <Button variant="outline" size="sm" onClick={() => window.print()} disabled={story.loading}>
          <Printer className="h-3.5 w-3.5" aria-hidden /> Print
        </Button>
      </PageHeader>

      <div className="px-5 py-8 sm:px-8">
        {story.loading ? (
          <LoadingBlocks rows={4} label="Loading the story" />
        ) : story.error ? (
          <LoadError what="The story" message={story.error} onRetry={() => void story.reload()} />
        ) : (
          <div className="story-grid mx-auto grid max-w-6xl gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
            <nav aria-label="Story contents" className="no-print self-start lg:sticky lg:top-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Contents</p>
              <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] lg:block lg:space-y-1.5">
                {STORY_PARTS.map((p) => (
                  <li key={p.key}>
                    <a href={`#story-${p.key}`} className={`hover:text-link ${byPart.has(p.key) ? "text-secondary" : "text-muted"}`}>
                      {p.heading}
                    </a>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-muted">{written} of {STORY_PARTS.length} parts written.</p>
            </nav>

            <article aria-label="Concept story" className="min-w-0 max-w-[68ch]">
              {project.oneLiner && <p className="text-lg leading-8 text-secondary">{project.oneLiner}</p>}
              {story.writeError && <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">The last change was not saved: {story.writeError}</p>}
              {!sources.loading && !sources.error && sources.items.length === 0 && (
                <div className="no-print mt-6 rounded-xl border border-dashed border-hairline px-4 py-4 text-sm text-secondary">
                  <p>
                    <span className="font-semibold text-primary">No files yet.</span> Add the documents, notes and chats this concept came from on the{" "}
                    <Link href="/files#add-file" className="text-link underline-offset-2 hover:underline">Files</Link> page. The story is written from them, and chat can quote them.
                  </p>
                </div>
              )}
              {written === 0 && (
                <div className="no-print mt-6">
                  <EmptyState title="The story is not written yet">
                    Each part below says what it covers. Write a part yourself, or use Draft with AI to draft every part from the sources and the brief, then approve what reads right.
                  </EmptyState>
                </div>
              )}
              {STORY_PARTS.map((p) => (
                <PartSection
                  key={p.key}
                  project={project}
                  part={p}
                  item={byPart.get(p.key)}
                  sources={sources.items}
                  sourceMap={sourceMap}
                  add={story.add}
                  patch={story.patch}
                  open={p.key === "open" ? { questions: questions.items, decisions: decisions.items, loading: questions.loading || decisions.loading } : undefined}
                />
              ))}
            </article>
          </div>
        )}
      </div>
    </div>
  );
}

type OpenLists = { questions: Item[]; decisions: Item[]; loading: boolean };

function PartSection({
  project,
  part,
  item,
  sources,
  sourceMap,
  add,
  patch,
  open,
}: {
  project: Project;
  part: StoryPart;
  item: Item | undefined;
  sources: Item[];
  sourceMap: Map<number, Item>;
  add: ReturnType<typeof useItems>["add"];
  patch: ReturnType<typeof useItems>["patch"];
  open?: OpenLists;
}) {
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const hid = `story-${part.key}-h`;
  const data = (item?.data ?? {}) as { position?: string; examples?: StoryExample[]; claims?: StoryClaim[]; sourceIds?: number[] };

  return (
    <section id={`story-${part.key}`} aria-labelledby={hid} className="mt-12 scroll-mt-6 first-of-type:mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-hairline pb-2">
        <h2 id={hid} className="text-xl font-semibold tracking-tight text-primary">{part.heading}</h2>
        <div className="no-print flex flex-wrap items-center gap-1.5">
          {item && <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>}
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`${item ? "Edit" : "Write"} ${part.heading}`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> {item ? "Edit" : "Write"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDrafting(true)} aria-label={`Draft ${part.heading} with AI`}>
            <Sparkles className="h-3.5 w-3.5 text-link" aria-hidden /> Draft
          </Button>
          {item && (
            <Button variant="ghost" size="sm" onClick={() => setHistory(true)} aria-label={`History of ${part.heading}`}>
              <History className="h-3.5 w-3.5" aria-hidden /> History
            </Button>
          )}
        </div>
      </div>

      {!item ? (
        <p className="mt-4 rounded-xl border border-dashed border-hairline px-4 py-4 text-sm text-muted">Not written yet. {part.covers}</p>
      ) : (
        <>
          {part.key === "positioning" && data.position && <PullOut text={data.position} />}
          {item.body.trim() ? <StoryProse markdown={item.body} /> : <p className="mt-4 text-sm text-muted">This part has no text yet.</p>}
          {part.key === "voice" && <Examples examples={data.examples ?? []} headingId={`${hid}-examples`} />}
          {part.key === "why" && <Claims claims={data.claims ?? []} sources={sourceMap} headingId={`${hid}-claims`} />}
          {data.sourceIds?.length ? (
            <p className="mt-5 text-xs text-muted">
              Written from <SourceLinks ids={data.sourceIds} sources={sourceMap} />.
            </p>
          ) : null}
        </>
      )}

      {open && <OpenNow lists={open} />}

      {editing && <StoryEditor part={part} item={item} sources={sources} open={editing} onOpenChange={setEditing} add={add} patch={patch} />}
      {history && item && (
        <Modal open={history} onOpenChange={setHistory} title={`History: ${part.heading}`} description="Every change to this part, newest first, with who made it and why." wide>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
            <HistoryPanel item={item} onRestore={(id, change) => patch(id, change)} />
          </div>
        </Modal>
      )}
      {drafting && <PartDraft projectId={project.id} part={part} open={drafting} onOpenChange={setDrafting} />}
    </section>
  );
}

/** The live state of the Open questions and Decision tree sections, under "Decided and still open". */
function OpenNow({ lists }: { lists: OpenLists }) {
  if (lists.loading) return <LoadingBlocks rows={2} label="Loading questions and decisions" />;
  const questions = lists.questions.filter((q) => !CLOSED.has(q.status));
  const decisions = lists.decisions.filter((d) => !CLOSED.has(d.status));
  const row = (i: Item, href: string) => (
    <li key={i.id} className="flex items-start gap-2 py-1.5 text-sm">
      <StatusBadge tone={statusTone(i.status)} className="mt-0.5 shrink-0 px-2! py-0! text-[10px]!">{i.status}</StatusBadge>
      <Link href={href} className="min-w-0 text-primary hover:text-link">{i.title}</Link>
    </li>
  );
  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-primary">Open questions now</h3>
        {questions.length ? <ul className="mt-1">{questions.map((q) => row(q, `/s/concept/questions?item=${q.id}`))}</ul> : <p className="mt-1 text-sm text-muted">None open. Questions added in <Link href="/s/concept/questions" className="text-link hover:underline">Open questions</Link> show here.</p>}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-primary">Decisions still to make</h3>
        {decisions.length ? <ul className="mt-1">{decisions.map((d) => row(d, "/s/concept/decisions"))}</ul> : <p className="mt-1 text-sm text-muted">None open. Decisions in the <Link href="/s/concept/decisions" className="text-link hover:underline">Decision tree</Link> show here until they are decided.</p>}
      </div>
    </div>
  );
}

/** Draft with AI for one part: the same panel as the page's button, asking for this part only. */
function PartDraft({ projectId, part, open, onOpenChange }: { projectId: string; part: StoryPart; open: boolean; onOpenChange: (o: boolean) => void }) {
  const gens = useQuery(draftQueries.generators(projectId, STORY_STORE));
  if (gens.isPending) return null;
  if (gens.error || !gens.data?.generators.length) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={`Draft ${part.heading}`}>
        <p role="alert" className="px-5 py-4 text-sm text-danger">Drafting is not available here: {gens.error ? (gens.error as Error).message : "no generator writes the story."}</p>
      </Modal>
    );
  }
  return (
    <DraftPanel
      open={open}
      onOpenChange={onOpenChange}
      projectId={projectId}
      store={STORY_STORE}
      sectionLabel={`Concept story · ${part.heading}`}
      generators={gens.data.generators}
      configured={gens.data.configured}
      reason={gens.data.reason}
      model={gens.data.model}
      params={{ part: part.key }}
    />
  );
}
