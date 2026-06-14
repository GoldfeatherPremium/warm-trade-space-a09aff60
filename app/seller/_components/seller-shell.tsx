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
      <div className="space-y-4">
        <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-border pb-2">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold whitespace-nowrap ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-border text-foreground"
                }`}
              >
                <n.icon className="size-3.5" /> {n.label}
              </Link>
            );
          })}
        </div>
        {children}
      </div>
    </PublicShell>
  );
}
