"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid } from "lucide-react";

type Category = { name: string; slug: string; icon: string };

function CategoryBarInner() {
  const [cats, setCats] = useState<Category[]>([]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCats)
      .catch(() => {});
  }, []);

  if (cats.length === 0) return null;

  const isAllActive = pathname === "/browse" && !activeCategory;

  return (
    <div className="border-b border-border/60 bg-background sticky top-16 z-30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
          <Link
            href="/browse"
            className={`shrink-0 flex items-center gap-1.5 text-[12px] font-medium px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              isAllActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            All
          </Link>
          {cats.map((c) => {
            const isActive = activeCategory === c.slug;
            return (
              <Link
                key={c.slug}
                href={`/browse?category=${c.slug}`}
                className={`shrink-0 flex items-center gap-1.5 text-[12px] font-medium px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                }`}
              >
                <span className="text-sm leading-none">{c.icon}</span>
                {c.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CategoryBar() {
  return (
    <Suspense fallback={null}>
      <CategoryBarInner />
    </Suspense>
  );
}
