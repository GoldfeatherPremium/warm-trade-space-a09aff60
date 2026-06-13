import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CircleDollarSign, ArrowDownToLine, History, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/use-me";
import { getMyCredits, requestCreditWithdrawal } from "@/lib/api/credits";
import { usdt } from "@/lib/format";

export const Route = createFileRoute("/account/credits")({
  head: () => ({ meta: [{ title: "Store Credits — X-VAULT" }] }),
  component: CreditsPage,
});

function CreditsPage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["myCredits"],
    queryFn: () => getMyCredits(),
    enabled: !!me,
  });
  const [wd, setWd] = useState({ amount: "", address: "", network: "TRC20" as "TRC20" | "BEP20" });
  const submitWd = useMutation({
    mutationFn: () =>
      requestCreditWithdrawal({
        data: {
          amountCents: Math.round(Number(wd.amount || 0) * 100),
          address: wd.address.trim(),
          network: wd.network,
        },
      }),
    onSuccess: () => {
      toast.success("Withdrawal requested — pending admin approval.");
      setWd({ amount: "", address: "", network: "TRC20" });
      qc.invalidateQueries({ queryKey: ["myCredits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!me)
    return (
      <PageShell>
        <div className="py-20 text-center text-sm text-muted-foreground">Please sign in.</div>
      </PageShell>
    );

  const balance = data?.balance ?? 0;
  return (
    <PageShell>
      <div className="max-w-3xl mx-auto py-6 space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-3xl">STORE CREDITS</h1>
          <Link to="/legal/credits" className="text-[11px] text-primary font-bold">
            How credits work →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-accent/15 via-card to-card border border-accent/30 rounded-xl p-5">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground">BALANCE</p>
          <p className="font-display text-4xl text-accent mt-1 flex items-center gap-2">
            <CircleDollarSign className="size-7" /> {usdt(balance)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 max-w-md">
            Apply credits at checkout for instant payment, or request a withdrawal to your USDT
            wallet (fee applies). Credits do not expire unless marked promotional.
          </p>
        </div>

        {data?.pendingWithdrawal && (
          <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3 text-xs">
            Withdrawal of <b>{usdt(data.pendingWithdrawal.amount_cents)}</b> is pending admin
            approval.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <section className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <ArrowDownToLine className="size-4" /> Request withdrawal
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Minimum 1.00 USDT. A 2% fee (min 1.00 USDT) covers network costs and processing.
            </p>
            <div className="space-y-2">
              <div>
                <Label className="text-[10px]">Amount (USDT)</Label>
                <Input
                  inputMode="decimal"
                  value={wd.amount}
                  onChange={(e) => setWd({ ...wd, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-[10px]">Network</Label>
                <select
                  className="w-full h-9 rounded-md bg-secondary text-sm px-2"
                  value={wd.network}
                  onChange={(e) =>
                    setWd({ ...wd, network: e.target.value as "TRC20" | "BEP20" })
                  }
                >
                  <option value="TRC20">TRC20 (Tron)</option>
                  <option value="BEP20">BEP20 (BSC)</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px]">Wallet address</Label>
                <Input
                  value={wd.address}
                  onChange={(e) => setWd({ ...wd, address: e.target.value })}
                  placeholder="T... or 0x..."
                />
              </div>
              <Button
                className="w-full"
                disabled={submitWd.isPending || !wd.amount || !wd.address}
                onClick={() => submitWd.mutate()}
              >
                {submitWd.isPending ? "Submitting…" : "Request withdrawal"}
              </Button>
            </div>
          </section>

          <section className="bg-card border border-border rounded-lg p-4 space-y-2">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" /> Buyer-friendly refunds
            </h2>
            <p className="text-[11px] text-muted-foreground">
              When an order is refunded, the amount is credited here instantly. You can spend it
              on your next order with zero gas — or withdraw it.
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-1.5 mt-2">
              <li>• Instant checkout — no network confirmations.</li>
              <li>• Stack with coupons & loyalty discounts.</li>
              <li>• Withdrawals reviewed by staff within 24h.</li>
            </ul>
          </section>
        </div>

        <section className="bg-card border border-border rounded-lg">
          <h2 className="font-bold text-sm flex items-center gap-2 px-4 py-3 border-b border-border">
            <History className="size-4" /> History
          </h2>
          {(data?.ledger.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground p-6 text-center">No credit activity yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {data!.ledger.map((row) => (
                <div key={row.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
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
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-mono font-bold ${
                        row.amount_cents > 0 ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {row.amount_cents > 0 ? "+" : ""}
                      {usdt(row.amount_cents)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      balance {usdt(row.balance_after_cents)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
