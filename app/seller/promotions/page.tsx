"use client";

import { useEffect, useState, useTransition } from "react";
import { TrendingUp } from "lucide-react";
import {
  deleteMyCouponAction,
  listMyPromotionsAction,
  saveMyCouponAction,
  setProductSaleAction,
} from "@/server/actions/seller";
import { usdt } from "@/lib/format";

type Promotions = Awaited<ReturnType<typeof listMyPromotionsAction>>;

export default function PromotionsPage() {
  const [data, setData] = useState<Promotions | null>(null);
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: "",
    discountType: "pct" as "pct" | "fixed",
    discountValue: "",
    minOrderCents: "0",
    maxUses: "",
  });
  const [saleForm, setSaleForm] = useState<{
    productId: string;
    title: string;
    currentCents: number;
  } | null>(null);
  const [salePriceInput, setSalePriceInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const d = await listMyPromotionsAction();
      setData(d);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const saveCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveMyCouponAction({
          code: couponForm.code,
          discountType: couponForm.discountType,
          discountValue: parseFloat(couponForm.discountValue),
          minOrderCents: Math.round(parseFloat(couponForm.minOrderCents || "0") * 100),
          maxUses: couponForm.maxUses ? parseInt(couponForm.maxUses) : undefined,
        });
        setSuccess("Coupon created");
        setShowCoupon(false);
        setCouponForm({
          code: "",
          discountType: "pct",
          discountValue: "",
          minOrderCents: "0",
          maxUses: "",
        });
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const deleteCoupon = (couponId: string) => {
    startTransition(async () => {
      try {
        await deleteMyCouponAction(couponId);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const saveSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForm) return;
    setError(null);
    startTransition(async () => {
      try {
        const salePriceCents = Math.round(parseFloat(salePriceInput) * 100);
        await setProductSaleAction(saleForm.productId, salePriceCents, null);
        setSuccess("Sale price set");
        setSaleForm(null);
        setSalePriceInput("");
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const clearSale = (productId: string) => {
    startTransition(async () => {
      try {
        await setProductSaleAction(productId, null, null);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground">
          MARKETING TOOLS
        </p>
        <h1 className="font-display text-xl">Promotions</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Run flash sales and issue discount codes to drive demand.
        </p>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
          {success}
        </p>
      )}

      {/* Coupons */}
      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground">
            DISCOUNT CODES
          </h2>
          <button
            onClick={() => setShowCoupon(!showCoupon)}
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-bold"
          >
            + New coupon
          </button>
        </div>

        {showCoupon && (
          <form
            onSubmit={saveCoupon}
            className="bg-secondary/50 border border-border rounded-lg p-3 space-y-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] font-bold text-muted-foreground">CODE</span>
                <input
                  required
                  value={couponForm.code}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full mt-1 bg-background border border-border rounded-md px-2 py-1.5 text-xs font-mono"
                  placeholder="SAVE10"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-muted-foreground">TYPE</span>
                <select
                  value={couponForm.discountType}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      discountType: e.target.value as "pct" | "fixed",
                    })
                  }
                  className="w-full mt-1 bg-background border border-border rounded-md px-2 py-1.5 text-xs h-8"
                >
                  <option value="pct">% off</option>
                  <option value="fixed">Fixed USDT off</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="text-[10px] font-bold text-muted-foreground">VALUE</span>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={couponForm.discountValue}
                  onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                  className="w-full mt-1 bg-background border border-border rounded-md px-2 py-1.5 text-xs"
                  placeholder={couponForm.discountType === "pct" ? "10" : "5.00"}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-muted-foreground">
                  MIN ORDER (USDT)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={couponForm.minOrderCents}
                  onChange={(e) => setCouponForm({ ...couponForm, minOrderCents: e.target.value })}
                  className="w-full mt-1 bg-background border border-border rounded-md px-2 py-1.5 text-xs"
                  placeholder="0"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-muted-foreground">MAX USES</span>
                <input
                  type="number"
                  min="1"
                  value={couponForm.maxUses}
                  onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                  className="w-full mt-1 bg-background border border-border rounded-md px-2 py-1.5 text-xs"
                  placeholder="unlimited"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-md"
              >
                Create coupon
              </button>
              <button
                type="button"
                onClick={() => setShowCoupon(false)}
                className="bg-secondary text-xs font-bold px-4 py-2 rounded-md hover:bg-border"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!data ? (
          <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">
            Loading…
          </div>
        ) : data.coupons.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No coupons yet.</p>
        ) : (
          <div className="space-y-1.5">
            {data.coupons.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 text-xs border-b border-border/40 pb-1.5 last:border-0"
              >
                <span className="font-mono font-bold">{c.code}</span>
                <span className="text-muted-foreground">
                  {c.discount_type === "pct"
                    ? `${c.discount_value}% off`
                    : `${usdt(c.discount_value * 100)} off`}
                </span>
                <span className="text-muted-foreground">
                  {c.uses}
                  {c.max_uses ? `/${c.max_uses}` : ""} uses
                </span>
                <span
                  className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${c.is_active ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}
                >
                  {c.is_active ? "ACTIVE" : "OFF"}
                </span>
                <button
                  onClick={() => deleteCoupon(c.id)}
                  className="text-muted-foreground hover:text-destructive text-[10px] font-bold"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Flash sales */}
      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground">FLASH SALES</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Temporarily reduce a product's price to boost visibility and conversions.
        </p>

        {saleForm && (
          <form
            onSubmit={saveSale}
            className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2"
          >
            <p className="text-xs font-bold">{saleForm.title}</p>
            <p className="text-[10px] text-muted-foreground">
              Regular price: {usdt(saleForm.currentCents)}
            </p>
            <label className="block">
              <span className="text-[10px] font-bold text-muted-foreground">SALE PRICE (USDT)</span>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                max={(saleForm.currentCents / 100 - 0.01).toFixed(2)}
                value={salePriceInput}
                onChange={(e) => setSalePriceInput(e.target.value)}
                className="w-full mt-1 bg-background border border-border rounded-md px-2 py-1.5 text-xs"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-md"
              >
                Set sale
              </button>
              <button
                type="button"
                onClick={() => setSaleForm(null)}
                className="bg-secondary text-xs font-bold px-4 py-2 rounded-md hover:bg-border"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {data && data.sales.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground tracking-widest">
              ACTIVE SALES
            </p>
            {data.sales.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 text-xs border-b border-border/40 pb-1.5 last:border-0"
              >
                <span className="font-bold flex-1 truncate">{p.title}</span>
                <span className="line-through text-muted-foreground">{usdt(p.price_cents)}</span>
                <span className="font-mono text-accent">{usdt(p.sale_price_cents!)}</span>
                <button
                  onClick={() => clearSale(p.id)}
                  className="text-muted-foreground hover:text-destructive text-[10px] font-bold"
                >
                  End
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
