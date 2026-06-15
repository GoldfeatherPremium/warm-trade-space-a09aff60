"use server";

import { q1, run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { audit, now, uid } from "@/lib/server/core.server";
import { getSettings } from "@/lib/server/core.server";
import { getWallet, txWithdrawalHold } from "@/lib/server/money.server";
import { requireUser } from "../auth";

const WEEKLY_CAP: Record<number, number> = {
  1: 50_000,
  2: 200_000,
  3: 1_000_000,
  4: 5_000_000,
  5: Number.MAX_SAFE_INTEGER,
};

export async function requestWithdrawalAction(input: {
  amountUsdt: number;
  address: string;
  network: "TRC20" | "BEP20" | "ERC20";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await appContext();
  const user = await requireUser();
  if (user.wallet_frozen) return { ok: false, error: "Your wallet is frozen. Contact support." };

  const settings = await getSettings();
  const amountCents = Math.round(input.amountUsdt * 100);
  if (amountCents < settings.min_withdrawal_cents)
    return {
      ok: false,
      error: `Minimum withdrawal is ${(settings.min_withdrawal_cents / 100).toFixed(2)} USDT.`,
    };

  const weekly = (await q1<{ s: number }>(
    `select coalesce(sum(amount_cents),0) s from withdrawals where user_id = ? and created_at > ? and status != 'rejected'`,
    [user.id, now() - 7 * 86_400_000],
  ))!.s;
  const cap = WEEKLY_CAP[user.seller_level] ?? WEEKLY_CAP[1];
  if (weekly + amountCents > cap)
    return {
      ok: false,
      error: `Seller level ${user.seller_level} weekly cap is ${(cap / 100).toFixed(0)} USDT.`,
    };

  const wallet = await getWallet(user.id);
  if (wallet.available_cents < amountCents + settings.withdrawal_fee_cents)
    return { ok: false, error: "Insufficient wallet balance." };

  const id = uid();
  await txWithdrawalHold(user.id, amountCents, settings.withdrawal_fee_cents, id);
  await run(
    `insert into withdrawals (id, user_id, amount_cents, fee_cents, address, network, created_at) values (?,?,?,?,?,?,?)`,
    [id, user.id, amountCents, settings.withdrawal_fee_cents, input.address, input.network, now()],
  );
  await audit(user.id, "withdrawal.request", "withdrawal", id, { amountCents });
  return { ok: true };
}
