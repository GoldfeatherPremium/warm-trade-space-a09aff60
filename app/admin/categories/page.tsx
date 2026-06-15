import type { Metadata } from "next";
import { CategoriesClient } from "./categories-client";

export const metadata: Metadata = { title: "Categories — Admin · X-VAULT" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <CategoriesClient />;
}
