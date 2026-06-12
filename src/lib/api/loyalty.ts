import { createServerFn } from "@tanstack/react-start";
import { appContext } from "../server/app.server";
import { currentUser } from "../server/auth.server";
import { getLoyaltySnapshot } from "../server/loyalty.server";

/**
 * Returns the signed-in buyer's loyalty snapshot. Anonymous callers get null
 * and the UI hides the tier card — there's nothing to display.
 */
export const getMyLoyalty = createServerFn({ method: "GET" }).handler(async () => {
  await appContext();
  const user = await currentUser();
  if (!user) return null;
  return await getLoyaltySnapshot(user.id);
});
