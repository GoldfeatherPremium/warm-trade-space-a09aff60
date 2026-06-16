import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--nf-display",
  display: "swap",
});

const inter = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--nf-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--nf-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "X-VAULT — Digital Goods Marketplace",
    template: "%s — X-VAULT",
  },
  description:
    "Buy and sell digital goods with buyer protection: game top-ups, gift cards, subscriptions, accounts and more. USDT payments, instant delivery from verified sellers.",
  applicationName: "X-VAULT",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "X-VAULT",
    url: SITE_URL,
    images: [{ url: `${SITE_URL}/assets/og-default.jpg`, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
