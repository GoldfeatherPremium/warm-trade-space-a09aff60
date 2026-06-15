import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Share2 } from "lucide-react";
import { requireUser } from "@/server/auth";
import { q1, run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { now, uid } from "@/lib/server/core.server";
import { usdt, dateTime } from "@/lib/format";
import { PublicShell } from "../../_components/site-shell";
import { AffiliateCopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Affiliate — X-VAULT" };
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default async function AffiliatePage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/auth?redirect=/account/affiliate");

  await appContext();
  let r = await q1<{
    id: string;
    code: string;
    commission_pct: number;
    click_count: number;
    signup_count: number;
    purchase_count: number;
    earnings_cents: number;
    created_at: number;
  }>(
    `select id, code, commission_pct, click_count, signup_count, purchase_count, earnings_cents, created_at
       from referrals where owner_user_id = ?`,
    [user.id],
  );
  if (!r) {
    const id = uid();
    let code = genCode();
    let tries = 0;
    while (tries < 5 && (await q1(`select 1 as x from referrals where code = ?`, [code]))) {
      code = genCode();
      tries++;
    }
    await run(
      `insert into referrals (id, owner_user_id, code, commission_pct, created_at) values (?,?,?,?,?)`,
      [id, user.id, code, 5, now()],
    );
    r = await q1(
      `select id, code, commission_pct, click_count, signup_count, purchase_count, earnings_cents, created_at from referrals where id = ?`,
      [id],
    );
  }

  const link = `${SITE_URL}/r/${r!.code}`;

  return (
    <PublicShell>
      <div className="max-w-2xl space-y-6">
        <h1 className="font-display text-3xl flex items-center gap-2">
          <Share2 className="size-6 text-accent" /> REFER &amp; EARN
        </h1>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground tracking-widest">
              YOUR REFERRAL LINK
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Earn <b className="text-accent">{r!.commission_pct}%</b> wallet credit every time
              someone you refer completes a purchase. Paid out automatically when escrow releases.
            </p>
          </div>
          <AffiliateCopyButton link={link} code={r!.code} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "CLICKS", v: r!.click_count.toLocaleString() },
            { label: "SIGN-UPS", v: r!.signup_count.toLocaleString() },
            { label: "PURCHASES", v: r!.purchase_count.toLocaleString() },
            { label: "EARNED", v: usdt(r!.earnings_cents), cls: "text-accent" },
          ].map((x) => (
            <div key={x.label} className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-[9px] font-bold tracking-widest text-muted-foreground">
                {x.label}
              </p>
              <p className={`font-display text-2xl mt-1 ${x.cls ?? ""}`}>{x.v}</p>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-muted-foreground space-y-1">
          <p>
            • Commission is credited to your wallet when the referred buyer's first order is
            released from escrow.
          </p>
          <p>• Referral attribution lasts 30 days from the first click.</p>
          <p>• Self-referrals are not counted.</p>
          <p className="pt-1">Referral code active since {dateTime(r!.created_at)}.</p>
        </div>
      </div>
    </PublicShell>
  );
}
