"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lightweight count-up that animates once when scrolled into view.
 * No animation library — a single rAF loop + IntersectionObserver, so it
 * adds almost nothing to the bundle and keeps the homepage fast.
 */
export function CountUp({
  to,
  durationMs = 1600,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: {
  to: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Initialise to the final value so SSR / no-JS / slow-hydration always shows
  // the real number — never a bare "0". The client animates from 0 on view.
  const [value, setValue] = useState(to);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion or missing IO support: keep the final value.
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      done.current = true;
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || done.current) return;
        done.current = true;
        setValue(0);
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          // easeOutExpo for a premium settle
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          setValue(to * eased);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, durationMs]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
