"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { listProductReviewQueue, reviewProduct } from "@/server/actions/admin";
import { PRODUCT_STATUS_META, usdtShort, dateTime } from "@/lib/format";
import { productImage } from "../../_lib/product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminProductsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listProductReviewQueue>> | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    listProductReviewQueue()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const reload = () => {
    listProductReviewQueue()
      .then((d) => setData(d))
      .catch(() => {});
  };

  const review = (vars: { productId: string; approve: boolean; reason?: string }) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await reviewProduct(vars);
        setSuccess("Product reviewed");
        reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">PRODUCT APPROVALS</h1>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Prohibited: stolen/carded gift cards, hacked accounts, unauthorized credentials, listings
        violating the underlying service's terms (e.g. shared-credential subscriptions).
      </p>
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
          {success}
        </p>
      )}
      {data?.products.map((p) => {
        const meta = PRODUCT_STATUS_META[p.status as string] ?? {
          label: p.status as string,
          cls: "bg-muted",
        };
        return (
          <div
            key={p.id as string}
            className="bg-card border border-border rounded-lg p-4 flex gap-3"
          >
            <div className="size-16 rounded-md overflow-hidden bg-secondary shrink-0">
              <img
                src={productImage(p.image_key as string)}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-bold">{p.title}</p>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${meta.cls}`}>
                  {meta.label.toUpperCase()}
                </span>
                {p.risk_tier === "high" && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
                    HIGH RISK
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {p.seller_name} · {p.category_name} · {p.delivery_type} delivery ·{" "}
                {usdtShort(p.price_cents as number)} · {dateTime(p.created_at as number)}
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <Link
                  href={`/admin/products/${p.id as string}/edit`}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  ✎ Edit / SEO
                </Link>
                {p.status === "pending_review" && (
                  <>
                    <Input
                      placeholder="Rejection reason"
                      className="max-w-xs h-8 text-xs"
                      value={reasons[p.id as string] ?? ""}
                      onChange={(e) => setReasons({ ...reasons, [p.id as string]: e.target.value })}
                    />
                    <Button
                      size="sm"
                      onClick={() => review({ productId: p.id as string, approve: true })}
                      disabled={isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => {
                        const reason = reasons[p.id as string];
                        if (!reason) {
                          setError("A rejection reason is required.");
                          return;
                        }
                        review({ productId: p.id as string, approve: false, reason });
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
