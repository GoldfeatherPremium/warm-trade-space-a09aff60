"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Clock,
  X,
  Zap,
  Star,
  ChevronRight,
  Tag,
  Flame,
  ShieldCheck,
  Loader2,
} from "lucide-react";

type SuggestProduct = {
  title: string;
  slug: string;
  price_cents: number;
  sold_count: number;
  image_key: string | null;
  delivery_type: string;
  category_name: string;
};
type SuggestSeller = {
  username: string;
  rating: number;
  total_sales: number;
  verification_tier: string;
};
type SuggestCategory = { name: string; slug: string; icon: string };
type SuggestResult = {
  products: SuggestProduct[];
  sellers: SuggestSeller[];
  categories: SuggestCategory[];
  popular: string[];
  suggestion: string | null;
};

const RECENT_KEY = "xv_recent_v2";
const MAX_RECENT = 6;
const VERIFIED = new Set(["verified", "business", "premium"]);

function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}
function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

/** Natural-language intent parsing — maps phrases to sort/delivery filters. */
function parseIntent(raw: string): { q: string; sort?: string; delivery?: string } {
  let q = raw.trim();
  let sort: string | undefined;
  let delivery: string | undefined;
  if (/\bcheap\b|\baffordable\b|\blowest?\b/i.test(q)) {
    sort = "price_asc";
    q = q.replace(/\bcheap\b|\baffordable\b|\blowest?\b/gi, "").trim();
  } else if (/\bbest\b|\btop\b|\bhighest? rated\b/i.test(q)) {
    sort = "rating";
    q = q.replace(/\bbest\b|\btop\b|\bhighest? rated\b/gi, "").trim();
  } else if (/\bnew(?:est)?\b|\blatest\b/i.test(q)) {
    sort = "newest";
    q = q.replace(/\bnew(?:est)?\b|\blatest\b/gi, "").trim();
  }
  if (/\binstant\b|\bauto.?deliver/i.test(q)) {
    delivery = "auto";
    q = q.replace(/\binstant\b|\bauto.?deliver\w*/gi, "").trim();
  }
  return { q: q.replace(/\s+/g, " ").trim() || raw.trim(), sort, delivery };
}

