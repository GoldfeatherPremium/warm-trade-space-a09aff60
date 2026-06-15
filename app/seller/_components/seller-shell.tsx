"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ListOrdered,
  Wallet,
  Star,
  ShieldCheck,
  Repeat,
  BarChart3,
  Tag,
  Store,
} from "lucide-react";
import { PublicShell } from "../../_components/site-shell";

const NAV = [
  { href: "/seller", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/seller/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/seller/products", label: "Products", icon: Package },
  { href: "/seller/orders", label: "Orders", icon: ListOrdered },
  { href: "/seller/storefront", label: "Storefront", icon: Store },
  { href: "/seller/promotions", label: "Promotions", icon: Tag },
  { href: "/seller/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/seller/wallet", label: "Wallet", icon: Wallet },
  { href: "/seller/reviews", label: "Reviews", icon: Star },
  { href: "/seller/verification", label: "Verification", icon: ShieldCheck },
];

export function SellerShell({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <PublicShell>
      <div className="space-y-5">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                <n.icon className="size-3.5" />
                {n.label}
              </Link>
            );
          })}
        </div>
        {children}
      </div>
    </PublicShell>
  );
}
