"use client";

import Link from "next/link";
import { TrendingUp, Star, ShieldCheck, Package, Zap } from "lucide-react";

const TIPS = [
  {
    icon: Package,
    title: "Add more images",
    desc: "Listings with 3+ high-quality images get 60% more clicks. Go to Products and add images to listings that have none.",
    href: "/seller/products",
    cta: "Manage products →",
  },
  {
    icon: Star,
    title: "Reply to reviews",
    desc: "Sellers who reply to reviews within 24h see higher repeat purchase rates. Buyers trust active sellers.",
    href: "/seller/reviews",
    cta: "View reviews →",
  },
  {
    icon: TrendingUp,
    title: "Run a flash sale",
    desc: "Temporarily discounting your top product by 10-20% can spike conversion and push you up category rankings.",
    href: "/seller/promotions",
    cta: "Set up promotion →",
  },
  {
    icon: ShieldCheck,
    title: "Get verified",
    desc: "Verified sellers get a trust badge shown on every listing and in search results, boosting conversion by up to 30%.",
    href: "/seller/verification",
    cta: "Apply for verification →",
  },
  {
    icon: Zap,
    title: "Keep auto-stock topped up",
    desc: "Out-of-stock products are hidden from buyers. Upload at least 20 codes to always have inventory ready.",
    href: "/seller/products",
    cta: "Manage stock →",
  },
];

export default function SellerOptimizePage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground">
          GROWTH PLAYBOOK
        </p>
        <h1 className="font-display text-xl">Optimize your store</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Actionable tips to increase visibility, conversion, and repeat buyers.
        </p>
      </div>
      <div className="space-y-3">
        {TIPS.map((tip) => (
          <div
            key={tip.title}
            className="bg-card border border-border rounded-lg p-4 flex items-start gap-4"
          >
            <div className="size-10 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center shrink-0">
              <tip.icon className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{tip.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tip.desc}</p>
            </div>
            <Link
              href={tip.href}
              className="text-[10px] font-bold text-primary whitespace-nowrap hover:underline"
            >
              {tip.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
