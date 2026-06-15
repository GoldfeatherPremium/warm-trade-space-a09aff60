"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getRiskOverviewAction, listRiskEventsAction } from "@/server/actions/admin";
import { usdt } from "@/lib/format";

type Band = "all" | "low" | "medium" | "high";
type Overview = Awaited<ReturnType<typeof getRiskOverviewAction>>;
type Event = Awaited<ReturnType<typeof listRiskEventsAction>>[number];

const BANDS: Array<{ id: Band; label: string }> = [
  { id: "all", label: "All" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

export function RiskClient() {
  const [band, setBand] = useState<Band>("high");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [, startTransition] = useTransition();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function loadOverview() {
    startTransition(async () => {
      try {
        const data = await getRiskOverviewAction();
        setOverview(data);
      } catch {
        // stale ok
      }
    });
  }

  function loadEvents(b: Band) {
    setLoadingEvents(true);
    startTransition(async () => {
      try {
        const data = await listRiskEventsAction({ band: b, limit: 100 });
        setEvents(data);
      } finally {
        setLoadingEvents(false);
      }
    });
  }

  useEffect(() => {
    loadOverview();
    intervalRef.current = setInterval(loadOverview, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    loadEvents(band);
  }, [band]);

  const pills = overview
    ? [
        {
          label: "Held orders",
          value: String(overview.heldOrders),
          tone: overview.heldOrders > 0 ? "alert" : undefined,
        },
        { label: "Held GMV", value: usdt(overview.heldGmvCents) },
        { label: "Events 24h", value: String(overview.events24h) },
        {
          label: "High-risk 24h",
          value: String(overview.highBand24h),
          tone: overview.highBand24h > 0 ? "warn" : undefined,
        },
        { label: "Events 7d", value: String(overview.events7d) },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl">Risk & Fraud Engine</h2>
        <p className="text-[11px] text-muted-foreground">
          Velocity, refund-rate and account-age rules score every paid order. Orders ≥70 are
          auto-held; staff release or refund after review.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {pills.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-md bg-secondary/60 animate-pulse" />
            ))
          : pills.map((p) => (
              <div
                key={p.label}
                className={`rounded-md border px-2.5 py-2 ${
                  p.tone === "alert"
                    ? "border-red-500/50 bg-red-500/10"
                    : p.tone === "warn"
                      ? "border-yellow-500/40 bg-yellow-500/5"
                      : "border-border bg-background/40"
                }`}
              >
                <p className="text-[9px] font-bold tracking-widest text-muted-foreground truncate">
                  {p.label.toUpperCase()}
                </p>
                <p className="font-mono text-sm mt-0.5 truncate">{p.value}</p>
              </div>
            ))}
      </div>

      <div className="flex items-center gap-1.5">
        {BANDS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBand(b.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
              band === b.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-border"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Order</th>
              <th className="text-left px-3 py-2">Buyer → Seller</th>
              <th className="text-right px-3 py-2">Score</th>
              <th className="text-left px-3 py-2">Reasons</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loadingEvents && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loadingEvents && events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No risk events in this band.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="border-t border-border/70 align-top">
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono">
                  {e.order_no ?? e.order_id?.slice(0, 8) ?? "—"}
                  {e.order_total_cents != null && (
                    <div className="text-[10px] text-muted-foreground">
                      {usdt(e.order_total_cents)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="font-bold">{e.buyer_username ?? "?"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    → {e.seller_username ?? "?"}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={`inline-block font-mono font-bold px-1.5 py-0.5 rounded ${
                      e.band === "high"
                        ? "bg-red-500/15 text-red-400"
                        : e.band === "medium"
                          ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-emerald-500/15 text-emerald-400"
                    }`}
                  >
                    {e.score}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <ul className="list-disc list-inside text-[11px] space-y-0.5">
                    {(Array.isArray(e.reasons) ? e.reasons : [String(e.reasons)])
                      .slice(0, 4)
                      .map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                  </ul>
                </td>
                <td className="px-3 py-2 text-[10px]">
                  <div>
                    <span className="text-muted-foreground">order:</span> {e.order_status ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">escrow:</span>{" "}
                    <span
                      className={
                        e.escrow_status === "on_hold" ? "text-red-400 font-bold" : undefined
                      }
                    >
                      {e.escrow_status ?? "—"}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
