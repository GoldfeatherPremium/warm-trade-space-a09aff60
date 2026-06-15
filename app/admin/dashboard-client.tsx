"use client";

import React, { lazy, Suspense, useEffect, useTransition, useState } from "react";
import Link from "next/link";
import { DollarSign, ShoppingBag, Coins, Lock, Trophy } from "lucide-react";
import { getAdminDashboardAction } from "@/server/actions/admin";
import { usdt, ORDER_STATUS_META } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Dashboard = Awaited<ReturnType<typeof getAdminDashboardAction>>;

// ---------------------------------------------------------------------------
// Lazy chart (avoids SSR issues with recharts)
// ---------------------------------------------------------------------------

const GmvChart = lazy(() =>
  import("recharts").then((m) => ({
    default: function Chart({ data }: { data: Dashboard["daily"] }) {
      const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = m;
      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, "GMV"]}
            />
            <Bar dataKey="gmv" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    },
  })),
);

const OrdersStatusChart = lazy(() =>
  import("recharts").then((m) => ({
    default: function Chart({ data }: { data: Array<{ status: string; c: number }> }) {
      const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = m;
      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={88}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Bar dataKey="c" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    },
  })),
);

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  label,
  icon: Icon,
  value,
  sub,
  valueCls,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  sub?: string;
  valueCls?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-4 text-muted-foreground" />
        <p className="text-[9px] font-bold tracking-widest text-muted-foreground">{label}</p>
      </div>
      <p className={`font-display text-2xl ${valueCls ?? ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QueueCounter
// ---------------------------------------------------------------------------

function QueueCounter({ label, count, href }: { label: string; count: number; href: string }) {
  const highlight = count > 0;
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-4 transition-colors hover:bg-secondary ${
        highlight ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-card"
      }`}
    >
      <span
        className={`font-mono text-2xl font-bold ${
          highlight ? "text-yellow-400" : "text-foreground"
        }`}
      >
        {count.toLocaleString("en-US")}
      </span>
      <span className="text-[9px] font-bold tracking-widest text-muted-foreground text-center leading-tight">
        {label}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function ChartSkeleton() {
  return (
    <div className="h-[200px] flex items-center justify-center rounded-lg bg-muted/20 animate-pulse">
      <span className="text-xs text-muted-foreground">Loading chart…</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminDashboardClient
// ---------------------------------------------------------------------------

export function AdminDashboardClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      try {
        const result = await getAdminDashboardAction();
        setData(result);
        setError(null);
      } catch (e) {
        setError((e as Error)?.message ?? "Failed to load dashboard.");
      }
    });
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  // --- KPI values (fall back to em dash while loading) ---
  const gmvToday = data ? usdt(data.gmvToday.s) : "—";
  const gmvTodayOrders = data ? `${data.gmvToday.c} orders` : undefined;
  const gmv30d = data ? usdt(data.gmv30d.s) : "—";
  const gmv30dOrders = data ? `${data.gmv30d.c} orders` : undefined;
  const revenue = data ? usdt(data.revenue) : "—";
  const escrow = data ? usdt(data.escrowHeld) : "—";

  // --- Orders-by-status rows enriched with labels ---
  const statusRows = data
    ? data.ordersByStatus.map((r) => ({
        ...r,
        label: ORDER_STATUS_META[r.status]?.label ?? r.status,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-semibold">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Live platform overview — refreshes every 15 s
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="GMV TODAY"
          icon={ShoppingBag}
          value={gmvToday}
          sub={gmvTodayOrders}
          valueCls="text-foreground"
        />
        <StatCard
          label="GMV 30 DAYS"
          icon={DollarSign}
          value={gmv30d}
          sub={gmv30dOrders}
          valueCls="text-foreground"
        />
        <StatCard
          label="REVENUE (COMMISSIONS)"
          icon={Coins}
          value={revenue}
          valueCls="text-accent"
        />
        <StatCard
          label="ESCROW HELD"
          icon={Lock}
          value={escrow}
          valueCls={data && data.escrowHeld > 0 ? "text-destructive" : "text-foreground"}
        />
      </div>

      {/* Queue counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <QueueCounter
          label="SELLER APPLICATIONS"
          count={data?.pending.sellerApplications ?? 0}
          href="/admin/sellers"
        />
        <QueueCounter
          label="PRODUCTS TO REVIEW"
          count={data?.pending.productReviews ?? 0}
          href="/admin/products"
        />
        <QueueCounter
          label="OPEN DISPUTES"
          count={data?.pending.openDisputes ?? 0}
          href="/admin/disputes"
        />
        <QueueCounter
          label="WITHDRAWALS PENDING"
          count={data?.pending.withdrawals ?? 0}
          href="/admin/finance"
        />
        <QueueCounter
          label="FLAGGED MESSAGES"
          count={data?.pending.flaggedMessages ?? 0}
          href="/admin/moderation"
        />
      </div>

      {/* 14-day GMV bar chart */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
          GMV — LAST 14 DAYS
        </p>
        <Suspense fallback={<ChartSkeleton />}>
          {data ? <GmvChart data={data.daily} /> : <ChartSkeleton />}
        </Suspense>
      </div>

      {/* Orders by status + Top sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Orders by status */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
            ORDERS BY STATUS
          </p>
          <Suspense fallback={<ChartSkeleton />}>
            {!data ? (
              <ChartSkeleton />
            ) : statusRows.length > 0 ? (
              <OrdersStatusChart data={statusRows} />
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">No orders yet.</p>
            )}
          </Suspense>
        </div>

        {/* Top sellers 30d */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
            <Trophy className="size-3" />
            TOP SELLERS — 30 DAYS
          </p>
          {data ? (
            data.topSellers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sales in the last 30 days.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left pb-2 font-medium">#</th>
                    <th className="text-left pb-2 font-medium">Seller</th>
                    <th className="text-right pb-2 font-medium">Orders</th>
                    <th className="text-right pb-2 font-medium">GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topSellers.map((s, i) => (
                    <tr key={s.username} className="border-b border-border/40 last:border-0">
                      <td className="py-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 font-medium">
                        <Link
                          href={`/admin/users?q=${encodeURIComponent(s.username)}`}
                          className="hover:underline text-foreground"
                        >
                          {s.username}
                        </Link>
                      </td>
                      <td className="py-2 text-right tabular-nums">{s.c}</td>
                      <td className="py-2 text-right tabular-nums font-mono">{usdt(s.s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-7 rounded bg-muted/30 animate-pulse" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
