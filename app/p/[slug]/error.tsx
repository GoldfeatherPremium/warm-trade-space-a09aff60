"use client";

import Link from "next/link";

export default function ProductError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-5xl mx-auto py-16 text-center space-y-4">
      <p className="text-sm text-muted-foreground">This listing couldn't be loaded.</p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="text-xs font-bold border border-border rounded-md px-4 py-2 hover:bg-secondary"
        >
          Try again
        </button>
        <Link href="/browse" className="text-xs font-bold text-primary hover:underline">
          Back to browse
        </Link>
      </div>
    </div>
  );
}
