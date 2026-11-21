"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageSquareMore, Search, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { ErrorPanel } from "@/components/ui/states";
import { messageOf } from "@/lib/queries";
import type { Item } from "@/lib/types";
import { useChallengeRow } from "./api";
import { MODELS_HREF } from "./DraftPanel";
import { verifyHref } from "./RowAssist";

export type AssistRow = Pick<Item, "id" | "projectId" | "section" | "title" | "body">;

/**
 * The assistant on any row or card: one menu with "Challenge this" (the reviewer argues against the row and
 * the exchange is saved in Challenge with a link back) and "Verify this" (Research, Ask, with the row's text
 * as the question). Keyboard reachable; the trigger's name carries the row's title.
 */
export function RowActions({ item, label }: { item: AssistRow; label?: string }) {
  const name = (label ?? item.title) || "this row";
  const challenge = useChallengeRow(item.projectId);
  const [open, setOpen] = useState(false);
  const notConfigured = /reasoning model|Admin, Models|needs a key/i.test(messageOf(challenge.error));
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" aria-label={`Ask the assistant about ${name}`} title="Ask the assistant" className="h-8 px-2 text-secondary">
            <MessageSquareMore className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setOpen(true);
              challenge.reset();
              challenge.mutate({ itemId: item.id, message: "Challenge this row. What is the weakest part of it?" });
            }}
          >
            <Swords className="h-3.5 w-3.5" aria-hidden /> Challenge this
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={verifyHref(item)}>
              <Search className="h-3.5 w-3.5" aria-hidden /> Verify this
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Modal open={open} onOpenChange={setOpen} title={`Challenge: ${name}`} description="The reviewer argues against this row. The exchange is saved in Challenge.">
        {challenge.isPending ? (
          <p role="status" className="text-sm text-secondary">The reviewer is reading it.</p>
        ) : challenge.error ? (
          <ErrorPanel title="The reviewer did not answer" message={messageOf(challenge.error)} link={notConfigured ? { href: MODELS_HREF, label: "Open Admin, Models" } : undefined} />
        ) : challenge.data ? (
          <div role="status" className="space-y-2">
            <p className="whitespace-pre-wrap text-sm text-primary">{challenge.data.reply}</p>
            <p className="text-xs text-muted">
              Saved in <Link href="/s/concept/challenge" className="text-link hover:underline">Challenge</Link> with a link to this row.
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
