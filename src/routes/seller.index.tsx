import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { TrendingUp, TrendingDown, Activity, Target, BarChart3 } from "lucide-react";
import { getSellerOverview } from "@/lib/api/seller";
import { usdt } from "@/lib/format";

// Lazy-loaded so the recharts bundle stays off the dashboard's critical path.
const SalesAreaChart = lazy(() => import("@/components/charts/sales-area-chart"));

export const Route = createFileRoute("/seller/")({
  component: SellerOverview,
});

function SellerOverview() {
  const { data } = useQuery({ queryKey: ["sellerOverview"], queryFn: () => getSellerOverview() });
  if (!data) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "SALES TODAY", v: `${data.today.c} · ${usdt(data.today.s)}` },
          { label: "SALES 7 DAYS", v: `${data.week.c} · ${usdt(data.week.s)}` },
          { label: "SALES 30 DAYS", v: `${data.month.c} · ${usdt(data.month.s)}` },
          {
            label: "RATING",
            v:
              data.profile.rating > 0
                ? `★ ${data.profile.rating.toFixed(1)} (${data.profile.ratingCount})`
                : "no reviews",
          },
        ].map((x) => (
          <div key={x.label} className="bg-card border border-border rounded-lg p-4">
            <p className="text-[9px] font-bold tracking-widest text-muted-foreground">{x.label}</p>
            <p className="font-mono text-sm mt-1">{x.v}</p>
          </div>
        ))}
      </div>

      {/* Business Intelligence — weekly performance, forecast, conversion */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
            <BarChart3 className="size-3.5" /> BUSINESS INTELLIGENCE
          </h2>
          <span className="text-[9px] text-muted-foreground tracking-widest">
            TRAILING 14d MODEL
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BIStat
            icon={<Activity className="size-3.5" />}
            label="THIS WEEK"
            value={usdt(data.intelligence.thisWeekCents)}
            sub={`vs ${usdt(data.intelligence.lastWeekCents)} last`}
            tone={data.intelligence.wowPct >= 0 ? "up" : "down"}
            delta={`${data.intelligence.wowPct >= 0 ? "+" : ""}${data.intelligence.wowPct}% WoW`}
          />
          <BIStat
            icon={<Target className="size-3.5" />}
            label="7-DAY FORECAST"
            value={usdt(data.intelligence.forecast7dCents)}
            sub={`${usdt(data.intelligence.avgDailyCents)} / day avg`}
            tone="neutral"
          />
          <BIStat
            icon={<TrendingUp className="size-3.5" />}
            label="CONVERSION"
            value={`${data.intelligence.conversionPct}%`}
            sub={`${data.intelligence.sold.toLocaleString()} / ${data.intelligence.views.toLocaleString()} views`}
            tone={data.intelligence.conversionPct >= 5 ? "up" : "neutral"}
          />
          <BIStat
            icon={<Activity className="size-3.5" />}
            label="COMPLETION"
            value={`${data.profile.completionRate.toFixed(0)}%`}
            sub={`Level ${data.profile.level}`}
            tone={
              data.profile.completionRate >= 95
                ? "up"
                : data.profile.completionRate >= 85
                  ? "neutral"
                  : "down"
            }
          />
        </div>
        {data.intelligence.lastWeekCents > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            {data.intelligence.wowPct >= 0 ? (
              <>
                <span className="text-accent font-bold">Momentum up.</span> You're outpacing last
                week by {data.intelligence.wowPct}%. If you sustain it, next week's payout could
                clear{" "}
                <span className="font-mono text-foreground">
                  {usdt(data.intelligence.forecast7dCents)}
                </span>
                .
              </>
            ) : (
              <>
                <span className="text-yellow-400 font-bold">Slowing down.</span> Sales are{" "}
                {Math.abs(data.intelligence.wowPct)}% under last week.{" "}
                <Link to="/seller/promotions" className="text-primary hover:underline">
                  Sponsored Boost
                </Link>{" "}
                on your top converter can rebuild the trend.
              </>
            )}
          </p>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
          NET SALES — LAST 14 DAYS
        </h2>
        <div className="h-44">
          <Suspense
            fallback={<div className="h-full w-full rounded bg-secondary/40 animate-pulse" />}
          >
            <SalesAreaChart data={data.daily} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "AVAILABLE", v: usdt(data.wallet.available_cents), cls: "text-accent" },
          { label: "IN ESCROW", v: usdt(data.wallet.pending_cents), cls: "text-yellow-400" },
          { label: "FROZEN", v: usdt(data.wallet.frozen_cents), cls: "text-destructive" },
        ].map((x) => (
          <Link
            to="/seller/wallet"
            key={x.label}
            className="bg-card border border-border rounded-lg p-4 hover:border-primary/50"
          >
            <p className="text-[9px] font-bold tracking-widest text-muted-foreground">{x.label}</p>
            <p className={`font-mono text-lg mt-1 ${x.cls}`}>{x.v}</p>
          </Link>
        ))}
      </div>

      {data.topProducts.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-2">
            PRODUCT PERFORMANCE
          </h2>
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
        </div>
      )}

      {(data.needsDelivery > 0 || data.openDisputes > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.needsDelivery > 0 && (
            <Link
              to="/seller/orders"
              className="bg-blue-500/10 border border-blue-500/40 rounded-lg p-4 text-sm font-bold text-blue-400"
            >
              ⚡ {data.needsDelivery} order{data.needsDelivery > 1 ? "s" : ""} awaiting delivery —
              SLA running!
            </Link>
          )}
          {data.openDisputes > 0 && (
            <Link
              to="/seller/orders"
              className="bg-destructive/10 border border-destructive/40 rounded-lg p-4 text-sm font-bold text-destructive"
            >
              ⚠ {data.openDisputes} open dispute{data.openDisputes > 1 ? "s" : ""} — respond with
              evidence
            </Link>
          )}
        </div>
      )}

      {data.lowStock.length > 0 && (
        <div className="bg-card border border-yellow-500/30 rounded-lg p-4">
          <h2 className="text-xs font-bold tracking-widest text-yellow-400 mb-2">LOW STOCK</h2>
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

function BIStat({
  icon,
  label,
  value,
  sub,
  delta,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  tone: "up" | "down" | "neutral";
}) {
  const toneCls =
    tone === "up" ? "text-accent" : tone === "down" ? "text-destructive" : "text-muted-foreground";
  const TrendIcon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : null;
  return (
    <div className="bg-background/40 border border-border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold tracking-widest text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </p>
        {delta && (
          <span className={`text-[9px] font-bold flex items-center gap-0.5 ${toneCls}`}>
            {TrendIcon && <TrendIcon className="size-2.5" />}
            {delta}
          </span>
        )}
      </div>
      <p className="font-mono text-base mt-1.5">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
