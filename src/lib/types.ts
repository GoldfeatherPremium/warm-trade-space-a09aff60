/**
 * Shared catalog/domain types for the Next.js app and its server query layer.
 *
 * These were previously declared in the legacy TanStack file src/lib/api/catalog.ts
 * (which pulled in @tanstack/react-start at runtime). They are extracted here as a
 * dependency-free, types-only module so the live code doesn't reach into the
 * retired Vite/TanStack tree.
 */

export interface PublicSeller {
  id: string;
  username: string;
  seller_level: number;
  rating: number;
  rating_count: number;
  total_sales: number;
  completion_rate: number;
  vacation_mode: number;
  created_at: number;
  verification_tier: "unverified" | "verified" | "business" | "premium";
  trust_score: number;
  refund_count: number;
  dispute_count: number;
}

export interface StoreProfile extends PublicSeller {
  store_banner_url: string | null;
  store_logo_url: string | null;
  store_description: string | null;
  store_socials: Record<string, string>;
  store_announcement: string | null;
  avg_response_minutes: number;
  avg_delivery_minutes: number;
  refund_count: number;
  dispute_count: number;
}

export interface CategorySubmissionField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  options?: string[];
  required?: boolean;
  help?: string;
}

export interface CategorySubmissionSchema {
  sellerFields?: CategorySubmissionField[];
  buyerFields?: CategorySubmissionField[];
  deliveryMethods?: Array<{ value: string; label: string }>;
}

export interface PublicProduct {
  id: string;
  title: string;
  slug: string;
  description: string;
  image_key: string | null;
  delivery_type: "auto" | "manual";
  delivery_sla_minutes: number;
  warranty_hours: number;
  price_cents: number;
  min_qty: number;
  max_qty: number;
  stock_count: number;
  region: string | null;
  platform: string | null;
  required_info: string | null;
  sold_count: number;
  views: number;
  status: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  risk_tier: string;
  item_id: string | null;
  item_name: string | null;
  insurance_days: number;
  expires_at: number | null;
  featured_until: number | null;
  is_promoted: boolean;
  category_attrs: Record<string, string> | null;
  admin_seo_description: string | null;
  submission_schema: CategorySubmissionSchema | null;
  seller: PublicSeller;
}

export interface LeaderboardSeller extends PublicSeller {
  rank: number;
  gmv_cents: number;
  recent_orders: number;
  category_name: string | null;
}
