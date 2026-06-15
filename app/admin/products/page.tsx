import type { Metadata } from "next";
import { ProductsClient } from "./products-client";

export const metadata: Metadata = { title: "Product Reviews — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ProductsClient />;
}
