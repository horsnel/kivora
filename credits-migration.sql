-- Kivora Credits & Monetization — Atoms.dev-style credit system with Paystack
-- Run this in your Supabase SQL Editor
-- Go to: supabase.com → your project → SQL Editor → New query → paste → Run

-- ─── Plan Definitions ──────────────────────────────────────────
-- Stored centrally so the daily-reset cron and the API can read one source of truth.
-- Each plan defines: daily_credits, monthly_credits, storage_gb, max_team_seats,
-- and which features are gated.

create table if not exists plans (
  code text primary key,                          -- 'free' | 'pro' | 'max' | 'team'
  name text not null,
  price_ngn_kobo bigint not null default 0,       -- Paystack charges in kobo (1 NGN = 100 kobo)
  price_usd_cents int not null default 0,         -- for display fallback
  daily_credits int not null default 10,
  monthly_credits int not null default 25,
  storage_gb int not null default 2,
  max_team_seats int not null default 1,
  features jsonb not null default '{}'::jsonb,    -- { deep_research: bool, image_osint: bool, voice: bool, ... }
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Seed the four plans (Naira pricing for the Nigerian market)
insert into plans (code, name, price_ngn_kobo, price_usd_cents, daily_credits, monthly_credits, storage_gb, max_team_seats, features, sort_order) values
  ('free', 'Free',         0,        0,   10, 25,   2, 1, '{"deep_research": false, "image_osint": false, "voice": false, "team_seats": false, "custom_domain": false, "priority_compute": false}'::jsonb, 0),
  ('pro',  'Pro',          250000,   167, 15, 200,  10, 1, '{"deep_research": true,  "image_osint": false, "voice": false, "team_seats": false, "custom_domain": false, "priority_compute": false}'::jsonb, 1),
  ('max',  'Max',          750000,   500, 20, 600,  50, 1, '{"deep_research": true,  "image_osint": true,  "voice": true,  "team_seats": false, "custom_domain": true,  "priority_compute": true}'::jsonb,  2),
  ('team', 'Team',        2000000,  1333, 30, 1800, 100, 5, '{"deep_research": true,  "image_osint": true,  "voice": true,  "team_seats": true,  "custom_domain": true,  "priority_compute": true}'::jsonb,  3)
on conflict (code) do update set
  name = excluded.name,
  price_ngn_kobo = excluded.price_ngn_kobo,
  price_usd_cents = excluded.price_usd_cents,
  daily_credits = excluded.daily_credits,
  monthly_credits = excluded.monthly_credits,
  storage_gb = excluded.storage_gb,
  max_team_seats = excluded.max_team_seats,
  features = excluded.features,
  sort_order = excluded.sort_order,
  is_active = true;

-- ─── User Credits ───────────────────────────────────────────────
-- One row per user. Tracks the three credit pools (daily / monthly / bonus)
-- plus the current plan and renewal date. This is the table every API route
-- reads before charging.

create table if not exists user_credits (
  user_id uuid primary key references profiles(id) on delete cascade,
  plan_code text not null default 'free' references plans(code),
  daily_credits int not null default 10,
  daily_credits_date date not null default current_date,
  monthly_credits int not null default 25,
  monthly_credits_renewed_at timestamptz default now(),
  -- Rollover: credits from the previous billing cycle that expire at the end
  -- of the current cycle. Drained AFTER current monthly, BEFORE bonus.
  rolled_over_credits int not null default 0,
  bonus_credits int not null default 0,
  total_spent int not null default 0,                -- lifetime credits spent (for analytics)
  current_period_end timestamptz,                    -- when the current billing cycle ends
  paystack_subscription_code text,                   -- Paystack subscription code (if recurring)
  paystack_customer_code text,                       -- Paystack customer code
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_credits enable row level security;

-- Users can read their own credit balance
create policy "users read own credits"
  on user_credits for select using (auth.uid() = user_id);
-- Service role (server-side API routes) has full access
create policy "service full credits"
  on user_credits for all using (auth.role() = 'service_role');

-- ─── Credit Transactions (audit log) ────────────────────────────
-- Append-only ledger of every credit movement (charge, grant, refund, daily reset).
-- Used for the /dashboard usage chart and for dispute resolution.

create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  delta int not null,                               -- negative = charge, positive = grant
  credit_type text not null check (credit_type in ('daily', 'monthly', 'rolled_over', 'bonus')),
  action text not null,                             -- 'chat' | 'research_quick' | 'research_deep' | 'image_osint' | 'explore' | 'opportunities' | 'study' | 'devtools' | 'reelpen' | 'daily_reset' | 'monthly_reset' | 'upgrade_grant' | 'referral_bonus' | 'redemption' | 'refund'
  description text,
  metadata jsonb default '{}'::jsonb,               -- { model, query_hash, session_id, paystack_ref, ... }
  balance_after jsonb,                              -- snapshot: {daily, monthly, rolled_over, bonus} after this txn
  created_at timestamptz default now()
);

alter table credit_transactions enable row level security;

create policy "users read own transactions"
  on credit_transactions for select using (auth.uid() = user_id);
create policy "service full transactions"
  on credit_transactions for all using (auth.role() = 'service_role');

create index if not exists credit_transactions_user_idx
  on credit_transactions (user_id, created_at desc);
create index if not exists credit_transactions_action_idx
  on credit_transactions (action, created_at desc);

-- ─── Paystack Orders ────────────────────────────────────────────
-- Tracks every Paystack checkout initiation. The webhook updates the status
-- when Paystack calls back. This is the source of truth for billing disputes.

create table if not exists paystack_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  reference text unique not null,                   -- Paystack transaction reference (kivora_<uuid>)
  plan_code text not null references plans(code),
  amount_kobo bigint not null,                      -- actual amount charged (in kobo)
  currency text not null default 'NGN',
  status text not null default 'pending',           -- 'pending' | 'success' | 'failed' | 'abandoned'
  paystack_transaction_id bigint,
  paystack_response jsonb,
  billing_cycle text default 'monthly',             -- 'monthly' | 'annual'
  created_at timestamptz default now(),
  verified_at timestamptz
);

