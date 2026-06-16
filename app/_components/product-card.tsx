"use client";

import Image from "next/image";
import Link from "next/link";
import { Zap, Clock, Heart } from "lucide-react";
import type { PublicProduct } from "@/lib/types";
import { productImage } from "../_lib/product-image";
import { RatingStars, PriceTag } from "./kit";

const LOW_STOCK = 5;

export function ProductCard({ product, priority }: { product: PublicProduct; priority?: boolean }) {
  const auto = product.delivery_type === "auto";
  const outOfStock = auto && product.stock_count === 0;
  const isLowStock =
    auto && !outOfStock && product.stock_count > 0 && product.stock_count <= LOW_STOCK;

  return (
    <Link
      href={`/p/${product.slug}`}
      className="group relative flex flex-col bg-card border border-border rounded-2xl overflow-hidden card-hover"
    >
      {/* Wishlist (visual only for now) */}
      <button
        aria-label="Add to wishlist"
        onClick={(e) => e.preventDefault()}
        className="absolute top-2.5 right-2.5 z-10 size-7 rounded-full glass flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:scale-110 active:scale-95"
      >
        <Heart className="size-3.5 text-foreground/70 hover:text-red-400 transition-colors" />
      </button>

      {/* Image */}
      <div className="aspect-[16/10] bg-secondary overflow-hidden relative shrink-0">
        <Image
          src={productImage(product.image_key)}
          alt={product.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
          className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
            outOfStock ? "opacity-40 grayscale" : "opacity-90 group-hover:opacity-100"
          }`}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
          aria-hidden
        />

        {/* Delivery badge — high-contrast over the image */}
        <span
          className={`absolute top-2.5 left-2.5 text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 backdrop-blur-sm border ${
            auto
              ? "bg-primary/85 text-primary-foreground border-primary/40"
              : "bg-accent/85 text-accent-foreground border-accent/40"
          }`}
        >
          {auto ? <Zap className="size-2.5" /> : <Clock className="size-2.5" />}
          {auto ? "INSTANT" : `~${product.delivery_sla_minutes}min`}
        </span>

        {product.is_promoted && !outOfStock && (
          <span className="absolute top-2.5 left-[88px] text-[9px] font-bold px-2 py-1 rounded-lg bg-warning/90 text-warning-foreground border border-warning/40 backdrop-blur-sm tracking-wide">
            FEATURED
          </span>
        )}
        {outOfStock && (
          <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-1 rounded-lg bg-foreground/60 text-background backdrop-blur-sm">
            SOLD OUT
          </span>
        )}
        {isLowStock && (
          <span className="absolute bottom-2.5 left-2.5 text-[9px] font-bold px-2 py-1 rounded-lg bg-destructive/85 text-destructive-foreground backdrop-blur-sm animate-pulse">
            {product.stock_count} LEFT
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col flex-1 gap-2.5">
        <h3 className="text-[13px] font-semibold leading-snug line-clamp-2 text-foreground/85 group-hover:text-foreground transition-colors">
          {product.title}
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2">
          {/* Seller */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-6 rounded-md bg-primary/15 border border-primary/25 grid place-items-center shrink-0 text-[9px] font-bold text-primary uppercase">
              {product.seller.username.slice(0, 2)}
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-medium text-muted-foreground truncate leading-none">
                {product.seller.username}
              </p>
              <div className="flex items-center gap-1.5">
                <RatingStars rating={product.seller.rating} size="sm" showValue={false} />
                <span className="text-[10px] text-muted-foreground/60">
                  · {product.sold_count} sold
                </span>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="text-right shrink-0">
            <PriceTag cents={product.price_cents} size="md" short className="block" />
          </div>
        </div>
      </div>

      {/* Hover glow accent */}
      <div
        className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        aria-hidden
      />
    </Link>
  );
}
