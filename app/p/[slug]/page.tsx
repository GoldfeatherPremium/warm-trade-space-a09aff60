import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  Star,
  Zap,
  Clock,
  ShieldCheck,
  Lock,
  RefreshCw,
  Eye,
  Package,
  Tag,
  Monitor,
  Globe,
} from "lucide-react";
import { getProductBySlug } from "@/server/queries/catalog";
import { usdt, timeAgo } from "@/lib/format";
import { PublicShell } from "../../_components/site-shell";
import { productImage } from "../../_lib/product-image";
import { SellerBadge } from "../../_components/seller-badge";
import { BuyBox } from "./buy-box";
import { RelatedProducts } from "./related-products";
import { ViewBeacon } from "./view-beacon";

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
  const description =
    product.admin_seo_description ??
    `Buy ${product.title} on X-VAULT — buyer-protected, ${product.warranty_hours}h warranty, ${product.delivery_type === "auto" ? "instant delivery" : "fast manual delivery"}. Paid in USDT.`;
  return {
    title,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/p/${product.slug}`,
      type: "website",
      images: [{ url: `${SITE_URL}${productImage(product.image_key)}`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product, reviews, variants } = await getProductBySlug(slug);
  if (!product) notFound();
  const auto = product.delivery_type === "auto";
  const outOfStock = auto && product.stock_count === 0;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Browse", item: `${SITE_URL}/browse` },
      {
        "@type": "ListItem",
        position: 2,
        name: product.category_name,
        item: `${SITE_URL}/browse?category=${product.category_slug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.title,
        item: `${SITE_URL}/p/${product.slug}`,
      },
    ],
  };

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
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
          <div className="group aspect-[16/10] rounded-2xl overflow-hidden border border-border bg-secondary relative shadow-card">
            <Image
              src={productImage(product.image_key)}
              alt={product.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute top-3 left-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm ${
                  auto
                    ? "bg-primary/85 text-primary-foreground"
                    : "bg-accent/85 text-accent-foreground"
                }`}
              >
                {auto ? <Zap className="size-2.5" /> : <Clock className="size-2.5" />}
                {auto ? "INSTANT DELIVERY" : `~${product.delivery_sla_minutes} MIN`}
              </span>
              {product.is_promoted && !outOfStock && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-fuchsia-500/85 text-white backdrop-blur-sm tracking-widest">
                  FEATURED
                </span>
              )}
            </div>
          </div>

          {/* Quick stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              {
                icon: Star,
                label: "Rating",
                value:
                  product.seller.rating > 0
                    ? `${product.seller.rating.toFixed(1)} (${product.seller.rating_count})`
                    : "New",
              },
              { icon: Package, label: "Sold", value: product.sold_count.toLocaleString() },
              { icon: Eye, label: "Views", value: product.views.toLocaleString() },
              { icon: ShieldCheck, label: "Warranty", value: `${product.warranty_hours}h` },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-secondary border border-border/60 rounded-xl p-3 flex flex-col gap-1"
              >
                <s.icon className="size-3.5 text-primary shrink-0" />
                <span className="text-sm font-bold leading-none">{s.value}</span>
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-display text-lg mb-3">About this listing</h2>
            <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">
              {product.description
                .replace(/^(?:#+\s*)?about\s+this\s+listing\s*[\r\n]*/i, "")
                .trim()}
            </p>
            {(product.platform || product.region || product.item_name) && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/60">
                {product.item_name && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-secondary/60 border border-border/60 rounded-md px-2 py-1">
                    <Tag className="size-3" /> {product.item_name}
                  </span>
                )}
                {product.platform && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-secondary/60 border border-border/60 rounded-md px-2 py-1">
                    <Monitor className="size-3" /> {product.platform}
                  </span>
                )}
                {product.region && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-secondary/60 border border-border/60 rounded-md px-2 py-1">
                    <Globe className="size-3" /> {product.region}
                  </span>
                )}
              </div>
            )}
          </div>

          {reviews.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-display text-lg mb-3">Reviews ({reviews.length})</h2>
              <div className="space-y-3">
                {reviews.map((r, i) => (
                  <div key={i} className="border-b border-border/60 pb-3 last:border-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                        <Star className="size-3 fill-current" />
                        {r.rating}
                      </span>
                      <span className="font-bold">{r.buyer}</span>
                      <span className="text-muted-foreground">{timeAgo(r.created_at)}</span>
                    </div>
                    {r.comment && <p className="text-sm text-foreground/80 mt-1">{r.comment}</p>}
                    {r.seller_reply && (
                      <p className="text-xs text-muted-foreground mt-1 pl-3 border-l-2 border-primary/40">
                        Seller: {r.seller_reply}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQ */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-display text-lg mb-3">Frequently asked</h2>
            <div className="divide-y divide-border/60">
              {[
                {
                  q: "How am I protected?",
                  a: "Your USDT is held in escrow when you pay and is only released to the seller after you confirm delivery. If something is wrong, open a dispute during your warranty window and our team reviews it within 24 hours.",
                },
                {
                  q: "How fast will I receive my order?",
                  a: auto
                    ? "This is an auto-delivery listing — your goods are released instantly the moment payment is confirmed."
                    : `This seller delivers manually, typically within ~${product.delivery_sla_minutes} minutes. You'll be notified the moment it ships.`,
                },
                {
                  q: "What if the item doesn't work?",
                  a: `This listing includes a ${product.warranty_hours}h warranty. If the goods aren't as described, you're covered — request a replacement or open a dispute for a refund.`,
                },
              ].map((f) => (
                <details key={f.q} className="group py-3 first:pt-0 last:pb-0">
                  <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold">
                    {f.q}
                    <span className="text-muted-foreground transition-transform group-open:rotate-45 text-lg leading-none">
                      +
                    </span>
                  </summary>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>

        {/* Right: buy panel */}
        <aside className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 lg:sticky lg:top-20 shadow-card">
            <h1 className="font-display text-2xl leading-tight">{product.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
              <span
                className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded ${
                  auto
                    ? "bg-primary/90 text-primary-foreground"
                    : "bg-accent/90 text-accent-foreground"
                }`}
              >
                {auto ? <Zap className="size-2.5" /> : <Clock className="size-2.5" />}
                {auto ? "INSTANT DELIVERY" : `~${product.delivery_sla_minutes} min`}
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {product.seller.rating > 0 ? product.seller.rating.toFixed(1) : "New"} ·{" "}
                {product.sold_count.toLocaleString()} sold
              </span>
            </div>

            <div className="flex items-end gap-2 mt-4">
              <span className="font-mono text-3xl text-gradient-brand font-bold">
                {usdt(product.price_cents)}
              </span>
              <span className="text-[11px] text-muted-foreground mb-1">USDT</span>
            </div>

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

            {/* Trust strip */}
            <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-3 gap-2 text-center">
              {[
                { icon: Lock, label: "Escrow secured" },
                { icon: ShieldCheck, label: "Buyer protected" },
                { icon: RefreshCw, label: `${product.warranty_hours}h warranty` },
              ].map((t) => (
                <div key={t.label} className="flex flex-col items-center gap-1">
                  <t.icon className="size-4 text-primary" />
                  <span className="text-[9px] text-muted-foreground leading-tight">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Seller card */}
          <Link
            href={`/s/${product.seller.username}`}
            className="block bg-card border border-border rounded-2xl p-4 card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-primary/15 border border-primary/40 grid place-items-center text-sm font-bold text-primary uppercase shrink-0">
                {product.seller.username.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold truncate">{product.seller.username}</p>
                  <SellerBadge tier={product.seller.verification_tier} />
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Star className="size-3 fill-current text-amber-400" />
                  {product.seller.rating > 0 ? product.seller.rating.toFixed(1) : "New"} · Lvl{" "}
                  {product.seller.seller_level} · {product.seller.total_sales.toLocaleString()}{" "}
                  sales
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/60 text-center">
              <div>
                <p className="text-sm font-bold">{Math.round(product.seller.completion_rate)}%</p>
                <p className="text-[10px] text-muted-foreground">Completion</p>
              </div>
              <div>
                <p className="text-sm font-bold">
                  {new Date(product.seller.created_at).getFullYear()}
                </p>
                <p className="text-[10px] text-muted-foreground">Member since</p>
              </div>
            </div>
          </Link>
        </aside>
      </div>

      <Suspense fallback={<div className="mt-10 h-40 rounded-xl bg-secondary/50 animate-pulse" />}>
        <RelatedProducts productId={product.id} />
      </Suspense>

      <ViewBeacon productId={product.id} />
    </PublicShell>
  );
}
