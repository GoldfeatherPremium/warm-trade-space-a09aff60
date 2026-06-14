import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  SendHorizonal,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ChevronDown,
  ExternalLink,
  Package,
} from "lucide-react";
import {
  getMessages,
  sendMessage,
  PRESENCE_WINDOW_MS,
  type ConversationCard,
} from "@/lib/api/chat";
import { Button } from "@/components/ui/button";
import { productImage } from "@/lib/images";
import { usdtShort, ORDER_STATUS_META, PRODUCT_STATUS_META } from "@/lib/format";

interface Msg {
  id: string;
  sender_id: string | null;
  body: string;
  is_system: number;
  is_flagged: number;
  created_at: number;
  sender_name: string | null;
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (dayKey(ts) === dayKey(today.getTime())) return "Today";
  if (dayKey(ts) === dayKey(yesterday.getTime())) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function clock(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase()
  );
}

export function relativeSeen(ts: number) {
  if (!ts) return "offline";
  const diff = Date.now() - ts;
  if (diff < PRESENCE_WINDOW_MS) return "online";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `seen ${h}h ago`;
  const d = Math.floor(h / 24);
  return `seen ${d}d ago`;
}

/** Pinned order / product card at the top of a conversation. */
function PinnedCard({ card }: { card: ConversationCard }) {
  if (card.kind === "order") {
    const meta = ORDER_STATUS_META[card.status] ?? {
      label: card.status,
      cls: "bg-muted text-muted-foreground",
    };
    return (
      <Link
        to="/orders/$orderId"
        params={{ orderId: card.order_id }}
        className="flex items-center gap-3 px-3 py-2.5 border-b border-border bg-secondary/30 hover:bg-secondary/60 transition-colors group"
      >
        <img
          src={productImage(card.image_key)}
          alt=""
          className="size-11 rounded-md object-cover border border-border shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-mono text-muted-foreground">{card.order_no}</span>
            <span className={`text-[9px] font-bold rounded-full px-1.5 py-px ${meta.cls}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-xs font-bold truncate">{card.title}</p>
          <p className="text-[10px] text-muted-foreground">
            {card.qty} × {usdtShort(card.unit_price_cents)} ·{" "}
            <span className="text-foreground font-semibold">{usdtShort(card.total_cents)}</span>
          </p>
        </div>
        <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
      </Link>
    );
  }
  const meta = PRODUCT_STATUS_META[card.status];
  const inner = (
    <>
      <img
        src={productImage(card.image_key)}
        alt=""
        className="size-11 rounded-md object-cover border border-border shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Package className="size-3 text-muted-foreground" />
          <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
            Pre-sale enquiry
          </span>
          {meta && card.status !== "active" && (
            <span className={`text-[9px] font-bold rounded-full px-1.5 py-px ${meta.cls}`}>
              {meta.label}
            </span>
          )}
        </div>
        <p className="text-xs font-bold truncate">{card.title}</p>
        <p className="text-[10px] text-foreground font-semibold">{usdtShort(card.price_cents)}</p>
      </div>
      {card.product_slug && (
        <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
      )}
    </>
  );
  return card.product_slug ? (
    <Link
      to="/p/$slug"
      params={{ slug: card.product_slug }}
      className="flex items-center gap-3 px-3 py-2.5 border-b border-border bg-secondary/30 hover:bg-secondary/60 transition-colors group"
    >
      {inner}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border bg-secondary/30">
      {inner}
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
          <div
            className="h-8 rounded-2xl bg-secondary"
            style={{ width: `${40 + ((i * 17) % 40)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function ChatBox({
  conversationId,
  className,
  readOnly = false,
  showHeader = true,
  showCard = true,
  fill = false,
}: {
  conversationId: string;
  className?: string;
  readOnly?: boolean;
  showHeader?: boolean;
  showCard?: boolean;
  fill?: boolean;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [safetyOpen, setSafetyOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => getMessages({ data: { conversationId } }),
    refetchInterval: 4000,
  });

  const send = useMutation({
    mutationFn: (text: string) => sendMessage({ data: { conversationId, body: text } }),
    onSuccess: (r) => {
      if (r.flagged)
        toast.warning(
          "Message sent, but flagged by auto-moderation (sharing contacts / off-platform payment is prohibited).",
        );
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      inputRef.current?.focus();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  // Auto-grow the composer up to a few lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [body]);

  // Group consecutive messages from the same sender into bubble clusters,
  // and insert day separators where the calendar day changes.
  const items = useMemo(() => {
    const out: Array<
      | { kind: "day"; key: string; label: string }
      | { kind: "system"; key: string; m: Msg }
      | {
          kind: "group";
          key: string;
          senderId: string | null;
          senderName: string | null;
          mine: boolean;
          messages: Msg[];
        }
    > = [];
    let lastDay = "";
    let cluster: { senderId: string | null; messages: Msg[] } | null = null;
    const flushCluster = () => {
      if (cluster && cluster.messages.length > 0) {
        const first = cluster.messages[0];
        out.push({
          kind: "group",
          key: `g-${first.id}`,
          senderId: cluster.senderId,
          senderName: first.sender_name,
          mine: cluster.senderId === data?.myId,
          messages: cluster.messages,
        });
      }
      cluster = null;
    };
    for (const m of (data?.messages ?? []) as Msg[]) {
      const dk = dayKey(m.created_at);
      if (dk !== lastDay) {
        flushCluster();
        out.push({ kind: "day", key: `d-${dk}`, label: dayLabel(m.created_at) });
        lastDay = dk;
      }
      if (m.is_system) {
        flushCluster();
        out.push({ kind: "system", key: m.id, m });
        continue;
      }
      if (cluster && cluster.senderId === m.sender_id) {
        cluster.messages.push(m);
      } else {
        flushCluster();
        cluster = { senderId: m.sender_id, messages: [m] };
      }
    }
    flushCluster();
    return out;
  }, [data?.messages, data?.myId]);

  const presence = relativeSeen(data?.otherLastSeenAt ?? 0);
  const online = presence === "online";

  const submit = () => {
    const text = body.trim();
    if (!text || send.isPending) return;
    setBody("");
    send.mutate(text);
  };

  return (
    <div
      className={`flex flex-col bg-card border border-border rounded-lg overflow-hidden ${className ?? ""}`}
    >
      {showHeader && data?.otherName && (
        <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-secondary/40">
          <div className="relative">
            <div className="size-9 rounded-full bg-primary/20 border border-primary/40 grid place-items-center text-[11px] font-bold text-primary">
              {initials(data.otherName)}
            </div>
            <span
              aria-hidden
              className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card ${
                online ? "bg-emerald-400" : "bg-muted-foreground/50"
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">{data.otherName}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="size-2.5" />
              {presence}
            </p>
          </div>
        </div>
      )}

      {showCard && data?.card && <PinnedCard card={data.card} />}

      <details
        className="border-b border-border bg-amber-500/5 group/safety"
        open={safetyOpen}
        onToggle={(e) => setSafetyOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="flex items-center gap-2 px-3 py-1.5 cursor-pointer list-none text-[10px] font-bold text-amber-500/90 select-none">
          <ShieldCheck className="size-3.5 shrink-0" />
          <span className="flex-1">Trade safety &amp; on-platform policy</span>
          <ChevronDown className="size-3.5 transition-transform group-open/safety:rotate-180" />
        </summary>
        <div className="px-3 pb-2.5 pt-0.5 text-[10px] leading-relaxed text-muted-foreground flex items-start gap-2">
          <ShieldAlert className="size-3.5 shrink-0 mt-0.5 text-destructive" />
          <span>
            Never share phone, email, Telegram/Discord/WhatsApp, payment links, wallet addresses or
            account credentials here. All chats are monitored and logged. Keeping the trade on
            X-VAULT is the only way to stay covered by buyer protection — going off-platform
            forfeits it and results in a permanent ban for both parties.
          </span>
        </div>
      </details>

      {isLoading && !data ? (
        <MessagesSkeleton />
      ) : (
        <div
          className={`overflow-y-auto p-3 space-y-3 bg-background/40 ${
            fill ? "flex-1 min-h-48" : "min-h-48 max-h-96"
          }`}
        >
          {data?.messages.length === 0 && (
            <div className="h-full grid place-items-center text-center py-6">
              <div>
                <div className="mx-auto size-10 rounded-full bg-secondary grid place-items-center mb-2">
                  <SendHorizonal className="size-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">No messages yet. Say hi 👋</p>
              </div>
            </div>
          )}
          {items.map((it) => {
            if (it.kind === "day") {
              return (
                <div key={it.key} className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[9px] font-bold tracking-widest text-muted-foreground">
                    {it.label.toUpperCase()}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              );
            }
            if (it.kind === "system") {
              return (
                <div key={it.key} className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/70 border border-border/60 rounded-full px-3 py-1 max-w-[88%]">
                    <ShieldCheck className="size-3 shrink-0 text-accent" />
                    <span className="truncate">{it.m.body}</span>
                    <span className="opacity-60 shrink-0">{clock(it.m.created_at)}</span>
                  </span>
                </div>
              );
            }
            const { mine, messages, senderName } = it;
            return (
              <div key={it.key} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (
                  <div className="size-7 shrink-0 rounded-full bg-secondary border border-border grid place-items-center text-[9px] font-bold text-foreground/80">
                    {initials(senderName)}
                  </div>
                )}
                <div
                  className={`flex flex-col gap-0.5 max-w-[78%] ${mine ? "items-end" : "items-start"}`}
                >
                  {!mine && (
                    <p className="text-[9px] font-bold text-muted-foreground px-1">
                      {senderName ?? "staff"}
                    </p>
                  )}
                  {messages.map((m, i) => {
                    const isLast = i === messages.length - 1;
                    const radius = mine
                      ? `rounded-2xl rounded-tr-md ${i === 0 ? "" : "rounded-tr-2xl"} ${isLast ? "rounded-br-md" : ""}`
                      : `rounded-2xl rounded-tl-md ${i === 0 ? "" : "rounded-tl-2xl"} ${isLast ? "rounded-bl-md" : ""}`;
                    return (
                      <div
                        key={m.id}
                        className={`px-3 py-1.5 text-xs leading-relaxed shadow-sm ${
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-foreground"
                        } ${radius} ${m.is_flagged ? "ring-1 ring-destructive/50" : ""}`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        {isLast && (
                          <p className="text-[9px] opacity-60 mt-1 flex items-center gap-1 justify-end">
                            {clock(m.created_at)}
                            {!!m.is_flagged && <ShieldAlert className="size-2.5" />}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {send.isPending && (
            <div className="flex justify-end">
              <div className="bg-primary/40 text-primary-foreground rounded-2xl px-3 py-2 text-xs flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1.5 rounded-full bg-current animate-bounce" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {readOnly ? (
        <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground text-center">
          Read-only view — staff monitor mode.
        </div>
      ) : (
        <form
          className="flex items-end gap-2 p-2 border-t border-border bg-card"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Type a message…  (Enter to send, Shift+Enter for a new line)"
            maxLength={3000}
            className="flex-1 resize-none bg-secondary border border-border rounded-md px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/50 max-h-[120px]"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={send.isPending || !body.trim()}>
            <SendHorizonal className="size-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
