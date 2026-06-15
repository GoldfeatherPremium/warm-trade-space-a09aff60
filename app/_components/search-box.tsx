"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export function SearchBox({ variant = "default" }: { variant?: "default" | "hero" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const big = variant === "hero";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/browse?q=${encodeURIComponent(term)}` : "/browse");
      }}
      role="search"
      className={`flex items-center gap-2 bg-secondary/60 border border-border rounded-lg focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all ${
        big ? "px-4 h-13" : "px-3 h-9"
      }`}
    >
      <Search className={`text-muted-foreground shrink-0 ${big ? "size-4.5" : "size-3.5"}`} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          big ? "Search games, gift cards, accounts, subscriptions…" : "Search listings…"
        }
        aria-label="Search the marketplace"
        className={`flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60 ${
          big ? "text-sm" : "text-xs"
        }`}
      />
      <button
        type="submit"
        className={`font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 ${
          big ? "text-xs px-4 py-2" : "text-[11px] px-3 py-1.5"
        }`}
      >
        Search
      </button>
    </form>
  );
}
