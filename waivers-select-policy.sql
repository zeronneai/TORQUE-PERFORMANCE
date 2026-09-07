-- ============================================================
-- TORQUE PERFORMANCE — waivers SELECT policy (fix contract gate + admin count)
-- Run ONCE in the Supabase SQL editor.
--
-- Bug: the re-sign gate (parent portal) and the admin Contracts page both READ
-- waivers via the anon client, but waivers only ever had an INSERT path before —
-- with RLS enabled and no SELECT policy, the anon read returns ZERO rows. Result:
-- admin shows Signed: 0, and worse, the gate re-prompts already-signed parents on
-- their next login (the waiver read comes back empty). The kid_name matching is
-- already trim+lower on both sides, so this is purely a read-permission issue.
--
-- Fix: add a permissive SELECT policy (consistent with leads / promo_registrations
-- / event_registrations, which already use `using (true)`).
-- Note: NOT enabling RLS here on purpose — only adding SELECT — so the existing
-- INSERT path cannot be affected either way.
-- ============================================================

-- Diagnose first (optional):
--   select relrowsecurity as rls_enabled from pg_class where relname = 'waivers';
--   select policyname, cmd from pg_policies where tablename = 'waivers';

drop policy if exists waivers_select on public.waivers;
create policy waivers_select on public.waivers for select using (true);
