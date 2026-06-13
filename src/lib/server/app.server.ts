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
  if (!booted) booted = seedIfEmpty();
  await booted;
  const now = Date.now();
  if (now - lastSweep > SWEEP_EVERY_MS) {
    lastSweep = now;
    try {
      await sweepLifecycle();
    } catch (e) {
      console.error("lifecycle sweep failed:", e);
    }
  }
}
