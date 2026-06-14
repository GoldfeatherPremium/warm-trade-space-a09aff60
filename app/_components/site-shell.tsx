import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SearchBox } from "./search-box";
import { AccountNav } from "./account-nav";

/**
 * Public RSC shell — header + footer rendered on the server. The only client
 * JS is the small <SearchBox> and <AccountNav> islands; <AccountNav> probes the
 * session client-side so these pages stay statically prerendered/edge-cached.
 */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <ShieldCheck className="size-5 text-accent" />
          <span className="font-display text-xl">X-VAULT</span>
        </Link>
        <nav className="hidden md:flex items-center gap-4 text-xs font-bold text-muted-foreground">
          <Link href="/browse" className="hover:text-foreground">
            Browse
          </Link>
          <Link href="/sellers" className="hover:text-foreground">
            Sellers
          </Link>
          <Link href="/sell" className="hover:text-foreground">
            Sell
          </Link>
        </nav>
        <div className="flex-1 max-w-md hidden sm:block">
          <SearchBox />
        </div>
        <AccountNav />
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
    <footer className="bg-secondary/20 border-t border-border px-4 py-12 mt-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-accent" />
          <span className="font-display text-2xl">X-VAULT</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
          {FOOTER_SECTIONS.map((s) => (
            <div key={s.heading} className="space-y-2">
              <h4 className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                {s.heading}
              </h4>
              <ul className="space-y-1.5">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-foreground/70 hover:text-foreground transition"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center pt-6 border-t border-border/60 tracking-wide">
          © 2026 X-VAULT MARKETPLACE · Buyer-protected digital goods · All chats are monitored —
          never share personal info off-platform.
        </p>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
