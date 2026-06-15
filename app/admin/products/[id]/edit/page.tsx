import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminGetProductAction } from "@/server/actions/admin";
import { EditProductClient } from "./edit-client";

export const metadata: Metadata = { title: "Edit Product — Admin" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await adminGetProductAction(id).catch(() => null);
  if (!data) notFound();

  return <EditProductClient productId={id} initial={data} />;
}
