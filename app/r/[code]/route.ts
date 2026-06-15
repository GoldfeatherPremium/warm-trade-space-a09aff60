import { type NextRequest, NextResponse } from "next/server";
import { appContext } from "@/lib/server/app.server";
import { recordReferralClick } from "@/lib/server/growth.server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    await appContext();
    const ua = request.headers.get("user-agent") ?? null;
    await recordReferralClick(code.toUpperCase(), ua, null);
  } catch {
    // never block the redirect
  }
  const response = NextResponse.redirect(new URL("/", request.url));
  // store ref code in a cookie so it survives subsequent page loads
  response.cookies.set("ref_code", code.toUpperCase(), {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  });
  return response;
}
