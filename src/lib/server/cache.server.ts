/**
 * Tiny in-isolate TTL cache with single-flight de-duplication.
 *
 * Built for GET server functions whose result is identical for every visitor
 * (homepage feed, live market pulse, …). Two wins under load:
 *
 *   1. TTL caching collapses thousands of identical polls into one DB hit per
 *      window — the homepage pulse alone is polled by every open tab.
 *   2. Single-flight: while one request is recomputing, concurrent callers
 *      await the same in-flight promise instead of each firing their own
 *      query burst (prevents cache-stampede / thundering herd).
 *
 * On recompute failure we serve the last good value if we have one, so a
 * transient DB blip never blanks the homepage.
 *
 * Scope is per-Worker isolate (same scope as getSettings' cache). It is a
 * read-through accelerator, never a source of truth — short TTLs keep data
 * fresh enough that a just-published listing shows within one window.
 */
interface Entry<T = unknown> {
  value: T | undefined;
  at: number;
  inflight?: Promise<T>;
}

const store = new Map<string, Entry>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.value !== undefined && now - hit.at < ttlMs) return hit.value;
  if (hit?.inflight) return hit.inflight;

  const inflight = fn()
    .then((value) => {
      store.set(key, { value, at: Date.now() });
      return value;
    })
    .catch((err) => {
      const stale = store.get(key) as Entry<T> | undefined;
      // drop the failed in-flight marker so the next call retries
      if (stale) store.set(key, { value: stale.value, at: stale.at });
      if (stale && stale.value !== undefined) return stale.value;
      throw err;
    });

  store.set(key, { value: hit?.value, at: hit?.at ?? 0, inflight });
  return inflight;
}

/** Drop a cached entry (e.g. after a mutation that should reflect immediately). */
export function invalidateCache(key: string): void {
  store.delete(key);
}
