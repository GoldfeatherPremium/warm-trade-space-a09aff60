/**
 * Canonical "base" category taxonomy (G2G / Z2U / Eneba style).
 *
 * This is the single source of truth used both by the fresh-install seed and
 * by the idempotent `ensureBaseCategories` bootstrap step (see db.server.ts).
 *
 * IMPORTANT: this list is ADDITIVE only. The ensure step inserts categories
 * that are missing *by slug* and never renames, reorders or deletes existing
 * ones — admins remain free to edit/rename/disable categories via
 * /admin/categories without their changes being reverted on the next deploy.
 * To add a new base category, append it here with a fresh slug.
 */
export type BaseCategory = {
  name: string;
  slug: string;
  icon: string;
  sort: number;
  defaultWarrantyHours: number;
  commissionPct: number;
  riskTier: "normal" | "high";
};

export const BASE_CATEGORIES: readonly BaseCategory[] = [
  // — Original taxonomy (slugs/names preserved for continuity) —
  {
    name: "Game Top-Ups & Currency",
    slug: "currency",
    icon: "🪙",
    sort: 0,
    defaultWarrantyHours: 72,
    commissionPct: 8,
    riskTier: "normal",
  },
  {
    name: "Game Items & Skins",
    slug: "items",
    icon: "⚔️",
    sort: 1,
    defaultWarrantyHours: 72,
    commissionPct: 8,
    riskTier: "normal",
  },
  {
    name: "Game Accounts",
    slug: "accounts",
    icon: "👤",
    sort: 2,
    defaultWarrantyHours: 168,
    commissionPct: 12,
    riskTier: "high",
  },
  {
    name: "Gift Cards",
    slug: "gift-cards",
    icon: "🎁",
    sort: 3,
    defaultWarrantyHours: 24,
    commissionPct: 8,
    riskTier: "normal",
  },
  {
    name: "Software Keys & Licenses",
    slug: "software-keys",
    icon: "🔑",
    sort: 4,
    defaultWarrantyHours: 72,
    commissionPct: 8,
    riskTier: "normal",
  },
  {
    name: "Digital Subscriptions",
    slug: "subscriptions",
    icon: "📺",
    sort: 5,
    defaultWarrantyHours: 72,
    commissionPct: 10,
    riskTier: "normal",
  },
  {
    name: "Boosting / Services",
    slug: "boosting",
    icon: "🚀",
    sort: 6,
    defaultWarrantyHours: 72,
    commissionPct: 10,
    riskTier: "normal",
  },
  // — G2G-style additions (additive; appended at the end) —
  {
    name: "Game Skins & Cosmetics",
    slug: "skins",
    icon: "🎨",
    sort: 7,
    defaultWarrantyHours: 72,
    commissionPct: 8,
    riskTier: "normal",
  },
  {
    name: "Mobile & Telco Top-Ups",
    slug: "telco",
    icon: "📱",
    sort: 8,
    defaultWarrantyHours: 24,
    commissionPct: 8,
    riskTier: "normal",
  },
  {
    name: "Prepaid & Payment Cards",
    slug: "payment-cards",
    icon: "💳",
    sort: 9,
    defaultWarrantyHours: 24,
    commissionPct: 8,
    riskTier: "normal",
  },
  {
    name: "Other Digital Goods",
    slug: "other",
    icon: "📦",
    sort: 10,
    defaultWarrantyHours: 72,
    commissionPct: 8,
    riskTier: "normal",
  },
];
