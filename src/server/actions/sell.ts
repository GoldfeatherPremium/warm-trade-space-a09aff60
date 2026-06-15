"use server";

import { z } from "zod";
import { q1, run } from "@/lib/server/db.server";
import { appContext } from "@/lib/server/app.server";
import { fail, now, uid } from "@/lib/server/core.server";
import { requireUser } from "../auth";

const applySchema = z.object({
  fullName: z.string().min(2).max(100),
  displayName: z.string().min(2).max(60),
  country: z.string().min(2).max(60),
  yearsExperience: z.enum(["new", "lt1", "1-2", "3-5", "5+"]),
  productCategories: z.string().min(2).max(300),
  experience: z.string().min(10).max(2000),
  sourceOfGoods: z.string().min(10).max(1500),
  monthlyVolume: z.enum(["lt100", "100-500", "500-2000", "2000-10000", "10000+"]).optional(),
  portfolio: z.string().max(1500).optional(),
  telegram: z.string().max(120).optional(),
  whatsapp: z.string().max(60).optional(),
  wechat: z.string().max(60).optional(),
  usdtPayoutAddress: z.string().min(20).max(120),
  usdtNetwork: z.enum(["TRC20", "BEP20", "ERC20"]),
});

export async function applyForSellerAction(
  input: z.infer<typeof applySchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await appContext();
    const user = await requireUser();
    const data = applySchema.parse(input);
    if (user.seller_status === "approved")
      return { ok: false, error: "You are already an approved seller." };
    if (user.seller_status === "pending")
      return { ok: false, error: "Your application is already under review." };
    if (!data.telegram?.trim() && !data.whatsapp?.trim() && !data.wechat?.trim())
      return {
        ok: false,
        error: "Please provide at least one contact channel (Telegram, WhatsApp or WeChat).",
      };

    await run(
      `insert into seller_applications
         (id, user_id, full_name, display_name, country, years_experience, product_categories,
          experience, source_of_goods, monthly_volume, portfolio, telegram, whatsapp, wechat,
          usdt_payout_address, usdt_network, created_at)
       values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid(),
        user.id,
        data.fullName,
        data.displayName,
        data.country,
        data.yearsExperience,
        data.productCategories,
        data.experience,
        data.sourceOfGoods,
        data.monthlyVolume ?? null,
        data.portfolio?.trim() || null,
        data.telegram?.trim() || null,
        data.whatsapp?.trim() || null,
        data.wechat?.trim() || null,
        data.usdtPayoutAddress,
        data.usdtNetwork,
        now(),
      ],
    );
    await run(`update users set seller_status = 'pending', updated_at = ? where id = ?`, [
      now(),
      user.id,
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getMyApplicationAction() {
  await appContext();
  const user = await requireUser();
  const app = await q1<{
    status: string;
    admin_note: string | null;
    usdt_payout_address: string;
    usdt_network: string;
    created_at: number;
  }>(`select * from seller_applications where user_id = ? order by created_at desc limit 1`, [
    user.id,
  ]);
  return { application: app ?? null, sellerStatus: user.seller_status };
}
