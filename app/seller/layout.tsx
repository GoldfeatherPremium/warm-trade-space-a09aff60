import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { SellerShell } from "./_components/seller-shell";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/auth?redirect=/seller");
  const allowed =
    user.seller_status === "approved" ||
    user.role === "admin" ||
    user.role === "support" ||
    user.role === "finance";
  if (!allowed) redirect("/sell?access=denied");
  return <SellerShell username={user.username}>{children}</SellerShell>;
}
