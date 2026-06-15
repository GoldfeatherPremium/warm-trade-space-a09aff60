"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, MessageCircle, ShieldCheck, Circle, X } from "lucide-react";
import { sendMessageAction, pingPresenceAction, getMessagesAction } from "@/server/actions/chat";
import { usdt, timeAgo } from "@/lib/format";
import { productImage } from "../_lib/product-image";
import Link from "next/link";

const ONLINE_THRESHOLD = 120_000;
const POLL_INTERVAL = 5_000;
const PRESENCE_INTERVAL = 60_000;

type Conversation = {
  id: string;
  order_id: string | null;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  seller_name: string;
  buyer_last_seen: number;
  seller_last_seen: number;
  order_no: string | null;
  product_title: string | null;
  order_status: string | null;
  order_total_cents: number | null;
  product_title_presale: string | null;
  image_key: string | null;
  last_body: string | null;
  last_is_system: number | null;
  unread: number;
  last_message_at: number | null;
  created_at: number;
};

type Message = {
  id: string;
  sender_id: string | null;
  body: string;
  is_system: number;
  is_flagged: number;
  created_at: number;
  sender_name: string | null;
};

type ConversationDetail = Awaited<ReturnType<typeof getMessagesAction>>;

function isOnline(ts: number) {
  return Date.now() - ts < ONLINE_THRESHOLD;
}

