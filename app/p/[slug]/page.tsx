import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  Zap,
  Clock,
  ShieldCheck,
  ChevronRight,
  Package,
  Globe,
  Monitor,
  Award,
  MessageSquare,
  TrendingUp,
  BadgeCheck,
} from "lucide-react";
import { getProductBySlug } from "@/server/queries/catalog";
import { usdt, timeAgo } from "@/lib/format";
import { PublicShell } from "../../_components/site-shell";
import { productImage } from "../../_lib/product-image";
import {
  RatingStars,
  PriceTag,
  DeliveryBadge,
  StockPill,
  TrustStrip,
  Stat,
} from "../../_components/kit";
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

const VERIFIED = new Set(["verified", "business", "premium"]);

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product, reviews, variants } = await getProductBySlug(slug);
  if (!product) notFound();

  const auto = product.delivery_type === "auto";
  const outOfStock = auto && product.stock_count === 0;
  const imgSrc = productImage(product.image_key);
  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const isVerified = VERIFIED.has(product.seller.verification_tier);

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
    image: `${SITE_URL}${imgSrc}`,
    offers: {
      "@type": "Offer",
      price: (product.price_cents / 100).toFixed(2),
      priceCurrency: "USD",
      availability: outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${SITE_URL}/p/${product.slug}`,
    },
    ...(avgRating > 0 && reviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: avgRating.toFixed(1),
            reviewCount: reviews.length,
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

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-[11px] text-muted-foreground mb-5 flex-wrap">
        <Link href="/browse" className="hover:text-foreground transition-colors">
          Browse
        </Link>
        <ChevronRight className="size-3 shrink-0" />
        <Link
          href={`/browse?category=${product.category_slug}`}
          className="hover:text-foreground transition-colors"
        >
          {product.category_name}
        </Link>
        <ChevronRight className="size-3 shrink-0" />
        <span className="text-foreground truncate max-w-[55vw] sm:max-w-[300px]">
          {product.title}
        </span>
      </nav>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* ── LEFT ── */}
        <div className="space-y-5 min-w-0">
          {/* Gallery */}
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-border bg-secondary">
            <Image
              src={imgSrc}
              alt={product.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              className={`object-cover transition-opacity ${outOfStock ? "opacity-50" : ""}`}
            />
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              <DeliveryBadge
                deliveryType={product.delivery_type}
                slaMinutes={product.delivery_sla_minutes}
                className="bg-background/85 backdrop-blur-sm"
              />
              <StockPill
                deliveryType={product.delivery_type}
                stockCount={product.stock_count}
                className="bg-background/85 backdrop-blur-sm"
              />
              {product.is_promoted && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/90 text-warning-foreground">
                  Featured
                </span>
              )}
            </div>
            <div className="absolute bottom-3 right-3">
              <Link
                href={`/browse?category=${product.category_slug}`}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm border border-border/60 text-foreground hover:bg-background transition-colors"
              >
                {product.category_name}
              </Link>
            </div>
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Highlight
              icon={auto ? Zap : Clock}
              label="Delivery"
              value={auto ? "Instant auto-delivery" : `~${product.delivery_sla_minutes} min manual`}
              accent={auto}
            />
            <Highlight
              icon={ShieldCheck}
              label="Warranty"
              value={`${product.warranty_hours}h buyer protection`}
            />
            {auto && (
              <Highlight
                icon={Package}
                label="In stock"
                value={outOfStock ? "0 units" : `${product.stock_count} units`}
                accent={!outOfStock}
              />
            )}
            {product.region && <Highlight icon={Globe} label="Region" value={product.region} />}
            {product.platform && (
              <Highlight icon={Monitor} label="Platform" value={product.platform} />
            )}
            {product.insurance_days > 0 && (
              <Highlight
                icon={Award}
                label="Insurance"
                value={`${product.insurance_days}d covered`}
              />
            )}
            {product.sold_count > 0 && (
              <Highlight
                icon={TrendingUp}
                label="Sold"
                value={`${product.sold_count.toLocaleString()} units`}
              />
            )}
          </div>

          {/* Description */}
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-display text-lg mb-3">About this listing</h2>
            <div className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">
              {product.description}
            </div>
          </section>

          {/* Reviews */}
          <section className="bg-card border border-border rounded-2xl p-5" id="reviews">
            <h2 className="font-display text-lg mb-4">
              Reviews
              {reviews.length > 0 && (
                <span className="ml-1 text-sm font-body font-normal text-muted-foreground">
                  ({reviews.length})
                </span>
              )}
            </h2>

            {reviews.length === 0 ? (
              <div className="py-6 text-center">
                <MessageSquare className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No reviews yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Be the first buyer to leave feedback
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-6 mb-5 pb-5 border-b border-border/60">
                  <div className="text-center shrink-0">
                    <p className="font-display text-5xl text-foreground tabular-nums">
                      {avgRating.toFixed(1)}
                    </p>
                    <div className="flex justify-center mt-1.5">
                      <RatingStars rating={avgRating} size="md" showValue={false} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {reviews.length} reviews
                    </p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {dist.map(({ star, count }) => (
                      <div key={star} className="flex items-center gap-2 text-[11px]">
                        <span className="w-6 text-right text-muted-foreground tabular-nums">
                          {star}
                        </span>
                        <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-warning rounded-full"
                            style={{
                              width:
                                reviews.length > 0 ? `${(count / reviews.length) * 100}%` : "0%",
                            }}
                          />
                        </div>
                        <span className="w-5 text-muted-foreground tabular-nums">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {reviews.map((r, i) => (
                    <div key={i} className="pb-4 border-b border-border/50 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-full bg-secondary border border-border grid place-items-center text-[10px] font-bold text-muted-foreground uppercase shrink-0">
                            {r.buyer.slice(0, 1)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{r.buyer}</p>
                            <div className="mt-0.5">
                              <RatingStars rating={r.rating} size="sm" showValue={false} />
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {timeAgo(r.created_at)}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-sm text-foreground/80 ml-9 leading-relaxed">
                          {r.comment}
                        </p>
                      )}
                      {r.seller_reply && (
                        <div className="ml-9 mt-2 pl-3 border-l-2 border-primary/30">
                          <p className="text-[10px] text-muted-foreground mb-0.5 font-semibold">
                            Seller reply
                          </p>
                          <p className="text-xs text-muted-foreground">{r.seller_reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        {/* ── RIGHT: sticky buy panel ── */}
        <aside className="space-y-3">
          <div className="bg-card border border-border rounded-2xl p-5 lg:sticky lg:top-24">
            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <DeliveryBadge
                  deliveryType={product.delivery_type}
                  slaMinutes={product.delivery_sla_minutes}
                />
                <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-secondary border border-border">
                  {product.warranty_hours}h warranty
                </span>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">
                    <BadgeCheck className="size-2.5" /> Verified seller
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold leading-snug">{product.title}</h1>
              {reviews.length > 0 && (
                <a href="#reviews" className="mt-1.5 inline-block">
                  <RatingStars rating={avgRating} count={reviews.length} size="sm" />
                </a>
              )}
            </div>

            <div className="border-t border-border/60 pt-4 mb-4">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium tracking-wider uppercase">
                Price per unit
              </p>
              <PriceTag cents={product.price_cents} size="lg" />
              {product.sold_count > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {product.sold_count.toLocaleString()} sold ·{" "}
                  {isVerified ? "Verified seller" : `Level ${product.seller.seller_level}`}
                </p>
              )}
            </div>

            <BuyBox
              productId={product.id}
              slug={product.slug}
              basePriceCents={product.price_cents}
              minQty={product.min_qty}
              maxQty={product.max_qty}
              deliveryType={product.delivery_type}
              requiresInfo={!!product.required_info}
              variants={variants}
              outOfStock={outOfStock}
              stockCount={product.stock_count}
            />

            <div className="mt-4 pt-4 border-t border-border/60">
              <TrustStrip warrantyHours={product.warranty_hours} />
            </div>
          </div>

          {/* Seller card */}
          <Link
            href={`/s/${product.seller.username}`}
            className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="size-11 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center text-sm font-bold text-primary uppercase shrink-0">
                {product.seller.username.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-bold truncate">{product.seller.username}</p>
                  {isVerified && <BadgeCheck className="size-4 text-primary shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {product.seller.verification_tier} seller · Level {product.seller.seller_level}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat
                value={product.seller.rating > 0 ? product.seller.rating.toFixed(1) : "—"}
                label="rating"
              />
              <Stat
                value={
                  product.seller.total_sales >= 1000
                    ? `${(product.seller.total_sales / 1000).toFixed(1)}k`
                    : String(product.seller.total_sales)
                }
                label="sales"
              />
              <Stat value={`${Math.round(product.seller.completion_rate)}%`} label="completion" />
            </div>

            <p className="text-[10px] text-primary font-semibold mt-3 group-hover:underline">
              View seller store →
            </p>
          </Link>

          {/* Buyer protection checklist */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
              Buyer Protection
            </p>
            <div className="space-y-2">
              {[
                "Funds held in escrow until delivery",
                "Dispute team available 24 hours",
                `${product.warranty_hours}h warranty after delivery`,
                "USDT payment — no chargebacks",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs">
                  <ShieldCheck className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Suspense fallback={<div className="mt-10 h-40 rounded-2xl bg-secondary/50 animate-pulse" />}>
        <RelatedProducts productId={product.id} />
      </Suspense>

      <ViewBeacon productId={product.id} />
    </PublicShell>
  );
}

function Highlight({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-3 flex items-start gap-2.5">
      <Icon
        className={`size-4 shrink-0 mt-0.5 ${accent ? "text-primary" : "text-muted-foreground"}`}
      />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
          {label}
        </p>
        <p className="text-xs font-semibold truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}
