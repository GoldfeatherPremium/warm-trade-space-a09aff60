# X-VAULT — Dual-Theme Redesign Plan

**Goal:** Ship two separately-designed, premium themes — not a color inversion.

- **Dark mode (default):** _Cyber luxury marketplace_ — Linear × Raycast × Vercel × Arc. Near-black canvas, violet/purple accents, glassmorphism, neon edges, premium gradients.
- **Light mode:** _Stripe-level fintech marketplace_ — Stripe × Notion × Apple × Airbnb × Framer. Pure whites, soft grays, violet accents, clean shadows, crisp cards.

Both must look like finished products. Every surface (homepage, search, product, seller store, dashboards, admin, chat, wallet, checkout, reviews, tables, charts) must be readable and on-brand in both.

---

## Current State (audit)

What already exists in the repo today:

| Area | Status |
|------|--------|
| Theme mechanism | Custom `.dark` class toggled via `localStorage('xv-theme')` + inline no-FOUC script in `app/layout.tsx`. **Not** `next-themes`. |
| Token system | CSS variables in `app/globals.css` via Tailwind 4 `@theme inline` (`--background`, `--primary`, `--card`, …). Solid foundation. |
| Current palette | Light = G2G emerald green; Dark = navy + green. **Neither matches the new brief** (violet/cyber-luxury + Stripe-clean). |
| Toggle UI | `app/_components/theme-toggle.tsx` — simple sun/moon button, light↔dark only (no "system" option). |
| Token adoption | ~3,858 semantic-token utility usages (good). ~453 hardcoded color utilities (`amber/blue/emerald/...-500`) + ~31 `black/white` opacity classes that can break contrast across themes. |
| Components | 13 shared in `app/_components/`, 68 route pages, 77 client components. |
| Charts | Dashboard/admin/analytics use inline SVG + colored utilities — must be tokenized. |

**Implication:** the plumbing is ~70% there. The work is (1) redesign both palettes to the new brief, (2) decide on `next-themes` vs. keep the lightweight custom toggle, (3) add a 3-way switcher with "system", (4) sweep the ~484 hardcoded colors, (5) audit every page in both themes.

---

## Open Decisions (need your input — see "What I Need From You")

1. **`next-themes` vs. keep custom toggle.** The brief says "use next-themes." Our current custom solution already does no-FOUC + system detection + persistence and is lighter. I recommend **adopting `next-themes`** anyway for the standard 3-way (light/dark/system) API and to match the brief — unless you'd rather keep the zero-dependency custom one.
2. **"Persist across devices when logged in."** This needs a DB column (`users.theme_pref`) + load on session + save on toggle. Confirm you want server-side persistence (otherwise localStorage-only, per-device).
3. **Keep green as a secondary accent, or go fully violet?** The new brief is violet-centric. I recommend violet primary + emerald reserved only for success/"in stock" states.

---

## Design Tokens (proposed)

A single source of truth in `app/globals.css`. Every color flows through these — no raw hex in components.

### Core semantic tokens (both themes define all of them)
```
--background        --foreground
--card              --card-foreground
--popover           --popover-foreground
--primary           --primary-foreground     (violet)
--secondary         --secondary-foreground
--muted             --muted-foreground
--accent            --accent-foreground
--success           --success-foreground     (emerald — "in stock", "completed")
--warning           --warning-foreground     (amber — "pending")
--destructive       --destructive-foreground (red — errors, "failed")
--border  --input  --ring
```

### Premium effect tokens (per theme)
```
--gradient-hero          --gradient-primary       --gradient-text
--glass-bg  --glass-border                         (glassmorphism)
--shadow-card  --shadow-elev  --shadow-glow
--neon-primary                                     (dark-mode neon edge)
--chart-1 … --chart-6                              (categorical chart palette, theme-aware)
```

### Dark — "Cyber Luxury" (target feel)
- Background: near-black with faint cool tint (`oklch(~0.06 0.01 290)`)
- Primary: electric violet (`oklch(~0.62 0.25 296)`) + brighter glow variant
- Cards: elevated charcoal with subtle violet tint + glass on overlays
- Neon edges on hover, aurora radial gradients on hero, soft glow shadows

