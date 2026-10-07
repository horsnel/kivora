-- security-hardening-1.sql — close the ONE unprotected table found by the RLS audit.
-- `plans` had RLS OFF while the anon role holds full CRUD grants, meaning anyone
-- with the public anon key (inlined in the JS bundle) could read/alter pricing
-- and plan config. No code reads `plans` via anon — server uses the service key
-- (bypasses RLS), so a service-only policy changes nothing for the app.

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service full plans" ON public.plans;
CREATE POLICY "service full plans" ON public.plans
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Verify
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND relname = 'plans';
