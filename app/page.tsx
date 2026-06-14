// Phase 1 foundation placeholder — a pure Server Component (zero client JS).
// Phase 2 replaces this with the real RSC homepage.

export default function Home() {
  return (
    <main className="min-h-dvh grid place-items-center px-6 py-20">
      <div className="max-w-xl text-center space-y-6">
        <div className="mx-auto size-14 grid place-items-center rounded-xl bg-primary text-primary-foreground font-display text-3xl">
          X
        </div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-foreground">
          X-VAULT
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Next.js App Router foundation is live. This is a Server Component rendered with zero
          client-side JavaScript — the baseline for the RSC migration. The full marketplace homepage
          arrives in Phase 2.
        </p>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-accent">
          <span className="size-2 rounded-full bg-accent" />
          Phase 1 · Foundation
        </div>
      </div>
    </main>
  );
}
