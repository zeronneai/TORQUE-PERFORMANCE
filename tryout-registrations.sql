-- ============================================================
-- TORQUE PERFORMANCE — tryout_registrations RLS
-- ============================================================
-- The table itself was created in Supabase with these columns:
--   id, tryout_slug, parent_name, parent_email, parent_phone, player_name,
--   player_age, age_group, time_slot, position, current_team, notes,
--   status, created_at
--
-- This file only sets row-level security, mirroring leads.sql:
--   • The admin app (Tryouts page) READS with the anon client → needs a SELECT policy.
--   • INSERTs happen ONLY through api/create-tryout-registration.js using the
--     service-role key, which BYPASSES RLS — so there is NO anon insert policy
--     (the public cannot insert directly; the honeypot + endpoint are the only door).
--   • The admin page is read-only (no status editing), so no anon UPDATE policy.
-- Safe to re-run.
-- ============================================================

alter table public.tryout_registrations enable row level security;

drop policy if exists tryout_reg_select on public.tryout_registrations;
create policy tryout_reg_select on public.tryout_registrations for select using (true);
