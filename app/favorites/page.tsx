import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { requireUser } from "@/server/auth";
import { q } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { usdt } from "@/lib/format";
import { PublicShell } from "../_components/site-shell";
import { productImage } from "../_lib/product-image";

export const metadata: Metadata = { title: "Favorites — X-VAULT" };
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
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Nothing saved yet — tap the ♥ on any product to keep it here.
          </p>
          <Link href="/browse" className="text-primary text-sm font-bold">
            Browse the market →
          </Link>
        </div>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/p/${p.slug}`}
              className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-primary/50 transition-colors"
            >
              <div className="size-14 rounded-md overflow-hidden bg-secondary shrink-0">
                <img
                  src={productImage(p.image_key)}
                  alt=""
                  className="w-full h-full object-cover"
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
                  <p className="text-[10px] text-yellow-400 font-bold">Currently unavailable</p>
                )}
              </div>
              <span className="font-mono text-accent text-sm shrink-0">{usdt(p.price_cents)}</span>
            </Link>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
