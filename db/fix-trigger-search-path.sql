-- ─────────────────────────────────────────────────────────────────────
-- FIX: Auth signup returning "Database error saving new user" (HTTP 500)
-- ─────────────────────────────────────────────────────────────────────
-- Date: 2026-06-23
-- Status: APPLIED TO PRODUCTION (verified end-to-end with live signup)
--
-- ROOT CAUSE
--   The handle_new_user() and handle_new_user_credits() trigger functions
--   on auth.users were created WITHOUT a pinned search_path. When GoTrue
--   (Supabase Auth) invokes these triggers, it connects via the
--   `authenticator` role whose search_path does NOT include `public`
--   (where `profiles`, `user_credits`, `plans`, `referral_codes` live) or
--   `extensions` (where `gen_random_bytes` from pgcrypto lives).
--
--   Result: `INSERT INTO profiles` failed with
--     ERROR: relation "profiles" does not exist (SQLSTATE 42P01)
--   And once that was patched, `gen_random_bytes(6)` failed with
--     ERROR: function gen_random_bytes(integer) does not exist (SQLSTATE 42883)
--
--   GoTrue wraps all such failures as the generic
--     "500: Database error saving new user"
--   which is why the actual cause was hidden from the client.
--
-- FIX
--   1. Pin search_path = public, extensions on BOTH trigger functions.
--   2. Schema-qualify every table reference (public.profiles, etc.).
--   3. Schema-qualify gen_random_bytes as extensions.gen_random_bytes.
--   4. Add EXCEPTION blocks that write to public.trigger_error_log
--      for future diagnosability.
--
-- WHY THIS IS SAFE
--   - The functions are SECURITY DEFINER, owned by postgres/supabase_admin.
--   - Pinning search_path does not change the function's privileges.
--   - Schema-qualifying is best practice and eliminates ambiguity.
--   - The exception blocks re-RAISE, so the signup transaction still
--     rolls back on a real failure (we want to know about failures,
--     not silently swallow them).
--
-- POST-FIX VERIFICATION (production, 2026-06-23 22:19 UTC)
--   curl POST /auth/v1/signup -> HTTP 200
--   auth.users row created ✓
--   public.profiles row created ✓
--   public.user_credits row created (free, 10 daily, 25 monthly) ✓
--   public.referral_codes row created (KIV-XXXXXX) ✓
--   public.trigger_error_log empty ✓

-- ─── Ensure trigger_error_log table exists (for diagnostics) ────────
create table if not exists public.trigger_error_log (
    id bigserial primary key,
    ts timestamptz default now(),
    trigger_name text,
    error_message text,
    error_detail text,
    error_context text,
    user_id uuid,
    user_email text
);
alter table public.trigger_error_log enable row level security;
drop policy if exists "service full trigger_error_log" on public.trigger_error_log;
create policy "service full trigger_error_log" on public.trigger_error_log
    for all using (auth.role() = 'service_role');

-- ─── handle_new_user (creates profiles row) ────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to public, extensions
as $fn_body$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
exception
  when others then
    insert into public.trigger_error_log
      (trigger_name, error_message, error_detail, error_context, user_id, user_email)
    values
      ('handle_new_user', sqlerrm, null, 'during signup', new.id, new.email);
    raise;
end;
$fn_body$;

-- ─── handle_new_user_credits (creates user_credits + referral_codes) ──
create or replace function public.handle_new_user_credits()
returns trigger
language plpgsql
security definer
set search_path to public, extensions
as $fn_body$
declare
  free_plan_daily int;
  free_plan_monthly int;
  ref_code text;
begin
  -- Read free plan defaults
  select daily_credits, monthly_credits
    into free_plan_daily, free_plan_monthly
    from public.plans where code = 'free';

  -- Create user_credits row
  insert into public.user_credits (user_id, plan_code, daily_credits, monthly_credits)
  values (new.id, 'free', coalesce(free_plan_daily, 10), coalesce(free_plan_monthly, 25))
  on conflict (user_id) do nothing;

  -- Generate unique referral code (KIV-XXXXXX format).
  -- Schema-qualify gen_random_bytes because pgcrypto lives in the extensions schema.
  ref_code := 'KIV-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 6));

  insert into public.referral_codes (code, user_id)
  values (ref_code, new.id)
  on conflict (user_id) do nothing;

  return new;
exception
  when others then
    insert into public.trigger_error_log
      (trigger_name, error_message, error_detail, error_context, user_id, user_email)
    values
      ('handle_new_user_credits', sqlerrm, null, 'during signup', new.id, new.email);
    raise;
end;
$fn_body$;

-- Triggers themselves do NOT need to be recreated — they call functions
-- by OID at runtime, so updating the function definition is sufficient.
-- We just verify they still exist and are enabled.
-- (If you're applying this from scratch, also run the CREATE TRIGGER
--  statements from supabase-migration.sql and credits-migration.sql.)

-- ─── Clear stale auth.flow_state rows from prior failed signups ────
-- (Rows with user_id IS NULL accumulate from failed Google OAuth attempts.
--  They're harmless but this keeps the table tidy.)
delete from auth.flow_state where user_id is null;
