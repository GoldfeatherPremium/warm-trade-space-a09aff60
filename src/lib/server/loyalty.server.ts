/**
 * Buyer loyalty engine — Phase 9.
 *
 * Lifetime-spend tiers (Bronze → Diamond) computed from completed orders.
 * On every order completion we credit the buyer's lifetime_spend and, if a
 * tier-up occurred, mint a single-use percent-off coupon scoped to that
 * buyer's next purchase. The coupon is announced through the in-app
 * notification stream so retention compounds.
 *
 * Tiers are intentionally chunky — a 5% discount for crossing $50 lifetime
 * is enough to bring buyers back without giving margin away to whales.
 */
import { q1, run } from "./db.server";
import { audit, notify, now, uid } from "./core.server";
import { randomBytes } from "node:crypto";

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface LoyaltyTierMeta {
  key: LoyaltyTier;
  label: string;
  minSpendCents: number;
  perkPct: number; // % off coupon issued on tier-up
  maxPerkOffCents: number; // soft cap on coupon value (min_total controls usage)
  cls: string;
  perks: string[];
}

export const LOYALTY_TIERS: readonly LoyaltyTierMeta[] = [
  {
    key: "bronze",
    label: "Bronze",
    minSpendCents: 0,
    perkPct: 0,
    maxPerkOffCents: 0,
    cls: "bg-orange-700/20 text-orange-400 border-orange-700/40",
    perks: ["Escrow protection", "Standard support"],
  },
  {
    key: "silver",
    label: "Silver",
    minSpendCents: 5_000, // $50
    perkPct: 5,
    maxPerkOffCents: 1_000,
    cls: "bg-slate-400/20 text-slate-300 border-slate-400/40",
    perks: ["5% welcome coupon", "Faster dispute review"],
  },
  {
    key: "gold",
    label: "Gold",
    minSpendCents: 25_000, // $250
    perkPct: 8,
    maxPerkOffCents: 2_500,
    cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    perks: ["8% tier coupon", "Priority chat support", "Early access to drops"],
  },
  {
    key: "platinum",
    label: "Platinum",
    minSpendCents: 100_000, // $1k
    perkPct: 10,
    maxPerkOffCents: 7_500,
    cls: "bg-cyan-400/20 text-cyan-300 border-cyan-400/40",
    perks: ["10% tier coupon", "Dedicated support queue", "Exclusive promo invites"],
  },
  {
    key: "diamond",
    label: "Diamond",
    minSpendCents: 500_000, // $5k
    perkPct: 12,
    maxPerkOffCents: 25_000,
    cls: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
    perks: ["12% tier coupon", "VIP support", "Account manager"],
  },
] as const;

export function tierFromSpend(cents: number): LoyaltyTierMeta {
  let current = LOYALTY_TIERS[0];
  for (const t of LOYALTY_TIERS) if (cents >= t.minSpendCents) current = t;
  return current;
}

export function nextTier(tier: LoyaltyTier): LoyaltyTierMeta | null {
  const idx = LOYALTY_TIERS.findIndex((t) => t.key === tier);
  if (idx < 0 || idx >= LOYALTY_TIERS.length - 1) return null;
  return LOYALTY_TIERS[idx + 1];
}

interface UserLoyaltyRow {
  lifetime_spend_cents: number;
  loyalty_tier: LoyaltyTier;
  loyalty_tier_at: number | null;
}

/**
 * Award lifetime spend to a buyer on order completion. Returns the new tier
 * if the buyer leveled up (in which case we already minted a coupon + sent
 * a notification), otherwise null. Safe to call inside the order tx.
 */
export async function awardLoyaltySpend(
  buyerId: string,
  cents: number,
): Promise<LoyaltyTier | null> {
  if (cents <= 0) return null;
  const row = await q1<UserLoyaltyRow>(
    `select lifetime_spend_cents, loyalty_tier, loyalty_tier_at from users where id = ?`,
    [buyerId],
  );
  if (!row) return null;
  const prevTier = (row.loyalty_tier as LoyaltyTier) ?? "bronze";
  const newSpend = Number(row.lifetime_spend_cents ?? 0) + cents;
  const newTierMeta = tierFromSpend(newSpend);
  const leveledUp =
    LOYALTY_TIERS.findIndex((t) => t.key === newTierMeta.key) >
    LOYALTY_TIERS.findIndex((t) => t.key === prevTier);

  if (leveledUp) {
    await run(
      `update users set lifetime_spend_cents = ?, loyalty_tier = ?, loyalty_tier_at = ? where id = ?`,
      [newSpend, newTierMeta.key, now(), buyerId],
    );
    await issueLoyaltyCoupon(buyerId, newTierMeta);
    await audit(null, "loyalty.tier_up", "users", buyerId, {
      from: prevTier,
      to: newTierMeta.key,
      lifetimeSpendCents: newSpend,
    });
    return newTierMeta.key;
  }

  await run(`update users set lifetime_spend_cents = ? where id = ?`, [newSpend, buyerId]);
  return null;
}

/**
 * Mint a single-use percent-off coupon for the buyer and notify them.
 * Code is unguessable; pct/max-uses come from the tier definition.
 */
async function issueLoyaltyCoupon(buyerId: string, tier: LoyaltyTierMeta): Promise<void> {
  if (tier.perkPct <= 0) return;
  const code = `${tier.label.slice(0, 3).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const expiresAt = now() + 60 * 86_400_000; // 60 days to redeem
  await run(
    `insert into coupons (id, code, pct_off, min_total_cents, max_uses, used_count, expires_at, is_active, created_at, label)
     values (?,?,?,?,?,0,?,1,?,?)`,
    [
      uid(),
      code,
      tier.perkPct,
      tier.minSpendCents > 0 ? Math.min(tier.minSpendCents / 10, 2_500) : 0,
      1,
      expiresAt,
      now(),
      `Loyalty ${tier.label}`,
    ],
  );
  await notify(
    buyerId,
    "loyalty_tier_up",
    `Welcome to ${tier.label}!`,
    `You unlocked a ${tier.perkPct}% coupon: ${code}. Valid for 60 days.`,
    "/account/loyalty",
  );
}

/** Read the buyer's current loyalty snapshot (used by the API layer). */
export async function getLoyaltySnapshot(userId: string) {
  const row = await q1<UserLoyaltyRow>(
    `select lifetime_spend_cents, loyalty_tier, loyalty_tier_at from users where id = ?`,
    [userId],
  );
  const spend = Number(row?.lifetime_spend_cents ?? 0);
  const current = tierFromSpend(spend);
  const next = nextTier(current.key);
  const progressCents = next
    ? Math.min(spend - current.minSpendCents, next.minSpendCents - current.minSpendCents)
    : 0;
  const progressTotal = next ? next.minSpendCents - current.minSpendCents : 0;
  return {
    tier: current.key,
    label: current.label,
    cls: current.cls,
    perkPct: current.perkPct,
    perks: current.perks,
    lifetimeSpendCents: spend,
    nextTier: next?.key ?? null,
    nextTierLabel: next?.label ?? null,
    nextTierAtCents: next?.minSpendCents ?? null,
    nextTierRemainingCents: next ? Math.max(0, next.minSpendCents - spend) : 0,
    progressPct: progressTotal > 0 ? Math.round((progressCents / progressTotal) * 100) : 100,
    tieredAt: row?.loyalty_tier_at ?? null,
    allTiers: LOYALTY_TIERS.map((t) => ({
      key: t.key,
      label: t.label,
      minSpendCents: t.minSpendCents,
      perkPct: t.perkPct,
      cls: t.cls,
      perks: t.perks,
    })),
  };
}
