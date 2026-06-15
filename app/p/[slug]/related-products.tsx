import { getRelatedProductsData } from "@/server/queries/catalog";
import { ProductCard } from "../../_components/product-card";

export async function RelatedProducts({ productId }: { productId: string }) {
  const related = await getRelatedProductsData(productId, 8);
  if (related.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl mb-3">Related listings</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {related.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
