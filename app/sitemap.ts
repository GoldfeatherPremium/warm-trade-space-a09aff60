import type { MetadataRoute } from "next";
import { q } from "@/lib/server/db.server";

// Generated per request (hits the DB), cached at the edge via revalidate.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/browse`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE}/sellers`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/sell`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/auth`, changeFrequency: "yearly", priority: 0.3 },
  ];

  let products: Array<{ slug: string; updated: number }> = [];
  let sellers: Array<{ username: string }> = [];
  let categories: Array<{ slug: string }> = [];
  try {
    [products, sellers, categories] = await Promise.all([
      q<{ slug: string; updated: number }>(
        `select slug, created_at as updated from products where status = 'active' limit 5000`,
      ),
      q<{ username: string }>(
        `select username from users where seller_status = 'approved' and is_banned = 0 limit 2000`,
      ),
      q<{ slug: string }>(`select slug from categories where is_active = 1`),
    ]);
  } catch {
    // DB unavailable during prerender → ship the static-only sitemap.
  }

  return [
    ...staticEntries,
    ...categories.map((c) => ({
      url: `${SITE}/browse?category=${encodeURIComponent(c.slug)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${SITE}/p/${encodeURIComponent(p.slug)}`,
      lastModified: new Date(p.updated),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...sellers.map((s) => ({
      url: `${SITE}/s/${encodeURIComponent(s.username)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
