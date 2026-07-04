-- ============================================================
-- TORQUE PERFORMANCE — event_registrations table
-- Run this ONCE in the Supabase SQL editor (Database → SQL).
-- Enables per-registration records (who RSVP'd) for the Events overhaul.
-- Assumes events.id is uuid (consistent with checkins/player_memberships).
-- If your events.id is a different type, change event_id's type to match.
-- ============================================================

create table if not exists public.event_registrations (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  parent_id   text not null,                 -- Clerk user id of the parent
  kid_name    text not null,
  parent_name text,                          -- denormalized for easy admin display
  created_at  timestamptz not null default now(),
  unique (event_id, parent_id, kid_name)     -- one RSVP per kid per event
);

create index if not exists event_registrations_event_idx  on public.event_registrations (event_id);
create index if not exists event_registrations_parent_idx on public.event_registrations (parent_id);

-- Row Level Security — mirrors the app's existing permissive client-side model
-- (the app reads/writes checkins & bookings from the anon client). Adjust to
-- your security posture if you tighten the others.
alter table public.event_registrations enable row level security;

drop policy if exists event_reg_select on public.event_registrations;
create policy event_reg_select on public.event_registrations
  for select using (true);

drop policy if exists event_reg_insert on public.event_registrations;
create policy event_reg_insert on public.event_registrations
  for insert with check (true);

drop policy if exists event_reg_delete on public.event_registrations;
create policy event_reg_delete on public.event_registrations
  for delete using (true);