alter table paystack_orders enable row level security;

create policy "users read own orders"
  on paystack_orders for select using (auth.uid() = user_id);
create policy "service full orders"
  on paystack_orders for all using (auth.role() = 'service_role');

create index if not exists paystack_orders_user_idx
  on paystack_orders (user_id, created_at desc);
create index if not exists paystack_orders_reference_idx
  on paystack_orders (reference);

-- ─── Referral Codes ─────────────────────────────────────────────
-- Every user gets a unique referral code. When a new user signs up with a
-- ref code, BOTH the referrer and the new user get bonus credits.

create table if not exists referral_codes (
  code text primary key,                            -- 8-char unique code (e.g., 'KIV-AB12CD')
  user_id uuid not null references profiles(id) on delete cascade,
  total_signups int not null default 0,
  total_credits_earned int not null default 0,
  created_at timestamptz default now()
);

alter table referral_codes enable row level security;

create policy "users read own referral_code"
  on referral_codes for select using (auth.uid() = user_id);
create policy "service full referral_codes"
  on referral_codes for all using (auth.role() = 'service_role');

create unique index if not exists referral_codes_user_idx
  on referral_codes (user_id);

-- ─── Referral Redemptions (who used whose code) ─────────────────
create table if not exists referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  new_user_id uuid not null references profiles(id) on delete cascade,
  code text not null references referral_codes(code),
  bonus_granted int not null default 25,
  created_at timestamptz default now(),
  unique (new_user_id)                              -- each user can only redeem once
);

alter table referral_redemptions enable row level security;
create policy "service full redemptions"
  on referral_redemptions for all using (auth.role() = 'service_role');

-- ─── Redemption Codes (promotional) ─────────────────────────────
-- Admin-created promo codes that grant bonus credits (e.g., "LAUNCH100")
create table if not exists promo_codes (
  code text primary key,
  bonus_credits int not null,
  max_uses int,                                     -- null = unlimited
  uses int not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table promo_codes enable row level security;
create policy "service full promo_codes"
  on promo_codes for all using (auth.role() = 'service_role');

create table if not exists promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  code text not null references promo_codes(code),
  bonus_granted int not null,
  created_at timestamptz default now(),
  unique (user_id, code)                            -- each user can only redeem a code once
);

alter table promo_redemptions enable row level security;
create policy "service full promo_redemptions"
  on promo_redemptions for all using (auth.role() = 'service_role');

-- ─── Auto-provision user_credits + referral_code on signup ──────
-- When a new auth.users row is created, we create a user_credits row with
-- the Free plan defaults and a unique referral code.

create or replace function handle_new_user_credits()
returns trigger as $$
declare
  free_plan_daily int;
  free_plan_monthly int;
  ref_code text;
  ref_param text;
