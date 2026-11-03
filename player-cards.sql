-- ─────────────────────────────────────────────────────────────────────────────
-- PLAYER CARDS + ENTRANCE SCANNER
-- Each player gets a card with a photo and a QR. The QR only holds a random
-- token; everything else (package, sessions, team, payment) is looked up live
-- when a coach scans it in Admin → Scanner.
-- Both tables are private: only the service role (api/player-card.js) reads or
-- writes them, so nobody can list tokens and fake a card.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.player_cards (
  player_id   text primary key,              -- players.id
  parent_id   text not null,
  kid_name    text not null,
  token       text not null unique,          -- what the QR encodes (TQ + 32 hex)
  photo_path  text,                          -- path inside the player-photos bucket
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.player_cards enable row level security;

create table if not exists public.card_scans (
  id          uuid primary key default gen_random_uuid(),
  player_id   text,
  parent_id   text,
  kid_name    text,
  verdict     text not null,                 -- ok | warn | blocked | unknown
  reason      text,
  action      text,                          -- confirmed | walk_in | override | already | none
  booking_id  text,
  deducted    boolean not null default false,
  scanned_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists card_scans_created_idx on public.card_scans (created_at desc);
alter table public.card_scans enable row level security;

-- Private bucket for player photos (served through short-lived signed links).
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', false)
on conflict (id) do nothing;
