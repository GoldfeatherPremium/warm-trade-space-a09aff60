/**
 * X-VAULT brand emblem — a hex-framed "X" with a purple→indigo gradient.
 * Pure SVG (no client JS) so it can render in server components anywhere.
 */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="xv-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a855f7" />
          <stop offset="1" stopColor="#4f6bf6" />
        </linearGradient>
      </defs>
      {/* Hex frame */}
      <path
        d="M24 3.5 41.8 13.75v20.5L24 44.5 6.2 34.25v-20.5L24 3.5Z"
        fill="url(#xv-grad)"
        fillOpacity="0.12"
        stroke="url(#xv-grad)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* X */}
      <path
        d="M17 16.5 31 31.5M31 16.5 17 31.5"
        stroke="url(#xv-grad)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
