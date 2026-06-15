import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { User, Trophy, CreditCard, Share2, Heart, Users } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getLoyaltySnapshot } from "@/lib/server/loyalty.server";
import { appContext } from "@/lib/server/app.server";
import { usdt } from "@/lib/format";
import { PublicShell } from "../_components/site-shell";
import { AccountClient } from "./account-client";

export const metadata: Metadata = { title: "Account — X-VAULT" };
export const dynamic = "force-dynamic";

const TIER_CLS: Record<string, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-400",
  gold: "text-yellow-400",
  platinum: "text-cyan-400",
  diamond: "text-purple-400",
};

export default async function AccountPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/auth?redirect=/account");

  await appContext();
  const loyalty = await getLoyaltySnapshot(user.id);

  const quickLinks = [
    { href: "/account/credits", icon: CreditCard, label: "Store credits" },
    { href: "/account/affiliate", icon: Share2, label: "Affiliate & referrals" },
    { href: "/favorites", icon: Heart, label: "Favorites" },
    { href: "/account/following", icon: Users, label: "Following" },
  ];

  return (
    <PublicShell>
      <h1 className="font-display text-3xl mb-6">ACCOUNT</h1>
      <div className="grid lg:grid-cols-[1fr_260px] gap-6 max-w-3xl">
        <AccountClient
          user={{
            username: user.username,
            email: user.email,
            locale: user.locale,
            preferred_currency: user.preferred_currency,
            country: user.country,
          }}
        />

        <div className="space-y-4">
          {/* Loyalty tier */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="size-4 text-yellow-400" />
              <h2 className="text-xs font-bold tracking-widest">LOYALTY</h2>
            </div>
            <p className={`font-display text-2xl ${TIER_CLS[loyalty.tier] ?? "text-foreground"}`}>
              {loyalty.tier.toUpperCase()}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {usdt(loyalty.lifetimeSpendCents)} lifetime spend
            </p>
            {loyalty.nextTier && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {usdt(loyalty.nextTierRemainingCents)} more to {loyalty.nextTierLabel}
              </p>
            )}
          </div>

          {/* Quick links */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-1">
            <h2 className="text-xs font-bold tracking-widest mb-3">QUICK LINKS</h2>
            {quickLinks.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary transition-colors text-sm"
              >
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
