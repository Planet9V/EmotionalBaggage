"use client";

import type { ChatStatus } from "ai";
import { MessageSquareText } from "lucide-react";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { MAX_QUESTION } from "@/lib/chat/shared";

/** The empty state: what will appear here, and three questions built from the concept's own section names. */
export function EmptyThread({ conceptName, suggestions, onPick, disabled }: { conceptName: string; suggestions: string[]; onPick: (q: string) => void; disabled?: boolean }) {
  return (
    <ConversationEmptyState className="py-12">
      <MessageSquareText className="h-6 w-6 text-muted" aria-hidden />
      <div className="max-w-md space-y-1">
        <h2 className="text-sm font-medium text-primary">Ask a question about {conceptName}</h2>
        <p className="text-sm text-secondary">
          Answers come only from the rows and saved research of this concept, with numbered sources that link to where each one lives.
        </p>
      </div>
      {suggestions.length > 0 ? (
        // wrapped, not scrolled sideways: the third question used to be cut off at the edge
        <div role="group" aria-label="Suggested questions" className="mt-2 flex max-w-2xl flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <Suggestion key={s} suggestion={s} onClick={onPick} disabled={disabled} className="h-auto whitespace-normal py-1.5 text-center" />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">This concept has no rows yet, so there is nothing to ask about. Add rows in its sections first.</p>
      )}
    </ConversationEmptyState>
  );
}

/** The question box under the conversation. Enter sends; while an answer streams the button stops it. */
export function QuestionBox({
  conceptName,
  onAsk,
  disabled,
  status,
  onStop,
}: {
  conceptName: string;
  onAsk: (text: string) => void;
  disabled?: boolean;
  status?: ChatStatus;
  onStop?: () => void;
}) {
  const busy = status === "submitted" || status === "streaming";
  return (
    <div className="border-t border-hairline bg-surface px-6 py-4">
      <PromptInput className="mx-auto max-w-3xl" onSubmit={({ text }) => onAsk(text)}>
        <PromptInputBody>
          <PromptInputTextarea
            aria-label="Your question"
            placeholder={disabled ? "Choose a reasoning model in Admin to ask questions" : `Ask about ${conceptName}`}
            disabled={disabled}
            maxLength={MAX_QUESTION}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <p className="px-2 text-xs text-muted">Enter to send, Shift and Enter for a new line</p>
          </PromptInputTools>
          <PromptInputSubmit status={status} onStop={onStop} disabled={disabled && !busy} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
