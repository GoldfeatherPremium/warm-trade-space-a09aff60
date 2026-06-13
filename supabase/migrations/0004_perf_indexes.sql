-- Performance audit: hot-path indexes.
--
-- The application creates these automatically on boot via migrate() in
-- src/lib/server/db.server.ts; this file mirrors them for anyone applying
-- schema by hand in the Supabase SQL editor. All are idempotent.

-- Listing & browse hot paths (featured sort, category browse, newest-active).
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products (featured_until);
CREATE INDEX IF NOT EXISTS idx_products_category_status ON public.products (category_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_active_created ON public.products (status, created_at DESC);

-- Admin/analytics roll-ups & notification badge counts.
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user_read ON public.notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_reviews_product_rating ON public.reviews (product_id, rating);

-- Time-range scans: homepage live pulse, recent-orders/user listings, analytics.
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_paid ON public.orders (paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_created ON public.users (created_at DESC);
