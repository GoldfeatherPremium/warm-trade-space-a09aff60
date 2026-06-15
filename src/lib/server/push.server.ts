import webpush from "web-push";
import { q, run } from "@/lib/server/db.server";

let _configured = false;

function configure() {
  if (_configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT ?? "mailto:admin@x-vault.gg";
  if (!pub || !priv) return; // push silently disabled when keys absent
  webpush.setVapidDetails(sub, pub, priv);
  _configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

export async function sendPush(userId: string, payload: PushPayload): Promise<void> {
  configure();
  if (!_configured) return;

  const subs = await q<{ endpoint: string; p256dh: string; auth: string }>(
    `select endpoint, p256dh, auth from push_subscriptions where user_id = ?`,
    [userId],
  );
  if (!subs.length) return;

  const data = JSON.stringify({
    ...payload,
    icon: payload.icon ?? "/icon-192.png",
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
          {
            TTL: 60 * 60 * 24, // 24h
          },
        );
      } catch (err: unknown) {
        // 410 Gone / 404 = subscription expired, remove it
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await run(`delete from push_subscriptions where endpoint = ?`, [s.endpoint]).catch(
            () => {},
          );
        }
      }
    }),
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}
