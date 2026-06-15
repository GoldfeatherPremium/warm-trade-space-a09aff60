"use client";

export default function SellerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-5xl mx-auto py-16 text-center space-y-4">
      <p className="text-sm text-muted-foreground">Seller dashboard failed to load.</p>
      <button
        onClick={reset}
        className="text-xs font-bold border border-border rounded-md px-4 py-2 hover:bg-secondary"
      >
        Retry
      </button>
    </div>
  );
}
