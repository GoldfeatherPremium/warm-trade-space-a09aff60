import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";
import { currentUser } from "@/server/auth";
import { ThemeProvider } from "./_components/theme-provider";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f14" },
  ],
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the logged-in user's saved theme preference (null = use next-themes default).
  // This runs server-side, so next-themes initialises with the right value on first
  // render, eliminating cross-device flash for signed-in users.
  let savedTheme: string | undefined;
  try {
    const user = await currentUser();
    savedTheme = user?.theme_pref ?? undefined;
  } catch {
    // not available during static rendering (e.g. build-time pages)
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivoBlack.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider defaultTheme={savedTheme ?? "dark"}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
