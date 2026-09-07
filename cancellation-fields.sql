-- ============================================================
-- TORQUE PERFORMANCE — in-app cancellation fields
-- Run ONCE in the Supabase SQL editor (Database → SQL).
--
-- Additive + non-breaking (all nullable). Records a member-initiated cancellation:
-- when it was requested, when access actually ends, when it finalized, the fee we
-- charged, and which signed contract_version's rule was applied (audit trail).
--
-- Lifecycle:
--   request succeeds  → cancel_requested_at set, cancel_effective_at set,
--                       status STAYS 'active' until the effective date (access kept)
--   sub actually ends → customer.subscription.deleted webhook sets
--                       status = 'canceled', canceled_at = now()
-- ============================================================

alter table public.player_memberships
  add column if not exists cancel_requested_at     timestamptz,  -- when the parent confirmed cancellation
  add column if not exists cancel_effective_at      timestamptz,  -- when access ends (now for m6 buyout, period end for m12)
  add column if not exists canceled_at              timestamptz,  -- when the Stripe sub was actually deleted (finalized)
  add column if not exists cancel_fee_cents         integer,      -- fee charged (0 for stand / past-term)
  add column if not exists cancel_contract_version  text;         -- the signed version whose rule was applied

create index if not exists player_memberships_cancel_effective_idx
  on public.player_memberships (cancel_effective_at) where cancel_effective_at is not null;

-- NOTE on the new 'canceled' status value: the app counts active strictly by
-- status = 'active', so 'canceled' drops out of all active surfaces. If a CHECK
-- constraint on status exists, add 'canceled' to it. Verify with:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.player_memberships'::regclass and contype = 'c';
-- (No status CHECK constraint is expected — the app writes 'active'/'inactive' freely.)
