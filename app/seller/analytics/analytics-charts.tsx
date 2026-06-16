"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usdt } from "@/lib/format";
import { CHART_COLORS } from "../../_lib/chart-colors";

type Analytics = {
  daily: { day: string; v: number }[];
  hours: { hour: string | number; n: number }[];
  range: string;
};

export function AnalyticsCharts({ data }: { data: Analytics }) {
  const ct = CHART_COLORS;

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
          NET REVENUE — {data.range.toUpperCase()}
        </h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="sa-fill" x1="0" y1="0" x2="0" y2="1">
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
                formatter={(v: number) => [`${(v / 100).toFixed(2)} USDT`, "Net"]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={ct.chart1}
                strokeWidth={2}
                fill="url(#sa-fill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
          ORDERS BY HOUR (UTC)
        </h2>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.hours} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 9, fill: ct.tickFill }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: ct.tickFill }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: ct.tooltipBg,
                  border: `1px solid ${ct.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [v, "orders"]}
                labelFormatter={(h) => `${h}:00`}
              />
              <Bar dataKey="n" fill={ct.chart4} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

export { usdt };
