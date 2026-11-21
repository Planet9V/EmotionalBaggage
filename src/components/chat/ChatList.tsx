"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatSummary } from "./api";

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const titleOf = (c: ChatSummary) => c.title || "New chat";

/**
 * The concept's chats. A column beside the conversation on wide screens; on narrower ones (tablet)
 * a chooser above it, so the conversation keeps the width.
 */
export function ChatList({
  chats,
  current,
  onPick,
  onDelete,
  deleting,
}: {
  chats: ChatSummary[];
  current: number | null;
  onPick: (id: number) => void;
  onDelete: (id: number) => void;
  deleting?: number;
}) {
  const [confirm, setConfirm] = useState<number | null>(null);
  const currentChat = chats.find((c) => c.id === current);

  return (
    <>
      {/* Narrow: a chooser and a delete button for the open chat */}
      <div className="flex items-center gap-2 border-b border-hairline bg-surface px-6 py-2 xl:hidden">
        <label htmlFor="chat-picker" className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
          Chat
        </label>
        {chats.length ? (
          <select
            id="chat-picker"
            className="h-8 min-w-0 flex-1 rounded-md border border-hairline bg-canvas px-2 text-sm text-primary focus-visible:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
            value={current ?? ""}
            onChange={(e) => onPick(Number(e.target.value))}
          >
            {chats.map((c) => (
              <option key={c.id} value={c.id}>
                {titleOf(c)}
              </option>
            ))}
          </select>
        ) : (
          <p className="flex-1 text-sm text-secondary">No chats yet. Your first question starts one.</p>
        )}
        {currentChat && (
          <DeleteButton
            chat={currentChat}
            confirming={confirm === currentChat.id}
            deleting={deleting === currentChat.id}
            onAsk={() => setConfirm(currentChat.id)}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              setConfirm(null);
              onDelete(currentChat.id);
            }}
          />
        )}
      </div>

      {/* Wide: a column */}
      <nav aria-label="Chats" className="hidden w-64 shrink-0 flex-col border-r border-hairline bg-surface xl:flex">
        {chats.length === 0 ? (
          <p className="p-4 text-sm text-secondary">No chats yet. Your first question starts one.</p>
        ) : (
          <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {chats.map((c) => {
              const active = c.id === current;
              return (
                <li key={c.id} className={`group flex items-start gap-1 rounded-md ${active ? "bg-subtle" : "hover:bg-subtle/60"}`}>
                  <button
                    type="button"
                    onClick={() => onPick(c.id)}
                    aria-current={active ? "true" : undefined}
                    className="min-w-0 flex-1 rounded-md px-2.5 py-2 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
                  >
                    <span className={`block truncate text-sm ${active ? "font-medium text-primary" : "text-secondary"}`}>{titleOf(c)}</span>
                    <span className="block font-mono text-[10px] text-muted">{when(c.updatedAt)}</span>
                  </button>
                  <div className="py-1.5 pr-1">
                    <DeleteButton
                      chat={c}
                      confirming={confirm === c.id}
                      deleting={deleting === c.id}
                      onAsk={() => setConfirm(c.id)}
                      onCancel={() => setConfirm(null)}
                      onConfirm={() => {
                        setConfirm(null);
                        onDelete(c.id);
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </>
  );
}

/** Delete in two steps: the bin, then "Delete" or "Keep". */
function DeleteButton({
  chat,
  confirming,
  deleting,
  onAsk,
  onCancel,
  onConfirm,
}: {
  chat: ChatSummary;
  confirming: boolean;
  deleting: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <Button size="xs" variant="destructive" onClick={onConfirm} aria-label={`Delete the chat "${titleOf(chat)}"`}>
          Delete
        </Button>
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Keep
        </Button>
      </span>
    );
  }
  return (
    <Button size="icon-xs" variant="ghost" onClick={onAsk} disabled={deleting} aria-label={`Delete the chat "${titleOf(chat)}"`} title="Delete this chat">
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
    </Button>
  );
}
