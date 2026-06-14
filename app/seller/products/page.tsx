"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pause, Play, Boxes, Pencil } from "lucide-react";
import { listMyProductsAction, setProductPausedAction } from "@/server/actions/seller";
import { PRODUCT_STATUS_META, usdtShort } from "@/lib/format";
import { productImage } from "../../_lib/product-image";

type Products = Awaited<ReturnType<typeof listMyProductsAction>>;

function productImageNext(key: string | null): string {
  if (!key) return "/assets/game-elden.jpg";
  if (key.startsWith("upload:")) return `/api/public/img/${key.slice(7)}`;
  return `/assets/${key}`;
}

export default function SellerProductsPage() {
  const router = useRouter();
  const [data, setData] = useState<Products | null>(null);
  const [pending, startTransition] = useTransition();
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    startTransition(async () => {
      const d = await listMyProductsAction();
      setData(d);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const togglePause = (productId: string, currentStatus: string) => {
    setPausingId(productId);
    setError(null);
    const paused = currentStatus !== "paused";
    startTransition(async () => {
      try {
        await setProductPausedAction(productId, paused);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setPausingId(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-2xl">MY PRODUCTS</h1>
        <Link
          href="/seller/products/new"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-3 py-2 rounded-md hover:opacity-90"
        >
          <Plus className="size-4" /> New listing
        </Link>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {!data ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-card border border-border" />
          ))}
        </div>
      ) : data.products.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No products yet — create your first listing.
        </p>
      ) : (
        <div className="space-y-2">
          {data.products.map((p) => {
            const meta = PRODUCT_STATUS_META[p.status as string] ?? {
              label: p.status as string,
              cls: "bg-muted",
            };
            return (
              <div
                key={p.id as string}
                className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
              >
                <div className="size-12 rounded-md overflow-hidden bg-secondary shrink-0">
                  <img
                    src={productImageNext(p.image_key as string | null)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.category_name} ·{" "}
                    {p.delivery_type === "auto" ? `⚡ stock ${p.stock_count}` : "🕐 manual"} ·{" "}
                    {p.sold_count} sold
                  </p>
                  {p.status === "rejected" && p.reject_reason && (
                    <p className="text-[10px] text-destructive mt-0.5">
                      Rejected: {p.reject_reason}
                    </p>
                  )}
                </div>
                <span
                  className={`text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap ${meta.cls}`}
                >
                  {meta.label.toUpperCase()}
                </span>
                <span className="font-mono text-accent text-sm">
                  {usdtShort(p.price_cents as number)}
                </span>
                <div className="flex gap-1">
                  {p.delivery_type === "auto" && (
                    <Link
                      href={`/seller/stock/${p.id as string}`}
                      className="size-8 grid place-items-center rounded-md bg-secondary hover:bg-border"
                      title="Manage stock"
                    >
                      <Boxes className="size-4" />
                    </Link>
                  )}
                  <Link
                    href={`/seller/products/new?edit=${p.id as string}`}
                    className="size-8 grid place-items-center rounded-md bg-secondary hover:bg-border"
                    title="Edit"
                  >
                    <Pencil className="size-4" />
                  </Link>
                  {["active", "out_of_stock", "paused"].includes(p.status as string) && (
                    <button
                      className="size-8 grid place-items-center rounded-md bg-secondary hover:bg-border disabled:opacity-50"
                      title={p.status === "paused" ? "Resume" : "Pause"}
                      disabled={pausingId === (p.id as string)}
                      onClick={() => togglePause(p.id as string, p.status as string)}
                    >
                      {p.status === "paused" ? (
                        <Play className="size-4" />
                      ) : (
                        <Pause className="size-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
