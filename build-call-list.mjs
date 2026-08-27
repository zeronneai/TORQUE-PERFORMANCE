// ============================================================
// TORQUE PERFORMANCE — Win-back CALL LIST (read-only)
//
// Builds call-list.csv of members whose 'sub_' membership is still status='active'
// in the DB but whose Stripe subscription is NOT active/trialing (canceled/paused/
// past_due/…). For each, pulls contact info so the owner can phone them.
//
// Contact resolution: profiles (full_name, phone, email) first, waivers (most recent
// by agreed_at) as fallback for phone / name / email. email is the REAL email, never
// the Clerk id.
//
// Makes NO changes — only SELECTs from Supabase and RETRIEVEs from Stripe.
//
// Which Stripe statuses to include (default: canceled only):
//   --paused      also include 'paused'
//   --pastdue     also include 'past_due'
//   --all         include EVERY non-active status (canceled/paused/past_due/unpaid/
//                 incomplete/incomplete_expired)
// A full per-status breakdown is always printed so nothing is hidden.
//
// Output: call-list.csv, sorted most-recently-lapsed first (freshest churn = best
// win-back odds). Columns: last_active(expires_at), days_lapsed, kid_name,
// parent_name, phone, email, package_name, stripe_status, sub_id, phone_missing.
//
// Run (bash):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node build-call-list.mjs [--paused] [--pastdue] [--all]
// Run (PowerShell): set the three $env vars, then: node build-call-list.mjs [--paused] [--pastdue] [--all]
// ============================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { writeFileSync } from 'fs';

const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!STRIPE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env: need STRIPE_SECRET_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const stripe   = new Stripe(STRIPE_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ARGS = process.argv.slice(2);
const ALL = ARGS.includes('--all');
const INCLUDE = new Set(['canceled']);                 // default
if (ALL || ARGS.includes('--paused'))  INCLUDE.add('paused');
if (ALL || ARGS.includes('--pastdue')) INCLUDE.add('past_due');
if (ALL) ['unpaid', 'incomplete', 'incomplete_expired'].forEach(s => INCLUDE.add(s));

const ACTIVE = new Set(['active', 'trialing']);       // never on a call list
const dayOf = (iso) => (iso || '').split('T')[0];
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const now = Date.now();

  // 1) All active autopay memberships (paginated).
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('player_memberships')
      .select('id, kid_name, parent_id, package_name, expires_at, stripe_payment_id')
      .eq('status', 'active').like('stripe_payment_id', 'sub_%')
      .range(from, from + 999);
    if (error) { console.error('Supabase error:', error.message); process.exit(1); }
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  console.error(`\nLoaded ${rows.length} active sub_ membership(s). Checking Stripe status (read-only)...`);

  // 2) Stripe status per membership → keep only NON-active ones.
  const stale = [];
  const statusCount = {};
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    if ((i + 1) % 20 === 0) console.error(`  ...${i + 1}/${rows.length}`);
    let st = 'retrieve_error';
    try { st = (await stripe.subscriptions.retrieve(m.stripe_payment_id)).status; }
    catch { st = 'retrieve_error'; }
    if (ACTIVE.has(st)) continue;                       // genuine active payer — not churn
    statusCount[st] = (statusCount[st] || 0) + 1;
    stale.push({ ...m, stripeStatus: st });
  }

  // 3) Contact info: profiles primary, waivers (most recent) fallback.
  const pids = [...new Set(stale.map(s => s.parent_id).filter(Boolean))];
  const prof = new Map(), waiver = new Map();
  for (let i = 0; i < pids.length; i += 200) {
    const chunk = pids.slice(i, i + 200);
    const { data: pf } = await supabase.from('profiles').select('id, full_name, phone, email').in('id', chunk);
    for (const p of (pf || [])) prof.set(p.id, p);
    const { data: wv } = await supabase.from('waivers')
      .select('parent_id, parent_name, phone, email, agreed_at').in('parent_id', chunk)
      .order('agreed_at', { ascending: false });
    for (const w of (wv || [])) if (!waiver.has(w.parent_id)) waiver.set(w.parent_id, w); // first = most recent
  }

  // 4) Build rows, filtered to the chosen statuses, sorted most-recently-lapsed first.
  const included = stale.filter(s => INCLUDE.has(s.stripeStatus));
  const list = included.map(s => {
    const p = prof.get(s.parent_id) || {}, w = waiver.get(s.parent_id) || {};
    const phone = p.phone || w.phone || '';
    const email = p.email || w.email || '';
    const name  = p.full_name || w.parent_name || '';
    const lapseMs = s.expires_at ? Date.parse(s.expires_at) : null;
    const daysLapsed = lapseMs != null ? Math.floor((now - lapseMs) / 86400000) : null;
    return {
      last_active: dayOf(s.expires_at), days_lapsed: daysLapsed,
      kid_name: s.kid_name, parent_name: name, phone, email,
      package_name: s.package_name, stripe_status: s.stripeStatus,
      sub_id: s.stripe_payment_id, phone_missing: phone ? '' : 'YES',
      _sort: lapseMs == null ? -Infinity : lapseMs,
    };
  }).sort((a, b) => b._sort - a._sort);   // most recent lapse first; unknown dates last

  // 5) Write CSV.
  const cols = ['last_active', 'days_lapsed', 'kid_name', 'parent_name', 'phone', 'email',
                'package_name', 'stripe_status', 'sub_id', 'phone_missing'];
  const csv = '﻿' + cols.join(',') + '\n' +
    list.map(r => cols.map(c => csvCell(r[c])).join(',')).join('\n') + '\n';
  writeFileSync('call-list.csv', csv);

  // 6) Console summary.
  console.log(`\n================ WIN-BACK CALL LIST ================`);
  console.log(`Non-active sub_ memberships found, by Stripe status:`);
  for (const [k, n] of Object.entries(statusCount).sort((a, b) => b[1] - a[1])) {
    const inc = INCLUDE.has(k) ? 'INCLUDED' : 'excluded';
    console.log(`  ${k.padEnd(20)} ${String(n).padStart(4)}   [${inc}]`);
  }
  console.log(`\nIncluded statuses: ${[...INCLUDE].join(', ')}   (flags: --paused --pastdue --all)`);
  console.log(`Rows written to call-list.csv: ${list.length}`);
  const noPhone = list.filter(r => !r.phone).length;
  if (noPhone) console.log(`⚠️  ${noPhone} row(s) have NO phone on file (phone_missing=YES) — email only.`);
  console.log(`\nTop of the list (freshest churn first):`);
  for (const r of list.slice(0, 10)) {
    console.log(`  ${r.last_active || '—'}  (${r.days_lapsed == null ? '?' : r.days_lapsed + 'd'})  ${r.kid_name} — ${r.parent_name || '(no name)'}  ${r.phone || '(no phone)'}  [${r.stripe_status}]`);
  }
  console.log(`\nNO changes were made. ✅  Hand call-list.csv to the owner.\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
