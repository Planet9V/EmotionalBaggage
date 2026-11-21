"use client";

import Link from "next/link";
import { useMemo, type ComponentProps } from "react";
import { BookOpen, ChevronDown, FlaskConical, Rows3 } from "lucide-react";
import { InlineCitation, InlineCitationCard, InlineCitationCardBody, InlineCitationSource } from "@/components/ai-elements/inline-citation";
import { MessageResponse } from "@/components/ai-elements/message";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { linkCitations, sectionHref, sectionLabel, type ChatMetadata, type ChatSource } from "@/lib/chat/shared";

const SEARCH_LABEL: Record<string, string> = {
  hnsw: "HNSW index",
  binary: "binary-quantized index, re-ranked",
  exact: "every vector compared",
  bits: "one-bit copies compared, the best re-ranked",
};

function hrefOf(s: ChatSource) {
  return sectionHref(s.section) ?? "/";
}

function whereOf(s: ChatSource) {
  return s.kind === "research" ? "Saved research answer" : sectionLabel(s.section);
}

/** One answer: its text with [n] turned into citations that open the source's section. */
export function Answer({ text, metadata, streaming }: { text: string; metadata?: ChatMetadata; streaming: boolean }) {
  const sources = useMemo(() => metadata?.sources ?? [], [metadata?.sources]);
  const components = useMemo(
    () => ({
      a: ({ href, children, ...rest }: ComponentProps<"a"> & { node?: unknown }) => {
        // The sanitizer prefixes fragment links with "user-content-" (hast-util-sanitize clobbering).
        const m = /^#(?:user-content-)?source-(\d+)$/.exec(href ?? "");
        const source = m ? sources.find((s) => s.n === Number(m[1])) : undefined;
        if (!source) {
          const { node: _node, ...anchor } = rest;
          void _node;
          return (
            <a href={href} {...anchor} className="text-link underline-offset-4 hover:underline" rel="noreferrer" target="_blank">
              {children}
            </a>
          );
        }
        return <Citation source={source} />;
      },
    }),
    [sources]
  );
  return (
    <div className="space-y-3">
      <MessageResponse className="text-sm leading-relaxed text-primary" components={components} isAnimating={streaming}>
        {linkCitations(text, sources.length)}
      </MessageResponse>
      {!streaming && <SourceList sources={sources} />}
    </div>
  );
}

function Citation({ source }: { source: ChatSource }) {
  return (
    <InlineCitation>
      <InlineCitationCard>
        <HoverCardTrigger asChild>
          <Link
            href={hrefOf(source)}
            aria-label={`Source ${source.n}: ${source.title}, in ${whereOf(source)}`}
            className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-hairline bg-subtle px-1.5 align-text-top font-mono text-[10px] font-medium text-link no-underline transition hover:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
          >
            {source.n}
          </Link>
        </HoverCardTrigger>
        <InlineCitationCardBody className="w-72 p-3">
          <InlineCitationSource>
            <p className="text-sm font-medium leading-snug text-primary">{source.title}</p>
            <p className="text-xs text-muted">
              {whereOf(source)} · source {source.n}
            </p>
          </InlineCitationSource>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}

/** The numbered sources under an answer, each linking to its section. */
function SourceList({ sources }: { sources: ChatSource[] }) {
  if (!sources.length) return <p className="text-xs text-muted">No recorded row or research answer matched this question.</p>;
  return (
    <Sources defaultOpen className="mb-0 text-link">
      <SourcesTrigger count={sources.length} className="rounded-sm text-xs font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
        <BookOpen className="h-3.5 w-3.5" aria-hidden />
        <span>
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </SourcesTrigger>
      <SourcesContent className="w-full">
        <ol className="space-y-1.5">
          {sources.map((s) => (
            <li key={`${s.kind}-${s.id}`}>
              <Source
                href={hrefOf(s)}
                target="_self"
                className="group/source flex items-start gap-2 rounded-md px-1 py-0.5 text-xs text-secondary hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
              >
                <span className="mt-px w-5 shrink-0 text-right font-mono text-[10px] text-link">[{s.n}]</span>
                {s.kind === "research" ? <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden /> : <Rows3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />}
                <span className="min-w-0">
                  <span className="font-medium text-primary group-hover/source:underline">{s.title}</span>
                  <span className="text-muted"> · {whereOf(s)}</span>
                </span>
              </Source>
            </li>
          ))}
        </ol>
      </SourcesContent>
    </Sources>
  );
}

/** Which model answered, and how the sources were found. */
export function AnswerFooter({ metadata }: { metadata?: ChatMetadata }) {
  if (!metadata?.model) return null;
  const how =
    metadata.retrieval === "meaning"
      ? `Sources found by meaning${metadata.search ? ` (${SEARCH_LABEL[metadata.search] ?? metadata.search})` : ""}.`
      : metadata.retrieval === "both"
        ? `Sources found by meaning${metadata.search ? ` (${SEARCH_LABEL[metadata.search] ?? metadata.search})` : ""} and by matching words, joined.`
        : metadata.retrieval === "text"
        ? "Sources found by matching words, not by meaning."
        : "How the sources were found was not recorded for this answer.";
  return (
    <div className="space-y-0.5 text-[11px] text-muted">
      <p>
        Answered by <span className="font-mono">{metadata.model}</span>
        {metadata.provider ? ` on ${metadata.provider}` : ""}. {how}
      </p>
      {metadata.retrieval === "text" && metadata.note && <p>Why: {metadata.note}</p>}
    </div>
  );
}
