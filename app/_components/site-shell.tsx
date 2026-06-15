import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SmartSearchBox } from "./smart-search-box";
import { AccountNav } from "./account-nav";
import { CategoryBar } from "./category-bar";
import { ThemeToggle } from "./theme-toggle";

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-1">
          <div className="size-7 rounded-lg grid place-items-center bg-primary/15 border border-primary/30">
            <ShieldCheck className="size-4 text-primary" />
          </div>
          <span className="font-display text-lg tracking-tight">X-VAULT</span>
        </Link>

        {/* Primary nav */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Link
            href="/browse"
            className="px-3 py-1.5 rounded-md hover:bg-secondary/80 hover:text-foreground transition-colors"
          >
            Browse
          </Link>
          <Link
            href="/sellers"
            className="px-3 py-1.5 rounded-md hover:bg-secondary/80 hover:text-foreground transition-colors"
          >
            Sellers
          </Link>
          <Link
            href="/sell"
            className="px-3 py-1.5 rounded-md hover:bg-secondary/80 hover:text-foreground transition-colors"
          >
            Sell
          </Link>
        </nav>

        {/* Search */}
        <div className="flex-1 max-w-sm hidden sm:block mx-2">
          <SmartSearchBox />
        </div>

        {/* Dark mode toggle + account actions */}
        <div className="ml-auto sm:ml-0 flex items-center gap-1">
          <ThemeToggle />
          <AccountNav />
        </div>
      </div>
    </header>
  );
}

const FOOTER_SECTIONS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Marketplace",
    links: [
      { label: "Browse listings", href: "/browse" },
      { label: "Top sellers", href: "/sellers" },
      { label: "Become a seller", href: "/sell" },
    ],
  },
  {
    heading: "Trust & safety",
    links: [
      { label: "Buyer protection", href: "/legal/buyer-protection" },
      { label: "How it works", href: "/legal/escrow" },
      { label: "Prohibited items", href: "/legal/prohibited" },
    ],
  },
  {
    heading: "Money",
    links: [
      { label: "Fees & commissions", href: "/legal/fees" },
      { label: "Credits & refunds", href: "/legal/credits" },
      { label: "Payouts & withdrawals", href: "/legal/payouts" },
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

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/40 px-4 py-12 mt-16">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <div className="size-7 rounded-lg grid place-items-center bg-primary/15 border border-primary/30">
            <ShieldCheck className="size-4 text-primary" />
          </div>
          <span className="font-display text-xl">X-VAULT</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm mb-10">
          {FOOTER_SECTIONS.map((s) => (
            <div key={s.heading} className="space-y-3">
              <h4 className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                {s.heading}
              </h4>
              <ul className="space-y-2">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            © 2026 X-VAULT MARKETPLACE · Buyer-protected digital goods
          </p>
          <p className="text-[11px] text-muted-foreground text-center">
            All chats are monitored — never share personal info off-platform.
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
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
