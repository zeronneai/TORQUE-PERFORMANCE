-- ─────────────────────────────────────────────────────────────────────────────
-- MEMBER NOTES: what coaches know that the data does not show (special deals,
-- who pays by invoice or cash, siblings covered by one payment...). Ask Torque
-- (Claude) reads every note on every question. parent_id NULL = academy-wide rule.
-- Private table: only the service role (api/admin.js) reads or writes it.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.member_notes (
  id          uuid primary key default gen_random_uuid(),
  parent_id   text,                 -- null = rule for the whole academy
  kid_name    text,                 -- optional: note about one player
  note        text not null,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists member_notes_parent_idx on public.member_notes (parent_id);
alter table public.member_notes enable row level security;
