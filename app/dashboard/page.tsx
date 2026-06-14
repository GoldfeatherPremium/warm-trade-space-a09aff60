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
} from "lucide-react";
import { currentUser } from "@/server/auth";
import { getBuyerDashboardData } from "@/server/queries/buyer";
import { ORDER_STATUS_META, usdt, timeAgo } from "@/lib/format";
import { PublicShell } from "../_components/site-shell";
import { productImage } from "../_lib/product-image";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

function Stat({
  label,
  value,
  sub,
  href,
  icon: Icon,
  valueCls,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  valueCls?: string;
  highlight?: boolean;
}) {
  const body = (
    <>
      <p className="text-[9px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className={`font-mono text-lg mt-1.5 ${valueCls ?? ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>}
    </>
  );
  const cls = `block bg-card border rounded-lg p-4 transition-colors ${
    highlight ? "border-yellow-500/40" : "border-border"
  } ${href ? "hover:border-primary/50" : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/auth?redirect=/dashboard");
  const data = await getBuyerDashboardData(user.id);

  return (
    <PublicShell>
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">DASHBOARD</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Welcome back, <span className="text-foreground font-bold">{user.username}</span>.
          </p>
        </div>
        <Link
          href="/browse"
          className="bg-primary text-primary-foreground text-xs font-bold rounded-md px-4 py-2 hover:opacity-90"
        >
          Browse the market →
        </Link>
      </div>

      {data.stats.actionNeeded > 0 && (
        <Link
          href="/orders"
          className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/40 rounded-lg p-3 hover:border-blue-500/70 transition-colors mb-5"
        >
          <AlertTriangle className="size-5 text-blue-400 shrink-0" />
          <p className="text-sm font-bold text-blue-400">
            {data.stats.actionNeeded} order{data.stats.actionNeeded > 1 ? "s" : ""} need your
            attention
          </p>
          <span className="text-[10px] text-blue-400/80 ml-auto">Pay or confirm receipt →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat
          label="ACTIVE ORDERS"
          icon={ShoppingBag}
          value={data.stats.activeOrders}
          sub={`${data.stats.totalOrders} lifetime`}
          href="/orders"
          highlight={data.stats.actionNeeded > 0}
        />
        <Stat
          label="TOTAL SPENT"
          icon={PackageCheck}
          value={usdt(data.stats.totalSpentCents)}
          sub={`${data.stats.completedOrders} completed`}
          valueCls="text-accent"
        />
        <Stat
          label="STORE CREDIT"
          icon={CreditCard}
          value={usdt(data.credits.balance_cents)}
          sub="Spendable at checkout"
          href="/account/credits"
          valueCls="text-accent"
        />
        <Stat
          label="WALLET"
          icon={Wallet}
          value={usdt(data.wallet.available_cents)}
          sub="Available balance"
          href="/wallet"
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <section className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3.5" /> RECENT ORDERS
            </h2>
            <Link href="/orders" className="text-[10px] font-bold text-primary hover:underline">
              All orders →
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingBag className="size-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-bold">No orders yet</p>
              <Link href="/browse" className="text-xs font-bold text-primary hover:underline">
                Browse the market →
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.recent.map((o) => {
                const meta = ORDER_STATUS_META[o.status] ?? {
                  label: o.status,
                  cls: "bg-muted text-muted-foreground",
                };
                return (
                  <Link
                    key={o.id}
                    href={`/orders/${o.id}`}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 transition-colors"
                  >
                    {" "}
                    <img
                      src={productImage(o.image_key)}
                      alt=""
                      className="size-10 rounded-md object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{o.product_title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {o.order_no} · {o.counterparty} · {timeAgo(o.created_at)}
                      </p>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${meta.cls}`}
                    >
                      {meta.label.toUpperCase()}
                    </span>
                    <span className="font-mono text-accent text-xs whitespace-nowrap">
                      {usdt(o.total_cents)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <div className="space-y-4">
          {data.loyalty && (
            <div className={`border rounded-lg p-4 space-y-3 ${data.loyalty.cls}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-widest opacity-80 flex items-center gap-1">
                    <Sparkles className="size-3" /> LOYALTY TIER
                  </p>
                  <p className="font-display text-2xl">{data.loyalty.label.toUpperCase()}</p>
                </div>
                <div className="text-right text-[11px] opacity-90">
                  <p>Lifetime spend</p>
                  <p className="font-mono text-sm">{usdt(data.loyalty.lifetimeSpendCents)}</p>
                </div>
              </div>
              {data.loyalty.nextTierLabel && (
                <div>
                  <div className="flex justify-between text-[10px] opacity-80 mb-1">
                    <span>Next: {data.loyalty.nextTierLabel}</span>
                    <span>{usdt(data.loyalty.nextTierRemainingCents)} to go</span>
                  </div>
                  <div className="h-1.5 bg-background/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-current opacity-80"
                      style={{ width: `${data.loyalty.progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Stat label="FAVORITES" icon={Heart} value={data.stats.favorites} href="/favorites" />
            <Stat
              label="FOLLOWING"
              icon={Users}
              value={data.stats.following}
              href="/account/following"
            />
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
