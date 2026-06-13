import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Seller dashboard "net sales" area chart. Lives in its own module so the
 * route can lazy-load it — keeping the ~hundreds-of-KB recharts bundle off the
 * dashboard's critical path. The page (stats, actions) renders and hydrates
 * immediately; the chart streams in behind a Suspense fallback.
 */
export default function SalesAreaChart({
  data,
}: {
  data: Array<{ day: string; sales: number; orders: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: "#71717a" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number, name: string) => [
            name === "sales" ? `${v.toFixed(2)} USDT` : v,
            name,
          ]}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#salesFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
