import { uid } from "./core.server";

/**
 * Object-storage / CDN backend for public images (H6: move product images out
 * of Postgres base64 onto a CDN). Uses Vercel Blob — native to the Vercel host,
 * served from its edge CDN. Entirely env-gated: with no BLOB_READ_WRITE_TOKEN
 * the app keeps storing/serving inline base64 exactly as before, so enabling
 * this is a zero-downtime opt-in (create a Blob store, set the token, then run
 * scripts/backfill-images.ts to migrate existing rows).
 */
export function storageEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Upload public image bytes and return the permanent CDN URL. Only call when
 * storageEnabled(); throws on misconfig so callers can fall back to inline. */
export async function uploadPublicImage(bytes: Buffer, mime: string): Promise<string> {
  const { put } = await import("@vercel/blob");
  const res = await put(`products/${uid()}.${EXT[mime] ?? "img"}`, bytes, {
    access: "public",
    contentType: mime,
    addRandomSuffix: false,
    // Immutable: the key is unique per upload, so cache hard at the edge.
    cacheControlMaxAge: 31536000,
  });
  return res.url;
}

/** True if a stored image reference is an absolute URL (CDN) vs inline base64. */
export function isUrl(s: string | null | undefined): boolean {
  return !!s && /^https?:\/\//.test(s);
}
