import { seedIfEmpty } from "./seed.server";
import { sweepLifecycle } from "./lifecycle.server";

let booted: Promise<void> | null = null;
let lastSweep = 0;
// Lifecycle sweep is relatively expensive (5 queries + per-row work in a
// transaction). Run it at most once every 5 minutes per isolate; it blocks
// the triggering request, so keep it rare. Critical flows (payment, delivery)
// don't depend on the sweep — they execute inline.
const SWEEP_EVERY_MS = 5 * 60_000;

export async function appContext(): Promise<void> {
  // Memoize the one-time seed, but do NOT cache a rejection: a transient
  // failure (DB blip during a cold start) must not poison the isolate so that
  // every subsequent request replays the same rejected promise and renders the
  // server-side-exception page. Clearing `booted` lets the next request retry.
  if (!booted) {
    booted = seedIfEmpty().catch((e) => {
      booted = null;
      throw e;
    });
  }
  await booted;
  const now = Date.now();
  if (now - lastSweep > SWEEP_EVERY_MS) {
    lastSweep = now;
    // Fire-and-forget: sweep runs in the background so it never blocks the
    // triggering request. Safe because critical flows (payment, delivery) run
    // inline — the sweep only handles deferred cleanup (expiry, auto-confirm).
    sweepLifecycle().catch((e) => console.error("lifecycle sweep failed:", e));
  }
}
