// Next-friendly product image resolver. Seller uploads (`upload:<id>`) are
// served by the route handler; legacy preset keys map to static files in
// /public/assets. (The Vite version in src/lib/images.ts uses bundler asset
// imports that don't work under Next, so the migration uses plain URLs.)
const PRESET: Record<string, string> = {
  gold: "/assets/item-gold.jpg",
  sword: "/assets/item-sword.jpg",
  elden: "/assets/game-elden.jpg",
  void: "/assets/game-void.jpg",
  league: "/assets/game-league.jpg",
  survive: "/assets/game-survive.jpg",
  royale: "/assets/game-royale.jpg",
  racing: "/assets/game-racing.jpg",
};

export function productImage(key: string | null | undefined): string {
  // CDN-backed (H6): image_key may be an absolute URL after backfill — use it
  // directly so next/image loads from the CDN without the route redirect hop.
  if (key && /^https?:\/\//.test(key)) return key;
  if (key && key.startsWith("upload:")) return `/api/public/img/${key.slice("upload:".length)}`;
  return (key && PRESET[key]) || "/assets/item-gold.jpg";
}