### Light — "Stripe Fintech" (target feel)
- Background: pure/near-white (`oklch(0.99 0 0)` canvas, `oklch(1 0 0)` cards)
- Primary: refined violet (`oklch(~0.55 0.22 296)`) — slightly deeper than dark for contrast
- Soft gray hierarchy, crisp 1px borders, layered soft shadows (no neon)
- Subtle violet-tinted gradients, lots of whitespace

> Exact OKLCH values are tuned in Phase 1 and reviewed against WCAG AA before any component work.

---

## Phased Delivery

Each phase is independently reviewable and shippable. I'll do **mockups before code** (Phase 0).

### Phase 0 — Design proof (mockups, no app changes)
- Build a `/theme-preview` route (or static HTML mock) showing both themes side by side: color swatches, buttons, cards, a product card, a chart, a table, form inputs, badges/states.
- You approve the exact palettes + feel here **before** we touch real pages.
- **Deliverable:** screenshots of both themes for sign-off.

### Phase 1 — Token foundation
- Finalize the full token set for both themes in `globals.css` (WCAG AA verified).
- Add `--success` / `--warning` / `--chart-*` tokens (currently missing).
- Wire `@theme inline` mappings for any new tokens.
- **Deliverable:** tokens live; existing pages still render (may look transitional).

### Phase 2 — Theme system & switcher
- Adopt `next-themes` (pending decision #1) with `attribute="class"`, `defaultTheme="dark"`, `enableSystem`.
- Replace toggle with a 3-way control (Light / Dark / System) in navbar + mobile menu.
- No-FOUC verified; (optional, decision #2) server persistence via `users.theme_pref`.
- **Deliverable:** instant, flash-free switching across light/dark/system.

### Phase 3 — Core buyer surfaces
- Homepage, global search + dropdown, product cards, product page, seller store, browse/filters.
- Sweep hardcoded colors → tokens in these files.
- **Deliverable:** the full buyer journey polished in both themes.

### Phase 4 — Account & transactional surfaces
- Wallet, checkout/pay, orders, favorites, notifications, reviews, chat.
- State colors (success/warning/destructive) standardized.
- **Deliverable:** money + comms flows polished in both themes.

### Phase 5 — Dashboards, admin, data viz
- Seller dashboard + analytics, admin panels, all tables and charts.
- Tokenize chart palettes (`--chart-*`) so graphs are legible in both themes.
- **Deliverable:** all data-dense screens readable in both themes.

### Phase 6 — Audit, polish, QA
- Page-by-page contrast/readability pass in both themes (the "no broken styles, no unreadable text, no low-contrast" gate).
- Kill remaining hardcoded `black/white` opacity classes.
- Cross-browser + mobile + reduced-motion check.
- **Deliverable:** sign-off checklist, before/after screenshots.

---

## Definition of Done

- [ ] Both themes designed separately and approved from mockups
- [ ] `next-themes` (or approved alternative) with Light / Dark / System
- [ ] System detection, persistence, instant switching, zero FOUC
- [ ] Every listed component/page verified in both themes
- [ ] No hardcoded colors left that break a theme; all via tokens
- [ ] WCAG AA contrast on text and interactive elements
- [ ] Charts/tables legible in both themes

---

## What I Need From You

**Decisions (blocking Phase 0 sign-off):**
1. `next-themes` vs. keep the lightweight custom toggle? _(I recommend next-themes.)_
2. Server-side persistence across devices when logged in — yes/no? _(Adds a DB column + migration.)_
3. Violet-only, or keep emerald green as a secondary/success accent? _(I recommend violet primary, emerald only for success states.)_
4. Is **dark** the default for first-time visitors (matches "default") — confirm.

**Helpful but not blocking:**
5. Any brand assets — exact logo files, a preferred violet hex, font licenses if changing from Inter/Archivo/JetBrains Mono.
6. Reference screenshots of specific Linear/Stripe/etc. screens you love (so I match the _exact_ vibe, not just the brand name).
7. Priority order if you want a phase pulled forward (e.g., homepage first for a demo).
8. Confirm the work continues on branch `claude/fervent-pasteur-1a1ltv` and whether you want a PR per phase or one big PR.

Reply with the four decisions and I'll start Phase 0 (mockups) immediately.
