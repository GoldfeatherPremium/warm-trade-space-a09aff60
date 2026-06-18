/**
 * H6 backfill: migrate existing base64 product images out of Postgres onto the
 * CDN (Vercel Blob), then rewrite references so the hot path serves from the
 * CDN directly.
 *
 * Safe to re-run (idempotent): rows already holding a URL are skipped.
 *
 * Run once after enabling Blob:
 *   BLOB_READ_WRITE_TOKEN=... DATABASE_URL=... npx tsx scripts/backfill-images.ts
 */
import { q, run } from "../src/lib/server/db.server";
import { uploadPublicImage, storageEnabled } from "../src/lib/server/storage.server";

async function main() {
  if (!storageEnabled()) {
    console.error("BLOB_READ_WRITE_TOKEN is not set — nothing to migrate to.");
    process.exit(1);
  }
  const rows = await q<{ id: string; mime: string; data: string }>(
    `select id, mime, data from product_images`,
  );
  let migrated = 0,
    skipped = 0,
    failed = 0;
  for (const r of rows) {
    if (/^https?:\/\//.test(r.data)) {
      skipped++;
      continue;
    }
    try {
      const url = await uploadPublicImage(Buffer.from(r.data, "base64"), r.mime);
      await run(`update product_images set data = ? where id = ?`, [url, r.id]);
      // Rewrite the primary thumbnail reference so productImage() skips the route.
      await run(`update products set image_key = ? where image_key = ?`, [url, `upload:${r.id}`]);
      migrated++;
      if (migrated % 25 === 0) console.log(`  …${migrated} migrated`);
    } catch (e) {
      failed++;
      console.error(`  ! ${r.id}: ${(e as Error)?.message}`);
    }
  }
  console.log(`Done. migrated=${migrated} skipped(already URL)=${skipped} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
