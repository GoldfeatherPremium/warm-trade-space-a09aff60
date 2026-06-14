"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Download, PackageSearch, ShoppingBag } from "lucide-react";
import { listSellerOrdersAction } from "@/server/actions/seller";
import { ORDER_STATUS_META, countdown, dateTime, usdt } from "@/lib/format";

type Orders = Awaited<ReturnType<typeof listSellerOrdersAction>>;
type Order = Orders["orders"][number];

const NEEDS_ACTION = ["paid", "delivering", "disputed"];

function productImageNext(key: string | null): string {
  if (!key) return "/assets/game-elden.jpg";
  if (key.startsWith("upload:")) return `/api/public/img/${key.slice(7)}`;
  return `/assets/${key}`;
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
        >
          <div className="size-12 rounded-md bg-secondary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-1/2 rounded bg-secondary" />
            <div className="h-2 w-2/3 rounded bg-secondary/70" />
          </div>
          <div className="h-5 w-16 rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, startTransition] = useTransition();
  const [tab, setTab] = useState<"all" | "action" | "disputed" | "done">("all");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const d = await listSellerOrdersAction();
      setOrders(d.orders);
      setLoaded(true);
    });
  }, []);

  const counts = {
    all: orders.length,
    action: orders.filter((o) => ["paid", "delivering"].includes(o.status)).length,
    disputed: orders.filter((o) => o.status === "disputed").length,
    done: orders.filter((o) => ["completed", "released"].includes(o.status)).length,
  };

  const filtered = orders.filter((o) => {
    if (tab === "action" && !["paid", "delivering"].includes(o.status)) return false;
    if (tab === "disputed" && o.status !== "disputed") return false;
    if (tab === "done" && !["completed", "released"].includes(o.status)) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !o.order_no.toLowerCase().includes(s) &&
        !o.product_title.toLowerCase().includes(s) &&
        !o.counterparty.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => Number(NEEDS_ACTION.includes(b.status)) - Number(NEEDS_ACTION.includes(a.status)),
  );

  const exportCsv = () => {
    const rows = [
      ["order_no", "product", "buyer", "qty", "total_usdt", "net_usdt", "status", "created_at"],
      ...orders.map((o) => [
        o.order_no,
        `"${o.product_title.replaceAll('"', '""')}"`,
        o.counterparty,
        o.qty,
        (o.total_cents / 100).toFixed(2),
        (o.seller_net_cents / 100).toFixed(2),
        o.status,
        new Date(o.created_at).toISOString(),
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl">SALES ORDERS</h1>
        <button
          onClick={exportCsv}
          disabled={orders.length === 0}
          className="flex items-center gap-1.5 bg-secondary text-xs font-bold px-3 py-2 rounded-md hover:bg-border disabled:opacity-50"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap items-center">
        {(
          [
            ["all", "All"],
            ["action", "Needs action"],
            ["disputed", "Disputed"],
            ["done", "Completed"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${tab === k ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-border"}`}
          >
            {label} ({counts[k]})
          </button>
        ))}
        <input
          placeholder="Search order / product / buyer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs max-w-56 ml-auto bg-secondary border border-border rounded-md px-3"
        />
      </div>

      {!loaded ? (
        <Skeleton />
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <ShoppingBag className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No sales yet.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-16 text-center">
          <PackageSearch className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No orders match this filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((o) => {
            const meta = ORDER_STATUS_META[o.status] ?? { label: o.status, cls: "bg-muted" };
            const slaDeadline = (o.paid_at ?? o.created_at) + o.delivery_sla_minutes * 60_000;
            const needsDelivery = ["paid", "delivering"].includes(o.status);
            return (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className={`bg-card border rounded-lg p-3 flex items-center gap-3 hover:border-primary/50 ${NEEDS_ACTION.includes(o.status) ? "border-blue-500/40" : "border-border"}`}
              >
                <div className="size-12 rounded-md overflow-hidden bg-secondary shrink-0">
                  <img
                    src={productImageNext(o.image_key)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{o.product_title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {o.order_no} · buyer {o.counterparty} · qty {o.qty} · {dateTime(o.created_at)}
                  </p>
                  {needsDelivery && o.delivery_type === "manual" && (
                    <p
                      className={`text-[10px] font-bold ${Date.now() > slaDeadline ? "text-destructive" : "text-blue-400"}`}
                    >
                      SLA:{" "}
                      {Date.now() > slaDeadline
                        ? "BREACHED — deliver now!"
                        : countdown(slaDeadline)}
                    </p>
                  )}
                </div>
                <span
                  className={`text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap ${meta.cls}`}
                >
                  {meta.label.toUpperCase()}
                </span>
                <div className="text-right">
                  <p className="font-mono text-accent text-sm whitespace-nowrap">
                    {usdt(o.total_cents)}
                  </p>
                  <p className="text-[9px] text-muted-foreground whitespace-nowrap">
                    net {usdt(o.seller_net_cents)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
