import { BadgeCheck, Building2, Crown } from "lucide-react";

type Tier = "unverified" | "verified" | "business" | "premium";

const TIERS: Record<
  Exclude<Tier, "unverified">,
  { label: string; icon: typeof BadgeCheck; cls: string }
> = {
  verified: {
    label: "Verified",
    icon: BadgeCheck,
    cls: "text-primary bg-primary/10 border-primary/25",
  },
  business: {
    label: "Business",
    icon: Building2,
    cls: "text-accent bg-accent/10 border-accent/25",
  },
  premium: {
    label: "Premium",
    icon: Crown,
    cls: "text-warning bg-warning/10 border-warning/30",
  },
};

/**
 * Seller verification badge. Renders nothing for unverified sellers so the
 * mark stays meaningful. Reusable across product page, storefront, leaderboard.
 */
export function SellerBadge({ tier, className = "" }: { tier: string; className?: string }) {
  const cfg = TIERS[tier as Exclude<Tier, "unverified">];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded-md border ${cfg.cls} ${className}`}
    >
      <Icon className="size-2.5" />
      {cfg.label}
    </span>
  );
}
