"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listWithdrawalQueueAction,
  listDepositsAction,
  reviewWithdrawalAction,
} from "@/server/actions/admin";
import { usdt, dateTime } from "@/lib/format";

type Withdrawal = Awaited<ReturnType<typeof listWithdrawalQueueAction>>[number];
type Deposit = Awaited<ReturnType<typeof listDepositsAction>>[number];

const STATUS_CLS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  sent: "bg-accent/15 text-accent",
  rejected: "bg-destructive/15 text-destructive",
  completed: "bg-emerald-500/15 text-emerald-400",
};

const BTN_CLS = "px-3 py-1.5 rounded-md text-xs font-bold";
const INPUT_CLS =
  "bg-secondary border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50";

function WithdrawalCard({ w, onRefresh }: { w: Withdrawal; onRefresh: () => void }) {
  const [txHash, setTxHash] = useState("");
  const [showTxInput, setShowTxInput] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const canAct = w.status === "pending" || w.status === "approved";

  async function act(action: "approve" | "mark_sent" | "reject") {
    if (action === "mark_sent" && !txHash.trim()) {
      setShowTxInput(true);
      return;
    }
    setBusy(true);
    setError(null);
    startTransition(async () => {
      try {
        await reviewWithdrawalAction({
          withdrawalId: w.id,
          action,
          txHash: action === "mark_sent" ? txHash.trim() : undefined,
          note: action === "reject" ? "" : undefined,
        });
        onRefresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Action failed.");
        setBusy(false);
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{w.username}</span>
            <span className="text-xs text-muted-foreground">{w.email}</span>
            <span className="text-[10px] text-muted-foreground">L{w.seller_level}</span>
          </div>
          <div className="text-xs text-muted-foreground font-mono">{w.wallet_address}</div>
          <div className="text-[10px] text-muted-foreground">
            Network: <span className="text-foreground">{w.usdt_network}</span>
          </div>
        </div>
        <div className="text-right space-y-0.5 shrink-0">
          <div className="font-bold text-sm">{usdt(w.amount_cents)}</div>
          <div className="text-[10px] text-muted-foreground">Fee: {usdt(w.fee_cents)}</div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_CLS[w.status] ?? "bg-secondary text-muted-foreground"}`}
          >
            {w.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground flex-wrap gap-1">
        <span>Created: {dateTime(w.created_at)}</span>
        <span>Wallet available: {usdt(w.wallet_available)}</span>
      </div>

      {canAct && (
        <div className="pt-1 border-t border-border space-y-2">
          {showTxInput && (
            <input
              type="text"
              className={`${INPUT_CLS} w-full font-mono`}
              placeholder="Transaction hash…"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
            />
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 flex-wrap">
            {w.status === "pending" && (
              <button
                disabled={busy}
                onClick={() => act("approve")}
                className={`${BTN_CLS} bg-emerald-600 text-white disabled:opacity-50`}
              >
                {busy ? "…" : "Approve"}
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => act("mark_sent")}
              className={`${BTN_CLS} bg-primary text-primary-foreground disabled:opacity-50`}
            >
              {busy ? "…" : showTxInput ? "Confirm sent" : "Mark sent"}
            </button>
            <button
              disabled={busy}
              onClick={() => act("reject")}
              className={`${BTN_CLS} bg-destructive text-destructive-foreground disabled:opacity-50`}
            >
              {busy ? "…" : "Reject"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DepositRow({ d }: { d: Deposit }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-2 flex-wrap">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{d.username}</span>
          <span className="text-xs text-muted-foreground font-mono">{d.order_no}</span>
        </div>
        <div className="text-[10px] text-muted-foreground">{dateTime(d.created_at)}</div>
      </div>
      <div className="text-right space-y-0.5">
        <div className="font-bold text-sm">{usdt(d.amount_cents)}</div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_CLS[d.status] ?? "bg-secondary text-muted-foreground"}`}
        >
          {d.status.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

export function FinanceClient() {
  const [tab, setTab] = useState<"withdrawals" | "deposits">("withdrawals");
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadWithdrawals() {
    setLoading(true);
    try {
      const data = await listWithdrawalQueueAction();
      setWithdrawals(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadDeposits() {
    setLoading(true);
    try {
      const data = await listDepositsAction();
      setDeposits(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "withdrawals") void loadWithdrawals();
    else void loadDeposits();
  }, [tab]);

  const TABS = [
    { key: "withdrawals", label: "Withdrawals" },
    { key: "deposits", label: "Deposits" },
  ] as const;

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">Finance</h1>

      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold ${
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tab === "withdrawals" ? (
        withdrawals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawals in queue.</p>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <WithdrawalCard key={w.id} w={w} onRefresh={loadWithdrawals} />
            ))}
          </div>
        )
      ) : deposits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deposits found.</p>
      ) : (
        <div className="space-y-2">
          {deposits.map((d) => (
            <DepositRow key={d.id} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}
