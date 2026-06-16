# LIGHTHOUSE_AUDIT.md — X-VAULT Marketplace

## Status: UNVERIFIED — Lighthouse was NOT executed

This environment has **no Chrome/headless browser and no running/deployed build**, so real Lighthouse runs (Performance / Accessibility / Best-Practices / SEO, desktop + mobile) on Home, Browse, Product, Store, Sellers, Login, Register, Dashboard, Seller dashboard, and Admin dashboard **could not be produced**. Reporting fabricated scores would violate the "do not guess" directive. Below is (a) how to run them and (b) static-analysis-based predictions to triage *before* running.

## How to generate the real report
```bash
# 1. Build & start
DATABASE_URL=... STOCK_ENCRYPTION_KEY=... npm run build && npm run start &   # serves :3000

# 2. Lighthouse CI, mobile + desktop, all routes
npx @lhci/cli autorun \
  --collect.url=http://localhost:3000/ \
  --collect.url=http://localhost:3000/browse \
  --collect.url=http://localhost:3000/p/<slug> \
  --collect.url=http://localhost:3000/s/<username> \
  --collect.url=http://localhost:3000/sellers \
  --collect.url=http://localhost:3000/auth \
  --collect.url=http://localhost:3000/dashboard \
  --collect.url=http://localhost:3000/seller \
  --collect.url=http://localhost:3000/admin \
  --collect.settings.preset=desktop   # repeat without preset for mobile
```
Authenticated routes (dashboard/seller/admin) need a session cookie injected via `--collect.settings.extraHeaders`.

## Predicted scores (static inference only — **UNVERIFIED**)

| Category | Likely | Why (evidence) |
|---|---|---|
| **SEO** | 95–100 | Strong metadata, per-page `generateMetadata`, JSON-LD, sitemap, robots (see SEO_AUDIT). Risk: missing canonicals could cap it. |
| **Best Practices** | 90–100 | Good security headers (`next.config.ts`), HTTPS, `nosniff`. Likely deductions: CSP `unsafe-inline` (`next.config.ts:17`), no HSTS (H2), console errors UNVERIFIED. |
| **Accessibility** | 80–95 | Radix primitives help, but no verified pass on alt text, form labels, contrast, focus order (see DESIGN §83-96). 100 requires that pass. |
| **Performance (mobile)** | 60–85 | Risks: base64 images via dynamic Node route not on CDN (P1), 3 font families (P5), chart/carousel client JS (P6), SSR data fetching. Home/legal likely high; product/browse/dashboards lower. **Highly content-dependent.** |
| **Performance (desktop)** | 80–95 | Same factors, less constrained CPU/network. |

## Pre-Lighthouse fixes most likely to raise scores
1. Serve product images from object storage + CDN (P1) → LCP/Performance.
2. Add canonicals + per-page OG (SEO_AUDIT) → SEO to 100.
3. Accessibility pass: alt text, labels, contrast, focus-visible (DESIGN) → A11y to 100.
4. Add HSTS, move toward nonce-CSP (SECURITY H2/M1) → Best Practices to 100.
5. `next/dynamic` for recharts/embla/cmdk (P6) + trim font weights (P5) → TBT/Performance.

> Re-run the command above after these to replace this UNVERIFIED report with measured numbers.
