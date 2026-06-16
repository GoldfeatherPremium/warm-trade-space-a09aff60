#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Full-site Lighthouse runner for X-VAULT (run on the VPS; needs Chrome).
#
# Public routes run unauthenticated. Authenticated routes run only if you pass a
# session cookie (COOKIE env). Each route is tested on BOTH desktop and mobile,
# across all four categories (performance, accessibility, best-practices, seo).
#
# Quick start:
#   npm i -g lighthouse
#   export BASE=http://localhost:3000
#   # optional, for /account /seller /admin etc:
#   export COOKIE='xv_session=PASTE_FROM_BROWSER_DEVTOOLS'
#   # optional, fill real ids so dynamic pages aren't 404:
#   export PROD_SLUG=some-product-slug  STORE_USER=some-seller
#   bash audit/run-lighthouse.sh
#
# Output: audit/lighthouse/<route>.<desktop|mobile>.report.{html,json} + summary
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
COOKIE="${COOKIE:-}"
OUT="${OUT:-audit/lighthouse}"
PROD_SLUG="${PROD_SLUG:-}"
STORE_USER="${STORE_USER:-}"
mkdir -p "$OUT"

CHROME_FLAGS="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage"

PUBLIC=(
  "/" "/browse" "/sellers" "/auth" "/about" "/contact" "/menu" "/search" "/sell"
  "/legal/terms" "/legal/privacy" "/legal/escrow" "/legal/fees"
  "/legal/payouts" "/legal/credits" "/legal/buyer-protection" "/legal/prohibited"
)
[ -n "$PROD_SLUG" ]  && PUBLIC+=("/p/$PROD_SLUG")
[ -n "$STORE_USER" ] && PUBLIC+=("/s/$STORE_USER")

AUTH=(
  "/dashboard" "/account" "/account/affiliate" "/account/credits"
  "/account/following" "/account/subscriptions" "/orders" "/wallet"
  "/favorites" "/notifications" "/chat" "/disputes"
  "/seller" "/seller/orders" "/seller/products" "/seller/wallet"
  "/seller/analytics" "/seller/promotions" "/seller/storefront"
  "/seller/reviews" "/seller/verification" "/seller/subscriptions" "/seller/optimize"
  "/admin" "/admin/orders" "/admin/finance" "/admin/users" "/admin/products"
  "/admin/disputes" "/admin/moderation" "/admin/risk" "/admin/analytics"
  "/admin/coupons" "/admin/categories" "/admin/sellers" "/admin/verifications"
  "/admin/fx" "/admin/payments" "/admin/credits" "/admin/settings"
  "/admin/audit" "/admin/items" "/admin/chats"
)

slug() { echo "$1" | sed 's#^/##; s#/#_#g; s#?.*##; s#^$#home#'; }

run() { # <url> <desktop|mobile>
  local url="$1" label="$2" name; name="$(slug "$url")"
  local args=(--quiet --chrome-flags="$CHROME_FLAGS"
    --only-categories=performance,accessibility,best-practices,seo
    --output=html --output=json --output-path="$OUT/${name}.${label}")
  [ "$label" = "desktop" ] && args+=(--preset=desktop)   # mobile = lighthouse default
  [ -n "$COOKIE" ] && args+=(--extra-headers="{\"Cookie\":\"$COOKIE\"}")
  echo "→ [$label] $url"
  lighthouse "$BASE$url" "${args[@]}" >/dev/null 2>&1 || echo "  ! failed: $url"
}

TARGETS=("${PUBLIC[@]}")
[ -n "$COOKIE" ] && TARGETS+=("${AUTH[@]}") || \
  echo "(no COOKIE set — skipping authenticated routes)"

for u in "${TARGETS[@]}"; do run "$u" desktop; run "$u" mobile; done

echo; echo "=== SCORES (P / A11y / BP / SEO) ==="
for f in "$OUT"/*.report.json; do
  jq -r '"\(input_filename|sub(".*/";"")|sub(".report.json";""))|\(.categories.performance.score*100|floor)|\(.categories.accessibility.score*100|floor)|\(.categories["best-practices"].score*100|floor)|\(.categories.seo.score*100|floor)"' "$f" 2>/dev/null
done | column -t -s'|'
echo; echo "HTML reports: $OUT/"
