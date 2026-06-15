import { redirect } from "next/navigation";
import { requireUser, isStaff } from "@/server/auth";
import { appContext } from "@/lib/server/app.server";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await appContext();

  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/");
  }

  if (!isStaff(user)) redirect("/");

  return <AdminShell role={user.role}>{children}</AdminShell>;
}
