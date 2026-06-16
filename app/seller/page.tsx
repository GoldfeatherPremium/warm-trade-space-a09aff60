"use client";

import { useEffect, useState, useTransition, lazy, Suspense } from "react";
import Link from "next/link";
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
import { getSellerOverviewAction } from "@/server/actions/seller";
import { usdt } from "@/lib/format";

const SalesAreaChart = lazy(() => import("../_components/charts/sales-area-chart"));

type Overview = Awaited<ReturnType<typeof getSellerOverviewAction>>;

function StatCard({
  label,
  icon: Icon,
  value,
  sub,
  tone,
  delta,
  valueCls,
  to,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  value: string;
  sub?: string;
  tone?: "up" | "down" | "neutral";
  delta?: string;
  valueCls?: string;
  to?: string;
}) {
  const body = (
    <div className="bg-card border border-border/60 rounded-2xl p-4 card-hover group overflow-hidden relative">
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/4 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
        aria-hidden
      />
      <p className="text-[9px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5 relative">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </p>
      <p className={`font-mono text-xl mt-2 font-bold relative ${valueCls ?? ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1 relative">{sub}</p>}
      {delta && (
        <p
          className={`text-[10px] font-bold mt-0.5 ${tone === "up" ? "text-accent" : tone === "down" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {delta}
        </p>
      )}
    </div>
  );
  return to ? <Link href={to}>{body}</Link> : body;
}

export default function SellerOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const d = await getSellerOverviewAction();
      setData(d);
    });
  }, []);

  if (!data)
    return (
      <div className="space-y-5 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border" />
          ))}
        </div>
        <div className="h-44 rounded-lg bg-card border border-border" />
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
      {(data.needsDelivery > 0 || data.openDisputes > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.needsDelivery > 0 && (
            <Link
              href="/seller/orders"
              className="flex items-center gap-3 bg-accent/10 border border-accent/40 rounded-lg p-3 hover:border-accent/70 transition-colors"
            >
              <PackageCheck className="size-5 text-accent shrink-0" />
              <p className="text-sm font-bold text-accent">
                {data.needsDelivery} order{data.needsDelivery > 1 ? "s" : ""} awaiting delivery
              </p>
            </Link>
          )}
          {data.openDisputes > 0 && (
            <Link
              href="/seller/orders"
              className="flex items-center gap-3 bg-destructive/10 border border-destructive/40 rounded-lg p-3 hover:border-destructive/70 transition-colors"
            >
              <AlertTriangle className="size-5 text-destructive shrink-0" />
              <p className="text-sm font-bold text-destructive">
                {data.openDisputes} open dispute{data.openDisputes > 1 ? "s" : ""}
              </p>
            </Link>
          )}
        </div>
      )}

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
          sub={`${data.week.c} orders`}
        />
        <StatCard
          label="SALES 30 DAYS"
          icon={BarChart3}
          value={usdt(data.month.s)}
          sub={`${data.month.c} orders`}
        />
        <StatCard
          label="RATING"
          icon={Star}
          value={data.profile.rating > 0 ? `★ ${data.profile.rating.toFixed(1)}` : "—"}
          sub={data.profile.rating > 0 ? `${data.profile.ratingCount} reviews` : "no reviews yet"}
        />
      </div>

      <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-3">
        <p className="text-[9px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
          <BarChart3 className="size-3.5" /> BUSINESS INTELLIGENCE
        </p>
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
      </div>

      <div className="bg-card border border-border/60 rounded-2xl p-5">
        <p className="text-[9px] font-bold tracking-widest text-muted-foreground mb-4">
          NET SALES — LAST 14 DAYS
        </p>
        <div className="h-44">
          <Suspense
            fallback={<div className="h-full w-full rounded bg-secondary/40 animate-pulse" />}
          >
            <SalesAreaChart data={data.daily} />
          </Suspense>
        </div>
      </div>

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
          valueCls="text-warning"
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
        <div className="bg-card border border-border/60 rounded-2xl p-5">
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5 mb-3">
            <Boxes className="size-3.5" /> PRODUCT PERFORMANCE
          </p>
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
                    className={`text-right font-mono ${tp.delivery_type === "auto" && tp.stock_count <= 5 ? "text-warning" : "text-muted-foreground"}`}
                  >
                    {tp.delivery_type === "auto" ? tp.stock_count : "∞"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.lowStock.length > 0 && (
        <div className="bg-card border border-warning/30 rounded-lg p-4">
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground mb-3">
            LOW STOCK
          </p>
          <div className="space-y-1">
            {data.lowStock.map((p) => (
              <Link
                key={p.id}
                href={`/seller/stock/${p.id}`}
                className="flex justify-between text-xs py-1 hover:text-primary"
              >
                <span className="truncate">{p.title}</span>
                <span className="font-mono text-warning">{p.stock_count} left</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border/60 rounded-2xl p-5 text-xs text-muted-foreground leading-relaxed">
        <b className="text-foreground">Seller level {data.profile.level}</b> ·{" "}
        {data.profile.totalSales} lifetime sales · {data.profile.completionRate.toFixed(0)}%
        completion.
      </div>
    </div>
  );
}
