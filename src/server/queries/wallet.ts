import { q, q1 } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { getWallet, getBuyerCredits } from "@/lib/server/money.server";
import { getSettings } from "@/lib/server/core.server";
import type { SessionUser } from "../auth";

export async function getWalletData(user: SessionUser) {
  await appContext();
  const [wallet, ledger, withdrawals, settings, app] = await Promise.all([
    getWallet(user.id),
    q<{
      id: number;
      order_id: string | null;
      type: string;
      amount_cents: number;
      balance_after_cents: number;
      note: string | null;
      created_at: number;
    }>(`select * from wallet_ledger where user_id = ? order by id desc limit 200`, [user.id]),
    q<{
      id: string;
      amount_cents: number;
      fee_cents: number;
      address: string;
      network: string;
      status: string;
      tx_hash: string | null;
      created_at: number;
    }>(`select * from withdrawals where user_id = ? order by created_at desc limit 50`, [user.id]),
    getSettings(),
    q1<{ usdt_payout_address: string; usdt_network: string }>(
      `select usdt_payout_address, usdt_network from seller_applications where user_id = ? and status = 'approved' order by created_at desc limit 1`,
      [user.id],
    ),
  ]);
  return {
    wallet,
    ledger,
    withdrawals,
    fees: {
      withdrawalFeeCents: settings.withdrawal_fee_cents,
      minWithdrawalCents: settings.min_withdrawal_cents,
    },
    payoutDefaults: app ?? null,
    walletFrozen: !!user.wallet_frozen,
  };
}

export async function getCreditsData(user: SessionUser) {
  await appContext();
  const [credits, ledger] = await Promise.all([
    getBuyerCredits(user.id),
    q<{
      id: number;
      order_id: string | null;
      type: string;
      amount_cents: number;
      balance_after_cents: number;
      note: string | null;
      created_at: number;
    }>(`select * from credit_ledger where user_id = ? order by id desc limit 100`, [user.id]),
  ]);
  return { credits, ledger };
}
