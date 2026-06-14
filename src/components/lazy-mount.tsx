import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Defers mounting of below-the-fold content to cut initial hydration / main-
 * thread work. Renders a fixed-height placeholder on the server AND the first
 * client render (so hydration matches — no mismatch, no layout shift), then
 * swaps in the real children once an IntersectionObserver reports the slot is
 * approaching the viewport.
 *
 * Use only for content that is genuinely below the fold and not critical to
 * first paint or SEO. The generous default rootMargin means children mount
 * well before the user scrolls to them, so it's invisible in practice but keeps
 * dozens of components out of the expensive first hydration pass.
 */
export function LazyMount({
  children,
  minHeight = 280,
  rootMargin = "600px",
  className,
}: {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show, rootMargin]);

  if (show) return <>{children}</>;
  return <div ref={ref} aria-hidden className={className} style={{ minHeight }} />;
}
