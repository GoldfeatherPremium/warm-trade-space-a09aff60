"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { createOrderAction } from "@/server/actions/orders";
import { startProductConversationAction } from "@/server/actions/chat";
import { usdt } from "@/lib/format";

type Variant = { id: string; title: string; price_cents: number };

export function BuyBox({
  productId,
  slug,
  basePriceCents,
  minQty,
  maxQty,
  deliveryType,
  requiresInfo,
  variants,
  outOfStock,
}: {
  productId: string;
  slug: string;
  basePriceCents: number;
  minQty: number;
  maxQty: number;
  deliveryType: "auto" | "manual";
  requiresInfo: boolean;
  variants: Variant[];
  outOfStock: boolean;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(minQty || 1);
  const [variantId, setVariantId] = useState<string>("");
  const [buyerInfo, setBuyerInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatBusy, startChatTransition] = useTransition();

  const unit = useMemo(() => {
    const v = variants.find((x) => x.id === variantId);
    return v ? v.price_cents : basePriceCents;
  }, [variantId, variants, basePriceCents]);
  const total = unit * Math.max(1, qty);

  function chat() {
    startChatTransition(async () => {
      try {
        const r = await startProductConversationAction(productId);
        router.push(`/chat?c=${r.conversationId}`);
      } catch (e) {
        const msg = (e as Error).message ?? "";
        if (/signed in/i.test(msg)) router.push(`/auth?redirect=/p/${slug}`);
        else setError(msg);
      }
    });
  }

  async function buy() {
    if (busy || outOfStock) return;
    setBusy(true);
    setError(null);
    const res = await createOrderAction({
      productId,
      qty: Math.max(minQty || 1, Math.min(maxQty || 1000, qty)),
      variantId: variantId || undefined,
      buyerInfo: buyerInfo.trim() || undefined,
      network: "TRC20",
    });
    if (res.ok && res.orderId) {
      router.push(`/pay/${res.orderId}`);
      return;
    }
    const msg = res.ok ? "Could not start checkout." : res.error;
    if (/signed in/i.test(msg)) {
      router.push(`/auth?redirect=/p/${slug}`);
      return;
    }
    setError(msg);
    setBusy(false);
  }

  const inputCls =
    "w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50";

  return (
    <div className="mt-4 space-y-3">
      {variants.length > 0 && (
        <label className="block space-y-1">
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground">OPTION</span>
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className={inputCls}
          >
            <option value="">{`Base — ${usdt(basePriceCents)}`}</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title} — {usdt(v.price_cents)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block space-y-1">
        <span className="text-[10px] font-bold tracking-widest text-muted-foreground">QUANTITY</span>
        <input
          type="number"
          min={minQty || 1}
          max={maxQty || 1000}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className={inputCls}
        />
      </label>

      {deliveryType === "manual" && requiresInfo && (
        <label className="block space-y-1">
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
            DELIVERY INFO
          </span>
          <textarea
            value={buyerInfo}
            onChange={(e) => setBuyerInfo(e.target.value)}
            rows={2}
            placeholder="What the seller needs to deliver (e.g. account ID, region)…"
            className={inputCls}
          />
        </label>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-mono text-accent text-lg">{usdt(total)}</span>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={buy}
        disabled={busy || outOfStock}
        className={`w-full text-sm font-bold rounded-lg py-3 ${
          outOfStock
            ? "bg-secondary text-muted-foreground cursor-not-allowed"
            : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        }`}
      >
        {outOfStock ? "Out of stock" : busy ? "Starting checkout…" : "Buy now"}
      </button>
      <button
        onClick={chat}
        disabled={chatBusy}
        className="w-full text-sm font-bold rounded-lg py-2.5 bg-secondary text-foreground hover:bg-secondary/70 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <MessageCircle className="size-4" />
        {chatBusy ? "Opening chat…" : "Chat with seller"}
      </button>
      <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-center">
        <ShieldCheck className="size-3 text-accent" /> Buyer-protected · USDT · funds released after
        warranty
      </p>
    </div>
  );
}
