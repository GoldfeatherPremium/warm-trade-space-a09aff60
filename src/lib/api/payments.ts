import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, run } from "../server/db.server";
import { appContext } from "../server/app.server";
import { audit, now } from "../server/core.server";
import { requireAdmin } from "../server/auth.server";

export interface PaymentMethod {
  code: string;
  name: string;
  kind: string;
  enabled: number;
  is_default: number;
  sort: number;
}

/**
 * Public list of payment rails for the checkout UI. Returns every method with
 * its enabled flag so the checkout can render live options and show the rest
 * as "coming soon" — the foundation other providers plug into later.
 */
export const listPaymentMethods = createServerFn({ method: "GET" }).handler(async () => {
  await appContext();
  const methods = await q<PaymentMethod>(
    `select code, name, kind, enabled, is_default, sort from payment_methods order by sort`,
  );
  return { methods };
});

export const adminListPaymentMethods = createServerFn({ method: "GET" }).handler(async () => {
  await appContext();
  await requireAdmin();
  const methods = await q<PaymentMethod & { config: string | null }>(
    `select code, name, kind, enabled, is_default, sort, config from payment_methods order by sort`,
  );
  return { methods };
});

export const adminSetPaymentMethod = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string().min(2).max(40), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    await appContext();
    const staff = await requireAdmin();
    await run(`update payment_methods set enabled = ? where code = ?`, [
      data.enabled ? 1 : 0,
      data.code,
    ]);
    await audit(staff.id, "payment_method.toggle", "payment_method", data.code, {
      enabled: data.enabled,
    });
    return { ok: true };
  });
