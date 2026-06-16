import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";
import { LiveUpdatesProvider, PwaInstallBanner } from "./_components/live-updates";
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
  themeColor: "#08070c",
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

/**
 * FOUC-free theme boot. Runs before first paint so the correct theme class is
 * on <html> before the body renders — no flash, no hydration mismatch (paired
 * with suppressHydrationWarning). Default is dark (the brand default); honors a
 * stored preference and "system" follows prefers-color-scheme.
 */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem('theme');var sys=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=t==='light'?false:t==='dark'?true:t==='system'?sys:true;var el=document.documentElement;el.classList.toggle('dark',dark);el.style.colorScheme=dark?'dark':'light';}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivoBlack.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <LiveUpdatesProvider>
          {children}
          <PwaInstallBanner />
        </LiveUpdatesProvider>
      </body>
    </html>
  );
}
