import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import {
  TrendingUp,
  Activity,
  Target,
  BarChart3,
  Wallet,
  ShoppingCart,
  Star,
  CalendarDays,
  Boxes,
  AlertTriangle,
  PackageCheck,
} from "lucide-react";
import { getSellerOverview } from "@/lib/api/seller";
import { usdt } from "@/lib/format";
import { StatCard, SectionCard, StatGridSkeleton } from "@/components/dashboard";

// Lazy-loaded so the recharts bundle stays off the dashboard's critical path.
const SalesAreaChart = lazy(() => import("@/components/charts/sales-area-chart"));

export const Route = createFileRoute("/seller/")({
  component: SellerOverview,
});

function SellerOverview() {
  const { data } = useQuery({ queryKey: ["sellerOverview"], queryFn: () => getSellerOverview() });

  if (!data)
    return (
      <div className="space-y-5">
        <StatGridSkeleton count={4} />
        <div className="h-44 rounded-lg bg-card border border-border animate-pulse" />
        <StatGridSkeleton count={3} cols={3} />
      </div>
    );

  const intel = data.intelligence;
  const completionTone =
    data.profile.completionRate >= 95
      ? "up"
      : data.profile.completionRate >= 85
        ? "neutral"
        : "down";

  return (
    <div className="space-y-5">
      {/* Action banners — fulfilment & disputes first, they're time-sensitive. */}
      {(data.needsDelivery > 0 || data.openDisputes > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.needsDelivery > 0 && (
            <Link
              to="/seller/orders"
              className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/40 rounded-lg p-3 hover:border-blue-500/70 transition-colors"
            >
              <PackageCheck className="size-5 text-blue-400 shrink-0" />
              <p className="text-sm font-bold text-blue-400">
                {data.needsDelivery} order{data.needsDelivery > 1 ? "s" : ""} awaiting delivery —
                SLA running
              </p>
            </Link>
          )}
          {data.openDisputes > 0 && (
            <Link
              to="/seller/orders"
              className="flex items-center gap-3 bg-destructive/10 border border-destructive/40 rounded-lg p-3 hover:border-destructive/70 transition-colors"
            >
              <AlertTriangle className="size-5 text-destructive shrink-0" />
              <p className="text-sm font-bold text-destructive">
                {data.openDisputes} open dispute{data.openDisputes > 1 ? "s" : ""} — respond with
                evidence
              </p>
            </Link>
          )}
        </div>
      )}

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="SALES TODAY"
          icon={ShoppingCart}
          value={usdt(data.today.s)}
          sub={`${data.today.c} order${data.today.c === 1 ? "" : "s"}`}
        />
        <StatCard
          label="SALES 7 DAYS"
          icon={CalendarDays}
          value={usdt(data.week.s)}
          sub={`${data.week.c} order${data.week.c === 1 ? "" : "s"}`}
        />
        <StatCard
          label="SALES 30 DAYS"
          icon={BarChart3}
          value={usdt(data.month.s)}
          sub={`${data.month.c} order${data.month.c === 1 ? "" : "s"}`}
        />
        <StatCard
          label="RATING"
          icon={Star}
          value={data.profile.rating > 0 ? `★ ${data.profile.rating.toFixed(1)}` : "—"}
          sub={data.profile.rating > 0 ? `${data.profile.ratingCount} reviews` : "no reviews yet"}
        />
      </div>

      {/* Business intelligence */}
      <SectionCard
        title="BUSINESS INTELLIGENCE"
        icon={BarChart3}
        action={
          <span className="text-[9px] text-muted-foreground tracking-widest">
            TRAILING 14d MODEL
          </span>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="THIS WEEK"
            icon={Activity}
            value={usdt(intel.thisWeekCents)}
            sub={`vs ${usdt(intel.lastWeekCents)} last`}
            tone={intel.wowPct >= 0 ? "up" : "down"}
            delta={`${intel.wowPct >= 0 ? "+" : ""}${intel.wowPct}% WoW`}
          />
          <StatCard
            label="7-DAY FORECAST"
            icon={Target}
            value={usdt(intel.forecast7dCents)}
            sub={`${usdt(intel.avgDailyCents)} / day avg`}
          />
          <StatCard
            label="CONVERSION"
            icon={TrendingUp}
            value={`${intel.conversionPct}%`}
            sub={`${intel.sold.toLocaleString()} / ${intel.views.toLocaleString()} views`}
            tone={intel.conversionPct >= 5 ? "up" : "neutral"}
          />
          <StatCard
            label="COMPLETION"
            icon={Activity}
            value={`${data.profile.completionRate.toFixed(0)}%`}
            sub={`Level ${data.profile.level}`}
            tone={completionTone}
          />
        </div>
        {intel.lastWeekCents > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            {intel.wowPct >= 0 ? (
              <>
                <span className="text-accent font-bold">Momentum up.</span> You're outpacing last
                week by {intel.wowPct}%. If you sustain it, next week's payout could clear{" "}
                <span className="font-mono text-foreground">{usdt(intel.forecast7dCents)}</span>.
              </>
            ) : (
              <>
                <span className="text-yellow-400 font-bold">Slowing down.</span> Sales are{" "}
                {Math.abs(intel.wowPct)}% under last week.{" "}
                <Link to="/seller/promotions" className="text-primary hover:underline">
                  Sponsored Boost
                </Link>{" "}
                on your top converter can rebuild the trend.
              </>
            )}
          </p>
        )}
      </SectionCard>

      <SectionCard title="NET SALES — LAST 14 DAYS">
        <div className="h-44">
          <Suspense
            fallback={<div className="h-full w-full rounded bg-secondary/40 animate-pulse" />}
          >
            <SalesAreaChart data={data.daily} />
          </Suspense>
        </div>
      </SectionCard>

      {/* Wallet */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="AVAILABLE"
          icon={Wallet}
          value={usdt(data.wallet.available_cents)}
          valueCls="text-accent"
          to="/seller/wallet"
        />
        <StatCard
          label="IN ESCROW"
          value={usdt(data.wallet.pending_cents)}
          valueCls="text-yellow-400"
          to="/seller/wallet"
        />
        <StatCard
          label="FROZEN"
          value={usdt(data.wallet.frozen_cents)}
          valueCls="text-destructive"
          to="/seller/wallet"
        />
      </div>

      {data.topProducts.length > 0 && (
        <SectionCard title="PRODUCT PERFORMANCE" icon={Boxes}>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_60px_60px_70px_60px] gap-2 text-[9px] font-bold text-muted-foreground tracking-widest pb-1 border-b border-border">
              <span>PRODUCT</span>
              <span className="text-right">VIEWS</span>
              <span className="text-right">SOLD</span>
              <span className="text-right">CONV.</span>
              <span className="text-right">STOCK</span>
            </div>
            {data.topProducts.map((tp) => {
              const conv = tp.views > 0 ? ((tp.sold_count / tp.views) * 100).toFixed(1) : "—";
              return (
                <div
                  key={tp.id}
                  className="grid grid-cols-[1fr_60px_60px_70px_60px] gap-2 text-xs py-1 border-b border-border/40 last:border-0 items-center"
                >
                  <span className="truncate font-bold">{tp.title}</span>
                  <span className="text-right font-mono text-muted-foreground">{tp.views}</span>
                  <span className="text-right font-mono">{tp.sold_count}</span>
                  <span
                    className={`text-right font-mono ${Number(conv) >= 5 ? "text-accent" : "text-muted-foreground"}`}
                  >
                    {conv}%
                  </span>
                  <span
                    className={`text-right font-mono ${tp.delivery_type === "auto" && tp.stock_count <= 5 ? "text-yellow-400" : "text-muted-foreground"}`}
                  >
                    {tp.delivery_type === "auto" ? tp.stock_count : "∞"}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {data.lowStock.length > 0 && (
        <SectionCard title="LOW STOCK" className="border-yellow-500/30">
          <div className="space-y-1">
            {data.lowStock.map((p) => (
              <Link
                key={p.id}
                to="/seller/stock/$productId"
                params={{ productId: p.id }}
                className="flex justify-between text-xs py-1 hover:text-primary"
              >
                <span className="truncate">{p.title}</span>
                <span className="font-mono text-yellow-400">{p.stock_count} left</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="bg-card border border-border rounded-lg p-4 text-xs text-muted-foreground leading-relaxed">
        <b className="text-foreground">Seller level {data.profile.level}</b> ·{" "}
        {data.profile.totalSales} lifetime sales · {data.profile.completionRate.toFixed(0)}%
        completion. Levels rise with sales volume, rating and low dispute rate — higher levels
        unlock more listings and bigger weekly withdrawal caps.
      </div>
    </div>
  );
}
