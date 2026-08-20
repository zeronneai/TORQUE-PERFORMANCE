-- ============================================================
-- TORQUE PERFORMANCE — Promos / paid-events feature
-- Run ONCE in the Supabase SQL editor (Database → SQL).
--
-- Reusable, multi-event. Kept SEPARATE from the free-RSVP `events`/
-- `event_registrations` tables — this is the paid-checkout module.
--
-- Tables:
--   promo_events         — catalog of paid events (camp, clinics, …)
--   promo_registrations  — one row per registered/paying kid
-- Function:
--   reserve_promo_spot() — atomically reserves a pending spot under an
--                          advisory lock so capacity can NEVER be oversold.
-- ============================================================

-- ── Catalog of paid events ──────────────────────────────────────────────────
create table if not exists public.promo_events (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,            -- 'labor-day-camp-2026'
  title           text not null,
  description     text,
  flyer_url       text,
  price_cents     integer not null,                -- 5000 = $50
  stripe_price_id text,                            -- the real one-time Price id
  event_date      date,
  event_time      text,                            -- '10:00 AM – 12:00 PM'
  age_range       text,                            -- '4–7' (display only)
  min_age         integer,                         -- 4  (gating logic)
  max_age         integer,                         -- 7  (gating logic)
  capacity        integer not null,                -- 40 (HARD cap)
  one_time        boolean not null default true,
  active          boolean not null default false,  -- drives announcement + Promos section
  created_at      timestamptz not null default now()
);

-- At most ONE active promo at a time (the announcement shows a single flyer).
create unique index if not exists promo_events_single_active_idx
  on public.promo_events ((active)) where active;

-- ── Registrations (pending → paid; expired/refunded free the spot) ───────────
create table if not exists public.promo_registrations (
  id                uuid primary key default gen_random_uuid(),
  promo_event_id    uuid not null references public.promo_events(id) on delete cascade,
  parent_id         text,             -- Clerk user id (any logged-in user)
  parent_name       text,
  player_name       text,
  player_age        text,             -- stored as text like players.age / leads.player_age
  email             text,
  phone             text,
  stripe_session_id text,
  stripe_payment_id text,             -- payment_intent (paid) / charge (refund match)
  amount_cents      integer,
  status            text not null default 'pending',  -- pending | paid | expired | refunded
  reserved_until    timestamptz,      -- a 'pending' row holds a spot only until this time
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  constraint promo_reg_status_chk check (status in ('pending','paid','expired','refunded'))
);

create index if not exists promo_reg_event_status_idx
  on public.promo_registrations (promo_event_id, status);
create unique index if not exists promo_reg_session_uidx
  on public.promo_registrations (stripe_session_id) where stripe_session_id is not null;
create index if not exists promo_reg_payment_idx
  on public.promo_registrations (stripe_payment_id) where stripe_payment_id is not null;

-- ── Atomic spot reservation (the strict-cap guarantee) ───────────────────────
-- Serializes all reservation attempts for one event via a transaction-level
-- advisory lock, so count-then-insert is atomic and the 41st spot is impossible.
-- Returns the new pending registration id, or NULL when sold out / event inactive
-- / age out of range.
create or replace function public.reserve_promo_spot(
  p_event_id     uuid,
  p_parent_id    text,
  p_parent_name  text,
  p_player_name  text,
  p_player_age   integer,
  p_email        text,
  p_phone        text,
  p_ttl_minutes  integer default 30
) returns uuid
language plpgsql
as $$
declare
  v_cap   integer;
  v_price integer;
  v_min   integer;
  v_max   integer;
  v_count integer;
  v_id    uuid;
begin
  -- Serialize concurrent buyers for THIS event only.
  perform pg_advisory_xact_lock(hashtext('promo_event:' || p_event_id::text));

  select capacity, price_cents, min_age, max_age
    into v_cap, v_price, v_min, v_max
  from public.promo_events
  where id = p_event_id and active;
  if not found then
    return null;                                   -- unknown / inactive event
  end if;

  -- Age gate (server-side truth): reject out-of-range kids.
  if (v_min is not null and p_player_age < v_min)
     or (v_max is not null and p_player_age > v_max) then
    return null;
  end if;

  -- Count spots already held: paid + still-valid pending reservations.
  select count(*) into v_count
  from public.promo_registrations
  where promo_event_id = p_event_id
    and (status = 'paid' or (status = 'pending' and reserved_until > now()));

  if v_count >= v_cap then
    return null;                                   -- SOLD OUT
  end if;

  insert into public.promo_registrations
    (promo_event_id, parent_id, parent_name, player_name, player_age,
     email, phone, amount_cents, status, reserved_until)
  values
    (p_event_id, p_parent_id, p_parent_name, p_player_name, p_player_age::text,
     p_email, p_phone, v_price, 'pending', now() + make_interval(mins => p_ttl_minutes))
  returning id into v_id;

  return v_id;
end;
$$;

-- ── RLS — mirrors `leads`: admin READS via anon client; all WRITES happen only
--    through the service-role key in api/ (which bypasses RLS). No public insert.
alter table public.promo_events        enable row level security;
alter table public.promo_registrations enable row level security;

drop policy if exists promo_events_select on public.promo_events;
create policy promo_events_select on public.promo_events for select using (true);

drop policy if exists promo_reg_select on public.promo_registrations;
create policy promo_reg_select on public.promo_registrations for select using (true);

-- ============================================================
-- SEED (owner runs manually) — the first camp. Adjust as needed.
-- ============================================================
-- insert into public.promo_events
--   (slug, title, description, flyer_url, price_cents, stripe_price_id,
--    event_date, event_time, age_range, min_age, max_age, capacity, one_time, active)
-- values
--   ('labor-day-camp-2026',
--    'Labor Day Baseball Camp',
--    'One-day beginner camp for ages 4–7. Monday Sept 7, 10am–12pm.',
--    'https://res.cloudinary.com/dsprn0ew4/image/upload/v1787264816/Creating_youth_baseball_camp_flyer_202608201625_iy6lkc.jpg',
--    5000,
--    'price_1U6eiWAPTWbxe0YyPWvCnaDk',
--    '2026-09-07', '10:00 AM – 12:00 PM',
--    '4–7', 4, 7, 40, true, true);
