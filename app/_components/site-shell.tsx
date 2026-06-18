import Link from "next/link";
import { ShieldCheck, Zap, Lock, ArrowRight } from "lucide-react";
import { SmartSearchBox } from "./smart-search-box";
import { AccountNav } from "./account-nav";
import { ThemeToggle } from "./theme-toggle";
import { CategoryBar } from "./category-bar";
import { BottomNav } from "./bottom-nav";

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 glass border-x-0 border-t-0">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 mr-2 group">
          <div className="size-8 rounded-xl grid place-items-center bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 shadow-[0_0_12px_-4px_var(--color-primary)] transition-shadow group-hover:shadow-[0_0_20px_-4px_var(--color-primary)]">
            <ShieldCheck className="size-4.5 text-primary" />
          </div>
          <span className="font-display text-lg tracking-tight">X-VAULT</span>
        </Link>

        {/* Primary nav */}
        <nav className="hidden md:flex items-center gap-0.5 text-[13px] font-medium text-muted-foreground">
          <Link
            href="/browse"
            className="px-3 py-1.5 rounded-lg hover:bg-secondary/80 hover:text-foreground transition-colors"
          >
            Browse
          </Link>
          <Link
            href="/sellers"
            className="px-3 py-1.5 rounded-lg hover:bg-secondary/80 hover:text-foreground transition-colors"
          >
            Sellers
          </Link>
          <Link
            href="/sell"
            className="px-3 py-1.5 rounded-lg hover:bg-secondary/80 hover:text-foreground transition-colors"
          >
            Sell
          </Link>
        </nav>

        {/* Search — centered */}
        <div className="flex-1 max-w-md hidden sm:block mx-2">
          <SmartSearchBox />
        </div>

        {/* Right actions */}
        <div className="ml-auto sm:ml-0 flex items-center gap-1.5">
          <ThemeToggle />
          <AccountNav />
        </div>
      </div>
    </header>
  );
}

const FOOTER_SECTIONS = [
  {
    heading: "Marketplace",
    links: [
      { label: "Browse listings", href: "/browse" },
      { label: "Top sellers", href: "/sellers" },
      { label: "Become a seller", href: "/sell" },
      { label: "Trending products", href: "/browse?sort=popular" },
    ],
  },
  {
    heading: "Trust & Safety",
    links: [
      { label: "Buyer protection", href: "/legal/buyer-protection" },
      { label: "How escrow works", href: "/legal/escrow" },
      { label: "Prohibited items", href: "/legal/prohibited" },
      { label: "Dispute process", href: "/legal/buyer-protection#disputes" },
    ],
  },
  {
    heading: "Money",
    links: [
      { label: "Fees & commissions", href: "/legal/fees" },
      { label: "Credits & refunds", href: "/legal/credits" },
      { label: "Payouts & withdrawals", href: "/legal/payouts" },
      { label: "USDT payments", href: "/legal/credits" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About X-VAULT", href: "/about" },
      { label: "Contact & support", href: "/contact" },
      { label: "Terms of service", href: "/legal/terms" },
      { label: "Privacy policy", href: "/legal/privacy" },
    ],
  },
];

const TRUST_BADGES = [
  { icon: ShieldCheck, label: "Buyer Protected" },
  { icon: Zap, label: "Instant Delivery" },
  { icon: Lock, label: "Escrow Secured" },
];

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/30 backdrop-blur-sm mt-20">
      {/* Trust belt */}
      <div className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {TRUST_BADGES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-muted-foreground text-sm">
              <Icon className="size-4 text-primary" />
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="size-8 rounded-xl grid place-items-center bg-primary/15 border border-primary/30">
                <ShieldCheck className="size-4 text-primary" />
              </div>
              <span className="font-display text-lg">X-VAULT</span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The premium digital goods marketplace. Buyer-protected, USDT-powered, instant
              delivery.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_SECTIONS.map((s) => (
            <div key={s.heading}>
              <h4 className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-3">
                {s.heading}
              </h4>
              <ul className="space-y-2">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-xs leading-relaxed"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA banner */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 to-accent/5 p-5 sm:p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <p className="text-sm font-semibold mb-0.5">Ready to start selling?</p>
            <p className="text-xs text-muted-foreground">
              Join 48,000+ verified sellers on X-VAULT.
            </p>
          </div>
          <Link
            href="/sell"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-widest px-4 py-2.5 rounded-lg text-primary-foreground shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            START SELLING <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            © 2026 X-VAULT MARKETPLACE · All rights reserved
          </p>
          <p className="text-[11px] text-muted-foreground text-center">
            Never share personal info off-platform · All chats are monitored
          </p>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <SiteHeader />
      <CategoryBar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">{children}</main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}
