"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { adminListConversationsAction } from "@/server/actions/admin";
import { timeAgo } from "@/lib/format";

type Conversation = Awaited<ReturnType<typeof adminListConversationsAction>>[number];

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
            Flagged only
          </label>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loading && (
            <p className="p-4 text-xs text-muted-foreground text-center">
              Loading conversations…
            </p>
          )}
          {!loading && conversations.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground text-center">
              No conversations match.
            </p>
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
          <div className="bg-card border border-border rounded-xl h-full p-4">
            <p className="text-xs text-muted-foreground">
              Conversation selected:{" "}
              <span className="font-mono text-foreground">{active}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Full chat viewer requires the ChatBox component (available in the TanStack stack).
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl h-full grid place-items-center text-sm text-muted-foreground">
            Select a conversation to inspect.
          </div>
        )}
      </section>
    </div>
  );
}
