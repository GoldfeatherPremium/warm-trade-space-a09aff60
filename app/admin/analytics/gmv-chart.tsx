"use client";

// Isolated so recharts (~hundreds of KB) is lazy-loaded off the analytics
// route's initial bundle via React.lazy + Suspense in analytics-client.tsx.
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "../../_lib/chart-colors";

export default function GmvChart({ daily }: { daily: Array<{ day: string; v: number }> }) {
  const ct = CHART_COLORS;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
        <Area type="monotone" dataKey="v" stroke={ct.chart1} strokeWidth={2} fill="url(#aa-fill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
