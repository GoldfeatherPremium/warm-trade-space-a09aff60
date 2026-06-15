"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { adminListConversationsAction, adminGetConversationMessagesAction } from "@/server/actions/admin";
import { timeAgo, dateTime, usdt } from "@/lib/format";
import { ShieldAlert } from "lucide-react";

type Conversation = Awaited<ReturnType<typeof adminListConversationsAction>>[number];
type ChatData = Awaited<ReturnType<typeof adminGetConversationMessagesAction>>;
type Message = ChatData["messages"][number];

function ConversationViewer({ conversationId }: { conversationId: string }) {
  const [data, setData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLoading(true);
    setData(null);
    startTransition(async () => {
      try {
        const d = await adminGetConversationMessagesAction(conversationId);
        setData(d);
      } finally {
        setLoading(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (data) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl h-full grid place-items-center">
        <p className="text-sm text-muted-foreground">Loading conversation…</p>
      </div>
    );
  }

  if (!data) return null;

  const { messages, buyerId, buyerName, sellerName, order } = data;

  return (
    <div className="bg-card border border-border rounded-xl flex flex-col min-h-[600px]">
      <div className="p-3 border-b border-border space-y-1">
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-primary">{buyerName}</span>
          <span className="text-muted-foreground font-normal">↔</span>
          <span className="text-accent">{sellerName}</span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-secondary text-muted-foreground ml-auto">
            READ-ONLY
          </span>
        </div>
        {order && (
          <div className="text-[10px] text-muted-foreground font-mono">
            Order #{order.order_no} · {order.status.replace("_", " ").toUpperCase()} · {usdt(order.total_cents)}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No messages yet.</p>
        )}
        {messages.map((m: Message) => {
          const isSystem = !!m.is_system;
          const isBuyer = m.sender_id === buyerId;
          const isFlagged = !!m.is_flagged;

          if (isSystem) {
            return (
              <div key={m.id} className="text-center">
                <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-3 py-1">
                  {m.body}
                </span>
              </div>
            );
          }

          return (
            <div
              key={m.id}
              className={`flex ${isBuyer ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-xs space-y-0.5 ${
                  isFlagged
                    ? "bg-destructive/15 border border-destructive/30 text-foreground"
                    : isBuyer
                      ? "bg-secondary text-foreground"
                      : "bg-primary/15 text-foreground"
                }`}
              >
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <span className="font-bold">{m.sender_name ?? "Unknown"}</span>
                  {isFlagged && (
                    <span className="flex items-center gap-0.5 text-destructive font-bold">
                      <ShieldAlert className="size-2.5" /> FLAGGED
                    </span>
                  )}
                  <span className="ml-auto">{dateTime(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export function ChatsClient() {
  const [q, setQ] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load(query: string, flagged: boolean) {
    startTransition(async () => {
      try {
        const data = await adminListConversationsAction({
          q: query || undefined,
          flaggedOnly: flagged,
          limit: 80,
        });
        setConversations(data);
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    load(q, flaggedOnly);
    intervalRef.current = setInterval(() => load(q, flaggedOnly), 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, flaggedOnly]);

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-4">
      <aside className="bg-card border border-border rounded-xl overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by user or order…"
              className="w-full bg-secondary border border-border rounded-md pl-3 pr-2 py-1.5 text-xs focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
              className="accent-primary"
            />
            <ShieldAlert className="size-3 text-destructive" />
            Flagged only
          </label>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loading && (
            <p className="p-4 text-xs text-muted-foreground text-center">Loading conversations…</p>
          )}
          {!loading && conversations.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground text-center">No conversations match.</p>
          )}
          {conversations.map((c) => {
            const flaggedCount = Number(c.flagged_count ?? 0);
            const msgCount = Number(c.msg_count ?? 0);
            const lastTs = Number(c.last_message_at ?? c.created_at ?? 0);
            return (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`w-full text-left px-3 py-2.5 hover:bg-secondary/60 transition ${
                  active === c.id ? "bg-secondary" : ""
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold truncate flex-1">
                    {c.buyer_name}{" "}
                    <span className="text-muted-foreground font-normal">↔</span>{" "}
                    {c.seller_name}
                  </span>
                  {flaggedCount > 0 && (
                    <span className="bg-destructive/20 text-destructive text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {flaggedCount} flagged
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {c.last_body ? c.last_body.slice(0, 80) : <em>No messages yet</em>}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                  {c.order_no && (
                    <span className="text-primary">#{c.order_no}</span>
                  )}
                  <span>{msgCount} msgs</span>
                  {lastTs > 0 && <span>· {timeAgo(lastTs)}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-h-[600px]">
        {active ? (
          <ConversationViewer key={active} conversationId={active} />
        ) : (
          <div className="bg-card border border-border rounded-xl h-full grid place-items-center text-sm text-muted-foreground">
            Select a conversation to inspect.
          </div>
        )}
      </section>
    </div>
  );
}
