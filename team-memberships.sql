-- ─────────────────────────────────────────────────────────────────────────────
-- TORQUE TEAM: $250/month team subscription, one row per player on a team.
-- Teams by age: 9U, 10U, 11U, 12U, 13U (team_age = 9..13).
-- Only players that already have an active session package can join (enforced
-- server-side in api/create-checkout.js, kind = 'team').
-- Rows are written ONLY by the Stripe webhook / api/admin.js (service role).
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.team_memberships (
  id                     uuid primary key default gen_random_uuid(),
  parent_id              text not null,
  kid_name               text not null,
  team_age               int  not null check (team_age between 9 and 13),
  status                 text not null default 'active',   -- active | past_due | canceled
  stripe_subscription_id text unique,
  stripe_session_id      text,
  started_at             timestamptz not null default now(),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  canceled_at            timestamptz,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists team_memberships_parent_idx on public.team_memberships (parent_id);
create index if not exists team_memberships_team_idx   on public.team_memberships (team_age, status);

-- Read access follows the same pattern as the rest of the app (parent portal and
-- admin read with the anon key). Writes only through the service role.
alter table public.team_memberships enable row level security;
drop policy if exists team_memberships_select on public.team_memberships;
create policy team_memberships_select on public.team_memberships for select using (true);
