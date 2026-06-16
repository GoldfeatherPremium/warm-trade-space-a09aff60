-- Cross-device theme persistence. Read by currentUser()/the root layout on
-- every request, so a database missing this column throws a server-side
-- exception on every page that resolves the session. Mirrors the
-- `alter table users add column theme_pref text` step in migrate()
-- (src/lib/server/db.server.ts).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS theme_pref text;
