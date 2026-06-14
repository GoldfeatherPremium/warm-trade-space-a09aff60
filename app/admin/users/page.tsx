"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  adminAdjustWallet,
  adminListUsers,
  adminUserAction,
  aiRiskScoreUser,
} from "@/server/actions/admin";
import { dateTime, usdt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [adjustFor, setAdjustFor] = useState<string | null>(null);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof adminListUsers>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () =>
    adminListUsers({ q: q || undefined })
      .then((d) => setData(d))
      .catch(() => {});

  useEffect(() => {
    let alive = true;
    adminListUsers({ q: q || undefined })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [q]);

  const action = (vars: Parameters<typeof adminUserAction>[0]) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await adminUserAction(vars);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const adjust = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await adminAdjustWallet({
          userId: adjustFor!,
          amountUsdt: parseFloat(adjAmount),
          note: adjNote,
        });
        setSuccess("Balance adjusted");
        setAdjustFor(null);
        setAdjAmount("");
        setAdjNote("");
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">USERS</h1>
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
      <Input
        placeholder="Search username / email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-xs h-9"
      />
      <div className="space-y-2">
        {data?.users.map((u) => (
          <div
            key={u.id as string}
            className="bg-card border border-border rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold">{u.username}</span>
              <span className="text-muted-foreground">{u.email}</span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-secondary">
                {(u.role as string).toUpperCase()}
              </span>
              {u.seller_status === "approved" && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-primary/15 text-primary">
                  SELLER Lv.{u.seller_level}
                </span>
              )}
              {!!u.is_banned && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive">
                  BANNED
                </span>
              )}
              {!!u.wallet_frozen && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">
                  WALLET FROZEN
                </span>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">
                joined {dateTime(u.created_at as number)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">
              available {usdt(u.available_cents as number)} · escrow{" "}
              {usdt(u.pending_cents as number)} · frozen {usdt(u.frozen_cents as number)}
              {(u.total_sales as number) > 0 ? ` · ${u.total_sales} sales` : ""}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant={u.is_banned ? "secondary" : "destructive"}
                className="h-7 text-[10px]"
                onClick={() =>
                  action({ userId: u.id as string, action: u.is_banned ? "unban" : "ban" })
                }
                disabled={isPending}
              >
                {u.is_banned ? "Unban" : "Ban"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-[10px]"
                onClick={() =>
                  action({
                    userId: u.id as string,
                    action: u.wallet_frozen ? "unfreeze_wallet" : "freeze_wallet",
                  })
                }
                disabled={isPending}
              >
                {u.wallet_frozen ? "Unfreeze wallet" : "Freeze wallet"}
              </Button>
              {u.seller_status === "approved" && (
                <select
                  className="bg-secondary border border-border rounded-md px-2 text-[10px] h-7"
                  value={u.seller_level as number}
                  onChange={(e) =>
                    action({
                      userId: u.id as string,
                      action: "set_seller_level",
                      level: Number(e.target.value),
                    })
                  }
                >
                  {[1, 2, 3, 4, 5].map((l) => (
                    <option key={l} value={l}>
                      Level {l}
                    </option>
                  ))}
                </select>
              )}
              <select
                className="bg-secondary border border-border rounded-md px-2 text-[10px] h-7"
                value={u.role as string}
                onChange={(e) =>
                  action({
                    userId: u.id as string,
                    action: "set_role",
                    role: e.target.value as never,
                  })
                }
              >
                {["buyer", "seller", "support", "finance", "admin"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {adjustFor === u.id ? (
                <>
                  <Input
                    placeholder="±USDT"
                    type="number"
                    className="h-7 text-[10px] w-20"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                  />
                  <Input
                    placeholder="Note (audited)"
                    className="h-7 text-[10px] w-40"
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="h-7 text-[10px]"
                    disabled={isPending || !adjAmount || adjNote.length < 5}
                    onClick={() => adjust()}
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px]"
                    onClick={() => setAdjustFor(null)}
                  >
                    ×
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-[10px]"
                  onClick={() => setAdjustFor(u.id as string)}
                >
                  Adjust balance
                </Button>
              )}
            </div>
            <RiskCheck userId={u.id as string} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskCheck({ userId }: { userId: string }) {
  const [result, setResult] = useState<{
    riskScore: number;
    band: string;
    reasons: string[];
    recommendation: string;
    ageDays: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await aiRiskScoreUser({ userId });
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const bandColor =
    result?.band === "high"
      ? "text-destructive"
      : result?.band === "medium"
        ? "text-yellow-400"
        : "text-accent";
  return (
    <div className="border-t border-border pt-2 mt-1">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[10px]"
          onClick={() => run()}
          disabled={isPending}
        >
          <Sparkles className="size-3 mr-1" />
          {isPending ? "Scoring…" : result ? "Re-score" : "AI fraud check"}
        </Button>
        {result && (
          <span className={`text-[10px] font-bold ${bandColor}`}>
            Risk {result.riskScore}/100 · {result.band.toUpperCase()}
          </span>
        )}
      </div>
      {error && <p className="text-[10px] text-destructive mt-1">{error}</p>}
      {result && (
        <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
          <ul className="list-disc ml-4">
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <p className="text-foreground">→ {result.recommendation}</p>
        </div>
      )}
    </div>
  );
}
