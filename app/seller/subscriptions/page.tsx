"use client";

export default function SellerSubscriptionsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">SUBSCRIPTIONS</h1>
      <div className="bg-card border border-border rounded-lg p-6 text-center space-y-2">
        <p className="text-sm font-bold">Subscription product management</p>
        <p className="text-xs text-muted-foreground">
          To create subscription products, go to{" "}
          <a href="/seller/products/new" className="text-primary font-bold hover:underline">
            Products → New listing
          </a>{" "}
          and select a subscription duration. Your subscription listings will appear there.
        </p>
      </div>
    </div>
  );
}