begin
  -- Read free plan defaults
  select daily_credits, monthly_credits into free_plan_daily, free_plan_monthly
    from plans where code = 'free';

  -- Create user_credits row
  insert into user_credits (user_id, plan_code, daily_credits, monthly_credits)
  values (new.id, 'free', coalesce(free_plan_daily, 10), coalesce(free_plan_monthly, 25))
  on conflict (user_id) do nothing;

  -- Generate unique referral code (KIV-XXXXXX format)
  ref_code := 'KIV-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));

  insert into referral_codes (code, user_id)
  values (ref_code, new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_credits on auth.users;
create trigger on_auth_user_created_credits
  after insert on auth.users
  for each row execute procedure handle_new_user_credits();

-- ─── Atomic charge function ─────────────────────────────────────
-- This is the single source of truth for charging credits. Every API route
-- calls this BEFORE running the user's request. It drains pools in the
-- Atoms.dev priority order: daily → rolled_over → monthly → bonus.
-- Returns jsonb with the result and the new balance.

create or replace function charge_credits(
  p_user_id uuid,
  p_action text,
  p_cost int,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb as $$
declare
  v_row user_credits%rowtype;
  v_remaining int;
  v_to_charge int;
  v_daily_used int := 0;
  v_rolled_used int := 0;
  v_monthly_used int := 0;
  v_bonus_used int := 0;
  v_balance_after jsonb;
  v_today date := current_date;
begin
  -- Lock the user's row for the duration of this transaction
  select * into v_row from user_credits where user_id = p_user_id for update;
  if not found then
    -- Auto-provision (in case the trigger missed — e.g., user existed before this migration)
    insert into user_credits (user_id, plan_code, daily_credits, monthly_credits)
    values (p_user_id, 'free', 10, 25)
    on conflict (user_id) do nothing;
    select * into v_row from user_credits where user_id = p_user_id for update;
  end if;

  -- Reset daily credits if it's a new day
  if v_row.daily_credits_date < v_today then
    select daily_credits into v_row.daily_credits from plans where code = v_row.plan_code;
    v_row.daily_credits_date := v_today;
  end if;

  v_remaining := p_cost;
  v_to_charge := 0;

  -- 1. Drain daily first
  if v_row.daily_credits > 0 and v_remaining > 0 then
    v_to_charge := least(v_row.daily_credits, v_remaining);
    v_row.daily_credits := v_row.daily_credits - v_to_charge;
    v_daily_used := v_to_charge;
    v_remaining := v_remaining - v_to_charge;
  end if;

  -- 2. Then rolled-over (expires at end of cycle)
  if v_row.rolled_over_credits > 0 and v_remaining > 0 then
    v_to_charge := least(v_row.rolled_over_credits, v_remaining);
    v_row.rolled_over_credits := v_row.rolled_over_credits - v_to_charge;
    v_rolled_used := v_to_charge;
    v_remaining := v_remaining - v_to_charge;
  end if;

  -- 3. Then monthly subscription
  if v_row.monthly_credits > 0 and v_remaining > 0 then
    v_to_charge := least(v_row.monthly_credits, v_remaining);
    v_row.monthly_credits := v_row.monthly_credits - v_to_charge;
    v_monthly_used := v_to_charge;
    v_remaining := v_remaining - v_to_charge;
  end if;

  -- 4. Finally bonus
  if v_row.bonus_credits > 0 and v_remaining > 0 then
    v_to_charge := least(v_row.bonus_credits, v_remaining);
    v_row.bonus_credits := v_row.bonus_credits - v_to_charge;
    v_bonus_used := v_to_charge;
    v_remaining := v_remaining - v_to_charge;
  end if;

  -- If we still have remaining, the user is out of credits
  if v_remaining > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'insufficient_credits',
      'needed', p_cost,
      'available', (p_cost - v_remaining),
      'shortfall', v_remaining,
      'balance', jsonb_build_object(
        'daily', v_row.daily_credits,
        'rolled_over', v_row.rolled_over_credits,
        'monthly', v_row.monthly_credits,
        'bonus', v_row.bonus_credits
      )
    );
  end if;

  -- Update the row
  v_row.total_spent := v_row.total_spent + p_cost;
  v_row.updated_at := now();

  update user_credits set
    daily_credits = v_row.daily_credits,
    daily_credits_date = v_row.daily_credits_date,
    rolled_over_credits = v_row.rolled_over_credits,
    monthly_credits = v_row.monthly_credits,
    bonus_credits = v_row.bonus_credits,
    total_spent = v_row.total_spent,
    updated_at = now()
  where user_id = p_user_id;

  -- Build balance snapshot
  v_balance_after := jsonb_build_object(
    'daily', v_row.daily_credits,
    'rolled_over', v_row.rolled_over_credits,
    'monthly', v_row.monthly_credits,
    'bonus', v_row.bonus_credits
  );

  -- Write audit transactions (one per pool drained)
  if v_daily_used > 0 then
    insert into credit_transactions (user_id, delta, credit_type, action, description, metadata, balance_after)
    values (p_user_id, -v_daily_used, 'daily', p_action, p_description, p_metadata, v_balance_after);
  end if;
  if v_rolled_used > 0 then
    insert into credit_transactions (user_id, delta, credit_type, action, description, metadata, balance_after)
    values (p_user_id, -v_rolled_used, 'rolled_over', p_action, p_description, p_metadata, v_balance_after);
  end if;
  if v_monthly_used > 0 then
    insert into credit_transactions (user_id, delta, credit_type, action, description, metadata, balance_after)
    values (p_user_id, -v_monthly_used, 'monthly', p_action, p_description, p_metadata, v_balance_after);
  end if;
  if v_bonus_used > 0 then
    insert into credit_transactions (user_id, delta, credit_type, action, description, metadata, balance_after)
    values (p_user_id, -v_bonus_used, 'bonus', p_action, p_description, p_metadata, v_balance_after);
  end if;

  return jsonb_build_object(
    'ok', true,
    'charged', p_cost,
    'breakdown', jsonb_build_object(
      'daily', v_daily_used,
      'rolled_over', v_rolled_used,
      'monthly', v_monthly_used,
      'bonus', v_bonus_used
    ),
    'balance', v_balance_after
  );
end;
$$ language plpgsql security definer;

-- Grant execute to authenticated users (they call it via the service role anyway, but
-- allowing direct execute lets us use it from RPC if needed)
grant execute on function charge_credits(uuid, text, int, text, jsonb) to authenticated, service_role, anon;

-- ─── Grant bonus credits helper ─────────────────────────────────
create or replace function grant_credits(
  p_user_id uuid,
  p_amount int,
  p_action text,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb as $$
declare
  v_row user_credits%rowtype;
  v_balance_after jsonb;
begin
  select * into v_row from user_credits where user_id = p_user_id for update;
  if not found then
    insert into user_credits (user_id, plan_code, daily_credits, monthly_credits)
    values (p_user_id, 'free', 10, 25)
    on conflict (user_id) do nothing;
    select * into v_row from user_credits where user_id = p_user_id for update;
  end if;

  v_row.bonus_credits := v_row.bonus_credits + p_amount;
  v_row.updated_at := now();

  update user_credits set
    bonus_credits = v_row.bonus_credits,
    updated_at = now()
  where user_id = p_user_id;

  v_balance_after := jsonb_build_object(
    'daily', v_row.daily_credits,
    'rolled_over', v_row.rolled_over_credits,
    'monthly', v_row.monthly_credits,
    'bonus', v_row.bonus_credits
  );

  insert into credit_transactions (user_id, delta, credit_type, action, description, metadata, balance_after)
  values (p_user_id, p_amount, 'bonus', p_action, p_description, p_metadata, v_balance_after);

  return jsonb_build_object('ok', true, 'granted', p_amount, 'balance', v_balance_after);
end;
$$ language plpgsql security definer;

grant execute on function grant_credits(uuid, int, text, text, jsonb) to service_role;

-- ─── Upgrade user plan (called by Paystack webhook) ─────────────
create or replace function upgrade_user_plan(
  p_user_id uuid,
  p_new_plan_code text,
  p_billing_cycle text default 'monthly',
  p_paystack_ref text default null
) returns jsonb as $$
declare
  v_plan plans%rowtype;
  v_old_plan text;
  v_remaining_monthly int;
  v_balance_after jsonb;
begin
  select * into v_plan from plans where code = p_new_plan_code and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_plan');
  end if;

  select plan_code, monthly_credits into v_old_plan, v_remaining_monthly
    from user_credits where user_id = p_user_id for update;

  -- Roll over unused monthly credits (one-month only, capped at new plan's monthly allowance)
  -- Per Atoms.dev: upgrades grant rollover so they feel risk-free
  if v_old_plan is not null and v_remaining_monthly > 0 then
    update user_credits set
      plan_code = p_new_plan_code,
      rolled_over_credits = least(v_remaining_monthly, v_plan.monthly_credits),
      monthly_credits = v_plan.monthly_credits,
      daily_credits = v_plan.daily_credits,
      daily_credits_date = current_date,
      current_period_end = case
        when p_billing_cycle = 'annual' then (now() + interval '1 year')::timestamptz
        else (now() + interval '1 month')::timestamptz
      end,
      monthly_credits_renewed_at = now(),
      updated_at = now()
    where user_id = p_user_id;
  else
    update user_credits set
      plan_code = p_new_plan_code,
      monthly_credits = v_plan.monthly_credits,
      daily_credits = v_plan.daily_credits,
      daily_credits_date = current_date,
      current_period_end = case
        when p_billing_cycle = 'annual' then (now() + interval '1 year')::timestamptz
        else (now() + interval '1 month')::timestamptz
      end,
      monthly_credits_renewed_at = now(),
      updated_at = now()
    where user_id = p_user_id;
  end if;

  select jsonb_build_object(
           'daily', daily_credits,
           'rolled_over', rolled_over_credits,
           'monthly', monthly_credits,
           'bonus', bonus_credits
         )
    into v_balance_after
    from user_credits where user_id = p_user_id;

  insert into credit_transactions (user_id, delta, credit_type, action, description, metadata, balance_after)
  values (p_user_id, v_plan.monthly_credits, 'monthly', 'upgrade_grant',
          'Upgraded to ' || v_plan.name,
          jsonb_build_object('plan', p_new_plan_code, 'billing', p_billing_cycle, 'paystack_ref', p_paystack_ref),
          v_balance_after);

  return jsonb_build_object('ok', true, 'plan', p_new_plan_code, 'balance', v_balance_after);
end;
$$ language plpgsql security definer;

grant execute on function upgrade_user_plan(uuid, text, text, text) to service_role;

-- ─── Daily reset function (called by cron) ──────────────────────
-- Resets daily_credits for ALL users to their plan's daily allowance.
-- Called once per day at 00:00 UTC by a Cloudflare Worker cron OR Supabase pg_cron.

create or replace function reset_daily_credits()
returns jsonb as $$
declare
  v_count int;
begin
  -- Reset daily credits to plan defaults; only reset for the current date
  -- (so re-running the cron on the same day is a no-op)
  update user_credits uc
  set daily_credits = p.daily_credits,
      daily_credits_date = current_date,
      updated_at = now()
  from plans p
  where uc.plan_code = p.code
    and uc.daily_credits_date < current_date;

  get diagnostics v_count = row_count;

  return jsonb_build_object('ok', true, 'users_reset', v_count, 'date', current_date);
end;
$$ language plpgsql security definer;

grant execute on function reset_daily_credits() to service_role;

-- ─── Monthly reset function (called by cron on the 1st of each month) ──
-- Refills monthly_credits for active subscribers and clears rolled_over_credits
-- (rolled_over only lasts one month per Atoms.dev policy).

create or replace function reset_monthly_credits()
returns jsonb as $$
declare
  v_count int;
begin
  -- For users whose billing cycle has ended: refill monthly, clear rolled_over
  update user_credits uc
  set monthly_credits = p.monthly_credits,
      rolled_over_credits = 0,                -- rolled_over expires
      monthly_credits_renewed_at = now(),
      current_period_end = now() + interval '1 month',
      updated_at = now()
  from plans p
  where uc.plan_code = p.code
    and uc.plan_code <> 'free'                -- only paid plans get monthly refill
    and (uc.current_period_end is null or uc.current_period_end <= now());

  get diagnostics v_count = row_count;

  -- Insert audit transactions for the refill
  insert into credit_transactions (user_id, delta, credit_type, action, description, balance_after)
  select uc.user_id, p.monthly_credits, 'monthly', 'monthly_reset',
         'Monthly credits refilled for ' || p.name,
         jsonb_build_object(
           'daily', uc.daily_credits,
           'rolled_over', 0,
           'monthly', p.monthly_credits,
           'bonus', uc.bonus_credits
         )
  from user_credits uc
  join plans p on uc.plan_code = p.code
  where uc.plan_code <> 'free'
    and (uc.current_period_end is null or uc.current_period_end <= now());

  return jsonb_build_object('ok', true, 'users_renewed', v_count);
end;
$$ language plpgsql security definer;

grant execute on function reset_monthly_credits() to service_role;

-- ─── Backfill user_credits for existing users ───────────────────
-- Anyone who signed up before this migration won't have a user_credits row yet.
-- This insert...select creates them with Free plan defaults.

insert into user_credits (user_id, plan_code, daily_credits, monthly_credits)
select
  p.id,
  'free',
  (select daily_credits from plans where code = 'free'),
  (select monthly_credits from plans where code = 'free')
from profiles p
where not exists (select 1 from user_credits uc where uc.user_id = p.id);

-- ─── Backfill referral codes for existing users ─────────────────
insert into referral_codes (code, user_id)
select
  'KIV-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  p.id
from profiles p
where not exists (select 1 from referral_codes rc where rc.user_id = p.id);

-- Done. The Supabase trigger will auto-provision future signups.
