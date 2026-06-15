"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  adminListCreditsAction,
  adminGetUserCreditsAction,
  adminAdjustCreditsAction,
} from "@/server/actions/admin";
import { usdt, dateTime } from "@/lib/format";

type UserRow = { user_id: string; username: string; email: string; balance_cents: number };
type UserDetail = Awaited<ReturnType<typeof adminGetUserCreditsAction>>;

export function CreditsClient() {
  const [q, setQ] = useState("");
  const [withBalanceOnly, setWithBalanceOnly] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Load user list
  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await adminListCreditsAction({ q, withBalanceOnly });
        setUsers(result as UserRow[]);
      } catch (e) {
        console.error(e);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, withBalanceOnly]);

  // Load user detail when selected changes
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    startTransition(async () => {
      try {
        const result = await adminGetUserCreditsAction({ userId: selected });
        setDetail(result);
      } catch (e) {
        console.error(e);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !amount) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    startTransition(async () => {
      try {
        const result = await adminAdjustCreditsAction({ userId: selected, amountCents, note });
        if (result?.ok) {
          setMsg("Adjustment applied.");
          setAmount("");
          setNote("");
          // Reload detail
          const fresh = await adminGetUserCreditsAction({ userId: selected });
          setDetail(fresh);
          // Reload list
          const freshList = await adminListCreditsAction({ q, withBalanceOnly });
          setUsers(freshList as UserRow[]);
        } else {
          setMsg((result as { error?: string })?.error ?? "Failed.");
        }
      } catch (e) {
        setMsg((e as Error)?.message ?? "Error");
      }
    });
  }

  const ledger =
    (
      detail as {
        ledger?: Array<{
          type: string;
          amount_cents: number;
          note: string | null;
          source: string | null;
          created_at: number;
        }>;
      }
    )?.ledger ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-display font-semibold">Buyer Credits</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Adjust credit balances and view ledger history.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[600px]">
        {/* Left: user list */}
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border space-y-2 shrink-0">
            <input
              type="text"
              placeholder="Search username or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={withBalanceOnly}
                onChange={(e) => setWithBalanceOnly(e.target.checked)}
                className="accent-primary"
              />
              With balance only
            </label>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {users.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">No users found.</p>
            ) : (
              users.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => setSelected(u.user_id)}
                  className={`w-full text-left px-4 py-3 flex justify-between items-center hover:bg-secondary transition-colors ${
                    selected === u.user_id ? "bg-secondary" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{u.username}</p>
                    <p className="text-[10px] text-muted-foreground">{u.email}</p>
                  </div>
                  <span className="text-sm font-mono font-semibold">{usdt(u.balance_cents)}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: user detail */}
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Select a user to view their credits.</p>
            </div>
          ) : !detail ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Loading…</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Header */}
              <div>
                <p className="text-[9px] font-bold tracking-widest text-muted-foreground">USER</p>
                <p className="text-lg font-semibold mt-0.5">
                  {(detail as { username?: string }).username}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(detail as { email?: string }).email}
                </p>
                <p className="text-3xl font-display font-bold mt-2 text-accent">
                  {usdt((detail as { balance_cents?: number }).balance_cents ?? 0)}
                </p>
              </div>

              {/* Adjustment form */}
              <form
                onSubmit={handleAdjust}
                className="space-y-3 border border-border rounded-xl p-4"
              >
                <p className="text-[9px] font-bold tracking-widest text-muted-foreground">
                  ADJUST BALANCE
                </p>
                {msg && (
                  <p className="text-xs px-3 py-2 rounded-lg bg-accent/10 text-accent border border-accent/20">
                    {msg}
                  </p>
                )}
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    AMOUNT (USDT, negative to deduct)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5.00 or -2.50"
                    required
                    className="bg-secondary rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground">REASON / NOTE</span>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for adjustment…"
                    className="bg-secondary rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Apply Adjustment
                </button>
              </form>

              {/* Ledger */}
              <div>
                <p className="text-[9px] font-bold tracking-widest text-muted-foreground mb-2">
                  LEDGER
                </p>
                {ledger.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No ledger entries.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
                          <th className="text-left px-3 py-2 font-medium">Type</th>
                          <th className="text-right px-3 py-2 font-medium">Amount</th>
                          <th className="text-left px-3 py-2 font-medium">Note / Source</th>
                          <th className="text-right px-3 py-2 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {ledger.map((entry, i) => (
                          <tr key={i} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-3 py-2 font-mono">{entry.type}</td>
                            <td
                              className={`px-3 py-2 text-right font-mono tabular-nums ${entry.amount_cents >= 0 ? "text-accent" : "text-destructive"}`}
                            >
                              {entry.amount_cents >= 0 ? "+" : ""}
                              {usdt(entry.amount_cents)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">
                              {entry.note ?? entry.source ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                              {dateTime(entry.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
