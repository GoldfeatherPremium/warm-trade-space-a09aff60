import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  Store,
} from "lucide-react";
import { getBuyerDashboard } from "@/lib/api/dashboard";
import { useMe } from "@/hooks/use-me";
import { PageShell } from "@/components/shell";
import {
  StatCard,
  SectionCard,
  SectionAction,
  EmptyState,
  StatGridSkeleton,
} from "@/components/dashboard";
import { ORDER_STATUS_META, usdt, timeAgo } from "@/lib/format";
import { productImage } from "@/lib/images";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — X-VAULT" }] }),
  component: BuyerDashboard,
});

function BuyerDashboard() {
  const { me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["buyerDashboard"],
    queryFn: () => getBuyerDashboard(),
    enabled: !!me,
  });

  if (!me)
    return (
      <PageShell>
        <div className="py-20 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Sign in to view your dashboard.</p>
          <Link to="/auth" className="text-primary text-sm font-bold">
            Sign in / Register →
          </Link>
        </div>
      </PageShell>
    );

  return (
    <PageShell>
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">DASHBOARD</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Welcome back, <span className="text-foreground font-bold">{me.username}</span>.
          </p>
        </div>
        <Link
          to="/browse"
          className="bg-primary text-primary-foreground text-xs font-bold rounded-md px-4 py-2 hover:opacity-90"
        >
          Browse the market →
        </Link>
      </div>

      {isLoading || !data ? (
        <div className="space-y-5">
          <StatGridSkeleton count={4} />
          <StatGridSkeleton count={2} cols={4} />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Action banner */}
          {data.stats.actionNeeded > 0 && (
            <Link
              to="/orders"
              className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/40 rounded-lg p-3 hover:border-blue-500/70 transition-colors"
            >
              <AlertTriangle className="size-5 text-blue-400 shrink-0" />
              <p className="text-sm font-bold text-blue-400">
                {data.stats.actionNeeded} order{data.stats.actionNeeded > 1 ? "s" : ""} need your
                attention
              </p>
              <span className="text-[10px] text-blue-400/80 ml-auto">Pay or confirm receipt →</span>
            </Link>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="ACTIVE ORDERS"
              icon={ShoppingBag}
              value={data.stats.activeOrders}
              sub={`${data.stats.totalOrders} lifetime`}
              to="/orders"
              valueCls="text-foreground"
              highlight={data.stats.actionNeeded > 0}
            />
            <StatCard
              label="TOTAL SPENT"
              icon={PackageCheck}
              value={usdt(data.stats.totalSpentCents)}
              sub={`${data.stats.completedOrders} completed`}
              valueCls="text-accent"
            />
            <StatCard
              label="STORE CREDIT"
              icon={CreditCard}
              value={usdt(data.credits.balance_cents)}
              sub="Spendable at checkout"
              to="/account/credits"
              valueCls="text-accent"
            />
            <StatCard
              label="WALLET"
              icon={Wallet}
              value={usdt(data.wallet.available_cents)}
              sub="Available balance"
              to="/wallet"
            />
          </div>

          <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
            {/* Recent orders */}
            <SectionCard
              title="RECENT ORDERS"
              icon={Clock}
              action={<SectionAction to="/orders" label="All orders" />}
              bodyClassName="space-y-1.5"
            >
              {data.recent.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="No orders yet"
                  description="Your purchases will appear here with live status."
                  action={{ to: "/browse", label: "Browse the market" }}
                />
              ) : (
                data.recent.map((o) => {
                  const meta = ORDER_STATUS_META[o.status] ?? {
                    label: o.status,
                    cls: "bg-muted text-muted-foreground",
                  };
                  return (
                    <Link
                      key={o.id}
                      to="/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 transition-colors"
                    >
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
                })
              )}
            </SectionCard>

            {/* Loyalty + quick stats */}
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
                          className="h-full bg-current opacity-80 transition-all"
                          style={{ width: `${data.loyalty.progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="FAVORITES"
                  icon={Heart}
                  value={data.stats.favorites}
                  to="/favorites"
                />
                <StatCard
                  label="FOLLOWING"
                  icon={Users}
                  value={data.stats.following}
                  to="/account/following"
                />
              </div>

              <SectionCard title="QUICK LINKS" bodyClassName="grid grid-cols-2 gap-2">
                {[
                  { to: "/disputes", label: "Disputes", icon: AlertTriangle },
                  { to: "/account/affiliate", label: "Refer & earn", icon: Users },
                  { to: "/account/credits", label: "Credits", icon: CreditCard },
                  { to: "/sellers", label: "Top sellers", icon: Store },
                ].map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="flex items-center gap-2 text-xs font-bold bg-secondary/50 hover:bg-secondary rounded-md px-3 py-2.5 transition-colors"
                  >
                    <l.icon className="size-3.5 text-muted-foreground" />
                    {l.label}
                  </Link>
                ))}
              </SectionCard>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
