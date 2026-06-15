import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Store, ShieldCheck, Banknote, TrendingUp, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/server/auth";
import { q1 } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { dateTime } from "@/lib/format";
import { PublicShell } from "../_components/site-shell";
import { SellForm } from "./sell-form";

export const metadata: Metadata = { title: "Become a Seller — X-VAULT" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; cls: string; note: string }> = {
  pending: {
    label: "Under review",
    cls: "bg-yellow-500/15 text-yellow-400",
    note: "We'll review your application within 48 hours and notify you by notification.",
  },
  approved: {
    label: "Approved",
    cls: "bg-accent/15 text-accent",
    note: "You're an approved seller! Head to your seller dashboard to list your first product.",
  },
  rejected: {
    label: "Not approved",
    cls: "bg-destructive/15 text-destructive",
    note: "Your application was not approved this time. See the note below, then you may reapply.",
  },
  suspended: {
    label: "Suspended",
    cls: "bg-destructive/15 text-destructive",
    note: "Your seller account has been suspended. Contact support for details.",
  },
};

export default async function SellPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/auth?redirect=/sell");

  // If already approved seller, redirect to dashboard
  if (user.seller_status === "approved") redirect("/seller");

  await appContext();
  const app = await q1<{
    status: string;
    admin_note: string | null;
    created_at: number;
  }>(
    `select status, admin_note, created_at from seller_applications where user_id = ? order by created_at desc limit 1`,
    [user.id],
  );

  const perks = [
    {
      icon: ShieldCheck,
      title: "Buyer-protected escrow",
      desc: "Funds held until delivery is confirmed — no chargebacks, no fraud.",
    },
    {
      icon: Banknote,
      title: "USDT payouts",
      desc: "Get paid in USDT directly to your wallet after each completed order.",
    },
    {
      icon: TrendingUp,
      title: "Growth tools",
      desc: "Promotions, coupons, subscriptions, and analytics built in.",
    },
    {
      icon: Store,
      title: "Your own storefront",
      desc: "Custom URL, reviews, verified badge — build your brand.",
    },
  ];

  return (
    <PublicShell>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2 py-6">
          <Store className="size-12 mx-auto text-accent" />
          <h1 className="font-display text-4xl">Sell on X-VAULT</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Join thousands of sellers moving digital goods on the most trusted platform. Zero
            listing fees — we only earn when you do.
          </p>
        </div>

        {/* Perks */}
        <div className="grid sm:grid-cols-2 gap-3">
          {perks.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-4 flex gap-3">
              <Icon className="size-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Application status */}
        {app && (
          <div
            className={`border rounded-xl p-5 space-y-2 ${app.status === "approved" ? "border-accent/30 bg-accent/5" : app.status === "pending" ? "border-yellow-500/30 bg-yellow-500/5" : "border-destructive/30 bg-destructive/5"}`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-accent" />
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_META[app.status]?.cls ?? "bg-muted"}`}
              >
                {STATUS_META[app.status]?.label ?? app.status}
              </span>
              <span className="text-[11px] text-muted-foreground ml-auto">
                Applied {dateTime(app.created_at)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{STATUS_META[app.status]?.note}</p>
            {app.admin_note && (
              <div className="pl-3 border-l-2 border-border">
                <p className="text-[10px] font-bold text-muted-foreground">STAFF NOTE</p>
                <p className="text-xs mt-0.5">{app.admin_note}</p>
              </div>
            )}
            {app.status === "approved" && (
              <Link
                href="/seller"
                className="inline-block mt-2 px-4 py-2 text-sm font-bold bg-accent text-accent-foreground rounded-lg"
              >
                Go to seller dashboard →
              </Link>
            )}
          </div>
        )}

        {/* Show form only if no pending/approved application */}
        {(!app || app.status === "rejected") && (
          <>
            <div className="border-t border-border pt-4">
              <h2 className="font-display text-2xl mb-1">
                {app?.status === "rejected" ? "Reapply" : "Apply to sell"}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Fill in the form below — the whole process takes about 5 minutes.
              </p>
            </div>
            <SellForm />
          </>
        )}
      </div>
    </PublicShell>
  );
}
