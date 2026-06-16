"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { listProductReviewQueueAction, reviewProductAction } from "@/server/actions/admin";
import { usdt, dateTime } from "@/lib/format";

type Product = Awaited<ReturnType<typeof listProductReviewQueueAction>>[number];

const PRODUCT_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending_review: { label: "Pending", cls: "bg-warning/15 text-warning" },
  active: { label: "Active", cls: "bg-success/15 text-success" },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive" },
  paused: { label: "Paused", cls: "bg-secondary text-muted-foreground" },
};

const INPUT_CLS =
  "bg-secondary border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50";
const BTN_CLS = "px-3 py-1.5 rounded-md text-xs font-bold";

function StatusBadge({ status }: { status: string }) {
  const meta = PRODUCT_STATUS_META[status] ?? {
    label: status,
    cls: "bg-secondary text-muted-foreground",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${meta.cls}`}>
      {meta.label.toUpperCase()}
    </span>
  );
}

function ProductCard({ product, onRefresh }: { product: Product; onRefresh: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleReview(approve: boolean) {
    if (!approve && !reason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setBusy(true);
    setError(null);
    startTransition(async () => {
      try {
        await reviewProductAction({
          productId: product.id,
          approve,
          reason: approve ? undefined : reason.trim(),
        });
        onRefresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Action failed.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{product.title}</span>
            {product.risk_tier === "high" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive">
                HIGH RISK
              </span>
            )}
            <StatusBadge status={product.status} />
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">{product.seller_name}</span>
            {" · "}
            {product.category_name}
          </div>
        </div>
        <div className="text-right space-y-0.5 shrink-0">
          <div className="text-sm font-bold">{usdt(product.price_cents)}</div>
          <div className="text-[10px] text-muted-foreground">{dateTime(product.created_at)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/p/${product.slug}`}
          target="_blank"
          className="text-xs text-primary hover:underline"
        >
          View
        </Link>
      </div>

      {product.status === "pending_review" && (
        <div className="pt-1 border-t border-border space-y-2">
          <textarea
            className={`${INPUT_CLS} w-full resize-none`}
            rows={2}
            placeholder="Rejection reason (required to reject)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => handleReview(true)}
              className={`${BTN_CLS} bg-success text-success-foreground disabled:opacity-50`}
            >
              {busy ? "…" : "Approve"}
            </button>
            <button
              disabled={busy}
              onClick={() => handleReview(false)}
              className={`${BTN_CLS} bg-destructive text-destructive-foreground disabled:opacity-50`}
            >
              {busy ? "…" : "Reject"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending_review");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await listProductReviewQueueAction();
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = products.filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.seller_name.toLowerCase().includes(q) ||
      p.category_name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const STATUSES = ["all", "pending_review", "active", "rejected", "paused"] as const;

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">Product Reviews</h1>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`${BTN_CLS} ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              {s === "all" ? "All" : (PRODUCT_STATUS_META[s]?.label ?? s)}
            </button>
          ))}
        </div>
        <input
          type="text"
          className={`${INPUT_CLS} flex-1 min-w-[160px]`}
          placeholder="Search title, seller, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products match.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
