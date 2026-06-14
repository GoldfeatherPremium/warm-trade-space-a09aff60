"use client";

import { useEffect, useState, useTransition } from "react";
import { adminAdjustCredits, adminGetUserCredits, adminListCredits } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usdt } from "@/lib/format";

export default function AdminCredits() {
  const [q, setQ] = useState("");
  const [withBalanceOnly, setWB] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const [list, setList] = useState<Awaited<ReturnType<typeof adminListCredits>> | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminGetUserCredits>> | null>(
    null,
  );
  const [adj, setAdj] = useState({ amount: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadList = () => {
    adminListCredits({ q, withBalanceOnly })
      .then((d) => setList(d))
      .catch(() => {});
  };

  useEffect(() => {
    loadList();
  }, [q, withBalanceOnly]);

  const loadDetail = () => {
    if (!selected) return;
    adminGetUserCredits({ userId: selected })
      .then((d) => setDetail(d))
      .catch(() => {});
  };

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const adjust = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await adminAdjustCredits({
          userId: selected!,
          amountCents: Math.round(Number(adj.amount || 0) * 100),
          note: adj.note,
        });
        setSuccess("Adjustment recorded.");
        setAdj({ amount: "", note: "" });
        loadList();
        loadDetail();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="grid md:grid-cols-[1fr_1.2fr] gap-4">
      <section className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search username / email…"
            className="h-8 text-xs"
          />
          <label className="flex items-center gap-2 shrink-0 text-[10px] font-bold uppercase tracking-wider">
            <Switch checked={withBalanceOnly} onCheckedChange={setWB} /> &gt; 0
          </label>
        </div>
        <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
          {(list?.rows ?? []).map((r) => (
            <button
              key={r.user_id}
              onClick={() => setSelected(r.user_id)}
              className={`w-full text-left px-3 py-2 hover:bg-secondary flex items-center justify-between gap-3 ${
                selected === r.user_id ? "bg-secondary" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{r.username}</p>
                <p className="text-[10px] text-muted-foreground truncate">{r.email}</p>
              </div>
              <p className="text-sm font-mono text-accent shrink-0">{usdt(r.balance_cents)}</p>
            </button>
          ))}
          {(list?.rows.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground p-6 text-center">No matches.</p>
          )}
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg">
        {!selected ? (
          <p className="text-xs text-muted-foreground p-10 text-center">
            Select a user to view ledger and adjust.
          </p>
        ) : (
          <div className="p-4 space-y-4">
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
            <div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground">USER</p>
              <p className="font-bold">{detail?.user?.username}</p>
              <p className="text-[10px] text-muted-foreground">{detail?.user?.email}</p>
              <p className="font-display text-2xl text-accent mt-2">{usdt(detail?.balance ?? 0)}</p>
            </div>
            <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end bg-secondary/40 rounded-md p-3">
              <div>
                <Label className="text-[10px]">Amount (USDT, negative to revoke)</Label>
                <Input
                  value={adj.amount}
                  onChange={(e) => setAdj({ ...adj, amount: e.target.value })}
                  placeholder="e.g. 5 or -3.50"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-[10px]">Reason (audit log)</Label>
                <Input
                  value={adj.note}
                  onChange={(e) => setAdj({ ...adj, note: e.target.value })}
                  placeholder="Goodwill, contest win, etc."
                  className="h-8"
                />
              </div>
              <Button
                size="sm"
                disabled={isPending || !adj.amount || !adj.note}
                onClick={() => adjust()}
              >
                Apply
              </Button>
            </div>
            <div className="border border-border rounded-md max-h-[55vh] overflow-y-auto divide-y divide-border">
              {(detail?.ledger ?? []).map((row) => (
                <div key={row.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      {row.note ?? row.type}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-widest">
                        {row.source ?? row.type}
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-mono font-bold shrink-0 ${
                      row.amount_cents > 0 ? "text-accent" : ""
                    }`}
                  >
                    {row.amount_cents > 0 ? "+" : ""}
                    {usdt(row.amount_cents)}
                  </p>
                </div>
              ))}
              {(detail?.ledger.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground p-6 text-center">No history.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
