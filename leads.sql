-- ============================================================
-- TORQUE PERFORMANCE — leads table
-- Run ONCE in the Supabase SQL editor (Database → SQL).
-- Backs the landing-page trial form → app admin "Leads" page.
-- ============================================================

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  parent_name   text,
  phone         text,
  email         text,
  player_name   text,
  player_age    text,          -- arrives as a string from the form; text avoids parse failures
  preferred_day text,
  source        text,          -- 'main-landing-trial' | 'tournament-landing' | 'unknown'
  status        text not null default 'new',
  notes         text,
  created_at    timestamptz not null default now(),
  constraint leads_status_chk check (status in ('new','contacted','converted','lost'))
);

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_status_idx  on public.leads (status);

-- The admin app READS and UPDATES with the anon client (like checkins/bookings).
-- INSERTs happen only through api/create-lead.js using the service-role key, which
-- bypasses RLS — so there is NO anon insert policy (the public can't insert directly).
alter table public.leads enable row level security;

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select using (true);

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update using (true) with check (true);
