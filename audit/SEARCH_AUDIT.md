# SEARCH_AUDIT.md — X-VAULT Marketplace

Search implementation: `src/lib/server/search.server.ts`, suggest API `app/api/search/suggest/route.ts`, browse `app/browse/**`, `src/server/queries/catalog.ts`. Compared against Amazon / Etsy / G2G / Z2U / EpicNPC patterns.

## Current state (verified)
- **Tokenizer** with stopwords, unicode-aware, ≤6 tokens (`search.server.ts:16-23`).
- **Matching:** AND across tokens, OR across columns, `lower(col) like '%tok%'` (`:30-45`) over title/description/platform/category/item/seller.
- **Typo tolerance:** Damerau-Levenshtein "did-you-mean" (`:48-71, 102-127`).
- **Suggestions:** corpus from active product titles + catalog items + categories, 60s cache (`:79-96`).
- **Indexing:** Postgres `pg_trgm` GIN on `lower(title)`/`lower(description)`; SQLite FTS5 with triggers (`db.server.ts:1203-1266`).
- **Analytics:** `search_queries` logged with results count + zero-result tracking (`admin.ts:1337-1352`).

This is a respectable v1 — notably better than naive `LIKE` thanks to trgm/FTS5 and did-you-mean. Gaps vs. category leaders below.

## Gaps vs. Amazon/Etsy/G2G
- **No relevance ranking / scoring.** Results aren't ordered by match quality (title-hit > description-hit), recency, sales, or trust. Leaders rank heavily.
- **No facet/filter integration with relevance** (price, delivery type, region, seller level, in-stock, rating).
- **No synonyms / aliases** (e.g. "gift card" ↔ "giftcard", platform nicknames, game abbreviations).
- **No autocomplete on entity types** (products vs. sellers vs. categories) — suggestion corpus is word-level only; **seller names are not in the suggest corpus** (`:82-86` unions products/catalog/categories, not users).
- **No trending / popular / recent searches surfaced to users** (data is collected but not exposed).
- **No personalization / recently viewed.**
- **No multi-language / locale-aware search** despite i18n columns.

## Top search improvements (grouped; ~100)

**Relevance & ranking (1–20):** weighted field scoring (title≫desc); boost by sold_count, rating, trust tier, featured, recency; exact-phrase boost; stock-aware demotion of out-of-stock; per-token IDF; trgm similarity score ordering on Postgres; FTS5 `bm25()` ranking on SQLite; tie-break by price/popularity; seller-level boost; penalize disputed sellers; query-time category boost when category filter active; "best match" vs "newest" vs "price" sort options; learning-to-rank from `search_queries.clicked_product_id`; click-through re-ranking; dedupe near-identical listings; promote verified sellers; region-availability boost; freshness decay; suppress banned/paused.

**Typo / synonyms (21–35):** synonym dictionary table; platform alias map (PSN/PlayStation, Xbox/XBL); game abbreviation map (CoD, GTA, LoL); plural/singular stemming; accent folding (already partial); bigram suggestions; "search instead for"; auto-correct vs suggest threshold tuning; multi-token correction; brand normalization; currency/locale synonyms; emoji stripping; numeric normalization (100usd→100 usd); profanity handling; admin-editable synonym UI.

**Autocomplete / suggest (36–55):** entity-typed suggestions (product/seller/category); **add sellers to suggest corpus**; thumbnails in dropdown; price + delivery badge in suggest; popular-search seeds; recent searches (localStorage); trending searches widget; keyboard nav (cmdk already present); debounce + abort; prefetch top result; category scoping ("in Gift Cards"); zero-state popular categories; per-seller search on storefront; "did you mean" inline; highlight matched substring; suggest from synonyms; cap latency budget; cache hot prefixes; instant results panel; voice/paste handling.

**Filters & facets (56–72):** price range; delivery type (auto/manual); region/country availability; in-stock only; seller level/verification; rating ≥ N; on-sale; subscription vs one-time; platform; category tree; combine facets with relevance; facet counts; sticky filters in URL (browse already uses query params); clear-all; mobile filter drawer; saved searches; "new this week".

**Infra & quality (73–90):** confirm pg_trgm GIN is planner-used (EXPLAIN); materialized suggestion table; async search logging (don't block response); cap corpus size; dedicated search service at >100k items (Meilisearch/Typesense/OpenSearch); per-locale analyzers; query result caching; spell-check from corpus + dictionary; guard against very long queries; rate-limit suggest; index seller storefront fields; index variant titles; nightly synonym mining from zero-result logs; A/B ranking; search SLA dashboards; relevance regression tests; multi-region replicas for read; warm cache on deploy.

**Discovery / merchandising (91–100):** "no results" recovery (broaden tokens, show popular); related searches; category landing SEO pages; trending products block; recently viewed; "buyers also searched"; sponsored/featured slots already supported (`featured_until`) — surface in search; collections/curated lists; seasonal boosts; empty-query browse defaults to best-sellers.

## Quick wins (do first)
1. Add field-weighted ranking (title boost) + sold_count/recency tiebreak.
2. Add sellers to the suggest corpus.
3. Surface trending + zero-result recovery (data already collected).
4. Make search-query logging async.