function ConvRow({
  c,
  myId,
  active,
  onClick,
}: {
  c: Conversation;
  myId: string;
  active: boolean;
  onClick: () => void;
}) {
  const other = c.buyer_id === myId ? c.seller_name : c.buyer_name;
  const otherLastSeen = c.buyer_id === myId ? c.seller_last_seen : c.buyer_last_seen;
  const label = c.order_id ? c.product_title : c.product_title_presale;
  const online = isOnline(otherLastSeen);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors ${active ? "bg-secondary/80" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="size-9 rounded-xl bg-primary/15 border border-primary/40 grid place-items-center text-xs font-bold text-primary uppercase">
            {other.slice(0, 2)}
          </div>
          {online && (
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-accent border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold truncate">{other}</span>
            {c.unread > 0 && (
              <span className="shrink-0 size-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold grid place-items-center">
                {c.unread}
              </span>
            )}
          </div>
          {label && <p className="text-[11px] text-muted-foreground truncate">{label}</p>}
          {c.last_body && (
            <p className="text-[11px] text-muted-foreground truncate">
              {Number(c.last_is_system) ? "🔔 " : ""}
              {c.last_body}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function OrderCard({ card }: { card: NonNullable<ConversationDetail>["card"] }) {
  if (!card) return null;
  if (card.kind === "order") {
    return (
      <Link
        href={`/orders/${card.order_id}`}
        className="block bg-secondary/40 border border-border rounded-lg p-3 hover:border-primary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {card.image_key != null && (
            <div className="size-10 rounded-md overflow-hidden bg-secondary shrink-0">
              <img
                src={productImage(String(card.image_key))}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground tracking-widest">
              ORDER {String(card.order_no)}
            </p>
            <p className="text-xs font-bold truncate">{String(card.title)}</p>
            <p className="text-[11px] text-muted-foreground">
              {usdt(Number(card.total_cents))} · {String(card.status).toUpperCase()}
            </p>
          </div>
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={`/p/${card.product_slug}`}
      className="block bg-secondary/40 border border-border rounded-lg p-3 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        {card.image_key != null && (
          <div className="size-10 rounded-md overflow-hidden bg-secondary shrink-0">
            <img
              src={productImage(String(card.image_key))}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-muted-foreground tracking-widest">
            PRODUCT ENQUIRY
          </p>
          <p className="text-xs font-bold truncate">{String(card.title)}</p>
          <p className="text-[11px] text-muted-foreground">{usdt(Number(card.price_cents))}</p>
        </div>
      </div>
    </Link>
  );
}

export function ChatClient({
  initialConversations,
  initialConversationId,
  myId,
}: {
  initialConversations: Conversation[];
  initialConversationId: string | null;
  myId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId);
  const [detail, setDetail] = useState<ConversationDetail>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversation when activeId changes
  useEffect(() => {
    if (!activeId) return;
    startTransition(async () => {
      const d = await getMessagesAction(activeId);
      setDetail(d);
    });
  }, [activeId]);

  // Poll messages every 5s
  useEffect(() => {
    if (!activeId) return;
    const id = setInterval(() => {
      startTransition(async () => {
        const d = await getMessagesAction(activeId);
        if (d) setDetail(d);
      });
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [activeId]);

  // Ping presence every 60s
  useEffect(() => {
    pingPresenceAction();
    const id = setInterval(() => pingPresenceAction(), PRESENCE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // Scroll to bottom when new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages?.length]);

  async function send() {
    if (!activeId || !body.trim() || busy) return;
    setBusy(true);
    const res = await sendMessageAction(activeId, body.trim());
    setBusy(false);
    if (!res.ok) return;
    setBody("");
    const d = await getMessagesAction(activeId);
    if (d) setDetail(d);
  }

  const activeConv = conversations.find((c) => c.id === activeId);
  const other = activeConv
    ? activeConv.buyer_id === myId
      ? { name: activeConv.seller_name, lastSeen: activeConv.seller_last_seen }
      : { name: activeConv.buyer_name, lastSeen: activeConv.buyer_last_seen }
    : null;

  return (
    <div
      className="grid lg:grid-cols-[280px_1fr] gap-0 bg-card border border-border rounded-xl overflow-hidden"
      style={{ height: "calc(100vh - 140px)", minHeight: 500 }}
    >
      {/* Sidebar */}
      <div className="border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h1 className="font-display text-lg flex items-center gap-2">
            <MessageCircle className="size-5 text-accent" /> Inbox
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No conversations yet.
            </p>
          ) : (
            conversations.map((c) => (
              <ConvRow
                key={c.id}
                c={c}
                myId={myId}
                active={c.id === activeId}
                onClick={() => {
                  setActiveId(c.id);
                  router.replace(`/chat?c=${c.id}`, { scroll: false });
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Main */}
      {activeId && other ? (
        <div className="flex flex-col min-h-0">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="relative">
              <div className="size-8 rounded-xl bg-primary/15 border border-primary/40 grid place-items-center text-xs font-bold text-primary uppercase">
                {other.name.slice(0, 2)}
              </div>
              {isOnline(other.lastSeen) && (
                <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-accent border-2 border-background" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold">{other.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {isOnline(other.lastSeen) ? (
                  <span className="text-accent">Online</span>
                ) : (
                  `Last seen ${timeAgo(other.lastSeen)}`
                )}
              </p>
            </div>
          </div>

          {/* Context card */}
          {detail?.card && (
            <div className="px-4 py-2 border-b border-border/50">
              <OrderCard card={detail.card} />
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {!detail ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
            ) : detail.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet. Say hello!
              </p>
            ) : (
              detail.messages.map((m) => {
                const isMe = m.sender_id === myId;
                const isSystem = !m.sender_id || m.is_system;
                if (isSystem) {
                  return (
                    <div key={m.id} className="text-center">
                      <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                        {m.body}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}
                    >
                      <p className="break-words">{m.body}</p>
                      <p
                        className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}
                      >
                        {timeAgo(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
              <ShieldCheck className="size-3 text-accent" />
              All communication is monitored to protect both parties.
            </div>
            <div className="flex gap-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="Type a message… (Enter to send)"
                className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                onClick={send}
                disabled={busy || !body.trim()}
                className="self-end px-3 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-60"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex items-center justify-center text-muted-foreground flex-col gap-3">
          <MessageCircle className="size-12 opacity-20" />
          <p className="text-sm">Select a conversation</p>
        </div>
      )}
    </div>
  );
}
