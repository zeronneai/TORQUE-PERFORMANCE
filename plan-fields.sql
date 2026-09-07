-- ============================================================
-- TORQUE PERFORMANCE — plan/term fields on player_memberships
-- Run ONCE in the Supabase SQL editor (Database → SQL).
--
-- Additive + non-breaking: all columns are nullable and no existing code reads
-- them yet. Lets the app know a member's plan/term WITHOUT a live Stripe lookup
-- (needed for contracts, cancellation fees, and stopping auto-renewal at term end).
--
-- NOTE on term_start vs purchased_at: purchased_at already moves forward every
-- renewal cycle (start of the current paid month). term_start is FIXED at the
-- commitment start and is never bumped on renewal — that's what makes term_end
-- (when the 6/12-month commitment ends) computable.
-- ============================================================

alter table public.player_memberships
  add column if not exists stripe_price_id text,       -- the Stripe price they're actually on
  add column if not exists billing_type    text,       -- 'stand' | 'm6' | 'm12' | 'annual'
  add column if not exists term_months     integer,    -- null (month-to-month) | 6 | 12
  add column if not exists term_start      timestamptz, -- when the commitment began (fixed, not bumped on renewal)
  add column if not exists term_end        timestamptz; -- term_start + term_months (null for month-to-month 'stand')

-- Value guard for billing_type. NOT VALID so it does NOT check existing rows now
-- and does NOT block the backfill; new/updated rows are validated going forward.
-- After the backfill is verified, enforce retroactively with:
--   alter table public.player_memberships validate constraint player_memberships_billing_type_chk;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'player_memberships_billing_type_chk'
  ) then
    alter table public.player_memberships
      add constraint player_memberships_billing_type_chk
      check (billing_type is null or billing_type in ('stand','m6','m12','annual')) not valid;
  end if;
end $$;

create index if not exists player_memberships_billing_type_idx on public.player_memberships (billing_type);
create index if not exists player_memberships_term_end_idx     on public.player_memberships (term_end);

-- Verify:
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_name = 'player_memberships'
--     and column_name in ('stripe_price_id','billing_type','term_months','term_start','term_end');
