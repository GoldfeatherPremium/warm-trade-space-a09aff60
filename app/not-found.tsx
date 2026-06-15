import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell } from "./_components/site-shell";

export const metadata: Metadata = {
  title: "Page not found — X-VAULT",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <PublicShell>
      <div className="flex flex-col items-center justify-center py-24 text-center gap-6">
        <p className="text-8xl font-display font-bold text-primary/20">404</p>
        <div className="space-y-2">
          <h1 className="font-display text-2xl">Page not found</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            The page you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            Go home
          </Link>
          <Link
            href="/browse"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/60 transition"
          >
            Browse listings
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
