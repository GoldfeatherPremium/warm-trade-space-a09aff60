# SEO_AUDIT.md — X-VAULT Marketplace

Evidence: `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/page.tsx`, `app/p/[slug]/page.tsx`, `app/s/[username]/page.tsx`, `app/browse/page.tsx`.

## Verified — already strong
- **Root metadata**: title template, description, `metadataBase`, OpenGraph (type/siteName/url/image 1200×630), Twitter `summary_large_image`, manifest, applicationName (`app/layout.tsx:33-50`). `lang="en"` set (`:54`).
- **Per-page `generateMetadata`**: `app/browse/page.tsx`, `app/p/[slug]/page.tsx`, `app/s/[username]/page.tsx`.
- **Structured data (JSON-LD)**: Organization + WebSite (with SearchAction `sitelinks searchbox`) + FAQ on home (`app/page.tsx:43-126`); Product + BreadcrumbList on product page (`app/p/[slug]/page.tsx:131-135`); Breadcrumb on seller page (`app/s/[username]/page.tsx:72`). Injected with `JSON.stringify` of static/derived objects (safe).
- **Sitemap**: dynamic, products (≤5000) + sellers (≤2000) + categories + static routes, `revalidate=3600`, graceful DB-fail fallback (`app/sitemap.ts`).
- **Robots**: disallows `/admin /account /seller /api/ /pay/ /chat /notifications`, points to sitemap (`app/robots.ts`).

This is above-average SEO hygiene for the stage.

## Gaps / improvements
1. **Canonical URLs** — no `alternates.canonical` seen in `generateMetadata`. Add per-page canonicals (esp. product/seller/browse with query params) to avoid duplicate-content from filter permutations.
2. **`robots`/`noindex` on thin or filtered pages** — `browse?...` facet combinations can create infinite crawlable URL space; mark non-canonical filter combos `noindex,follow` or canonical to the base.
3. **Per-page OG images** — product/seller pages should set their own `openGraph.images` (product image / store banner) rather than inheriting the default OG. **UNVERIFIED** whether product `generateMetadata` sets images — recommend confirming.
4. **Sitemap `lastModified`** uses `created_at` as "updated" (`sitemap.ts:24`) — products don't expose an `updated_at`; lastmod is stale after edits. Add a real updated timestamp.
5. **Sitemap caps** (5000 products / 2000 sellers) will under-cover at 50k products — add sitemap index + paginated child sitemaps.
6. **Aggregate rating schema** — add `aggregateRating`/`review` to Product JSON-LD (data exists in `reviews`) for rich snippets. **UNVERIFIED** if already included.
7. **Breadcrumb on browse/category** pages for category landing SEO.
8. **`hreflang`** — i18n columns exist but no locale routing/hreflang; only relevant once localized routes ship.
9. **Theme-color / PWA meta** — `viewport` set but no `themeColor`; add for mobile address-bar polish.
10. **Image alt text** coverage — verify product/seller images have descriptive alts (accessibility + image SEO; see DESIGN/ACCESSIBILITY).
11. **404 handling** — `app/not-found.tsx` present (good); ensure proper 404 status for missing products/sellers (not soft-200).
12. **Internal linking** — add related products (present on product page), category cross-links, seller→products, footer link graph for crawl depth.

## Priority
Canonicals (1) + filtered-page indexation control (2) + per-page OG images (3) + sitemap scaling (5) are the highest-value, lowest-risk wins.
