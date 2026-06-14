"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Minimal client search island — the only interactive JS the homepage hero
 * needs. Submits to /browse?q=… (server-rendered results). Kept deliberately
 * tiny to preserve the public-page JS budget; richer suggestions can be added
 * as a progressive enhancement later.
 */
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
      className={`flex items-center gap-2 bg-secondary/70 border border-border rounded-lg ${
        big ? "px-4 h-12" : "px-3 h-9"
      }`}
    >
      <Search className="size-4 text-muted-foreground shrink-0" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search games, gift cards, subscriptions, accounts…"
        aria-label="Search the marketplace"
        className={`flex-1 bg-transparent outline-none placeholder:text-muted-foreground ${
          big ? "text-sm" : "text-xs"
        }`}
      />
      <button
        type="submit"
        className={`font-bold rounded-md bg-primary text-primary-foreground ${
          big ? "text-xs px-4 py-2" : "text-[11px] px-3 py-1.5"
        }`}
      >
        Search
      </button>
    </form>
  );
}
