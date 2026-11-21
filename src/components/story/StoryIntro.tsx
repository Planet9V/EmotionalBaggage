"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LoadError, LoadingBlocks } from "@/components/ui/states";
import { useItems } from "@/lib/client";
import { plural } from "@/lib/format";
import { SOURCES_STORE, STORY_STORE } from "@/lib/story/parts";
import { PullOut, StoryProse } from "./prose";

/** The first thing a concept's home shows: its pitch and position from the concept story, or how to start the story. */
export function StoryIntro({ projectId }: { projectId: string }) {
  const story = useItems(projectId, STORY_STORE);
  const sources = useItems(projectId, SOURCES_STORE);
  if (story.loading) return <LoadingBlocks rows={2} label="Loading the concept story" />;
  if (story.error) return <LoadError what="The concept story" message={story.error} onRetry={() => void story.reload()} />;
  const pitch = story.items.find((i) => i.data.part === "pitch");
  const position = story.items.find((i) => i.data.part === "positioning")?.data.position;
  const stored = sources.items.filter((s) => Number(s.data.chunks ?? 0) > 0).length;
  const sourceLine = sources.loading
    ? ""
    : sources.items.length
      ? `${plural(sources.items.length, "file")} in Files, ${stored} with their text searchable.`
      : "No files yet: add the documents this concept came from, so chat and drafting can read them.";
  return (
    <Card variant="flat" as="section" aria-labelledby="story-intro-h" className="p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Concept story</p>
      <h2 id="story-intro-h" className="mt-1.5 text-lg font-semibold tracking-tight text-primary">{pitch ? "The pitch" : "The story is not written yet"}</h2>
      <div className="max-w-[68ch]">
        {pitch?.body.trim() ? (
          <StoryProse markdown={pitch.body} />
        ) : (
          <p className="mt-2 text-sm text-secondary">The concept story tells the whole idea: the pitch, where it came from, why it should work, who it is for, its voice, and what it costs to find out. Write it, or draft it with AI from the sources.</p>
        )}
        {typeof position === "string" && position && <PullOut text={position} />}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Link href="/story" className="inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-2 font-medium text-white transition hover:bg-action-hover">
          {pitch ? "Read the whole story" : "Start the story"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <Link href="/files" className="text-secondary hover:text-link">{sourceLine || "Files"}</Link>
      </div>
    </Card>
  );
}
