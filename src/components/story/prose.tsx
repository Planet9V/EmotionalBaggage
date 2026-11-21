"use client";

import Link from "next/link";
import type { Components } from "react-markdown";
import { Markdown } from "@/components/docs/DocBody";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CLAIM_BASIS_LABEL, type ClaimBasis, type StoryClaim, type StoryExample } from "@/lib/story/parts";
import type { Item } from "@/lib/types";

/** The story's Markdown at reading size: larger type, longer line height, the same renderer as the documentation. */
const READING: Components = {
  p: ({ children }) => <p className="mt-4 text-[15px] leading-7 text-primary/90">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-primary/90 marker:text-dutchOrange">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-primary/90">{children}</ol>,
  h3: ({ children }) => <h3 className="mt-6 text-base font-semibold text-primary">{children}</h3>,
  table: ({ children }) => (
    <div className="mt-5 overflow-x-auto rounded-xl border border-hairline">
      <table className="w-full min-w-[32rem] text-left text-sm">{children}</table>
    </div>
  ),
  blockquote: ({ children }) => <blockquote className="mt-4 border-l-2 border-dutchOrange pl-4 italic [&_p]:mt-1">{children}</blockquote>,
};

export function StoryProse({ markdown }: { markdown: string }) {
  return (
    <div className="story-prose">
      <Markdown markdown={markdown} overrides={READING} />
    </div>
  );
}

/** The one-line position, set apart from the text. */
export function PullOut({ text, label = "The one-line position" }: { text: string; label?: string }) {
  return (
    <figure className="my-6 border-l-4 border-dutchOrange py-1 pl-5">
      <blockquote className="text-xl font-semibold leading-snug tracking-tight text-primary sm:text-2xl">{text}</blockquote>
      <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-link">{label}</figcaption>
    </figure>
  );
}

/** Lines the product says, set as examples. */
export function Examples({ examples, headingId }: { examples: StoryExample[]; headingId: string }) {
  if (!examples.length) return null;
  return (
    <div className="mt-6">
      <h3 id={headingId} className="text-base font-semibold text-primary">In its own words</h3>
      <ul aria-labelledby={headingId} className="mt-3 grid gap-3 sm:grid-cols-2">
        {examples.map((e, i) => (
          <li key={i} className="break-inside-avoid">
            <figure className="h-full rounded-xl border border-hairline bg-surface p-4">
              <blockquote className="text-[15px] font-medium leading-snug text-primary">&ldquo;{e.text}&rdquo;</blockquote>
              {e.context && <figcaption className="mt-2 text-xs text-muted">{e.context}</figcaption>}
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}

const BASIS_TONE: Record<ClaimBasis, "success" | "info" | "warning"> = { measured: "success", sourced: "info", assumption: "warning" };

/** The claims of "Why it should work", each with how it is known and where it comes from. */
export function Claims({ claims, sources, headingId }: { claims: StoryClaim[]; sources: Map<number, Item>; headingId: string }) {
  if (!claims.length) return null;
  return (
    <div className="mt-6">
      <h3 id={headingId} className="text-base font-semibold text-primary">The claims, and how each is known</h3>
      <ul aria-labelledby={headingId} className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
        {claims.map((c, i) => (
          <li key={i} className="break-inside-avoid px-4 py-3">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <StatusBadge tone={BASIS_TONE[c.basis]} className="mt-0.5 shrink-0">{CLAIM_BASIS_LABEL[c.basis]}</StatusBadge>
              <p className="min-w-0 flex-1 text-[15px] leading-6 text-primary">{c.text}</p>
            </div>
            {(c.note || c.sourceIds?.length) && (
              <p className="mt-1.5 text-xs text-muted">
                {c.note}
                {c.sourceIds?.length ? <>{c.note ? " From " : "From "}<SourceLinks ids={c.sourceIds} sources={sources} /></> : null}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "a.pdf, b.md": links to the files in Files; ids no longer there are left out. */
export function SourceLinks({ ids, sources }: { ids: number[]; sources: Map<number, Item> }) {
  const known = ids.filter((id) => sources.has(id));
  if (!known.length) return <span>files that were removed</span>;
  return (
    <>
      {known.map((id, i) => (
        <span key={id}>
          {i > 0 && (i === known.length - 1 ? " and " : ", ")}
          <Link href={`/files#file-${id}`} className="text-link underline-offset-2 hover:underline">{sources.get(id)!.title}</Link>
        </span>
      ))}
    </>
  );
}
