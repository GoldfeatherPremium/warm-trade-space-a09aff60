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
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from "lucide-react";
import { getSellerOverviewAction } from "@/server/actions/seller";
import { usdt } from "@/lib/format";

const SalesAreaChart = lazy(() => import("@/components/charts/sales-area-chart"));

type Overview = Awaited<ReturnType<typeof getSellerOverviewAction>>;

function KpiCard({
  label,
  value,
  sub,
  delta,
  tone,
  icon: Icon,
  accent = false,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  tone?: "up" | "down" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={`relative bg-card border rounded-2xl p-4 overflow-hidden h-full ${href ? "card-hover border-border" : "border-border"}`}
    >
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div
            className={`size-8 rounded-lg grid place-items-center ${accent ? "bg-primary/20" : "bg-secondary"}`}
          >
            <Icon className={`size-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
          </div>
        )}
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
              tone === "up"
                ? "bg-emerald-500/15 text-emerald-400"
                : tone === "down"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {tone === "up" ? (
              <ArrowUpRight className="size-2.5" />
            ) : tone === "down" ? (
              <ArrowDownRight className="size-2.5" />
            ) : null}
            {delta}
          </span>
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

export default function SellerOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const d = await getSellerOverviewAction();
      setData(d);
    });
  }, []);

  if (!data) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-card border border-border" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-card border border-border" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-card border border-border" />
          ))}
        </div>
      </div>
    );
  }

  const intel = data.intelligence;
  const completionTone: "up" | "down" | "neutral" =
    data.profile.completionRate >= 95
      ? "up"
      : data.profile.completionRate >= 85
        ? "neutral"
        : "down";
  const wowTone: "up" | "down" | "neutral" =
    intel.wowPct > 0 ? "up" : intel.wowPct < 0 ? "down" : "neutral";

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {(data.needsDelivery > 0 || data.openDisputes > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.needsDelivery > 0 && (
            <Link
              href="/seller/orders"
              className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl p-3.5 hover:border-primary/60 transition-colors"
            >
              <PackageCheck className="size-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-primary">
                  {data.needsDelivery} order{data.needsDelivery > 1 ? "s" : ""} awaiting delivery
                </p>
                <p className="text-[10px] text-primary/60">Fulfill now to maintain SLA</p>
              </div>
              <ArrowUpRight className="size-4 text-primary shrink-0" />
            </Link>
          )}
          {data.openDisputes > 0 && (
            <Link
              href="/seller/orders"
              className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl p-3.5 hover:border-destructive/60 transition-colors"
            >
              <AlertTriangle className="size-5 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-destructive">
                  {data.openDisputes} open dispute{data.openDisputes > 1 ? "s" : ""}
                </p>
                <p className="text-[10px] text-destructive/60">Respond within 24h</p>
              </div>
              <ArrowUpRight className="size-4 text-destructive shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Sales Today"
          icon={ShoppingCart}
          value={usdt(data.today.s)}
          sub={`${data.today.c} order${data.today.c === 1 ? "" : "s"}`}
          accent
        />
        <KpiCard
          label="Sales 7 Days"
          icon={CalendarDays}
          value={usdt(data.week.s)}
          sub={`${data.week.c} orders`}
        />
        <KpiCard
          label="Sales 30 Days"
          icon={BarChart3}
          value={usdt(data.month.s)}
          sub={`${data.month.c} orders`}
        />
        <KpiCard
          label="Rating"
          icon={Star}
          value={data.profile.rating > 0 ? `★ ${data.profile.rating.toFixed(1)}` : "—"}
          sub={data.profile.rating > 0 ? `${data.profile.ratingCount} reviews` : "no reviews yet"}
        />
      </div>

      {/* Sales chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Activity className="size-3.5" /> NET SALES — LAST 14 DAYS
            </p>
          </div>
          <Link
            href="/seller/analytics"
            className="text-[10px] font-bold text-primary hover:underline"
          >
            Full analytics →
          </Link>
        </div>
        <div className="h-48">
          <Suspense
            fallback={<div className="h-full w-full rounded-xl bg-secondary/40 animate-pulse" />}
          >
            <SalesAreaChart data={data.daily} />
          </Suspense>
        </div>
      </div>

      {/* Business intelligence */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5 mb-4">
          <Zap className="size-3.5 text-primary" /> BUSINESS INTELLIGENCE
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="This Week"
            icon={Activity}
            value={usdt(intel.thisWeekCents)}
            sub={`vs ${usdt(intel.lastWeekCents)} last week`}
            tone={wowTone}
            delta={`${intel.wowPct >= 0 ? "+" : ""}${intel.wowPct}% WoW`}
          />
          <KpiCard
            label="7-Day Forecast"
            icon={Target}
            value={usdt(intel.forecast7dCents)}
            sub={`${usdt(intel.avgDailyCents)} / day avg`}
          />
          <KpiCard
            label="Conversion"
            icon={TrendingUp}
            value={`${intel.conversionPct}%`}
            sub={`${intel.sold.toLocaleString()} sales / ${intel.views.toLocaleString()} views`}
            tone={intel.conversionPct >= 5 ? "up" : "neutral"}
            delta={intel.conversionPct >= 5 ? "Healthy" : "Needs work"}
          />
          <KpiCard
            label="Completion"
            icon={Activity}
            value={`${data.profile.completionRate.toFixed(0)}%`}
            sub={`Level ${data.profile.level} · ${data.profile.totalSales} sales`}
            tone={completionTone}
            delta={
              completionTone === "up" ? "Excellent" : completionTone === "down" ? "At risk" : "Good"
            }
          />
        </div>
      </div>

      {/* Wallet */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Available"
          icon={Wallet}
          value={usdt(data.wallet.available_cents)}
          accent
          href="/seller/wallet"
        />
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="size-8 rounded-lg grid place-items-center bg-yellow-500/15 mb-3">
            <Wallet className="size-4 text-yellow-400" />
          </div>
          <p className="font-mono text-xl font-bold text-yellow-400">
            {usdt(data.wallet.pending_cents)}
          </p>
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground mt-1 uppercase">
            In Escrow
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="size-8 rounded-lg grid place-items-center bg-destructive/15 mb-3">
            <Wallet className="size-4 text-destructive" />
          </div>
          <p className="font-mono text-xl font-bold text-destructive">
            {usdt(data.wallet.frozen_cents)}
          </p>
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground mt-1 uppercase">
            Frozen
          </p>
        </div>
      </div>

      {/* Product performance */}
      {data.topProducts.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Boxes className="size-3.5" /> PRODUCT PERFORMANCE
            </p>
            <Link
              href="/seller/products"
              className="text-[10px] font-bold text-primary hover:underline"
            >
              Manage →
            </Link>
          </div>
          <div className="space-y-0">
            <div className="grid grid-cols-[1fr_56px_56px_64px_52px] gap-2 text-[9px] font-bold text-muted-foreground tracking-widest pb-2 border-b border-border mb-1">
              <span>PRODUCT</span>
              <span className="text-right">VIEWS</span>
              <span className="text-right">SOLD</span>
              <span className="text-right">CONV.</span>
              <span className="text-right">STOCK</span>
            </div>
            {data.topProducts.map((tp) => {
              const conv = tp.views > 0 ? ((tp.sold_count / tp.views) * 100).toFixed(1) : "—";
              const convNum = Number(conv) || 0;
              return (
                <Link
                  key={tp.id}
                  href={`/seller/products`}
                  className="grid grid-cols-[1fr_56px_56px_64px_52px] gap-2 text-xs py-2.5 border-b border-border/30 last:border-0 items-center hover:bg-secondary/30 -mx-1 px-1 rounded-lg transition-colors"
                >
                  <span className="truncate font-bold text-[11px]">{tp.title}</span>
                  <span className="text-right font-mono text-muted-foreground text-[11px]">
                    {tp.views.toLocaleString()}
                  </span>
                  <span className="text-right font-mono text-[11px]">
                    {tp.sold_count.toLocaleString()}
                  </span>
                  <span
                    className={`text-right font-mono text-[11px] ${
                      convNum >= 5
                        ? "text-emerald-400"
                        : convNum > 0
                          ? "text-muted-foreground"
                          : "text-muted-foreground/50"
                    }`}
                  >
                    {conv === "—" ? "—" : `${conv}%`}
                  </span>
                  <span
                    className={`text-right font-mono text-[11px] ${
                      tp.delivery_type === "auto" && tp.stock_count <= 5
                        ? "text-yellow-400 font-bold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {tp.delivery_type === "auto" ? tp.stock_count : "∞"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Low stock */}
      {data.lowStock.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-2xl p-4">
          <p className="text-[10px] font-bold tracking-widest text-yellow-400 mb-3 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" /> LOW STOCK ALERT
          </p>
          <div className="space-y-1.5">
            {data.lowStock.map((p) => (
              <Link
                key={p.id}
                href={`/seller/stock/${p.id}`}
                className="flex justify-between items-center text-xs py-1.5 hover:text-primary transition-colors"
              >
                <span className="truncate text-foreground/80">{p.title}</span>
                <span className="font-mono text-yellow-400 font-bold shrink-0 ml-2">
                  {p.stock_count} left
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Seller level badge */}
      <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center shrink-0">
          <Star className="size-5 text-primary" />
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed flex-1">
          <span className="text-foreground font-bold">Seller Level {data.profile.level}</span> ·{" "}
          {data.profile.totalSales.toLocaleString()} lifetime sales ·{" "}
          {data.profile.completionRate.toFixed(0)}% completion rate
        </div>
        <Link
          href="/seller/analytics"
          className="text-[10px] font-bold text-primary hover:underline shrink-0"
        >
          Analytics →
        </Link>
      </div>
    </div>
  );
}