export function SmartSearchBox({ variant = "default" }: { variant?: "default" | "hero" }) {
  const router = useRouter();
  const big = variant === "hero";

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggest = useCallback((value: string) => {
    setLoading(true);
    fetch(`/api/search/suggest?q=${encodeURIComponent(value)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: SuggestResult) => setResult(d))
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, []);

  // Debounced fetch on query change while open
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggest(query.trim()), 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, fetchSuggest]);

  // Load recents + initial (empty) suggestions when opened
  useEffect(() => {
    if (open) {
      setRecent(getRecent());
      if (!result) fetchSuggest(query.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Cmd/Ctrl+K to focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function commitRecent(term: string) {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(
      0,
      MAX_RECENT,
    );
    setRecent(next);
    saveRecent(next);
  }

  function submit(term: string) {
    const value = term.trim();
    if (!value) {
      router.push("/browse");
      setOpen(false);
      return;
    }
    commitRecent(value);
    const { q, sort, delivery } = parseIntent(value);
    const sp = new URLSearchParams();
    sp.set("q", q);
    if (sort) sp.set("sort", sort);
    if (delivery) sp.set("delivery", delivery);
    router.push(`/browse?${sp.toString()}`);
    setOpen(false);
    inputRef.current?.blur();
  }

  function removeRecent(term: string) {
    const next = recent.filter((r) => r !== term);
    setRecent(next);
    saveRecent(next);
  }
  function clearRecent() {
    setRecent([]);
    saveRecent([]);
  }

  const showTyped = query.trim().length > 0;
  const hasTypedResults =
    !!result &&
    (result.products.length > 0 ||
      result.sellers.length > 0 ||
      result.categories.length > 0 ||
      result.popular.length > 0);

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        role="search"
        className={`flex items-center gap-2 bg-secondary/60 border rounded-lg transition-all ${
          open ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
        } ${big ? "px-4 h-12" : "px-3 h-9"}`}
      >
        <Search className={`text-muted-foreground shrink-0 ${big ? "size-4.5" : "size-3.5"}`} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={
            big ? "Search games, gift cards, accounts, subscriptions…" : "Search listings…"
          }
          aria-label="Search the marketplace"
          className={`flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/60 ${
            big ? "text-sm" : "text-xs"
          }`}
        />
        {loading && <Loader2 className="size-3.5 text-muted-foreground animate-spin shrink-0" />}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
        <button
          type="submit"
          className={`font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 ${
            big ? "text-xs px-4 py-2" : "text-[11px] px-3 py-1.5"
          }`}
        >
          Search
        </button>
      </form>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-[480px] overflow-y-auto no-scrollbar animate-enter">
          {/* ── EMPTY QUERY ── */}
          {!showTyped && (
            <div className="p-2 space-y-3">
              {recent.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 mb-1">
                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                      Recent Searches
                    </span>
                    <button
                      onClick={clearRecent}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </button>
                  </div>
                  {recent.map((r) => (
                    <div
                      key={r}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/40 group"
                    >
                      <Clock className="size-3.5 text-muted-foreground shrink-0" />
                      <button
                        onClick={() => submit(r)}
                        className="flex-1 text-left text-xs truncate"
                      >
                        {r}
                      </button>
                      <button
                        onClick={() => removeRecent(r)}
                        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove ${r}`}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {result && result.popular.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-2 mb-1.5">
                    <Flame className="size-3 text-accent" />
                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                      Trending Today
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-2">
                    {result.popular.map((p) => (
                      <button
                        key={p}
                        onClick={() => submit(p)}
                        className="text-[11px] capitalize px-2.5 py-1 rounded-full bg-secondary/70 border border-border/60 hover:border-primary/50 hover:text-primary transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {result && result.categories.length > 0 && (
                <div>
                  <span className="block px-2 mb-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    Browse Categories
                  </span>
                  <div className="grid grid-cols-2 gap-0.5">
                    {result.categories.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/browse?category=${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/40 text-xs"
                      >
                        <span>{c.icon}</span>
                        <span className="truncate">{c.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {!result && !loading && (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Start typing to search…
                </p>
              )}
            </div>
          )}

          {/* ── TYPED QUERY ── */}
          {showTyped && (
            <div className="py-1">
              {result?.suggestion && (
                <button
                  onClick={() => {
                    setQuery(result.suggestion!);
                    fetchSuggest(result.suggestion!);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs border-b border-border/60 hover:bg-secondary/40"
                >
                  <Search className="size-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Did you mean</span>
                  <span className="font-semibold text-primary">{result.suggestion}</span>
                </button>
              )}

              {result && result.products.length > 0 && (
                <Section label="Products">
                  {result.products.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/p/${p.slug}`}
                      onClick={() => {
                        commitRecent(query);
                        setOpen(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="size-9 rounded-md bg-secondary border border-border grid place-items-center shrink-0 text-sm">
                        🎮
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {p.category_name}
                          {p.sold_count > 0 ? ` · ${p.sold_count} sold` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-accent font-mono">
                          ${(p.price_cents / 100).toFixed(2)}
                        </p>
                        {p.delivery_type === "auto" && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-primary">
                            <Zap className="size-2.5" /> INSTANT
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </Section>
              )}

              {result && result.categories.length > 0 && (
                <Section label="Categories">
                  {result.categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/browse?category=${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/40 transition-colors"
                    >
                      <span className="text-base">{c.icon}</span>
                      <span className="flex-1 text-xs font-medium truncate">{c.name}</span>
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                </Section>
              )}

              {result && result.sellers.length > 0 && (
                <Section label="Sellers">
                  {result.sellers.map((s) => (
                    <Link
                      key={s.username}
                      href={`/s/${s.username}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="size-8 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-[10px] font-bold text-primary uppercase shrink-0">
                        {s.username.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate flex items-center gap-1">
                          {s.username}
                          {VERIFIED.has(s.verification_tier) && (
                            <ShieldCheck className="size-3 text-primary" />
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Star className="size-2.5 fill-amber-500 text-amber-500" />
                          {s.rating > 0 ? s.rating.toFixed(1) : "—"} · {s.total_sales} sales
                        </p>
                      </div>
                    </Link>
                  ))}
                </Section>
              )}

              {result && result.popular.length > 0 && (
                <Section label="Popular Searches">
                  <div className="flex flex-wrap gap-1.5 px-3 py-1">
                    {result.popular.map((p) => (
                      <button
                        key={p}
                        onClick={() => submit(p)}
                        className="text-[11px] capitalize px-2.5 py-1 rounded-full bg-secondary/70 border border-border/60 hover:border-primary/50 hover:text-primary transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {/* Empty results */}
              {result && !hasTypedResults && !loading && (
                <div className="px-3 py-8 text-center">
                  <Tag className="size-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs font-medium mb-1">No matches for “{query.trim()}”</p>
                  <p className="text-[11px] text-muted-foreground">
                    Try a different spelling or browse all listings.
                  </p>
                </div>
              )}

              {/* View all footer */}
              <button
                onClick={() => submit(query)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 mt-1 text-xs font-semibold text-primary border-t border-border/60 hover:bg-secondary/40 transition-colors"
              >
                <Search className="size-3.5" />
                View all results for “{query.trim()}”
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <span className="block px-3 py-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
