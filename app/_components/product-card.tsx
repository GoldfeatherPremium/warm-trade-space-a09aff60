import Image from "next/image";
import Link from "next/link";
import { Zap, Clock, Star } from "lucide-react";
import type { PublicProduct } from "@/lib/api/catalog";
import { usdtShort } from "@/lib/format";
import { productImage } from "../_lib/product-image";

export function ProductCard({ product, priority }: { product: PublicProduct; priority?: boolean }) {
  const lowStock = 5;
  const auto = product.delivery_type === "auto";
  const outOfStock = auto && product.stock_count === 0;

  return (
    <Link
      href={`/p/${product.slug}`}
      className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden card-hover"
    >
      {/* Image */}
      <div className="aspect-[16/10] bg-secondary overflow-hidden relative shrink-0">
        <Image
          src={productImage(product.image_key)}
          alt={product.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
          className={`object-cover transition-transform duration-300 group-hover:scale-105 ${outOfStock ? "opacity-50" : "opacity-90 group-hover:opacity-100"}`}
        />

        {/* Delivery badge */}
        <span
          className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-sm ${
            auto ? "bg-primary/85 text-primary-foreground" : "bg-accent/85 text-accent-foreground"
          }`}
        >
          {auto ? <Zap className="size-2.5" /> : <Clock className="size-2.5" />}
          {auto ? "INSTANT" : `~${product.delivery_sla_minutes}min`}
        </span>

        {/* Right badges */}
        {product.is_promoted && !outOfStock && (
          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/85 text-primary-foreground tracking-widest backdrop-blur-sm">
            FEATURED
          </span>
        )}
        {outOfStock && (
          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-foreground/70 text-background backdrop-blur-sm">
            SOLD OUT
          </span>
        )}
        {auto && !outOfStock && product.stock_count > 0 && product.stock_count <= lowStock && (
          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-warning/90 text-warning-foreground backdrop-blur-sm">
            {product.stock_count} LEFT
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        <h3 className="text-[13px] font-semibold leading-snug line-clamp-2 text-foreground/90 group-hover:text-foreground transition-colors">
          {product.title}
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2">
          {/* Seller info */}
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
              <span className="size-1.5 rounded-full bg-primary inline-block shrink-0" />
              <span className="truncate font-medium">{product.seller.username}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Star className="size-2.5 fill-warning text-warning shrink-0" />
              <span className="text-warning font-medium">
                {product.seller.rating > 0 ? product.seller.rating.toFixed(1) : "New"}
              </span>
              <span className="text-muted-foreground/60">· {product.sold_count} sold</span>
            </div>
          </div>

          {/* Price */}
          <div className="text-right shrink-0">
            <span className="text-accent font-mono font-semibold text-sm">
              {usdtShort(product.price_cents)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
