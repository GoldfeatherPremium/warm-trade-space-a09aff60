import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Admin dashboard "GMV — last 14 days" bar chart. Isolated in its own module
 * so the route can lazy-load it, keeping recharts off the dashboard's critical
 * path (the page renders and hydrates first; the chart streams in).
 */
export default function GmvBarChart({ data }: { data: Array<{ day: string; gmv: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: "#71717a" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number, name: string) => [
            name === "gmv" ? `${v.toFixed(2)} USDT` : v,
            name,
          ]}
        />
        <Bar dataKey="gmv" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
