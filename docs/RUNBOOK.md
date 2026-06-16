# X-VAULT Operator Runbook

Day-2 ops for the marketplace. Pair with the top-level `README.md` for
architecture and local setup.

---

## 1. Environments & secrets

| Secret                 | Where      | Purpose                                                                                                                          |
| ---------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | server env | Postgres pooler URL. Unset = SQLite dev mode.                                                                                    |
| `STOCK_ENCRYPTION_KEY` | server env | AES-256-GCM key for stock ciphertext. **Rotating invalidates existing codes** — only rotate during a planned maintenance window. |
| `SESSION_SECRET`       | server env | Signs httpOnly session cookies. Rotating logs every user out.                                                                    |
| `CRON_SECRET`          | server env | Bearer for `/api/public/cron/*` endpoints. Must match the scheduler config.                                                      |

After changing any secret, redeploy. Never commit secrets — use `.env` locally
and the host's secret store in production.

---

## 2. First-boot / fresh database

1. Set `DATABASE_URL` + `STOCK_ENCRYPTION_KEY`.
2. Hit any page once — the app auto-creates the schema and seeds categories +
   demo accounts (`scripts/seed.server.ts`).
3. Sign in as `admin@xvault.test` / `Password123!`, then immediately:
   - **rotate** every demo password,
   - **delete or demote** demo accounts you don't need,
   - set the real platform fee + warranty windows under **Admin → Settings**.

---

## 3. Daily checks (5 min)

Admin → Dashboard pulse pills:

- **Escrow on hold** — should match the sum of unreleased orders.
- **Open disputes** — triage anything older than 24h.
- **Withdrawals pending** — finance queue; SLA = 24h business.
- **Refunds 24h** — spike = likely seller issue, drill into Orders.
- **Avg trust** — sustained drop = moderation backlog.

---

## 4. Common incidents

### "Buyer paid but order still `awaiting_payment`"

1. Open `/admin/orders`, search by order ID.
2. Confirm the deposit address + amount match the on-chain tx.
3. Use **Force confirm payment** (audited; mandatory note with tx hash).
4. Downstream (delivery, escrow, warranty) runs automatically.

### "Stock code leaked / wrong code delivered"

1. Open the order in `/admin/orders` → **Force refund** with reason.
2. Open the product in `/admin/products` → **Suspend** until the seller
   replaces the affected batch.
3. Check `/admin/audit` for who touched the stock row.

### "Dispute stalled"

1. `/admin/disputes` → open the case.
2. Read buyer claim + seller evidence + chat transcript (linked).
3. Resolve with **full refund / partial refund / release**. All wallet math
   (escrow → buyer/seller, commission reversal) is automatic.

### "Seller withdrawal stuck"

1. `/admin/finance` → Withdrawals tab.
2. Verify level cap + KYC tier. Approve → paste on-chain tx hash.
3. Reject reverses funds to `available` instantly with an audit row.

### "Chat moderation queue full"

1. `/admin/moderation` shows regex-flagged messages (contact share, off-platform
   payment).
2. **Dismiss** (false positive) or **Ban + reverse order** (policy breach).

### "Site feels slow"

1. Check Admin pulse — large `orders24h` spike?
2. Verify Postgres pooler connections (Supabase dashboard).
3. Lifecycle sweeps are in-process and throttled; if a single request looks
   slow, it's likely the sweep — safe to ignore once.

---

## 5. Cron / lifecycle

The spec's three cron workers run as throttled in-process sweeps
(`sweepLifecycle()` in `src/lib/server/lifecycle.server.ts`):

- expire unpaid orders past the 30-min window,
- auto-confirm delivered orders past the buyer confirmation window,
- release escrow past the warranty window.

External cron is only used for the **follow digest** email job at
`/api/public/cron/follow-digest` — call it hourly with
`Authorization: Bearer $CRON_SECRET`.

---

## 6. Maintenance mode

Admin → Settings → **Maintenance mode** → on. Non-staff requests get a
friendly banner; staff continue to operate. Use during schema migrations or
secret rotation.

---

## 7. Backups & recovery

- Postgres: rely on Supabase PITR (enable in project settings).
- Stock ciphertext is in the DB — same backup covers it.
- Test restore quarterly: spin a staging project, restore a snapshot, hit
  `/admin` and confirm KPIs match.

---

## 8. Going to a real payment processor

Swap the simulated USDT gateway for NOWPayments / Cryptomus:

1. Add a route under `/api/public/webhooks/<provider>.ts`.
2. Verify the provider's HMAC signature (template in
   `src/routes/api/public/cron/follow-digest.ts`).
3. Call `confirmPayment(orderId)` from `src/lib/server/core.server.ts`.
4. Everything downstream (delivery, escrow, warranty, release) already works.

---

## 9. Smoke tests before each release

```bash
# escrow engine, direct against DB
./node_modules/.bin/esbuild scripts/smoke-test.ts --bundle --platform=node \
  --format=esm --packages=external --outfile=data/.smoke.mjs && node data/.smoke.mjs

# HTTP integration, real wire protocol
bun run dev &
node scripts/http-test.mjs http://127.0.0.1:<port>
```

Both must be green before promoting a build to production.
