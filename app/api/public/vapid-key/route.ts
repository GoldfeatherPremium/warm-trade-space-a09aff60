export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY ?? null;
  return Response.json({ publicKey: key });
}
