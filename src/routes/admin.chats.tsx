import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ShieldAlert } from "lucide-react";
import { adminListConversations } from "@/lib/api/chat";
import { ChatBox } from "@/components/chat-box";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/admin/chats")({
  head: () => ({ meta: [{ title: "Chat Monitor — Admin · X-VAULT" }] }),
  component: AdminChatsPage,
});

function AdminChatsPage() {
  const [q, setQ] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["adminChats", q, flaggedOnly],
    queryFn: () =>
      adminListConversations({
        data: { q: q || undefined, flaggedOnly, limit: 80 },
      }),
    refetchInterval: 15_000,
  });

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-4">
      <aside className="bg-card border border-border rounded-xl overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by user or order…"
              className="w-full bg-secondary border border-border rounded-md pl-7 pr-2 py-1.5 text-xs"
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
          {isLoading && (
            <p className="p-4 text-xs text-muted-foreground text-center">Loading conversations…</p>
          )}
          {data?.conversations.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground text-center">No conversations match.</p>
          )}
          {data?.conversations.map((c) => {
            const id = c.id as string;
            const flaggedCount = Number(c.flagged_count ?? 0);
            const msgCount = Number(c.msg_count ?? 0);
            const lastTs = Number(c.last_message_at ?? c.created_at ?? 0);
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`w-full text-left px-3 py-2.5 hover:bg-secondary/60 transition ${
                  active === id ? "bg-secondary" : ""
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold truncate flex-1">
                    {c.buyer_name as string}{" "}
                    <span className="text-muted-foreground font-normal">↔</span>{" "}
                    {c.seller_name as string}
                  </span>
                  {flaggedCount > 0 && (
                    <span className="bg-destructive/20 text-destructive text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {flaggedCount} flagged
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {c.last_body ? String(c.last_body).slice(0, 80) : <em>No messages yet</em>}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                  {c.order_no && (
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: c.order_id as string }}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{c.order_no}
                    </Link>
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
          <ChatBox conversationId={active} readOnly className="min-h-[600px]" />
        ) : (
          <div className="bg-card border border-border rounded-xl h-full grid place-items-center text-sm text-muted-foreground">
            Select a conversation to inspect.
          </div>
        )}
      </section>
    </div>
  );
}
