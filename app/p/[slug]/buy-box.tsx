"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, ShieldCheck, Minus, Plus, Zap, Lock } from "lucide-react";
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
  stockCount,
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
  stockCount: number;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(Math.max(1, minQty));
  const [variantId, setVariantId] = useState<string>("");
  const [buyerInfo, setBuyerInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatBusy, startChatTransition] = useTransition();

  const unitPrice = useMemo(() => {
    const v = variants.find((x) => x.id === variantId);
    return v ? v.price_cents : basePriceCents;
  }, [variantId, variants, basePriceCents]);

  const total = unitPrice * Math.max(1, qty);
  const safeMax = Math.min(maxQty || 1000, deliveryType === "auto" ? stockCount : 9999);

  function adjustQty(delta: number) {
    setQty((prev) => Math.max(Math.max(1, minQty), Math.min(safeMax, prev + delta)));
  }

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
      qty: Math.max(Math.max(1, minQty), Math.min(safeMax, qty)),
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

  return (
    <div className="space-y-4">
      {/* Variant chips */}
      {variants.length > 0 && (
        <div>
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">
            SELECT OPTION
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setVariantId("")}
              className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-all ${
                variantId === ""
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              Base · {usdt(basePriceCents)}
            </button>
            {variants.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-all ${
                  variantId === v.id
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                {v.title} · {usdt(v.price_cents)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity stepper */}
      {safeMax > 1 && (
        <div>
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">
            QUANTITY{" "}
            {minQty > 1 && <span className="text-muted-foreground/70">(min {minQty})</span>}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0 border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => adjustQty(-1)}
                disabled={qty <= Math.max(1, minQty)}
                className="size-9 grid place-items-center text-muted-foreground hover:bg-secondary/60 disabled:opacity-30 transition-colors"
              >
                <Minus className="size-3.5" />
              </button>
              <input
                type="number"
                value={qty}
                min={Math.max(1, minQty)}
                max={safeMax}
                onChange={(e) =>
                  setQty(
                    Math.max(Math.max(1, minQty), Math.min(safeMax, Number(e.target.value) || 1)),
                  )
                }
                className="w-12 text-center text-sm font-bold bg-transparent outline-none py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => adjustQty(1)}
                disabled={qty >= safeMax}
                className="size-9 grid place-items-center text-muted-foreground hover:bg-secondary/60 disabled:opacity-30 transition-colors"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {deliveryType === "auto" && stockCount > 0 && (
              <span className="text-[11px] text-muted-foreground">{stockCount} in stock</span>
            )}
          </div>
        </div>
      )}

      {/* Delivery info field */}
      {deliveryType === "manual" && requiresInfo && (
        <div>
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">
            DELIVERY INFO
          </p>
          <textarea
            value={buyerInfo}
            onChange={(e) => setBuyerInfo(e.target.value)}
            rows={2}
            placeholder="What the seller needs to deliver your order (e.g. account ID, username, region)…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50 resize-none"
          />
        </div>
      )}

      {/* Price total */}
      <div className="flex items-baseline justify-between pt-1">
        <span className="text-xs text-muted-foreground font-medium">Total</span>
        <div className="text-right">
          <span className="font-mono text-2xl font-bold text-accent">{usdt(total)}</span>
          {qty > 1 && (
            <p className="text-[10px] text-muted-foreground">
              {usdt(unitPrice)} × {qty}
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Buy CTA */}
      <button
        onClick={buy}
        disabled={busy || outOfStock}
        className={`w-full font-bold rounded-xl py-3.5 text-sm transition-all ${
          outOfStock
            ? "bg-secondary text-muted-foreground cursor-not-allowed"
            : busy
              ? "bg-primary/60 text-primary-foreground cursor-wait"
              : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
        }`}
      >
        {outOfStock ? "Out of stock" : busy ? "Processing…" : "Buy Now"}
      </button>

      <button
        onClick={chat}
        disabled={chatBusy}
        className="w-full font-semibold rounded-xl py-3 text-sm bg-secondary text-foreground hover:bg-secondary/70 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        <MessageCircle className="size-4" />
        {chatBusy ? "Opening chat…" : "Chat with Seller"}
      </button>

      {/* Trust row */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {[
          { icon: ShieldCheck, label: "Buyer Protected" },
          { icon: Zap, label: "Secure Checkout" },
          { icon: Lock, label: "USDT Payment" },
          { icon: ShieldCheck, label: "Dispute Coverage" },
        ].map((t) => (
          <div
            key={t.label}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
          >
            <t.icon className="size-3 text-primary shrink-0" />
            {t.label}
          </div>
        ))}
      </div>
    </div>
  );
}
