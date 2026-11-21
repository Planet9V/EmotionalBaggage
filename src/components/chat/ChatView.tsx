"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, MessageSquarePlus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useItems, useProject } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import { MAX_QUESTION, suggestedQuestions } from "@/lib/chat/shared";
import type { Project } from "@/lib/types";
import { chatKeys, chatQueries, createChat, deleteChat, type ChatSetup, type ChatSummary } from "./api";
import { ChatThread, toUIMessages } from "./ChatThread";
import { ChatList } from "./ChatList";
import { SetupNotice } from "./SetupNotice";
import { EmptyThread, QuestionBox } from "./parts";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";

const BLURB = "Ask about this concept. Answers come only from its rows and saved research, with numbered sources.";

export function ChatView() {
  const { project, loading } = useProject();
  if (!project) {
    return (
      <div className="flex h-dvh flex-col">
        <PageHeader eyebrow="Chat" title="Chat with the concept" blurb={BLURB} />
        {loading ? (
          <ScreenSkeleton />
        ) : (
          <p className="p-8 text-sm text-secondary">
            No concept is open. <Link href="/new" className="text-link hover:underline">Start one</Link>.
          </p>
        )}
      </div>
    );
  }
  return <ChatBody key={project.id} project={project} />;
}

function ChatBody({ project }: { project: Project }) {
  const qc = useQueryClient();
  const list = useQuery(chatQueries.list(project.id));
  const { items } = useItems(project.id, null);
  const [selected, setSelected] = useState<number | null>(null);
  // The question typed before a chat existed: the chat is made, then the thread asks it.
  const [pending, setPending] = useState<{ chatId: number; question: string } | null>(null);
  const [actionError, setActionError] = useState("");

  const chats = useMemo(() => list.data?.chats ?? [], [list.data]);
  const setup = list.data?.setup;
  // The open chat: the one picked, or the newest; none when the concept has no chats.
  const current = selected !== null && chats.some((c) => c.id === selected) ? selected : pending?.chatId ?? chats[0]?.id ?? null;

  const suggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) counts.set(it.section, (counts.get(it.section) ?? 0) + 1);
    return suggestedQuestions([...counts].map(([store, count]) => ({ store, count })));
  }, [items]);

  const create = useMutation({
    mutationFn: () => createChat(project.id),
    onSuccess: (chat) => {
      qc.setQueryData(chatKeys.list(project.id), (d: { chats: ChatSummary[]; setup: ChatSetup } | undefined) => (d ? { ...d, chats: [chat, ...d.chats] } : d));
      qc.setQueryData(chatKeys.one(chat.id), { chat, messages: [] });
      setSelected(chat.id);
    },
    onError: (e) => setActionError(messageOf(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteChat(id),
    onSuccess: (_r, id) => {
      qc.setQueryData(chatKeys.list(project.id), (d: { chats: ChatSummary[]; setup: ChatSetup } | undefined) => (d ? { ...d, chats: d.chats.filter((c) => c.id !== id) } : d));
      qc.removeQueries({ queryKey: chatKeys.one(id) });
      if (selected === id) setSelected(null);
      if (pending?.chatId === id) setPending(null);
    },
    onError: (e) => setActionError(messageOf(e)),
  });

  const newChat = () => {
    setActionError("");
    create.mutate();
  };

  /** The first question of a concept with no chat yet: make the chat, then ask in it. */
  const askInNewChat = async (question: string) => {
    setActionError("");
    try {
      const chat = await create.mutateAsync();
      setPending({ chatId: chat.id, question });
    } catch {
      // shown through onError
    }
  };

  const reasoningMissing = setup && !setup.reasoning.ok ? setup.reasoning : null;

  return (
    <div className="flex h-dvh flex-col">
      <PageHeader eyebrow="Chat" title={`Chat with ${project.name}`} blurb={BLURB}>
        <Button variant="outline" size="sm" onClick={newChat} disabled={create.isPending || !!reasoningMissing}>
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden /> New chat
        </Button>
      </PageHeader>

      {list.isPending ? (
        <ScreenSkeleton />
      ) : list.error ? (
        <div className="m-8 flex items-start gap-3 rounded-xl border border-hairline bg-danger-soft p-5 text-sm text-danger" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">The chats could not be loaded.</p>
            <p className="mt-1">{messageOf(list.error)}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void list.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          <ChatList
            chats={chats}
            current={current}
            onPick={(id) => {
              setSelected(id);
              setActionError("");
            }}
            onDelete={(id) => remove.mutate(id)}
            deleting={remove.isPending ? remove.variables : undefined}
          />
          <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Chat">
            {setup && <SetupNotice projectId={project.id} setup={setup} />}
            {actionError && (
              <p role="alert" className="border-b border-hairline bg-danger-soft px-6 py-2 text-sm text-danger">
                {actionError}
              </p>
            )}
            {current === null ? (
              <DraftThread project={project} suggestions={suggestions} disabled={!!reasoningMissing || create.isPending} onAsk={askInNewChat} />
            ) : (
              <OpenChat
                key={current}
                chatId={current}
                project={project}
                suggestions={suggestions}
                disabled={!!reasoningMissing}
                firstQuestion={pending?.chatId === current ? pending.question : undefined}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/** Loads one chat's saved messages, then hands them to the thread. */
function OpenChat({ chatId, project, suggestions, disabled, firstQuestion }: { chatId: number; project: Project; suggestions: string[]; disabled: boolean; firstQuestion?: string }) {
  const one = useQuery(chatQueries.one(chatId));
  if (one.isPending) return <ThreadSkeleton />;
  if (one.error) {
    return (
      <div className="m-6 flex items-start gap-3 rounded-xl border border-hairline bg-danger-soft p-5 text-sm text-danger" role="alert">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold">This chat could not be loaded.</p>
          <p className="mt-1">{messageOf(one.error)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void one.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </Button>
      </div>
    );
  }
  return (
    <ChatThread
      chatId={chatId}
      projectId={project.id}
      initial={toUIMessages(one.data.messages)}
      firstQuestion={firstQuestion}
      suggestions={suggestions}
      conceptName={project.name}
      disabled={disabled}
    />
  );
}

/** The thread before any chat exists: the same empty state and box; asking makes the chat. */
function DraftThread({ project, suggestions, disabled, onAsk }: { project: Project; suggestions: string[]; disabled: boolean; onAsk: (q: string) => Promise<void> }) {
  const ask = (q: string) => {
    const t = q.trim();
    if (t && !disabled) void onAsk(t.slice(0, MAX_QUESTION));
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0" aria-label="Conversation">
        <ConversationContent className="mx-auto w-full max-w-3xl px-6 py-6">
          <EmptyThread conceptName={project.name} suggestions={suggestions} onPick={ask} disabled={disabled} />
        </ConversationContent>
      </Conversation>
      <QuestionBox conceptName={project.name} onAsk={ask} disabled={disabled} />
    </div>
  );
}

function ScreenSkeleton() {
  return (
    <div className="flex min-h-0 flex-1" aria-busy="true" aria-label="Loading the chats">
      <div className="hidden w-64 shrink-0 space-y-2 border-r border-hairline p-4 xl:block">
        {[0, 1, 2, 3].map((k) => (
          <Skeleton key={k} className="h-10 w-full" />
        ))}
      </div>
      <ThreadSkeleton />
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-6" aria-busy="true" aria-label="Loading the conversation">
      <Skeleton className="ml-auto h-10 w-2/3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="ml-auto h-10 w-1/2" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
