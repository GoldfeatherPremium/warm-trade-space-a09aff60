import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { requireUser } from "@/server/auth";
import { q } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { PublicShell } from "../_components/site-shell";
import { productImage } from "../_lib/product-image";
import { PriceTag, EmptyState } from "../_components/kit";

export const metadata: Metadata = { title: "Favorites", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/auth?redirect=/favorites");

  await appContext();
  const products = await q<{
    id: string;
    title: string;
    slug: string;
    image_key: string | null;
    delivery_type: string;
    price_cents: number;
    stock_count: number;
    status: string;
    category_name: string;
    seller_name: string;
    seller_rating: number;
  }>(
    `select p.id, p.title, p.slug, p.image_key, p.delivery_type, p.price_cents, p.stock_count, p.status,
            c.name as category_name, u.username as seller_name, u.rating as seller_rating
     from favorites f
     join products p on p.id = f.product_id
     join categories c on c.id = p.category_id
     join users u on u.id = p.seller_id
     where f.user_id = ? order by f.created_at desc limit 100`,
    [user.id],
  );

  return (
    <PublicShell>
      <h1 className="font-display text-3xl mb-6 flex items-center gap-2">
        <Heart className="size-6 text-destructive" /> FAVORITES
      </h1>

      {products.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the ♥ on any product to keep it here."
        >
          <Link href="/browse" className="text-primary text-sm font-bold">
            Browse the market →
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/p/${p.slug}`}
              className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-primary/50 transition-colors"
            >
              <div className="size-14 rounded-md overflow-hidden bg-secondary shrink-0 relative">
                <Image
                  src={productImage(p.image_key)}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{p.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {p.category_name} · {p.seller_name}{" "}
                  {p.seller_rating > 0 ? `★ ${p.seller_rating.toFixed(1)}` : ""} ·{" "}
                  {p.delivery_type === "auto" ? `⚡ ${p.stock_count} in stock` : "🕐 manual"}
                </p>
                {p.status !== "active" && (
                  <p className="text-[10px] text-warning font-bold">Currently unavailable</p>
                )}
              </div>
              <PriceTag cents={p.price_cents} size="sm" className="shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
