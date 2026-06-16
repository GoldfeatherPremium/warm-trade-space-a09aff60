import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MessageCircle, FileText } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getOrderData } from "@/server/queries/orders";
import { usdt, dateTime } from "@/lib/format";
import { PublicShell } from "../../_components/site-shell";
import { productImage } from "../../_lib/product-image";
import { OrderClient } from "./order-client";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

function Snap({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-[9px] font-bold tracking-widest text-muted-foreground">
        {label.toUpperCase()}
      </dt>
      <dd className="text-[11px] font-mono">{String(value)}</dd>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await requireUser().catch(() => null);
  if (!user) redirect(`/auth?redirect=/orders/${orderId}`);

  const data = await getOrderData(orderId, user);
  if (!data) notFound();

  const { order: o, productSnapshot, conversationId } = data;

  return (
    <PublicShell>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-12 rounded-md overflow-hidden bg-secondary shrink-0 relative">
            <Image
              src={productImage(o.image_key)}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="font-display text-xl">{o.product_title}</h1>
            <p className="text-xs text-muted-foreground">{o.order_no}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <OrderClient initial={data} />

          <div className="space-y-4 lg:sticky lg:top-20 self-start">
            {/* Chat */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-xs font-bold tracking-widest text-muted-foreground flex items-center gap-1.5 mb-3">
                <MessageCircle className="size-4" /> ORDER CHAT
              </h2>
              <Link
                href={`/chat?c=${conversationId}`}
                className="block text-sm text-center py-2.5 bg-secondary rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
              >
                Open chat →
              </Link>
              <p className="text-[10px] text-muted-foreground mt-2">
                Keep all communication here — it's used as evidence in disputes.
              </p>
            </div>

            {/* Product snapshot */}
            {productSnapshot && (
              <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                <h2 className="text-xs font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-4" /> WHAT WAS SOLD
                </h2>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <Snap label="Title" value={productSnapshot.title} />
                  <Snap label="Unit price" value={usdt(productSnapshot.unit_price_cents ?? 0)} />
                  <Snap label="Delivery" value={productSnapshot.delivery_type} />
                  <Snap label="Warranty" value={`${productSnapshot.warranty_hours ?? 0}h`} />
                  {productSnapshot.region && <Snap label="Region" value={productSnapshot.region} />}
                  {productSnapshot.platform && (
                    <Snap label="Platform" value={productSnapshot.platform} />
                  )}
                  {productSnapshot.variant_title && (
                    <Snap label="Variant" value={productSnapshot.variant_title} />
                  )}
                </dl>
                {productSnapshot.required_info && (
                  <div>
                    <p className="text-[9px] font-bold tracking-widest text-muted-foreground">
                      DELIVERY INFO
                    </p>
                    <p className="text-[11px] text-muted-foreground whitespace-pre-wrap mt-0.5">
                      {productSnapshot.required_info}
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Snapshot frozen at purchase — used as source of truth in disputes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
