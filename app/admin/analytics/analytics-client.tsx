"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getAdminAnalyticsAction } from "@/server/actions/admin";
import { usdt } from "@/lib/format";
import { CHART_COLORS } from "../../_lib/chart-colors";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = "7d" | "30d" | "90d";
type Data = Awaited<ReturnType<typeof getAdminAnalyticsAction>>;

const RANGES: Range[] = ["7d", "30d", "90d"];

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-[9px] font-bold tracking-widest text-muted-foreground">{label}</p>
      <p className="font-mono text-sm mt-1">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">{title}</h2>
      {children}
    </div>
  );
}

export function AnalyticsClient() {
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const ct = CHART_COLORS;

  useEffect(() => {
    setLoading(true);
    startTransition(async () => {
      try {
        const result = await getAdminAnalyticsAction({ range });
        setData(result);
      } finally {
        setLoading(false);
      }
    });
  }, [range]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground">
            MARKETPLACE INSIGHTS
          </p>
          <h1 className="font-display text-xl">Analytics</h1>
        </div>
        <div className="flex gap-1 bg-secondary rounded-md p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded text-[11px] font-bold ${
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              label="GMV"
              value={usdt(data.summary.gmv)}
              sub={
                data.summary.gmvGrowth === null
                  ? null
                  : `${data.summary.gmvGrowth >= 0 ? "+" : ""}${data.summary.gmvGrowth.toFixed(1)}% vs prev`
              }
            />
            <Kpi
              label="ORDERS"
              value={String(data.summary.orders)}
              sub={`${data.summary.aov.toFixed(2)} USDT AOV`}
            />
            <Kpi label="COMMISSION" value={usdt(data.summary.commission)} />
            <Kpi
              label="ACTIVE"
              value={`${data.summary.activeSellers} sellers`}
              sub={`${data.summary.uniqueBuyers} buyers`}
            />
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
              GMV TREND — {data.range.toUpperCase()}
            </h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aa-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ct.chart1} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={ct.chart1} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={ct.grid} vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: ct.tickFill }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: ct.tickFill }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 100).toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: ct.tooltipBg,
                      border: `1px solid ${ct.tooltipBorder}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${(v / 100).toFixed(2)} USDT`, "GMV"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={ct.chart1}
                    strokeWidth={2}
                    fill="url(#aa-fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <Panel title="CATEGORY PERFORMANCE">
              {data.categoryPerf.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No data in this range.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.categoryPerf.map((c) => {
                    const max = data.categoryPerf[0].gmv || 1;
                    const pct = (c.gmv / max) * 100;
                    return (
                      <div key={c.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold truncate">{c.name}</span>
                          <span className="font-mono text-muted-foreground">
                            {usdt(c.gmv)} · {c.orders} · {c.sellers}s
                          </span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel title="TOP SELLERS">
              {data.topSellers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No data in this range.
                </p>
              ) : (
                <div className="space-y-1">
                  {data.topSellers.map((s, i) => (
                    <div
                      key={s.username}
                      className="grid grid-cols-[20px_1fr_80px_60px] gap-2 text-xs py-1 border-b border-border/40 last:border-0 items-center"
                    >
                      <span className="font-mono text-muted-foreground">#{i + 1}</span>
                      <span className="font-bold truncate">{s.username}</span>
                      <span className="text-right font-mono">{usdt(s.gmv)}</span>
                      <span className="text-right font-mono text-muted-foreground">{s.orders}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="TOP PRODUCTS">
            {data.topProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No data in this range.
              </p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_120px_80px_60px] gap-2 text-[9px] font-bold text-muted-foreground tracking-widest pb-1 border-b border-border">
                  <span>PRODUCT</span>
                  <span>SELLER</span>
                  <span className="text-right">GMV</span>
                  <span className="text-right">ORDERS</span>
                </div>
                {data.topProducts.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[1fr_120px_80px_60px] gap-2 text-xs py-1.5 border-b border-border/40 last:border-0"
                  >
                    <span className="truncate font-bold">{p.title}</span>
                    <span className="truncate text-muted-foreground">{p.seller}</span>
                    <span className="text-right font-mono">{usdt(p.gmv)}</span>
                    <span className="text-right font-mono text-muted-foreground">{p.orders}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="grid lg:grid-cols-2 gap-3">
            <Panel
              title={`TOP SEARCHES — ${data.search.total} queries · ${data.search.failRate.toFixed(1)}% empty`}
            >
              {data.search.top.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No data.</p>
              ) : (
                <div className="space-y-1">
                  {data.search.top.map((s) => (
                    <div
                      key={s.query}
                      className="grid grid-cols-[1fr_60px_70px] gap-2 text-xs py-1 border-b border-border/40 last:border-0"
                    >
                      <span className="truncate font-mono">{s.query}</span>
                      <span className="text-right font-mono text-muted-foreground">{s.uses}×</span>
                      <span className="text-right font-mono text-success">
                        {s.avg_results.toFixed(0)} hits
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="ZERO-RESULT SEARCHES — DEMAND GAPS">
              {data.search.zero.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No failing searches.
                </p>
              ) : (
                <div className="space-y-1">
                  {data.search.zero.map((s) => (
                    <div
                      key={s.query}
                      className="grid grid-cols-[1fr_60px] gap-2 text-xs py-1 border-b border-border/40 last:border-0"
                    >
                      <span className="truncate font-mono text-warning/80">{s.query}</span>
                      <span className="text-right font-mono text-muted-foreground">{s.uses}×</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Kpi label="NEW BUYERS" value={String(data.newSignups.buyers ?? 0)} />
            <Kpi label="NEW SELLERS" value={String(data.newSignups.sellers ?? 0)} />
            <Kpi
              label="CATALOG CONV."
              value={`${data.summary.marketplaceConversion.toFixed(2)}%`}
            />
          </div>
        </>
      )}
    </div>
  );
}
