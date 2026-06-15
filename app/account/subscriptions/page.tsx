"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Eye, EyeOff, Repeat } from "lucide-react";
import { buyerListSubscriptionsAction } from "@/server/actions/account";
import { dateTime } from "@/lib/format";

type Slot = Awaited<ReturnType<typeof buyerListSubscriptionsAction>>[number];

export default function SubscriptionsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await buyerListSubscriptionsAction();
        setSlots(data);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl flex items-center gap-2">
          <Repeat className="size-5 text-primary" /> MY SUBSCRIPTIONS
        </h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Shared subscription slots you currently hold. Credentials are only visible while a seat is
          active.
        </p>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
      ) : slots.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No active subscription slots.
        </p>
      ) : (
        <div className="space-y-2">
          {slots.map((s) => {
            const active = s.status === "active";
            const show = revealed[s.id];
            return (
              <div key={s.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold flex-1 truncate">{s.productTitle}</p>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      active
                        ? "bg-accent/15 text-accent"
                        : s.status === "expired"
                          ? "bg-muted text-muted-foreground"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {s.status.toUpperCase()}
                  </span>
                  {s.orderId && (
                    <Link
                      href={`/orders/${s.orderId}`}
                      className="text-[10px] text-primary underline"
                    >
                      Order
                    </Link>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Seller @{s.sellerUsername} · Slot {s.label}
                  {s.startedAt ? ` · started ${dateTime(s.startedAt)}` : ""}
                  {s.expiresAt ? ` · expires ${dateTime(s.expiresAt)}` : ""}
                </p>

                {active && s.credentials && (
                  <div className="border border-border rounded-md bg-background/40 p-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
                        ACCESS DETAILS
                      </span>
                      <div className="ml-auto flex gap-1">
                        <button
                          type="button"
                          onClick={() => setRevealed((r) => ({ ...r, [s.id]: !r[s.id] }))}
                          className="p-1.5 rounded hover:bg-secondary transition"
                          title={show ? "Hide credentials" : "Show credentials"}
                        >
                          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(s.credentials!)}
                          className="p-1.5 rounded hover:bg-secondary transition"
                          title="Copy to clipboard"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <pre className="text-[11px] whitespace-pre-wrap break-all font-mono">
                      {show ? s.credentials : "•".repeat(Math.min(48, s.credentials.length))}
                    </pre>
                  </div>
                )}

                {!active && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Seat is not active. Contact the seller to renew or replace it.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
