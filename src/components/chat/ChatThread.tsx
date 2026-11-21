"use client";

import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import type { ChatUIMessage } from "@/lib/chat/shared";
import { MAX_QUESTION } from "@/lib/chat/shared";
import { chatKeys, errorSentence, type SavedMessage } from "./api";
import { Answer, AnswerFooter } from "./Answer";
import { EmptyThread, QuestionBox } from "./parts";

/** Saved messages in the shape useChat holds. Saved answers carry their sources and model; how they were found is not stored. */
export function toUIMessages(saved: SavedMessage[]): ChatUIMessage[] {
  return saved.map((m) => ({
    id: `saved-${m.id}`,
    role: m.role,
    parts: [{ type: "text", text: m.content }],
    metadata: m.role === "assistant" ? { sources: m.sources, model: m.model, savedId: m.id } : undefined,
  }));
}

/** On a 401 the browser goes to sign in and comes back, as api() does elsewhere. */
const signedFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    const here = window.location.pathname + window.location.search;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- outside React's router on purpose: a full load drops the old session's cache
    window.location.assign(`/sign-in?next=${encodeURIComponent(here)}`);
  }
  return res;
};

export function ChatThread({
  chatId,
  projectId,
  initial,
  firstQuestion,
  suggestions,
  conceptName,
  disabled,
}: {
  chatId: number;
  projectId: string;
  initial: ChatUIMessage[];
  /** asked as soon as the thread opens (the question typed before the chat existed) */
  firstQuestion?: string;
  suggestions: string[];
  conceptName: string;
  /** no reasoning model: the box is shown but cannot send */
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  // One transport per chat: the request goes to this chat's route with only the new question.
  // DefaultChatTransport and prepareSendMessagesRequest: node_modules/ai/docs/04-ai-sdk-ui/03-chatbot-message-persistence.mdx
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: `/api/chats/${chatId}/messages`,
        fetch: signedFetch,
        prepareSendMessagesRequest: ({ messages }) => {
          const last = [...messages].reverse().find((m) => m.role === "user");
          const text = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
          return { body: { message: text } };
        },
      }),
    [chatId]
  );

  const { messages, sendMessage, status, error, regenerate, stop, clearError } = useChat<ChatUIMessage>({
    id: `chat-${chatId}`,
    messages: initial,
    transport,
    onFinish: () => {
      void qc.invalidateQueries({ queryKey: chatKeys.list(projectId) });
      void qc.invalidateQueries({ queryKey: chatKeys.one(chatId) });
    },
  });

  const asked = useRef(false);
  useEffect(() => {
    if (firstQuestion && !asked.current) {
      asked.current = true;
      void sendMessage({ text: firstQuestion });
    }
  }, [firstQuestion, sendMessage]);

  const busy = status === "submitted" || status === "streaming";
  const ask = (text: string) => {
    const t = text.trim();
    if (!t || busy || disabled) return;
    clearError();
    void sendMessage({ text: t.slice(0, MAX_QUESTION) });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0" aria-label="Conversation">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-6 py-6">
          {messages.length === 0 && !firstQuestion ? (
            <EmptyThread conceptName={conceptName} suggestions={suggestions} onPick={ask} disabled={disabled} />
          ) : (
            messages.map((m, i) => {
              const last = i === messages.length - 1;
              const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              if (m.role === "user") {
                return (
                  <Message from="user" key={m.id}>
                    <MessageContent>
                      <p className="whitespace-pre-wrap">{text}</p>
                    </MessageContent>
                  </Message>
                );
              }
              const streaming = last && status === "streaming";
              return (
                <Message from="assistant" key={m.id}>
                  <MessageContent className="w-full">
                    {text ? <Answer text={text} metadata={m.metadata} streaming={streaming} /> : <Shimmer>Writing the answer</Shimmer>}
                  </MessageContent>
                  {!streaming && <AnswerFooter metadata={m.metadata} />}
                </Message>
              );
            })
          )}
          {status === "submitted" && (
            <div role="status" aria-live="polite">
              <Shimmer>Finding sources and asking the model</Shimmer>
            </div>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-lg border border-hairline bg-danger-soft px-4 py-3 text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">The answer could not be completed.</p>
                <p className="mt-0.5 break-words">{errorSentence(error)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void regenerate()} disabled={disabled}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Ask again
              </Button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label="Scroll to the latest message" />
      </Conversation>

      <QuestionBox conceptName={conceptName} onAsk={ask} disabled={disabled} status={status} onStop={stop} />
    </div>
  );
}
