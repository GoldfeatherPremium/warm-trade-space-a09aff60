"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DollarSign, ShoppingBag, Coins, Lock, BarChart3, Trophy } from "lucide-react";
import { getAdminDashboard } from "@/server/actions/admin";
import { ORDER_STATUS_META, usdt } from "@/lib/format";
import { StatCard, SectionCard, EmptyState, StatGridSkeleton } from "./_components/admin-ui";

// Lazy-loaded so the recharts bundle stays off the dashboard's critical path.
const GmvBarChart = dynamic(() => import("@/components/charts/gmv-bar-chart"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded bg-secondary/40 animate-pulse" />,
});

export default function AdminDashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminDashboard>> | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getAdminDashboard()
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!data)
    return (
      <div className="space-y-5">
        <StatGridSkeleton count={4} />
        <StatGridSkeleton count={5} cols={5} />
        <div className="h-44 rounded-lg bg-card border border-border animate-pulse" />
      </div>
    );

  const queues = [
    { label: "Seller applications", v: data.pending.sellerApplications, to: "/admin/sellers" },
    { label: "Products to review", v: data.pending.productReviews, to: "/admin/products" },
    { label: "Open disputes", v: data.pending.openDisputes, to: "/admin/disputes" },
    { label: "Withdrawals pending", v: data.pending.withdrawals, to: "/admin/finance" },
    { label: "Flagged messages", v: data.pending.flaggedMessages, to: "/admin/moderation" },
  ];
  const maxStatus = Math.max(1, ...data.ordersByStatus.map((x) => x.c));

  return (
    <div className="space-y-5">
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="GMV TODAY"
          icon={DollarSign}
          value={usdt(data.gmvToday.s)}
          sub={`${data.gmvToday.c} orders`}
          valueCls="text-accent"
        />
        <StatCard
          label="GMV 30 DAYS"
          icon={ShoppingBag}
          value={usdt(data.gmv30d.s)}
          sub={`${data.gmv30d.c} orders`}
        />
        <StatCard
          label="REVENUE (COMMISSIONS)"
          icon={Coins}
          value={usdt(data.revenue)}
          valueCls="text-accent"
        />
        <StatCard
          label="ESCROW HELD"
          icon={Lock}
          value={usdt(data.escrowHeld)}
          valueCls="text-yellow-400"
        />
      </div>

      {/* Moderation / ops queues */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {queues.map((qq) => (
          <Link
            key={qq.label}
            href={qq.to}
            className={`bg-card border rounded-lg p-3 text-center hover:border-primary/50 transition-colors ${
              qq.v > 0 ? "border-yellow-500/40" : "border-border"
            }`}
          >
            <p
              className={`font-display text-3xl ${qq.v > 0 ? "text-yellow-400" : "text-muted-foreground"}`}
            >
              {qq.v}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground">{qq.label}</p>
          </Link>
        ))}
      </div>

      <SectionCard title="GMV — LAST 14 DAYS" icon={BarChart3}>
        <div className="h-44">
          <GmvBarChart data={data.daily} />
        </div>
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-4">
        <SectionCard title="ORDERS BY STATUS" bodyClassName="space-y-1.5">
          {data.ordersByStatus.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders yet" />
          ) : (
            data.ordersByStatus.map((s) => (
              <div key={s.status} className="flex items-center gap-2 text-xs">
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded w-36 text-center ${ORDER_STATUS_META[s.status]?.cls ?? "bg-muted"}`}
                >
                  {(ORDER_STATUS_META[s.status]?.label ?? s.status).toUpperCase()}
                </span>
                <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full"
                    style={{ width: `${Math.min(100, (s.c / maxStatus) * 100)}%` }}
                  />
                </div>
                <span className="font-mono w-8 text-right">{s.c}</span>
              </div>
            ))
          )}
        </SectionCard>

        <SectionCard title="TOP SELLERS (30D)" icon={Trophy}>
          {data.topSellers.length === 0 ? (
            <EmptyState icon={Trophy} title="No sales in the last 30 days" />
          ) : (
            <div className="space-y-2">
              {data.topSellers.map((s, i) => (
                <div key={s.username} className="flex items-center gap-2 text-xs">
                  <span className="font-display text-muted-foreground">#{i + 1}</span>
                  <span className="font-bold flex-1 truncate">{s.username}</span>
                  <span className="text-muted-foreground">{s.c} orders</span>
                  <span className="font-mono text-accent">{usdt(s.s)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-4">
            {data.users} registered users total.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
