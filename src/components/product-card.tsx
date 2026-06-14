import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, Clock, Star, Heart } from "lucide-react";
import type { PublicProduct } from "@/lib/api/catalog";
import { listFavoriteIds, toggleFavorite } from "@/lib/api/extras";
import { useMe } from "@/hooks/use-me";
import { productImage } from "@/lib/images";
import { usdtShort } from "@/lib/format";
import { VerificationBadge, LevelBadge, TrustScore } from "./seller-badge";

export function useFavorites() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["favoriteIds"],
    queryFn: () => listFavoriteIds(),
    enabled: !!me,
    staleTime: 30_000,
  });
  const toggle = useMutation({
    mutationFn: (productId: string) => toggleFavorite({ data: { productId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favoriteIds"] }),
  });
  return { ids: new Set(data?.ids ?? []), toggle, loggedIn: !!me };
}

export function FavoriteButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  // Logged-out visitors (the vast majority on public pages) skip the favorites
  // query/mutation hooks entirely — no per-card React Query observers. Only an
  // authenticated card mounts the inner button that subscribes.
  const { me } = useMe();
  if (!me) return null;
  return <FavoriteButtonInner productId={productId} className={className} />;
}

function FavoriteButtonInner({ productId, className }: { productId: string; className?: string }) {
  const { ids, toggle } = useFavorites();
  const active = ids.has(productId);
  return (
    <button
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      className={`size-7 grid place-items-center rounded-full bg-background/70 backdrop-blur hover:bg-background ${className ?? ""}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate(productId);
      }}
    >
      <Heart
        className={`size-3.5 ${active ? "text-destructive fill-current" : "text-foreground/70"}`}
      />
    </button>
  );
}

// Memoized: product grids render 8–24 cards, and the parent page re-renders
// on unrelated state changes (recently-viewed, pulse polling). With stable
// product props from the query cache, memo skips re-rendering every card.
export const ProductCard = memo(function ProductCard({
  product,
  priority,
}: {
  product: PublicProduct;
  priority?: boolean;
}) {
  const { banner } = useMe();
  const lowStockThreshold = banner?.lowStockThreshold ?? 5;
  return (
    <Link
      to="/p/$slug"
      params={{ slug: product.slug }}
      className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors group flex flex-col"
    >
      <div className="aspect-[16/10] bg-secondary overflow-hidden relative">
        <img
          src={productImage(product.image_key)}
          alt={product.title}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all"
        />
        <span
          className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
            product.delivery_type === "auto"
              ? "bg-accent/90 text-accent-foreground"
              : "bg-blue-500/90 text-white"
          }`}
        >
          {product.delivery_type === "auto" ? (
            <Zap className="size-2.5" />
          ) : (
            <Clock className="size-2.5" />
          )}
          {product.delivery_type === "auto" ? "INSTANT" : `~${product.delivery_sla_minutes}min`}
        </span>
        <FavoriteButton productId={product.id} className="absolute bottom-2 right-2" />
        {product.is_promoted && (
          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/90 text-white tracking-widest">
            SPONSORED
          </span>
        )}
        {product.delivery_type === "auto" && product.stock_count === 0 && (
          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive/90 text-white">
            OUT OF STOCK
          </span>
        )}
        {product.delivery_type === "auto" &&
          product.stock_count > 0 &&
          product.stock_count <= lowStockThreshold && (
            <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/90 text-black">
              ONLY {product.stock_count} LEFT
            </span>
          )}
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <h3 className="text-xs font-bold leading-tight line-clamp-2">{product.title}</h3>
        <p className="text-[10px] text-muted-foreground">{product.category_name}</p>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
              <span className="size-1.5 rounded-full bg-accent inline-block" />
              <span className="truncate">{product.seller.username}</span>
              <VerificationBadge
                tier={product.seller.verification_tier}
                size="xs"
                showLabel={false}
              />
              <span className="flex items-center gap-0.5 text-yellow-400">
                <Star className="size-2.5 fill-current" />
                {product.seller.rating > 0 ? product.seller.rating.toFixed(1) : "new"}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <LevelBadge level={product.seller.seller_level} size="xs" />
              {product.seller.trust_score > 0 && <TrustScore score={product.seller.trust_score} />}
              <span className="text-[9px] text-muted-foreground">· {product.sold_count} sold</span>
            </div>
          </div>
          <span className="text-accent font-mono text-sm whitespace-nowrap">
            {usdtShort(product.price_cents)}
          </span>
        </div>
      </div>
    </Link>
  );
});
