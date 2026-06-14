import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { PublicShell } from "../_components/site-shell";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in or create an X-VAULT account to buy and sell buyer-protected digital goods.",
  robots: { index: false },
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectParam } = await searchParams;
  // Only allow same-site relative redirects.
  const redirectTo =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/";

  const user = await currentUser();
  if (user) redirect(redirectTo);

  return (
    <PublicShell>
      <div className="max-w-sm mx-auto py-10">
        <h1 className="font-display text-2xl text-center mb-5">Welcome to X-VAULT</h1>
        <AuthForm redirectTo={redirectTo} />
      </div>
    </PublicShell>
  );
}
