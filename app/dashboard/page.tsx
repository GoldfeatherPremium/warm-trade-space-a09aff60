import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShoppingBag,
  Wallet,
  CreditCard,
  Heart,
  Sparkles,
  PackageCheck,
  Clock,
  Users,
  AlertTriangle,
  TrendingUp,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { currentUser } from "@/server/auth";
import { getBuyerDashboardData } from "@/server/queries/buyer";
import { ORDER_STATUS_META, usdt, timeAgo } from "@/lib/format";
import { PublicShell } from "../_components/site-shell";
import { productImage } from "../_lib/product-image";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

function StatCard({
  label,
  value,
  sub,
  href,
  icon: Icon,
  accent = false,
  warn = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  warn?: boolean;
}) {
  const inner = (
    <div
      className={`relative bg-card border rounded-2xl p-4 overflow-hidden h-full ${
        warn ? "border-primary/40" : "border-border"
      } ${href ? "card-hover" : ""}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`size-8 rounded-lg grid place-items-center shrink-0 ${
            accent || warn ? "bg-primary/20" : "bg-secondary"
          }`}
        >
          <Icon className={`size-4 ${accent || warn ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        {href && (
          <ArrowUpRight className="size-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
        )}
      </div>
      <p className={`font-mono text-xl font-bold ${accent ? "text-gradient-brand" : ""}`}>
        {value}
      </p>
      <p className="text-[9px] font-bold tracking-widest text-muted-foreground mt-1 uppercase">
        {label}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block group">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/auth?redirect=/dashboard");
  const data = await getBuyerDashboardData(user.id);

  return (
    <PublicShell>
      {/* Header */}
      <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">
            BUYER DASHBOARD
          </p>
          <h1 className="font-display text-3xl leading-none">
            WELCOME, <span className="text-gradient-brand">{user.username.toUpperCase()}</span>
          </h1>
        </div>
        <Link
          href="/browse"
          className="bg-primary text-primary-foreground text-xs font-bold rounded-xl px-4 py-2.5 hover:bg-primary/90 transition-colors"
        >
          Browse market →
        </Link>
      </div>

      {/* Action alert */}
      {data.stats.actionNeeded > 0 && (
        <Link
          href="/orders"
          className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl p-3.5 hover:border-primary/60 transition-colors mb-5"
        >
          <AlertTriangle className="size-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-primary">
              {data.stats.actionNeeded} order
              {data.stats.actionNeeded > 1 ? "s" : ""} need your attention
            </p>
            <p className="text-[10px] text-primary/70">Pay or confirm receipt to continue</p>
          </div>
          <ChevronRight className="size-4 text-primary shrink-0" />
        </Link>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Active Orders"
          icon={ShoppingBag}
          value={data.stats.activeOrders}
          sub={`${data.stats.totalOrders} lifetime`}
          href="/orders"
          warn={data.stats.actionNeeded > 0}
        />
        <StatCard
          label="Total Spent"
          icon={TrendingUp}
          value={usdt(data.stats.totalSpentCents)}
          sub={`${data.stats.completedOrders} completed`}
          accent
        />
        <StatCard
          label="Store Credit"
          icon={CreditCard}
          value={usdt(data.credits.balance_cents)}
          sub="Spendable at checkout"
          href="/account/credits"
          accent
        />
        <StatCard
          label="Wallet"
          icon={Wallet}
          value={usdt(data.wallet.available_cents)}
          sub="Available balance"
          href="/wallet"
        />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        {/* Recent orders */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3.5" /> RECENT ORDERS
            </h2>
            <Link href="/orders" className="text-[10px] font-bold text-primary hover:underline">
              View all →
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingBag className="size-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-bold mb-1">No orders yet</p>
              <p className="text-xs text-muted-foreground mb-3">
                Your recent purchases will appear here
              </p>
              <Link href="/browse" className="text-xs font-bold text-primary hover:underline">
                Browse the market →
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {data.recent.map((o) => {
                const meta = ORDER_STATUS_META[o.status] ?? {
                  label: o.status,
                  cls: "bg-muted text-muted-foreground",
                };
                return (
                  <Link
                    key={o.id}
                    href={`/orders/${o.id}`}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors group"
                  >
                    <img
                      src={productImage(o.image_key)}
                      alt=""
                      className="size-10 rounded-lg object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                        {o.product_title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {o.order_no} · @{o.counterparty} · {timeAgo(o.created_at)}
                      </p>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 ${meta.cls}`}
                    >
                      {meta.label.toUpperCase()}
                    </span>
                    <span className="font-mono text-accent text-xs whitespace-nowrap shrink-0">
                      {usdt(o.total_cents)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Loyalty tier */}
          {data.loyalty && (
            <div className={`border rounded-2xl p-4 space-y-3 ${data.loyalty.cls}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-widest opacity-70 flex items-center gap-1.5 mb-0.5">
                    <Sparkles className="size-3" /> LOYALTY TIER
                  </p>
                  <p className="font-display text-2xl">{data.loyalty.label.toUpperCase()}</p>
                </div>
                <div className="text-right text-[11px]">
                  <p className="opacity-60 text-[10px]">Lifetime spend</p>
                  <p className="font-mono text-sm font-bold">
                    {usdt(data.loyalty.lifetimeSpendCents)}
                  </p>
                </div>
              </div>
              {data.loyalty.nextTierLabel && (
                <div>
                  <div className="flex justify-between text-[10px] opacity-70 mb-1.5">
                    <span>→ {data.loyalty.nextTierLabel}</span>
                    <span>{usdt(data.loyalty.nextTierRemainingCents)} to go</span>
                  </div>
                  <div className="h-1.5 bg-background/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-current opacity-80 transition-all duration-500 rounded-full"
                      style={{ width: `${data.loyalty.progressPct ?? 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Favorites + Following */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/favorites"
              className="bg-card border border-border rounded-2xl p-3 text-center card-hover group"
            >
              <Heart className="size-5 text-rose-400 mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="font-bold text-sm">{data.stats.favorites}</p>
              <p className="text-[10px] text-muted-foreground">Favorites</p>
            </Link>
            <Link
              href="/account/following"
              className="bg-card border border-border rounded-2xl p-3 text-center card-hover group"
            >
              <Users className="size-5 text-primary mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="font-bold text-sm">{data.stats.following}</p>
              <p className="text-[10px] text-muted-foreground">Following</p>
            </Link>
          </div>

          {/* Account shortcut */}
          <Link
            href="/account"
            className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5 card-hover group"
          >
            <div className="size-10 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center text-sm font-bold text-primary uppercase shrink-0">
              {user.username.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{user.username}</p>
              <p className="text-[10px] text-muted-foreground">Account &amp; settings</p>
            </div>
            <PackageCheck className="size-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
