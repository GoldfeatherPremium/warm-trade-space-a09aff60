import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleDollarSign, History } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getBuyerCredits } from "@/lib/server/money.server";
import { q, q1 } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { usdt, dateTime } from "@/lib/format";
import { PublicShell } from "../../_components/site-shell";

export const metadata: Metadata = { title: "Store Credits" };
export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/auth?redirect=/account/credits");

  await appContext();
  const [credits, ledger, pending] = await Promise.all([
    getBuyerCredits(user.id),
    q<{
      id: number;
      type: string;
      amount_cents: number;
      balance_after_cents: number;
      note: string | null;
      created_at: number;
    }>(
      `select id, type, amount_cents, balance_after_cents, note, created_at
         from credit_ledger where user_id = ? order by created_at desc limit 100`,
      [user.id],
    ),
    q1<{ amount_cents: number }>(
      `select amount_cents from withdrawals where user_id = ? and from_credits = 1 and status = 'pending' order by created_at desc limit 1`,
      [user.id],
    ),
  ]);

  return (
    <PublicShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-3xl">STORE CREDITS</h1>
          <Link href="/legal/credits" className="text-[11px] text-primary font-bold">
            How credits work →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-accent/15 via-card to-card border border-accent/30 rounded-xl p-5">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground">BALANCE</p>
          <p className="font-display text-4xl text-accent mt-1 flex items-center gap-2">
            <CircleDollarSign className="size-7" /> {usdt(credits.balance_cents)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 max-w-md">
            Apply credits at checkout for instant payment. Credits are automatically applied when
            your balance covers the full order amount.
          </p>
        </div>

        {pending && (
          <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3 text-xs">
            Withdrawal of <b>{usdt(pending.amount_cents)}</b> is pending admin approval.
          </div>
        )}

        {ledger.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-xs font-bold tracking-widest mb-3 flex items-center gap-1.5">
              <History className="size-4" /> CREDIT HISTORY
            </h2>
            <div className="space-y-1">
              {ledger.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 text-xs border-b border-border/50 pb-1 last:border-0"
                >
                  <span className="text-[10px] font-bold bg-secondary px-1.5 py-0.5 rounded whitespace-nowrap">
                    {l.type.replaceAll("_", " ").toUpperCase()}
                  </span>
                  <span className="text-muted-foreground text-[10px] truncate flex-1">
                    {l.note}
                  </span>
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
          </div>
        )}
      </div>
    </PublicShell>
  );
}
