-- ─────────────────────────────────────────────────────────────────────────────
-- CLOSED DATES: academy-closed days managed from Admin → Schedule.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.closed_dates (
  day        date primary key,
  reason     text,
  created_at timestamptz not null default now(),
  created_by text
);

-- Everyone (parent portal, admin) can READ the list. Writes only go through the
-- service-role endpoint api/closed-dates.js, which verifies the caller is an admin.
alter table public.closed_dates enable row level security;
drop policy if exists closed_dates_select on public.closed_dates;
create policy closed_dates_select on public.closed_dates for select using (true);

-- Seed: past closures (history) + the Oct 23–31 block requested by the owner.
insert into public.closed_dates (day, reason) values
  ('2026-07-24', 'Closed'),
  ('2026-07-25', 'Closed'),
  ('2026-09-07', 'Labor Day'),
  ('2026-10-10', 'Tryouts')
on conflict (day) do nothing;

insert into public.closed_dates (day, reason)
select d::date, 'Closed'
from generate_series('2026-10-23'::date, '2026-10-31'::date, interval '1 day') d
on conflict (day) do nothing;

-- Hard server-side block: no booking can be inserted on a closed day, even if a
-- client bypasses the app UI. Reschedules (delete + insert) are covered too.
create or replace function public.reject_closed_date() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.closed_dates c where c.day = new.session_date::date) then
    raise exception 'Academy closed on %', new.session_date;
  end if;
  return new;
end $$;

drop trigger if exists bookings_block_closed on public.bookings;
create trigger bookings_block_closed before insert on public.bookings
  for each row execute function public.reject_closed_date();

-- Check: who is ALREADY booked in the Oct 23–31 window (these need to be cancelled
-- and their sessions returned, same as we did for Oct 10).
-- select b.id, b.session_date, b.session_time, b.kid_name, p.full_name, p.phone, p.email, b.membership_id
-- from bookings b left join profiles p on p.id = b.parent_id
-- where b.session_date between '2026-10-23' and '2026-10-31' and b.status = 'confirmed'
-- order by b.session_date, b.session_time;
