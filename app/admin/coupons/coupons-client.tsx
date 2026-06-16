"use client";

import { useEffect, useState, useTransition } from "react";
import { adminListCouponsAction, adminSaveCouponAction } from "@/server/actions/admin";
import { dateTime, usdt } from "@/lib/format";

type Coupon = Awaited<ReturnType<typeof adminListCouponsAction>>[number];

const EMPTY = {
  couponId: undefined as string | undefined,
  code: "",
  pctOff: 10,
  minTotalUsdt: 0,
  maxUses: 0,
  expiresInDays: 0,
  isActive: true,
};

const BTN = "px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-50";
const INPUT =
  "bg-secondary border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50";

export function CouponsClient() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const data = await adminListCouponsAction();
        setCoupons(data as Coupon[]);
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await adminSaveCouponAction(form);
      setMsg("Coupon saved.");
      setForm(EMPTY);
      load();
    } catch (err) {
      setMsg((err as Error).message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">COUPONS</h1>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Percentage discounts applied at checkout.
      </p>

      {msg && (
        <p className="text-xs bg-secondary border border-border rounded-md px-3 py-2">{msg}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">
          {coupons.length === 0 && <p className="text-sm text-muted-foreground">No coupons yet.</p>}
          {coupons.map((c) => {
            const expired = c.expires_at && (c.expires_at as number) < Date.now();
            const usedUp =
              (c.max_uses as number) > 0 && (c.used_count as number) >= (c.max_uses as number);
            return (
              <div
                key={c.id as string}
                className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 text-xs flex-wrap"
              >
                <span className="font-mono font-bold text-primary">{c.code as string}</span>
                <span className="font-bold text-accent">−{c.pct_off as number}%</span>
                <span className="text-[10px] text-muted-foreground">
                  {(c.min_total_cents as number) > 0
                    ? `min ${usdt(c.min_total_cents as number)} · `
                    : ""}
                  used {c.used_count as number}
                  {(c.max_uses as number) > 0 ? ` / ${c.max_uses}` : " (unlimited)"}
                  {c.expires_at ? ` · expires ${dateTime(c.expires_at as number)}` : ""}
                </span>
                {!c.is_active && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-muted">
                    DISABLED
                  </span>
                )}
                {expired ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive">
                    EXPIRED
                  </span>
                ) : usedUp ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-warning/15 text-warning">
                    FULLY REDEEMED
                  </span>
                ) : c.is_active ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-accent/15 text-accent">
                    LIVE
                  </span>
                ) : null}
                <button
                  className={`${BTN} ml-auto bg-secondary text-foreground`}
                  onClick={() =>
                    setForm({
                      couponId: c.id as string,
                      code: c.code as string,
                      pctOff: c.pct_off as number,
                      minTotalUsdt: (c.min_total_cents as number) / 100,
                      maxUses: c.max_uses as number,
                      expiresInDays: 0,
                      isActive: !!c.is_active,
                    })
                  }
                >
                  Edit
                </button>
              </div>
            );
          })}
        </div>
      )}

      <form
        className="bg-card border border-border rounded-lg p-4 space-y-3 max-w-xl"
        onSubmit={save}
      >
        <h2 className="text-xs font-bold tracking-widest">
          {form.couponId ? "EDIT COUPON" : "NEW COUPON"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input
            required
            placeholder="CODE (e.g. SAVE10)"
            value={form.code}
            pattern="[A-Za-z0-9_-]+"
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className={`${INPUT} font-mono`}
          />
          <input
            type="number"
            min={1}
            max={100}
            step="0.5"
            placeholder="% off"
            value={form.pctOff}
            onChange={(e) => setForm({ ...form, pctOff: Number(e.target.value) })}
            className={INPUT}
          />
          <input
            type="number"
            min={0}
            placeholder="Min order USDT (0=none)"
            value={form.minTotalUsdt}
            onChange={(e) => setForm({ ...form, minTotalUsdt: Number(e.target.value) })}
            className={INPUT}
          />
          <input
            type="number"
            min={0}
            placeholder="Max uses (0=unlimited)"
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })}
            className={INPUT}
          />
          <input
            type="number"
            min={0}
            max={365}
            placeholder="Expires in days (0=never)"
            value={form.expiresInDays}
            onChange={(e) => setForm({ ...form, expiresInDays: Number(e.target.value) })}
            className={INPUT}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className={`${BTN} bg-primary text-primary-foreground`}
          >
            {form.couponId ? "Save changes" : "Create coupon"}
          </button>
          {form.couponId && (
            <button
              type="button"
              onClick={() => setForm(EMPTY)}
              className={`${BTN} bg-secondary text-foreground`}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
