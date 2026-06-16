"use client";

import { useState } from "react";
import { requestWithdrawalAction } from "@/server/actions/wallet";
import { usdt, dateTime } from "@/lib/format";

const GENERIC_STATUS_CLS: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  processing: "bg-accent/15 text-accent",
  completed: "bg-accent/15 text-accent",
  rejected: "bg-destructive/15 text-destructive",
};

type WalletData = {
  wallet: { available_cents: number; pending_cents: number; frozen_cents: number };
  ledger: Array<{
    id: number;
    type: string;
    amount_cents: number;
    balance_after_cents: number;
    note: string | null;
    created_at: number;
  }>;
  withdrawals: Array<{
    id: string;
    amount_cents: number;
    fee_cents: number;
    address: string;
    network: string;
    status: string;
    tx_hash: string | null;
    created_at: number;
  }>;
  fees: { withdrawalFeeCents: number; minWithdrawalCents: number };
  payoutDefaults: { usdt_payout_address: string; usdt_network: string } | null;
  walletFrozen: boolean;
};

export function WalletClient({ initial }: { initial: WalletData }) {
  const [data, setData] = useState(initial);
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<"TRC20" | "BEP20" | "ERC20">("TRC20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const inputCls =
    "bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50";

  async function withdraw() {
    const addr = address || data.payoutDefaults?.usdt_payout_address || "";
    if (!amount || !addr) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    const res = await requestWithdrawalAction({
      amountUsdt: parseFloat(amount),
      address: addr,
      network,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAmount("");
    setSuccess(true);
  }

  const exportCsv = () => {
    const rows = [
      ["date", "type", "amount_usdt", "balance_after_usdt", "note"],
      ...data.ledger.map((l) => [
        new Date(l.created_at).toISOString(),
        l.type,
        (l.amount_cents / 100).toFixed(2),
        (l.balance_after_cents / 100).toFixed(2),
        `"${(l.note ?? "").replaceAll('"', '""')}"`,
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      {/* Balance grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "AVAILABLE", v: data.wallet.available_cents, cls: "text-accent" },
          { label: "IN ESCROW", v: data.wallet.pending_cents, cls: "text-warning" },
          { label: "FROZEN", v: data.wallet.frozen_cents, cls: "text-destructive" },
        ].map((x) => (
          <div key={x.label} className="bg-card border border-border rounded-lg p-4">
            <p className="text-[9px] font-bold tracking-widest text-muted-foreground">{x.label}</p>
            <p className={`font-mono text-lg mt-1 ${x.cls}`}>{usdt(x.v)}</p>
          </div>
        ))}
      </div>

      {data.walletFrozen && (
        <p className="text-xs bg-destructive/10 text-destructive border border-destructive/30 rounded-lg p-3">
          Your wallet is frozen by staff. Withdrawals are disabled — contact support.
        </p>
      )}

      {/* Withdrawal form */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-xs font-bold tracking-widest">REQUEST WITHDRAWAL</h2>
        {success && (
          <p className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
            Withdrawal requested — finance will review it shortly.
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <div className="grid sm:grid-cols-[120px_1fr_110px_auto] gap-2 items-center">
          <input
            type="number"
            min={1}
            step="0.01"
            placeholder="Amount (USDT)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls}
          />
          <input
            placeholder={data.payoutDefaults?.usdt_payout_address ?? "USDT payout address"}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputCls}
          />
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value as never)}
            className={`${inputCls} w-full`}
          >
            <option>TRC20</option>
            <option>BEP20</option>
            <option>ERC20</option>
          </select>
          <button
            onClick={withdraw}
            disabled={busy || !amount || data.walletFrozen || (!address && !data.payoutDefaults)}
            className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60 whitespace-nowrap"
          >
            {busy ? "Requesting…" : "Withdraw"}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Fee: {usdt(data.fees.withdrawalFeeCents)} flat · minimum{" "}
          {usdt(data.fees.minWithdrawalCents)} · reviewed by finance before payout.
        </p>
      </div>

      {/* Withdrawal history */}
      {data.withdrawals.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-bold tracking-widest mb-3">WITHDRAWALS</h2>
          <div className="space-y-1.5">
            {data.withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-2 text-xs border-b border-border/50 pb-1.5 last:border-0"
              >
                <span className="font-mono">{usdt(w.amount_cents)}</span>
                <span className="text-muted-foreground text-[10px] truncate flex-1">
                  {w.network} · {w.address.slice(0, 12)}…
                  {w.tx_hash ? ` · tx ${w.tx_hash.slice(0, 12)}…` : ""}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${GENERIC_STATUS_CLS[w.status] ?? "bg-muted"}`}
                >
                  {w.status.toUpperCase()}
                </span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {dateTime(w.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold tracking-widest">LEDGER</h2>
          {data.ledger.length > 0 && (
            <button
              onClick={exportCsv}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Export CSV
            </button>
          )}
        </div>
        {data.ledger.length === 0 ? (
          <p className="text-xs text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="space-y-1">
            {data.ledger.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 text-xs border-b border-border/50 pb-1 last:border-0"
              >
                <span className="text-[10px] font-bold bg-secondary px-1.5 py-0.5 rounded whitespace-nowrap">
                  {l.type.replaceAll("_", " ").toUpperCase()}
                </span>
                <span className="text-muted-foreground text-[10px] truncate flex-1">{l.note}</span>
                <span
                  className={`font-mono whitespace-nowrap ${l.amount_cents >= 0 ? "text-accent" : "text-destructive"}`}
                >
                  {l.amount_cents >= 0 ? "+" : ""}
                  {usdt(l.amount_cents)}
                </span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {dateTime(l.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
