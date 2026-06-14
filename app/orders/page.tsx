import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag, PackageSearch } from "lucide-react";
import { currentUser } from "@/server/auth";
import { listBuyerOrders } from "@/server/queries/buyer";
import { ORDER_STATUS_META, dateTime, usdt } from "@/lib/format";
import { PublicShell } from "../_components/site-shell";
import { productImage } from "../_lib/product-image";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

const ACTIVE = ["awaiting_payment", "paid", "delivering", "delivered", "disputed"];
const COMPLETED = ["completed", "released"];
const CLOSED = ["refunded", "cancelled", "expired"];
const ACTION = ["awaiting_payment", "delivered"];

type Tab = "all" | "active" | "completed" | "closed";
const TABS: Array<{ key: Tab; label: string; match: (s: string) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "active", label: "Active", match: (s) => ACTIVE.includes(s) },
  { key: "completed", label: "Completed", match: (s) => COMPLETED.includes(s) },
  { key: "closed", label: "Closed", match: (s) => CLOSED.includes(s) },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/auth?redirect=/orders");
  const { tab: tabParam } = await searchParams;
  const tab: Tab = (["all", "active", "completed", "closed"] as const).includes(tabParam as Tab)
    ? (tabParam as Tab)
    : "all";

  const orders = await listBuyerOrders(user.id);
  const counts: Record<Tab, number> = { all: orders.length, active: 0, completed: 0, closed: 0 };
  for (const o of orders) {
    if (ACTIVE.includes(o.status)) counts.active++;
    else if (COMPLETED.includes(o.status)) counts.completed++;
    else if (CLOSED.includes(o.status)) counts.closed++;
  }
  const actionNeeded = orders.filter((o) => ACTION.includes(o.status)).length;
  const matchTab = TABS.find((t) => t.key === tab)!.match;
  const filtered = orders.filter((o) => matchTab(o.status));

  return (
    <PublicShell>
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <h1 className="font-display text-3xl">MY ORDERS</h1>
        {actionNeeded > 0 && (
          <span className="text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full px-3 py-1">
            {actionNeeded} need{actionNeeded === 1 ? "s" : ""} your attention
          </span>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto no-scrollbar mb-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/orders" : `/orders?tab=${t.key}`}
            className={`whitespace-nowrap text-xs font-bold rounded-md px-3 py-2 transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t.label}
            <span className="ml-1.5 opacity-70">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ShoppingBag className="size-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">You haven't bought anything yet.</p>
          <Link href="/browse" className="text-primary text-sm font-bold">
            Browse the market →
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <PackageSearch className="size-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No orders in this view.</p>
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
                href={`/orders/${o.id}`}
                className={`bg-card border rounded-lg p-3 flex items-center gap-3 hover:border-primary/50 transition-colors ${
                  needsAction ? "border-blue-500/40" : "border-border"
                }`}
              >
                {" "}
                <img
                  src={productImage(o.image_key)}
                  alt=""
                  className="size-12 rounded-md object-cover border border-border shrink-0"
                />
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
    </PublicShell>
  );
}
