import { redirect } from "next/navigation";

// Search results are rendered by /browse (RSC, ?q=…). /search is a canonical
// entry point that forwards the query there, preserving any params.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) params.set(k, val);
  }
  const qs = params.toString();
  redirect(qs ? `/browse?${qs}` : "/browse");
}
