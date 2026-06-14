"use client";

import { useEffect, useState, useTransition } from "react";
import { getWalletDataAction, requestWithdrawalAction } from "@/server/actions/seller";
import { usdt, dateTime } from "@/lib/format";

type WalletData = Awaited<ReturnType<typeof getWalletDataAction>>;

export default function SellerWalletPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [form, setForm] = useState({
    amountUsdt: "",
    address: "",
    network: "TRC20" as "TRC20" | "BEP20" | "ERC20",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const d = await getWalletDataAction();
      setData(d);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const withdraw = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await requestWithdrawalAction(parseFloat(form.amountUsdt), form.address, form.network);
        setSuccess("Withdrawal requested — it will be processed within 24h.");
        setForm({ amountUsdt: "", address: "", network: "TRC20" });
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  if (!data)
    return (
      <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
    );

  const STATUS_CLS: Record<string, string> = {
    pending: "text-yellow-400",
    processing: "text-blue-400",
    paid: "text-accent",
    rejected: "text-destructive",
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="font-display text-2xl">SELLER WALLET</h1>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "AVAILABLE", val: data.wallet.available_cents, cls: "text-accent" },
          { label: "IN ESCROW", val: data.wallet.pending_cents, cls: "text-yellow-400" },
          { label: "FROZEN", val: data.wallet.frozen_cents, cls: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4">
            <p className="text-[9px] font-bold tracking-widest text-muted-foreground">{s.label}</p>
            <p className={`font-mono text-lg mt-1.5 ${s.cls}`}>{usdt(s.val)}</p>
          </div>
        ))}
      </div>

      {!data.walletFrozen && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
            WITHDRAW USDT
          </h2>
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 mb-3">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-md px-3 py-2 mb-3">
              {success}
            </p>
          )}
          <form onSubmit={withdraw} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
                  AMOUNT (USDT)
                </span>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={form.amountUsdt}
                  onChange={(e) => setForm({ ...form, amountUsdt: e.target.value })}
                  className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-xs"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
                  NETWORK
                </span>
                <select
                  value={form.network}
                  onChange={(e) => setForm({ ...form, network: e.target.value as never })}
                  className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-xs h-9"
                >
                  <option value="TRC20">TRC20 (TRON)</option>
                  <option value="BEP20">BEP20 (BSC)</option>
                  <option value="ERC20">ERC20 (Ethereum)</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
                USDT ADDRESS
              </span>
              <input
                required
                minLength={20}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Your USDT wallet address"
                className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-2 text-xs font-mono"
              />
            </label>
            <p className="text-[10px] text-muted-foreground">
              Fee: {usdt(data.fees.withdrawalFeeCents)} · Min: {usdt(data.fees.minWithdrawalCents)}
            </p>
            <button
              type="submit"
              className="bg-primary text-primary-foreground text-xs font-bold tracking-widest px-5 py-2.5 rounded-lg hover:opacity-90"
            >
              REQUEST WITHDRAWAL
            </button>
          </form>
        </div>
      )}

      {data.walletFrozen && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-xs text-destructive font-bold">Wallet frozen — contact support.</p>
        </div>
      )}

      {data.withdrawals.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
            WITHDRAWAL HISTORY
          </h2>
          <div className="space-y-1.5">
            {data.withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-2 text-xs border-b border-border/40 pb-1.5 last:border-0"
              >
                <span className="font-mono font-bold text-accent">{usdt(w.amount_cents)}</span>
                <span className="text-muted-foreground font-mono">{w.network}</span>
                <span
                  className={`font-bold ml-auto ${STATUS_CLS[w.status] ?? "text-muted-foreground"}`}
                >
                  {w.status.toUpperCase()}
                </span>
                <span className="text-[10px] text-muted-foreground">{dateTime(w.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.ledger.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">LEDGER</h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {data.ledger.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 text-xs border-b border-border/40 pb-1 last:border-0"
              >
                <span
                  className={`font-mono font-bold ${e.amount_cents >= 0 ? "text-accent" : "text-destructive"}`}
                >
                  {e.amount_cents >= 0 ? "+" : ""}
                  {usdt(Math.abs(e.amount_cents))}
                </span>
                <span className="text-muted-foreground flex-1 truncate">
                  {e.type}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
                <span className="font-mono text-muted-foreground text-[10px]">
                  {usdt(e.balance_after_cents)}
                </span>
                <span className="text-[10px] text-muted-foreground">{dateTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
