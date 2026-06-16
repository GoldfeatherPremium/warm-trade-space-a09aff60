# DESIGN_AUDIT.md — X-VAULT Marketplace (UI / UX / Premium / Accessibility)

Static review of the component system (`app/_components/kit.tsx`, `app/globals.css`, `app/_components/*`, page tree). **Pixel-level visual judgments require the running app** (not launched here) → those are **UNVERIFIED** and framed as checks. Design system signals (CSS variables, typography, primitives) are read from source.

## System read (verified from source)
- Design system in `app/_components/kit.tsx` + Tailwind v4 + CSS variables (`globals.css`), Radix UI primitives across `@radix-ui/*` (accessible foundations).
- Typography: Archivo Black (display) + Inter (body) + JetBrains Mono (`app/layout.tsx`) — strong, premium pairing.
- Component breadth: cards, charts (`recharts`), carousels (`embla`), command menu (`cmdk`), drawers (`vaul`), toasts (`sonner`), bottom-nav + mobile tabs (mobile-first intent).
- 66 client components — rich interactivity.

## Compared to Stripe / Linear / Vercel / Framer / Etsy / G2G
The foundation (variable-driven theme, Archivo Black display, Radix, micro-interaction libs) reads premium. The gaps that separate it from Linear/Stripe polish are consistency, empty/loading states, density control, and motion discipline.

## Top 100 visual / UX improvements (grouped)

**Trust & conversion (1–15):** escrow/buyer-protection badge on buy-box; verified-seller badge prominence; refund-policy microcopy at checkout; live "X sold / Y in stock" urgency; seller rating + response-time on product card; security reassurance near payment; clear delivery-time estimate; order-status timeline; trust tier explainer tooltip; testimonials/social proof block; "instant delivery" badge for auto items; dispute-protection callout; payment-method icons; SSL/secure cues; money-back guarantee strip.

**Empty / loading / error states (16–30):** empty state for buyer orders; for favorites; for seller orders; for wallet/ledger; for search no-results (with recovery); for notifications; for chat; skeleton loaders on all admin tables; skeleton on dashboards; product-grid skeletons (some `loading.tsx` exist — extend coverage); error boundaries styling (some `error.tsx` exist); offline state (PWA); first-purchase onboarding; seller setup checklist.

**Typography & spacing (31–45):** consistent type scale tokens; line-height rhythm; max line-length on legal/long text; heading hierarchy audit; consistent card padding scale; 4/8px spacing grid enforcement; tabular-nums for prices/money; consistent currency formatting; truncation + tooltip for long titles; balanced two-line clamps on cards; section spacing rhythm; reduce font-weight variety where unused; mono only for codes/IDs; caption/label tier; empty-line whitespace tuning.

**Color & theming (46–58):** ensure AA contrast on muted text; semantic status colors (success/warn/danger) tokens; consistent badge palette; hover/active/focus states on all interactive; disabled-state styling; chart color tokens (`_lib/chart-colors.ts`) consistency; dark surfaces depth/elevation; focus-visible rings (a11y); selection color; brand accent restraint; gradient discipline; price-discount color semantics; sale badge contrast.

**Motion & micro-interactions (59–68):** respect `prefers-reduced-motion`; consistent transition durations/easing tokens; skeleton shimmer; button press feedback; toast timing; page-transition subtlety; carousel inertia tuning; hover lift on cards (restrained); loading spinners consistency; avoid layout shift on async.

**Mobile experience (69–82):** bottom-nav active states; thumb-reach CTAs; sticky buy-box on product (mobile); filter drawer (vaul) polish; safe-area insets; tap target ≥44px; mobile table→card transforms in admin/seller; horizontal scroll affordances; input zoom prevention (font-size ≥16px); mobile search full-screen; sticky add-to-cart; reduced motion on mobile; image lazy + aspect-ratio to prevent CLS; mobile menu polish.

**Accessibility (83–96):** alt text on all product/seller/store images; form labels + `aria-describedby` on errors; focus management in dialogs/drawers (Radix helps); skip-to-content link; semantic landmarks (header/nav/main/footer); color-contrast AA across muted text/badges; keyboard nav for command menu/search; `aria-live` for toasts/SSE updates; reduced-motion; accessible icon-only buttons (`aria-label`); table headers/scope in admin; error summary on forms; visible focus rings; heading order; language attribute set (done). **Target 100 in LIGHTHOUSE_AUDIT requires these.**

**Premium finishing (97–100):** consistent iconography (lucide) weight/size; cohesive card elevation system; empty-to-rich state transitions; polished 404/error pages (`not-found.tsx` exists — elevate).

## Strengths to keep
Variable-driven design system, Archivo Black identity, Radix accessible primitives, mobile-first shell (`bottom-nav`, `site-shell`), micro-animation toolkit. The base is genuinely premium-capable.

## Highest-leverage first
Empty/loading states everywhere + trust signals on buy-box/checkout + accessibility pass (labels/alt/contrast/focus). These move conversion and the Lighthouse a11y score most.
