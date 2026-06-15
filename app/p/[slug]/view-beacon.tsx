"use client";

import { useEffect } from "react";
import { recordProductViewAction } from "@/server/actions/views";

export function ViewBeacon({ productId }: { productId: string }) {
  useEffect(() => {
    const key = `v:${productId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    recordProductViewAction(productId).catch(() => {});
  }, [productId]);
  return null;
}
