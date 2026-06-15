import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Admin analytics "GMV trend" area chart. Lives in its own module so the route
 * can lazy-load it with `next/dynamic({ ssr: false })` — recharts'
 * ResponsiveContainer relies on the DOM and must stay off the server render.
 */
export default function AnalyticsGmvAreaChart({
  data,
}: {
  data: Array<{ day: string; v: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="aa-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: "#71717a" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#71717a" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 100).toFixed(0)}`}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [`${(v / 100).toFixed(2)} USDT`, "GMV"]}
        />
        <Area type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={2} fill="url(#aa-fill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
