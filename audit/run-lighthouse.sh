#!/usr/bin/env bash
# Lighthouse runner for X-VAULT — run on the Contabo VPS (needs Chrome/Chromium).
#
# Prereqs:
#   sudo apt-get install -y chromium-browser   # or google-chrome-stable
#   npm i -g lighthouse
#   export DATABASE_URL=...  STOCK_ENCRYPTION_KEY=...  NEXT_PUBLIC_SITE_URL=http://localhost:3000
#
# Usage:  bash audit/run-lighthouse.sh [BASE_URL]
# Output: audit/lighthouse/<route>.<mobile|desktop>.html  + a summary.json
set -euo pipefail

BASE="${1:-http://localhost:3000}"
OUT="audit/lighthouse"
mkdir -p "$OUT"

# Public routes. Authenticated routes (dashboard/seller/admin) need a session
# cookie — pass it via LH_EXTRA_HEADERS='{"Cookie":"xv_session=..."}'.
ROUTES=( "/" "/browse" "/sellers" "/auth" "/about" )
# Add a real product + store slug if you have them:
#   ROUTES+=( "/p/<slug>" "/s/<username>" )

CHROME_FLAGS="--headless=new --no-sandbox --disable-gpu"

run() {
  local route="$1" preset="$2" form="$3" label="$4"
  local name; name="$(echo "$route" | sed 's#/#_#g; s#^_##; s#^$#home#')"
  echo "→ $route [$label]"
  lighthouse "$BASE$route" \
    --quiet --chrome-flags="$CHROME_FLAGS" \
    --preset="$preset" --form-factor="$form" \
    ${LH_EXTRA_HEADERS:+--extra-headers="$LH_EXTRA_HEADERS"} \
    --only-categories=performance,accessibility,best-practices,seo \
    --output=html --output=json \
    --output-path="$OUT/${name:-home}.$label.html" || true
}

for r in "${ROUTES[@]}"; do
  run "$r" desktop desktop desktop
  run "$r" perf    mobile  mobile     # 'perf' preset = mobile throttling
done

echo
echo "Reports in $OUT/. Open the .html files, or jq the .report.json for scores:"
echo "  for f in $OUT/*.report.json; do jq -r '[input_filename,(.categories|to_entries|map(\"\\(.key):\\(.value.score*100|floor)\"))]|flatten|join(\" \")' \"\$f\"; done"
