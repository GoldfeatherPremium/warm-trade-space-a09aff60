"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Category = { name: string; slug: string; icon: string };

export function CategoryBar() {
  const [cats, setCats] = useState<Category[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCats)
      .catch(() => {});
  }, []);

  if (cats.length === 0) return null;

  return (
    <div className="border-b border-border/60 bg-background/70 backdrop-blur-sm sticky top-14 z-30">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar py-1">
          <Link
            href="/browse"
            className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-secondary/60 transition-colors whitespace-nowrap"
          >
            All
          </Link>
          {cats.map((c) => (
            <Link
              key={c.slug}
              href={`/browse?category=${c.slug}`}
              className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-secondary/60 transition-colors whitespace-nowrap"
            >
              <span>{c.icon}</span>
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
