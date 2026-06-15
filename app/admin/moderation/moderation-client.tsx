"use client";

import { useEffect, useState, useTransition } from "react";
import { listFlaggedMessagesAction, moderateMessageAction } from "@/server/actions/admin";
import { dateTime } from "@/lib/format";

type FlaggedMessage = Awaited<ReturnType<typeof listFlaggedMessagesAction>>[number];

const FLAG_REASON_META: Record<string, { label: string; cls: string }> = {
  contact_sharing: { label: "Contact sharing", cls: "bg-yellow-500/15 text-yellow-400" },
  off_platform_payment: {
    label: "Off-platform payment",
    cls: "bg-destructive/15 text-destructive",
  },
  spam: { label: "Spam", cls: "bg-secondary text-muted-foreground" },
  harassment: { label: "Harassment", cls: "bg-destructive/15 text-destructive" },
};

const BTN_CLS = "px-3 py-1.5 rounded-md text-xs font-bold";
const INPUT_CLS =
  "bg-secondary border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50";

function MessageCard({ msg, onRefresh }: { msg: FlaggedMessage; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const flagMeta = FLAG_REASON_META[msg.flag_reason] ?? {
    label: msg.flag_reason,
    cls: "bg-secondary text-muted-foreground",
  };

  async function moderate(action: "dismiss" | "remove") {
    setBusy(true);
    setError(null);
    startTransition(async () => {
      try {
        await moderateMessageAction({ messageId: msg.id, action });
        onRefresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Action failed.");
        setBusy(false);
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{msg.sender_name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${flagMeta.cls}`}>
              {flagMeta.label.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-3">{msg.body}</p>
        </div>
        <div className="text-right space-y-0.5 shrink-0 text-[10px] text-muted-foreground">
          <div>{dateTime(msg.created_at)}</div>
          {msg.moderated_at && (
            <div className="text-accent">Moderated {dateTime(msg.moderated_at)}</div>
          )}
        </div>
      </div>

      {!msg.moderated_at && (
        <div className="pt-1 border-t border-border space-y-1.5">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => moderate("dismiss")}
              className={`${BTN_CLS} bg-secondary text-foreground disabled:opacity-50`}
            >
              {busy ? "…" : "Dismiss"}
            </button>
            <button
              disabled={busy}
              onClick={() => moderate("remove")}
              className={`${BTN_CLS} bg-destructive text-destructive-foreground disabled:opacity-50`}
            >
              {busy ? "…" : "Remove"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ModerationClient() {
  const [messages, setMessages] = useState<FlaggedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await listFlaggedMessagesAction();
      setMessages(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="font-display text-2xl">Chat Moderation</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Auto-moderation flags contact sharing and off-platform payment attempts.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : messages.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">Queue is empty — no flagged messages.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <MessageCard key={m.id} msg={m} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
