"use client";

import Link from "next/link";
import { Search, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { messageOf } from "@/lib/queries";
import type { Item } from "@/lib/types";
import { useChallengeRow } from "./api";
import { MODELS_HREF } from "./DraftPanel";

/** Rows whose text is a statement that outside sources can check. */
const VERIFIABLE = new Set(["research/claims", "design/requirements"]);

/** The address of Research, Ask with a row's text as the question and, for a claim, the claim chosen for evidence. */
export function verifyHref(item: Pick<Item, "id" | "section" | "title" | "body">) {
  const question = [item.title, item.body].filter(Boolean).join(": ").slice(0, 600);
  const p = new URLSearchParams({ ask: question });
  if (item.section === "research/claims") p.set("claim", String(item.id));
  return `/s/research/ask?${p.toString()}`;
}

/**
 * In the row editor: "Challenge this" (the reviewer argues against the row with the concept's context;
 * the exchange is saved to the reviewer's messages with a link back to the row) and, for claims and
 * requirements, "Verify this" (Research, Ask, with the row's text as the question).
 */
export function RowAssist({ item }: { item: Item }) {
  const challenge = useChallengeRow(item.projectId);
  const notConfigured = /reasoning model|Admin, Models|needs a key/i.test(messageOf(challenge.error));
  return (
    <fieldset className="space-y-3 rounded-xl border border-hairline bg-subtle p-4">
      <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-link">Ask the assistant</legend>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={challenge.isPending} onClick={() => challenge.mutate({ itemId: item.id, message: "Challenge this row. What is the weakest part of it?" })}>
          <Swords className="h-3.5 w-3.5" aria-hidden /> {challenge.isPending ? "The reviewer is reading it" : "Challenge this"}
        </Button>
        {VERIFIABLE.has(item.section) && (
          <Button asChild type="button" variant="outline" size="sm">
            <Link href={verifyHref(item)}>
              <Search className="h-3.5 w-3.5" aria-hidden /> Verify this
            </Link>
          </Button>
        )}
      </div>
      {challenge.data && (
        <div role="status" className="space-y-1.5">
          <p className="whitespace-pre-wrap text-sm text-primary">{challenge.data.reply}</p>
          <p className="text-xs text-muted">
            Saved in <Link href="/s/concept/challenge" className="text-link hover:underline">Challenge</Link> with a link to this row.
          </p>
        </div>
      )}
      {challenge.error && (
        <p role="alert" className="text-sm text-danger wrap-anywhere">
          {messageOf(challenge.error)} {notConfigured && <Link href={MODELS_HREF} className="underline">Open Admin, Models.</Link>}
        </p>
      )}
    </fieldset>
  );
}
