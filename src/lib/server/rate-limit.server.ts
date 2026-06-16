/**
 * Tiny in-memory token bucket.
 *
 * IMPORTANT — SERVERLESS LIMITATION: In serverless environments (Vercel,
 * Cloudflare Workers, AWS Lambda) every invocation may be a fresh isolate,
 * so this store is reset on each cold start. Rate limits are best-effort
 * for casual abuse. For production hardening at 100k+ users, replace this
 * with a Redis/Upstash-backed counter or use an edge WAF (Cloudflare, Vercel
 * Edge Middleware with Redis) as the enforcement layer.
 */
const buckets = new Map<string, { tokens: number; resetAt: number }>();

export interface RateLimitOptions {
  /** Unique key (e.g. `login:${ip}` or `withdraw:${userId}`). */
  key: string;
  /** Maximum hits allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export class RateLimitedError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Too many requests — try again in ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.retryAfterMs = retryAfterMs;
  }
}

let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export function rateLimit(opts: RateLimitOptions): void {
  const now = Date.now();
  sweep(now);
  const entry = buckets.get(opts.key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(opts.key, { tokens: opts.limit - 1, resetAt: now + opts.windowMs });
    return;
  }
  if (entry.tokens <= 0) {
    throw new RateLimitedError(entry.resetAt - now);
  }
  entry.tokens -= 1;
}
