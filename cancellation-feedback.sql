-- ─────────────────────────────────────────────────────────────────────────────
-- CANCELLATION SURVEY: why families cancel. Run once in Supabase SQL editor.
-- Written only by api/cancellation.js (parent, action:'feedback') and api/admin.js
-- (coach records a reason from Manage player). Read by Admin → Cancellations.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.cancellation_feedback (
  id            uuid primary key default gen_random_uuid(),
  parent_id     text not null,
  kid_name      text,
  membership_id uuid,
  package_name  text,
  billing_type  text,
  reason        text not null,          -- key from src/lib/cancelReasons.js
  details       text,                   -- optional free text
  source        text not null default 'parent',   -- 'parent' | 'admin'
  created_at    timestamptz not null default now()
);
create index if not exists cancellation_feedback_created_idx on public.cancellation_feedback (created_at desc);

alter table public.cancellation_feedback enable row level security;
drop policy if exists cancellation_feedback_select on public.cancellation_feedback;
create policy cancellation_feedback_select on public.cancellation_feedback for select using (true);
