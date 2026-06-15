"use client";

import { useEffect, useState, useTransition } from "react";
import { listDeposits, listWithdrawalQueue, reviewWithdrawal } from "@/server/actions/admin";
import { GENERIC_STATUS_CLS, dateTime, usdt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminFinance() {
  const [wd, setWd] = useState<Awaited<ReturnType<typeof listWithdrawalQueue>> | null>(null);
  const [dp, setDp] = useState<Awaited<ReturnType<typeof listDeposits>> | null>(null);
  const [txHashes, setTxHashes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    listWithdrawalQueue()
      .then((d) => setWd(d))
      .catch(() => {});
    listDeposits()
      .then((d) => setDp(d))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const review = (vars: {
    withdrawalId: string;
    action: "approve" | "reject" | "mark_sent";
    txHash?: string;
  }) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await reviewWithdrawal(vars);
        setSuccess("Updated");
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="space-y-6">
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
      <div className="space-y-3">
        <h1 className="font-display text-2xl">WITHDRAWAL QUEUE</h1>
        {wd?.withdrawals.length === 0 && (
          <p className="text-sm text-muted-foreground">No withdrawals.</p>
        )}
        {wd?.withdrawals.map((w) => (
          <div
            key={w.id as string}
            className="bg-card border border-border rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold">{w.username}</span>
              <span className="text-[10px] text-muted-foreground">
                Lv.{w.seller_level} · wallet {usdt((w.wallet_available as number) ?? 0)}
              </span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded ${GENERIC_STATUS_CLS[w.status as string] ?? "bg-muted"}`}
              >
                {(w.status as string).toUpperCase()}
              </span>
              <span className="font-mono text-accent ml-auto">
                {usdt(w.amount_cents as number)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                fee {usdt(w.fee_cents as number)}
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">
              {w.network} → {w.address} {w.tx_hash ? `· tx ${w.tx_hash}` : ""} ·{" "}
              {dateTime(w.created_at as number)}
            </p>
            {["pending", "approved"].includes(w.status as string) && (
              <div className="flex gap-2 items-center flex-wrap">
                {w.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => review({ withdrawalId: w.id as string, action: "approve" })}
                      disabled={isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => review({ withdrawalId: w.id as string, action: "reject" })}
                      disabled={isPending}
                    >
                      Reject & refund
                    </Button>
                  </>
                )}
                <Input
                  placeholder="On-chain tx hash"
                  className="h-8 text-xs w-64 font-mono"
                  value={txHashes[w.id as string] ?? ""}
                  onChange={(e) => setTxHashes({ ...txHashes, [w.id as string]: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPending || !txHashes[w.id as string]}
                  onClick={() =>
                    review({
                      withdrawalId: w.id as string,
                      action: "mark_sent",
                      txHash: txHashes[w.id as string],
                    })
                  }
                >
                  Mark sent
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-2xl">DEPOSITS MONITOR</h2>
        <div className="bg-card border border-border rounded-lg p-3 space-y-1">
          {dp?.deposits.length === 0 && (
            <p className="text-sm text-muted-foreground p-2">No deposits.</p>
          )}
          {dp?.deposits.map((d) => (
            <div
              key={d.id as string}
              className="flex items-center gap-2 text-xs border-b border-border/50 pb-1 last:border-0"
            >
              <span className="font-mono text-primary">{d.order_no ?? "—"}</span>
              <span className="text-muted-foreground">{d.username}</span>
              <span className="text-[10px] text-muted-foreground font-mono truncate flex-1">
                {d.network} · {(d.pay_address as string).slice(0, 16)}…
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${GENERIC_STATUS_CLS[d.status as string] ?? "bg-muted"}`}
              >
                {(d.status as string).toUpperCase()}
              </span>
              <span className="font-mono text-accent">{usdt(d.amount_cents as number)}</span>
              <span className="text-[10px] text-muted-foreground">
                {dateTime(d.created_at as number)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
