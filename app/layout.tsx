import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "X-VAULT — Digital Goods Marketplace",
    template: "%s — X-VAULT",
  },
  description:
    "Buy and sell digital goods with buyer protection: game top-ups, gift cards, subscriptions, accounts and more. USDT payments, instant delivery from verified sellers.",
  applicationName: "X-VAULT",
  openGraph: {
    type: "website",
    siteName: "X-VAULT",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Fonts are loaded at runtime via a stylesheet link (not next/font) so
            the build needs no network access. Preconnect for faster fetch. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
