import type { ReactNode } from "react";
import { PublicShell } from "./site-shell";

/**
 * Static legal/marketing article wrapper (RSC, zero client JS). Mirrors the
 * legacy LegalPage prose styling.
 */
export function LegalArticle({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <PublicShell>
      <article className="max-w-3xl mx-auto py-6 space-y-6">
        <header className="space-y-2 border-b border-border pb-4">
          <h1 className="font-display text-3xl">{title}</h1>
          {intro && <p className="text-sm text-muted-foreground leading-relaxed">{intro}</p>}
        </header>
        <div className="space-y-5 text-sm leading-relaxed [&_a]:underline [&_h2]:font-display [&_h2]:text-xl [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:text-foreground/85">
          {children}
        </div>
      </article>
    </PublicShell>
  );
}
