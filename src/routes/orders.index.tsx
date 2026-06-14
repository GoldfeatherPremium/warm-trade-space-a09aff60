import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, PackageSearch, ShoppingBag } from "lucide-react";
import { listMyOrders } from "@/lib/api/orders";
import { PageShell } from "@/components/shell";
import { ORDER_STATUS_META, dateTime, usdt } from "@/lib/format";
import { productImage } from "@/lib/images";

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "My Orders — X-VAULT" }] }),
  component: OrdersPage,
});

type Tab = "all" | "active" | "completed" | "closed";

const ACTIVE = ["awaiting_payment", "paid", "delivering", "delivered", "disputed"];
const COMPLETED = ["completed", "released"];
const CLOSED = ["refunded", "cancelled", "expired"];
// Statuses where the buyer has a concrete next step (pay, or confirm receipt).
const ACTION = ["awaiting_payment", "delivered"];

const TABS: Array<{ key: Tab; label: string; match: (s: string) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "active", label: "Active", match: (s) => ACTIVE.includes(s) },
  { key: "completed", label: "Completed", match: (s) => COMPLETED.includes(s) },
  { key: "closed", label: "Closed", match: (s) => CLOSED.includes(s) },
];

function OrdersSkeleton() {
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

function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["myOrders"],
    queryFn: () => listMyOrders({ data: { role: "buyer" } }),
  });
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const orders = useMemo(() => data?.orders ?? [], [data?.orders]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: orders.length, active: 0, completed: 0, closed: 0 };
    for (const o of orders) {
      if (ACTIVE.includes(o.status)) c.active++;
      else if (COMPLETED.includes(o.status)) c.completed++;
      else if (CLOSED.includes(o.status)) c.closed++;
    }
    return c;
  }, [orders]);

  const actionNeeded = useMemo(
    () => orders.filter((o) => ACTION.includes(o.status)).length,
    [orders],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matchTab = TABS.find((t) => t.key === tab)!.match;
    return orders.filter((o) => {
      if (!matchTab(o.status)) return false;
      if (!term) return true;
      return [o.product_title, o.order_no, o.counterparty]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [orders, tab, search]);

  return (
    <PageShell>
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <h1 className="font-display text-3xl">MY ORDERS</h1>
        {actionNeeded > 0 && (
          <span className="text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full px-3 py-1">
            {actionNeeded} need{actionNeeded === 1 ? "s" : ""} your attention
          </span>
        )}
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap text-xs font-bold rounded-md px-3 py-2 transition-colors ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 ${tab === t.key ? "opacity-80" : "opacity-60"}`}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders…"
            className="w-full bg-secondary border border-border rounded-md pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {isLoading ? (
        <OrdersSkeleton />
      ) : orders.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ShoppingBag className="size-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">You haven't bought anything yet.</p>
          <Link to="/browse" className="text-primary text-sm font-bold">
            Browse the market →
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <PackageSearch className="size-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No orders match your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const meta = ORDER_STATUS_META[o.status] ?? {
              label: o.status,
              cls: "bg-muted text-muted-foreground",
            };
            const needsAction = ACTION.includes(o.status);
            return (
              <Link
                key={o.id}
                to="/orders/$orderId"
                params={{ orderId: o.id }}
                className={`bg-card border rounded-lg p-3 flex items-center gap-3 hover:border-primary/50 transition-colors ${
                  needsAction ? "border-blue-500/40" : "border-border"
                }`}
              >
                <div className="size-12 rounded-md overflow-hidden bg-secondary shrink-0">
                  <img
                    src={productImage(o.image_key)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{o.product_title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {o.order_no} · {o.counterparty} · qty {o.qty} · {dateTime(o.created_at)}
                  </p>
                </div>
                <span
                  className={`text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap ${meta.cls}`}
                >
                  {meta.label.toUpperCase()}
                </span>
                <span className="font-mono text-accent text-sm whitespace-nowrap">
                  {usdt(o.total_cents)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
