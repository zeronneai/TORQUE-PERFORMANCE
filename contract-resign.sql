-- ============================================================
-- TORQUE PERFORMANCE — contract re-signing: admin exemption flag
-- Run ONCE in the Supabase SQL editor (Database → SQL).
--
-- contract_exempt lets the owner individually unblock a parent from the
-- re-signing gate (e.g. they pushed back). Default false. The parent portal
-- reads it off the profile it already loads; the admin toggles it via the
-- service-role endpoint api/set-contract-exempt.js (profiles stays locked to
-- anon writes — no new anon UPDATE policy is added).
-- ============================================================

alter table public.profiles
  add column if not exists contract_exempt boolean not null default false;

-- Signing status is otherwise derived from existing tables (player_memberships
-- .billing_type + waivers.contract_version) — no other schema change needed.

-- Verify:
--   select id, full_name, contract_exempt from public.profiles where contract_exempt;
