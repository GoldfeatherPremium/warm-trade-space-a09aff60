"use client";

import { type ComponentType, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag, Layers, Scale, Megaphone, Ticket, Settings,
  Heart, Wallet, Bell, Star, Boxes, PlusCircle, LayoutDashboard,
  Gavel, LogOut, ChevronRight, ChevronDown,
} from "lucide-react";
import { logoutAction } from "@/server/actions/auth";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ar", label: "العربية" },
] as const;

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "PKR", "BDT"] as const;

type Entry = { label: string; href: string; icon?: ComponentType<{ className?: string }> };
type Section = { id: string; label: string; icon: ComponentType<{ className?: string }>; color: string; entries: Entry[] };

type User = {
  id: string; username: string; email: string; role: string;
  seller_status: string | null; seller_level: number | null;
};

function LocaleSwitcher() {
  const [locale, setLocale] = useState("en");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    try {
      setLocale(localStorage.getItem("xv_locale") ?? "en");
      setCurrency(localStorage.getItem("xv_currency") ?? "USD");
    } catch { /* ignore */ }
  }, []);

  function applyLocale(v: string) {
    setLocale(v);
    try {
      localStorage.setItem("xv_locale", v);
      document.documentElement.lang = v;
      document.documentElement.dir = v === "ar" ? "rtl" : "ltr";
    } catch { /* ignore */ }
  }

  function applyCurrency(v: string) {
    setCurrency(v);
    try { localStorage.setItem("xv_currency", v); } catch { /* ignore */ }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <p className="text-xs font-bold text-muted-foreground">PREFERENCES</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground">Language</span>
          <select
            value={locale}
            onChange={(e) => applyLocale(e.target.value)}
            className="w-full h-9 rounded-md bg-secondary text-sm px-2 border border-border"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground">Currency</span>
          <select
            value={currency}
            onChange={(e) => applyCurrency(e.target.value)}
            className="w-full h-9 rounded-md bg-secondary text-sm px-2 border border-border"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function Accordion({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  return (
    <div className="space-y-2">
      {sections.map((s) => (
        <div key={s.id} className="bg-card border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(s.id)}
            className="w-full px-4 py-4 flex items-center justify-between hover:bg-secondary/40 transition"
          >
            <span className="flex items-center gap-3 text-sm font-bold">
              <s.icon className={`size-5 ${s.color}`} />
              {s.label}
            </span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open.has(s.id) ? "rotate-180" : ""}`} />
          </button>
          {open.has(s.id) && (
            <div className="divide-y divide-border/60 border-t border-border">
              {s.entries.map((e) => (
                <Link
                  key={e.href + e.label}
                  href={e.href}
                  className="flex items-center gap-2 py-3 pl-8 pr-4 text-sm text-foreground/80 hover:text-primary transition"
                >
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                  {e.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function MenuClient({ user }: { user: User | null }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const isSeller = user?.seller_status === "approved";
  const isStaff = user && ["admin", "support", "finance"].includes(user.role);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logoutAction();
      router.push("/");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  const sections: Section[] = [
    {
      id: "buy",
      label: "Buy",
      icon: ShoppingBag,
      color: "text-yellow-400",
      entries: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Purchase Orders", href: "/orders", icon: ShoppingBag },
        { label: "Favorites", href: "/favorites", icon: Heart },
        { label: "My Wallet", href: "/wallet", icon: Wallet },
        { label: "Refer & Earn", href: "/account/affiliate", icon: Wallet },
        { label: "Browse the Market", href: "/browse" },
      ],
    },
    {
      id: "seller",
      label: "Seller Center",
      icon: Layers,
      color: "text-destructive",
      entries: isSeller
        ? [
            { label: "Overview & Analytics", href: "/seller", icon: LayoutDashboard },
            { label: "Sold Orders", href: "/seller/orders", icon: ShoppingBag },
            { label: "Create New Offer", href: "/seller/new-product", icon: PlusCircle },
            { label: "Active Offers", href: "/seller/products", icon: Boxes },
            { label: "Withdrawal Management", href: "/seller/wallet", icon: Wallet },
            { label: "Reviews & Replies", href: "/seller/reviews", icon: Star },
          ]
        : [{ label: "Apply to become a seller", href: "/sell", icon: PlusCircle }],
    },
    {
      id: "disputes",
      label: "Dispute Center",
      icon: Scale,
      color: "text-cyan-400",
      entries: [{ label: "My Disputes", href: "/disputes" }],
    },
    {
      id: "announcement",
      label: "Announcement",
      icon: Megaphone,
      color: "text-yellow-400",
      entries: [
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Messages", href: "/chat" },
      ],
    },
    {
      id: "coupon",
      label: "Coupon",
      icon: Ticket,
      color: "text-destructive",
      entries: [
        { label: "Browse deals", href: "/browse" },
        ...(isStaff ? [{ label: "Manage coupons (staff)", href: "/admin/coupons" }] : []),
      ],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      color: "text-muted-foreground",
      entries: [
        { label: "Account & Security", href: "/account" },
        ...(isStaff ? [{ label: "Admin Panel", href: "/admin" }] : []),
      ],
    },
  ];

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Sign in to access your account.</p>
        <Link href="/auth" className="text-primary text-sm font-bold">
          Sign in / Register →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-8">
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
        <div className="size-12 rounded-full bg-primary/20 border border-primary/40 grid place-items-center text-sm font-bold text-primary uppercase">
          {user.username.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{user.username}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {user.email}
            {isSeller ? ` · Seller Lv.${user.seller_level}` : ""}
            {isStaff ? ` · ${user.role.toUpperCase()}` : ""}
          </p>
        </div>
        {isStaff && (
          <Link
            href="/admin"
            className="size-9 rounded-full bg-secondary grid place-items-center"
            title="Admin Panel"
          >
            <Gavel className="size-4" />
          </Link>
        )}
      </div>

      <Accordion sections={sections} />

      <LocaleSwitcher />

      <button
        onClick={handleLogout}
        disabled={signingOut}
        className="w-full bg-card border border-border rounded-lg p-4 flex items-center gap-3 text-sm font-bold text-destructive hover:border-destructive/50 disabled:opacity-50 transition"
      >
        <LogOut className="size-5" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
