import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Search, ArrowLeft, MessagesSquare, ShoppingBag, Store } from "lucide-react";
import { listConversations } from "@/lib/api/chat";
import { PageShell } from "@/components/shell";
import { ChatBox, relativeSeen } from "@/components/chat-box";
import { productImage } from "@/lib/images";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/chat")({
  validateSearch: z.object({ c: z.string().optional() }),
  head: () => ({ meta: [{ title: "Messages — X-VAULT" }] }),
  component: ChatPage,
});

type Conv = Record<string, string | number | null>;
type Filter = "all" | "buying" | "selling" | "unread";

function InboxSkeleton() {
  return (
    <div className="divide-y divide-border animate-pulse">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="size-10 rounded-full bg-secondary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-1/3 rounded bg-secondary" />
            <div className="h-2 w-2/3 rounded bg-secondary/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatPage() {
  const { c } = Route.useSearch();
  const navigate = useNavigate({ from: "/chat" });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
    refetchInterval: 5000,
  });

  const myId = data?.myId;
  const all = useMemo(() => (data?.conversations ?? []) as Conv[], [data?.conversations]);

  const totalUnread = useMemo(
    () => all.reduce((sum, cv) => sum + (Number(cv.unread) || 0), 0),
    [all],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((cv) => {
      const isBuyer = cv.buyer_id === myId;
      if (filter === "buying" && !isBuyer) return false;
      if (filter === "selling" && isBuyer) return false;
      if (filter === "unread" && !(Number(cv.unread) > 0)) return false;
      if (!term) return true;
      const other = ((isBuyer ? cv.seller_name : cv.buyer_name) as string) ?? "";
      const hay = [other, cv.order_no, cv.product_title, cv.product_title_presale, cv.last_body]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [all, filter, search, myId]);

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "All" },
    { key: "buying", label: "Buying" },
    { key: "selling", label: "Selling" },
    { key: "unread", label: "Unread" },
  ];

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-3xl flex items-center gap-2">
          MESSAGES
          {totalUnread > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 align-middle">
              {totalUnread}
            </span>
          )}
        </h1>
      </div>

      <div className="grid md:grid-cols-[340px_1fr] gap-4 items-start">
        {/* Inbox list */}
        <div
          className={`bg-card border border-border rounded-lg overflow-hidden flex flex-col max-h-[75vh] ${
            c ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="p-2 border-b border-border space-y-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages, orders, people…"
                className="w-full bg-secondary border border-border rounded-md pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-1">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex-1 text-[10px] font-bold rounded-md py-1.5 transition-colors ${
                    filter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-border flex-1">
            {isLoading && !data ? (
              <InboxSkeleton />
            ) : filtered.length === 0 ? (
              <div className="grid place-items-center text-center p-8 h-full">
                <div>
                  <MessagesSquare className="size-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {all.length === 0
                      ? "No conversations yet."
                      : "No conversations match your filters."}
                  </p>
                </div>
              </div>
            ) : (
              filtered.map((cv) => {
                const isBuyer = cv.buyer_id === myId;
                const other = (isBuyer ? cv.seller_name : cv.buyer_name) as string;
                const lastSeen = Number(isBuyer ? cv.seller_last_seen : cv.buyer_last_seen) || 0;
                const online = relativeSeen(lastSeen) === "online";
                const unread = Number(cv.unread) || 0;
                const mineLast = cv.last_sender_id === myId;
                const isSystemLast = !!Number(cv.last_is_system);
                const preview = (cv.last_body as string) ?? "No messages yet";
                const active = c === cv.id;
                return (
                  <button
                    key={cv.id as string}
                    onClick={() => navigate({ search: { c: cv.id as string } })}
                    className={`w-full text-left p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors ${
                      active ? "bg-secondary" : ""
                    }`}
                  >
                    <div className="relative shrink-0">
                      {cv.image_key ? (
                        <img
                          src={productImage(cv.image_key as string)}
                          alt=""
                          className="size-10 rounded-lg object-cover border border-border"
                        />
                      ) : (
                        <div className="size-10 rounded-lg bg-primary/20 border border-primary/40 grid place-items-center text-[11px] font-bold text-primary uppercase">
                          {other?.slice(0, 2)}
                        </div>
                      )}
                      <span
                        aria-hidden
                        className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card ${
                          online ? "bg-emerald-400" : "bg-muted-foreground/40"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold truncate flex-1">{other}</p>
                        <span
                          className={`text-[8px] font-bold rounded px-1 py-px shrink-0 inline-flex items-center gap-0.5 ${
                            isBuyer ? "bg-blue-500/15 text-blue-400" : "bg-accent/15 text-accent"
                          }`}
                        >
                          {isBuyer ? (
                            <ShoppingBag className="size-2" />
                          ) : (
                            <Store className="size-2" />
                          )}
                          {isBuyer ? "Buying" : "Selling"}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] truncate ${
                          unread > 0 ? "text-foreground font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        {isSystemLast ? (
                          <span className="italic text-muted-foreground">{preview}</span>
                        ) : (
                          <>
                            {mineLast && <span className="text-muted-foreground">You: </span>}
                            {preview}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                        {cv.last_message_at ? timeAgo(cv.last_message_at as number) : ""}
                      </span>
                      {unread > 0 && (
                        <span className="bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-4 h-4 px-1 grid place-items-center">
                          {unread}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Conversation view */}
        <div className={c ? "block" : "hidden md:block"}>
          {c ? (
            <div className="space-y-2">
              <button
                onClick={() => navigate({ search: {} })}
                className="md:hidden inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Back to inbox
              </button>
              <ChatBox key={c} conversationId={c} fill className="h-[72vh]" />
            </div>
          ) : (
            <div className="h-full min-h-[60vh] grid place-items-center text-center bg-card/50 border border-dashed border-border rounded-lg p-8">
              <div>
                <MessagesSquare className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-bold mb-1">Select a conversation</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Pick a chat from your inbox to view the order, message history and safety details.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
