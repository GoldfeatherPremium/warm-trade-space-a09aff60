import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Zap, Clock, ShieldCheck } from "lucide-react";
import { getProductBySlug, getRelatedProductsData } from "@/server/queries/catalog";
import { usdt, timeAgo } from "@/lib/format";
import { PublicShell } from "../../_components/site-shell";
import { ProductCard } from "../../_components/product-card";
import { productImage } from "../../_lib/product-image";
import { BuyBox } from "./buy-box";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await getProductBySlug(slug);
  if (!product) return { title: "Listing not found" };
  const title = `${product.title} — ${usdt(product.price_cents)}`;
  const description = `Buy ${product.title} on X-VAULT — buyer-protected, ${product.warranty_hours}h warranty, ${product.delivery_type === "auto" ? "instant delivery" : "fast manual delivery"}. Paid in USDT.`;
  return {
    title,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: { title, description, url: `${SITE_URL}/p/${product.slug}`, type: "website" },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product, reviews, variants } = await getProductBySlug(slug);
  if (!product) notFound();
  const related = await getRelatedProductsData(product.id, 8);
  const auto = product.delivery_type === "auto";
  const outOfStock = auto && product.stock_count === 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: `${SITE_URL}${productImage(product.image_key)}`,
    offers: {
      "@type": "Offer",
      price: (product.price_cents / 100).toFixed(2),
      priceCurrency: "USD",
      availability: outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${SITE_URL}/p/${product.slug}`,
    },
    ...(product.seller.rating > 0 && product.seller.rating_count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.seller.rating.toFixed(1),
            reviewCount: product.seller.rating_count,
          },
        }
      : {}),
  };

  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="text-[11px] text-muted-foreground mb-4">
        <Link href="/browse" className="hover:text-foreground">
          Browse
        </Link>{" "}
        /{" "}
        <Link href={`/browse?category=${product.category_slug}`} className="hover:text-foreground">
          {product.category_name}
        </Link>{" "}
        / <span className="text-foreground">{product.title}</span>
      </nav>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Left: media + description */}
        <div className="space-y-5">
          <div className="aspect-[16/10] rounded-2xl overflow-hidden border border-border bg-secondary">
            <img
              src={productImage(product.image_key)}
              alt={product.title}
              className="w-full h-full object-cover"
              fetchPriority="high"
            />
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-display text-lg mb-2">About this listing</h2>
            <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">
              {product.description}
            </p>
          </div>

          {reviews.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-display text-lg mb-3">Reviews ({reviews.length})</h2>
              <div className="space-y-3">
                {reviews.map((r, i) => (
                  <div key={i} className="border-b border-border/60 pb-3 last:border-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-0.5 text-yellow-400 font-bold">
                        <Star className="size-3 fill-current" />
                        {r.rating}
                      </span>
                      <span className="font-bold">{r.buyer}</span>
                      <span className="text-muted-foreground">{timeAgo(r.created_at)}</span>
                    </div>
                    {r.comment && <p className="text-sm text-foreground/80 mt-1">{r.comment}</p>}
                    {r.seller_reply && (
                      <p className="text-xs text-muted-foreground mt-1 pl-3 border-l-2 border-border">
                        Seller: {r.seller_reply}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: buy panel */}
        <aside className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 lg:sticky lg:top-20">
            <h1 className="font-display text-2xl leading-tight">{product.title}</h1>
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span
                className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded ${
                  auto ? "bg-accent/90 text-accent-foreground" : "bg-blue-500/90 text-white"
                }`}
              >
                {auto ? <Zap className="size-2.5" /> : <Clock className="size-2.5" />}
                {auto ? "INSTANT DELIVERY" : `~${product.delivery_sla_minutes} min`}
              </span>
              <span className="text-muted-foreground">{product.warranty_hours}h warranty</span>
            </div>

            <p className="font-mono text-3xl text-accent mt-4">{usdt(product.price_cents)}</p>

            <BuyBox
              productId={product.id}
              slug={product.slug}
              basePriceCents={product.price_cents}
              minQty={product.min_qty}
              maxQty={product.max_qty}
              deliveryType={product.delivery_type}
              requiresInfo={!!product.required_info}
              variants={variants.map((v) => ({
                id: v.id,
                title: v.title,
                price_cents: v.price_cents,
              }))}
              outOfStock={outOfStock}
            />
          </div>

          {/* Seller card */}
          <Link
            href={`/s/${product.seller.username}`}
            className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/15 border border-primary/40 grid place-items-center text-xs font-bold text-primary uppercase">
                {product.seller.username.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{product.seller.username}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Star className="size-3 fill-current text-yellow-400" />
                  {product.seller.rating > 0 ? product.seller.rating.toFixed(1) : "new"} ·{" "}
                  {product.seller.total_sales.toLocaleString()} sales
                </p>
              </div>
            </div>
          </Link>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl mb-3">Related listings</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
