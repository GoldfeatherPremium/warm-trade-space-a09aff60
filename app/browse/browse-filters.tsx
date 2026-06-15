"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Zap, Package, ShieldCheck, X } from "lucide-react";

interface BrowseFiltersProps {
  categories: Array<{ name: string; slug: string; icon: string }>;
  currentParams: Record<string, string>;
}

export function BrowseFilters({ categories, currentParams }: BrowseFiltersProps) {
  const router = useRouter();
  const [minPrice, setMinPrice] = useState(currentParams.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(currentParams.maxPrice ?? "");

  function buildUrl(patch: Record<string, string | undefined>): string {
    const merged: Record<string, string | undefined> = { ...currentParams, ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && v !== "0") sp.set(k, v);
    }
    sp.delete("page");
    const s = sp.toString();
    return s ? `/browse?${s}` : "/browse";
  }

  function applyPrice() {
    router.push(
      buildUrl({
        minPrice: minPrice.trim() || undefined,
        maxPrice: maxPrice.trim() || undefined,
      }),
    );
  }

  const activeCategory = currentParams.category;
  const activeDelivery = currentParams.delivery;
  const inStock = currentParams.inStock === "1";
  const verified = currentParams.verified === "1";
  const hasPrice = !!(currentParams.minPrice || currentParams.maxPrice);

  return (
    <div className="space-y-5">
      {/* CATEGORY */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
          Category
        </p>
        <div className="space-y-0.5">
          <Link
            href={buildUrl({ category: undefined })}
            className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors w-full ${
              !activeCategory
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            All categories
          </Link>
          {categories.map((c) => {
            const isActive = activeCategory === c.slug;
            return (
              <Link
                key={c.slug}
                href={buildUrl({ category: isActive ? undefined : c.slug })}
                className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors w-full ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <span>{c.icon}</span>
                <span className="truncate">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* DELIVERY TYPE */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
          Delivery
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { v: undefined, label: "Any", icon: null },
            { v: "auto", label: "Instant", icon: Zap },
            { v: "manual", label: "Manual", icon: Package },
          ].map((d) => {
            const isActive = (activeDelivery ?? undefined) === d.v;
            return (
              <Link
                key={d.label}
                href={buildUrl({ delivery: d.v })}
                className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2.5 py-1.5 transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {d.icon && <d.icon className="size-3" />}
                {d.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* PRICE RANGE */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
          Price (USDT)
        </p>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            className="w-full h-8 px-2 text-xs rounded-md border border-input bg-input outline-none focus:border-primary/50"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            className="w-full h-8 px-2 text-xs rounded-md border border-input bg-input outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={applyPrice}
            className="flex-1 text-[11px] font-semibold rounded-md bg-primary text-primary-foreground py-1.5 hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
          {hasPrice && (
            <Link
              href={buildUrl({ minPrice: undefined, maxPrice: undefined })}
              onClick={() => {
                setMinPrice("");
                setMaxPrice("");
              }}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1.5"
            >
              <X className="size-3" /> Clear
            </Link>
          )}
        </div>
      </div>

      {/* TOGGLE FILTERS */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
          Filters
        </p>
        <div className="space-y-0.5">
          <Link
            href={buildUrl({ inStock: inStock ? undefined : "1" })}
            className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors w-full ${
              inStock
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            <span
              className={`size-4 rounded border grid place-items-center shrink-0 ${
                inStock ? "bg-primary border-primary" : "border-border"
              }`}
            >
              {inStock && <Check className="size-3 text-primary-foreground" />}
            </span>
            In stock only
          </Link>
          <Link
            href={buildUrl({ verified: verified ? undefined : "1" })}
            className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors w-full ${
              verified
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            <span
              className={`size-4 rounded border grid place-items-center shrink-0 ${
                verified ? "bg-primary border-primary" : "border-border"
              }`}
            >
              {verified && <Check className="size-3 text-primary-foreground" />}
            </span>
            <ShieldCheck className="size-3.5" />
            Verified sellers
          </Link>
        </div>
      </div>
    </div>
  );
}
