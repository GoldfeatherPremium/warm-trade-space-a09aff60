"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  MessageCircle,
  ShieldCheck,
  ChevronLeft,
  Package,
  ExternalLink,
  Search,
} from "lucide-react";
import { sendMessageAction, pingPresenceAction, getMessagesAction } from "@/server/actions/chat";
import { usdt, timeAgo } from "@/lib/format";
import { productImage } from "../_lib/product-image";
import Link from "next/link";

const ONLINE_THRESHOLD = 120_000;
const POLL_INTERVAL = 4_000;
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

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: diff > 300 ? "numeric" : undefined,
  });
}

function isSameDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Avatar initials with deterministic colour
function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "md" ? "size-10" : "size-8";
  return (
    <div
      className={`${sz} rounded-full bg-primary/20 border border-primary/40 grid place-items-center text-xs font-bold text-primary uppercase shrink-0`}
    >
      {name.slice(0, 2)}
    </div>
  );
}

function OnlineDot({ ts }: { ts: number }) {
  return isOnline(ts) ? (
    <span className="size-2.5 rounded-full bg-emerald-500 border-2 border-background inline-block" />
  ) : null;
}

// Conversation list row
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
  const isBuyer = c.buyer_id === myId;
  const other = isBuyer ? c.seller_name : c.buyer_name;
  const otherLastSeen = isBuyer ? c.seller_last_seen : c.buyer_last_seen;
  const label = c.order_id ? c.product_title : c.product_title_presale;
  const online = isOnline(otherLastSeen);
  const ts = c.last_message_at ?? c.created_at;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-border/40 transition-colors ${
        active
          ? "bg-primary/8 border-l-2 border-l-primary"
          : "hover:bg-secondary/40 border-l-2 border-l-transparent"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Avatar name={other} />
          {online && (
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-sm font-semibold truncate">{other}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(ts)}</span>
          </div>
          {label && (
            <p className="text-[10px] text-muted-foreground/70 truncate mb-0.5 flex items-center gap-1">
              <Package className="size-2.5 shrink-0" />
              {label}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground truncate">
              {c.last_body
                ? Number(c.last_is_system)
                  ? `🔔 ${c.last_body}`
                  : c.last_body
                : "No messages yet"}
            </p>
            {c.unread > 0 && (
              <span className="shrink-0 min-w-[20px] h-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold grid place-items-center">
                {c.unread > 99 ? "99+" : c.unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// Pinned order/product context card
function ContextCard({ card }: { card: NonNullable<ConversationDetail>["card"] }) {
  if (!card) return null;

  if (card.kind === "order") {
    const statusColor: Record<string, string> = {
      pending: "text-yellow-400",
      paid: "text-blue-400",
      delivered: "text-accent",
      completed: "text-emerald-400",
      cancelled: "text-muted-foreground",
      disputed: "text-destructive",
    };
    return (
      <Link
        href={`/orders/${card.order_id}`}
        className="flex items-center gap-3 px-4 py-2.5 bg-secondary/30 border-b border-border/50 hover:bg-secondary/50 transition-colors group"
      >
        {card.image_key != null && (
          <div className="size-8 rounded-md overflow-hidden bg-secondary shrink-0">
            <img
              src={productImage(String(card.image_key))}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-muted-foreground tracking-widest">
            ORDER {String(card.order_no)}
          </p>
          <p className="text-xs font-semibold truncate">{String(card.title)}</p>
          <p
            className={`text-[10px] font-medium ${statusColor[String(card.status)] ?? "text-muted-foreground"}`}
          >
            {usdt(Number(card.total_cents))} · {String(card.status).toUpperCase()}
          </p>
        </div>
        <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      </Link>
    );
  }

  return (
    <Link
      href={`/p/${card.product_slug}`}
      className="flex items-center gap-3 px-4 py-2.5 bg-secondary/30 border-b border-border/50 hover:bg-secondary/50 transition-colors group"
    >
      {card.image_key != null && (
        <div className="size-8 rounded-md overflow-hidden bg-secondary shrink-0">
          <img
            src={productImage(String(card.image_key))}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground tracking-widest">
          PRODUCT ENQUIRY
        </p>
        <p className="text-xs font-semibold truncate">{String(card.title)}</p>
        <p className="text-[10px] text-muted-foreground">{usdt(Number(card.price_cents))}</p>
      </div>
      <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
    </Link>
  );
}

// Auto-growing textarea
function Composer({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <div className="px-4 py-3 border-t border-border bg-card/50">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
        <ShieldCheck className="size-3 text-accent shrink-0" />
        All communication is monitored — never share personal info off-platform.
      </div>
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder="Message… (Enter to send, Shift+Enter for new line)"
          className="flex-1 bg-secondary/60 border border-border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition placeholder:text-muted-foreground/60"
          style={{ minHeight: 42, maxHeight: 160 }}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="size-[42px] shrink-0 bg-primary text-primary-foreground rounded-xl grid place-items-center hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
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
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId);
  const [detail, setDetail] = useState<ConversationDetail>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">(
    initialConversationId ? "chat" : "list",
  );
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback((id: string) => {
    startTransition(async () => {
      const d = await getMessagesAction(id);
      setDetail(d);
    });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
  }, [activeId, loadMessages]);

  // Poll messages
  useEffect(() => {
    if (!activeId) return;
    const id = setInterval(() => loadMessages(activeId), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [activeId, loadMessages]);

  // Ping presence
  useEffect(() => {
    pingPresenceAction();
    const id = setInterval(() => pingPresenceAction(), PRESENCE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // Scroll to bottom on new messages
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
    loadMessages(activeId);
  }

  function openConversation(id: string) {
    setActiveId(id);
    setMobileView("chat");
    router.replace(`/chat?c=${id}`, { scroll: false });
  }

  const activeConv = conversations.find((c) => c.id === activeId);
  const other = activeConv
    ? activeConv.buyer_id === myId
      ? { name: activeConv.seller_name, lastSeen: activeConv.seller_last_seen }
      : { name: activeConv.buyer_name, lastSeen: activeConv.buyer_last_seen }
    : null;

  const filteredConvs = search.trim()
    ? conversations.filter((c) => {
        const q = search.toLowerCase();
        const name = c.buyer_id === myId ? c.seller_name : c.buyer_name;
        return (
          name.toLowerCase().includes(q) ||
          c.product_title?.toLowerCase().includes(q) ||
          c.product_title_presale?.toLowerCase().includes(q) ||
          c.order_no?.toLowerCase().includes(q)
        );
      })
    : conversations;

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  // Group messages by sender + day
  const messageGroups: Array<
    | {
        type: "day";
        label: string;
        key: string;
      }
    | {
        type: "group";
        key: string;
        senderId: string | null;
        senderName: string | null;
        isMe: boolean;
        isSystem: boolean;
        messages: Message[];
      }
  > = [];

  if (detail?.messages) {
    let lastDay = -1;
    let lastSenderId: string | null | undefined = undefined;
    let currentGroup: Message[] = [];

    const flush = () => {
      if (currentGroup.length === 0) return;
      const first = currentGroup[0];
      const isSystem = !first.sender_id || Boolean(first.is_system);
      messageGroups.push({
        type: "group",
        key: first.id,
        senderId: first.sender_id,
        senderName: first.sender_name,
        isMe: first.sender_id === myId,
        isSystem,
        messages: currentGroup,
      });
      currentGroup = [];
    };

    for (const m of detail.messages) {
      const day = new Date(m.created_at).setHours(0, 0, 0, 0);
      if (day !== lastDay) {
        flush();
        messageGroups.push({ type: "day", label: formatDay(m.created_at), key: `day-${day}` });
        lastDay = day;
        lastSenderId = undefined;
      }
      const isSystem = !m.sender_id || Boolean(m.is_system);
      if (m.sender_id !== lastSenderId || isSystem) {
        flush();
        lastSenderId = m.sender_id;
      }
      currentGroup.push(m);
    }
    flush();
  }

  // ─── Sidebar ─────────────────────────────────────────────────────────────
  const sidebar = (
    <div
      className={`flex flex-col border-r border-border bg-card ${
        mobileView === "chat" ? "hidden lg:flex" : "flex"
      } lg:flex w-full lg:w-[300px] shrink-0`}
    >
      {/* Sidebar header */}
      <div className="px-4 py-3.5 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-base flex items-center gap-2">
            <MessageCircle className="size-4 text-accent" />
            Inbox
            {totalUnread > 0 && (
              <span className="size-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold grid place-items-center">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </h1>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-secondary/60 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filteredConvs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
            <MessageCircle className="size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {search ? "No conversations match your search." : "No conversations yet."}
            </p>
          </div>
        ) : (
          filteredConvs.map((c) => (
            <ConvRow
              key={c.id}
              c={c}
              myId={myId}
              active={c.id === activeId}
              onClick={() => openConversation(c.id)}
            />
          ))
        )}
      </div>
    </div>
  );

  // ─── Chat pane ───────────────────────────────────────────────────────────
  const chatPane =
    activeId && other ? (
      <div
        className={`flex flex-col flex-1 min-w-0 min-h-0 ${
          mobileView === "list" ? "hidden lg:flex" : "flex"
        }`}
      >
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-card/80 backdrop-blur">
          {/* Mobile back */}
          <button
            onClick={() => setMobileView("list")}
            className="lg:hidden -ml-1 size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            aria-label="Back to inbox"
          >
            <ChevronLeft className="size-5" />
          </button>

          <div className="relative">
            <Avatar name={other.name} size="md" />
            {isOnline(other.lastSeen) && (
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{other.name}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              {isOnline(other.lastSeen) ? (
                <>
                  <OnlineDot ts={other.lastSeen} />
                  <span className="text-emerald-400">Online</span>
                </>
              ) : (
                `Last seen ${timeAgo(other.lastSeen)}`
              )}
            </p>
          </div>
        </div>

        {/* Context card */}
        {detail?.card && <ContextCard card={detail.card} />}

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {!detail ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading messages…</p>
            </div>
          ) : detail.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <MessageCircle className="size-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No messages yet.</p>
              <p className="text-xs text-muted-foreground/60">Be the first to say hello!</p>
            </div>
          ) : (
            messageGroups.map((group) => {
              if (group.type === "day") {
                return (
                  <div key={group.key} className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-[10px] font-medium text-muted-foreground px-2">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                );
              }

              if (group.isSystem) {
                return (
                  <div key={group.key} className="flex flex-col items-center gap-1 py-2">
                    {group.messages.map((m) => (
                      <span
                        key={m.id}
                        className="text-[11px] text-muted-foreground bg-secondary/60 border border-border/50 px-3 py-1 rounded-full max-w-[80%] text-center"
                      >
                        {m.body}
                      </span>
                    ))}
                  </div>
                );
              }

              return (
                <div
                  key={group.key}
                  className={`flex gap-2 items-end ${group.isMe ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar — only for the other person */}
                  {!group.isMe && <Avatar name={group.senderName ?? "?"} />}

                  <div
                    className={`flex flex-col gap-0.5 max-w-[72%] ${group.isMe ? "items-end" : "items-start"}`}
                  >
                    {/* Sender name (only for other, first in group) */}
                    {!group.isMe && group.senderName && (
                      <span className="text-[10px] font-medium text-muted-foreground pl-1 mb-0.5">
                        {group.senderName}
                      </span>
                    )}

                    {group.messages.map((m, idx) => {
                      const isLast = idx === group.messages.length - 1;
                      const isFirst = idx === 0;
                      const roundingMe = `rounded-2xl ${isFirst && !isLast ? "rounded-br-sm" : ""} ${!isFirst && !isLast ? "rounded-r-sm" : ""} ${isLast && !isFirst ? "rounded-br-2xl rounded-tr-sm" : ""}`;
                      const roundingOther = `rounded-2xl ${isFirst && !isLast ? "rounded-bl-sm" : ""} ${!isFirst && !isLast ? "rounded-l-sm" : ""} ${isLast && !isFirst ? "rounded-bl-2xl rounded-tl-sm" : ""}`;

                      return (
                        <div key={m.id} className="group/msg">
                          <div
                            className={`px-3.5 py-2 text-sm leading-relaxed break-words ${
                              group.isMe
                                ? `bg-primary text-primary-foreground ${roundingMe}`
                                : `bg-secondary text-foreground ${roundingOther}`
                            } ${m.is_flagged ? "ring-1 ring-destructive/50" : ""}`}
                          >
                            {m.body}
                          </div>
                          {isLast && (
                            <p
                              className={`text-[10px] text-muted-foreground/70 mt-1 ${group.isMe ? "text-right" : "text-left"} pl-1 pr-1`}
                            >
                              {formatTime(m.created_at)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} className="h-1" />
        </div>

        {/* Composer */}
        <Composer value={body} onChange={setBody} onSend={send} disabled={busy} />
      </div>
    ) : (
      <div
        className={`flex-1 items-center justify-center flex-col gap-4 text-center p-8 ${
          mobileView === "list" ? "hidden lg:flex" : "flex"
        }`}
      >
        <MessageCircle className="size-16 text-muted-foreground/20" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">Select a conversation</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Choose from your inbox to start chatting
          </p>
        </div>
      </div>
    );

  return (
    <div
      className="flex bg-card border border-border rounded-xl overflow-hidden"
      style={{ height: "calc(100dvh - 112px)", minHeight: 500 }}
    >
      {sidebar}
      {chatPane}
    </div>
  );
}
