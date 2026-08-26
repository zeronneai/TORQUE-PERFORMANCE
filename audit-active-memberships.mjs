// ============================================================
// TORQUE PERFORMANCE — READ-ONLY audit of "active" memberships
//
// Explains the "139 active members" vs "56 Stripe subscriptions" gap.
// Makes NO changes — only SELECTs from Supabase and RETRIEVEs from Stripe.
// (No .update / .insert / .delete / stripe write calls anywhere.)
//
// Answers, with real counts:
//   Q2 — active memberships by stripe_payment_id kind (sub_/pi_/manual/null/other)
//   Q3 — for each sub_, its ACTUAL Stripe status (active/trialing vs canceled/…)
//   Q4 — kids with >1 active membership (duplicates inflating the count)
//   Q5 — active sub_ memberships with sessions_total=0 or an expired date
//
// Writes two CSVs for review (local files only, no DB writes):
//   audit-stale-subs.csv       — sub_ active in DB but NOT active in Stripe
//   audit-duplicate-kids.csv   — kids with more than one active membership
//
// Run (bash):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node audit-active-memberships.mjs
// Run (PowerShell): set the three $env vars, then: node audit-active-memberships.mjs
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
const dayOf = (iso) => (iso || '').split('T')[0];
const csv = (rows) => rows.map(r => r.map(v => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',')).join('\n');

function kind(pid) {
  if (!pid) return 'null/empty';
  if (pid.startsWith('sub_')) return 'sub (recurring)';
  if (pid.startsWith('pi_'))  return 'pi (one-time)';
  if (pid.startsWith('cs_'))  return 'cs (checkout session)';
  if (pid === 'manual')       return 'manual';
  return 'other';
}

async function main() {
  // Fetch ALL status='active' memberships (this IS the app's "active members" set).
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('player_memberships')
      .select('id, parent_id, kid_name, package_name, sessions_total, sessions_used, expires_at, purchased_at, stripe_payment_id')
      .eq('status', 'active')
      .range(from, from + PAGE - 1);
    if (error) { console.error('Supabase error:', error.message); process.exit(1); }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  const now = Date.now();
  console.log(`\n================ ACTIVE MEMBERSHIPS AUDIT ================`);
  console.log(`Total player_memberships with status='active' (the app's "active members"): ${rows.length}`);

  // ── Q2: breakdown by stripe_payment_id kind ──
  const byKind = {};
  for (const m of rows) byKind[kind(m.stripe_payment_id)] = (byKind[kind(m.stripe_payment_id)] || 0) + 1;
  console.log(`\n── Q2: by stripe_payment_id kind ──`);
  for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)} ${n}`);

  // ── Q4: kids with >1 active membership ──
  const byKid = new Map();
  for (const m of rows) {
    const key = `${m.parent_id}::${(m.kid_name || '').toLowerCase().trim()}`;
    if (!byKid.has(key)) byKid.set(key, []);
    byKid.get(key).push(m);
  }
  const dupes = [...byKid.entries()].filter(([, ms]) => ms.length > 1);
  const extraRows = dupes.reduce((s, [, ms]) => s + (ms.length - 1), 0);
  console.log(`\n── Q4: duplicate kids (>1 active membership) ──`);
  console.log(`  kids with duplicates: ${dupes.length}`);
  console.log(`  extra (inflating) rows from duplicates: ${extraRows}`);
  const dupeCsv = [['parent_id', 'kid_name', 'active_count', 'payment_ids', 'packages']];
  for (const [, ms] of dupes.sort((a, b) => b[1].length - a[1].length)) {
    dupeCsv.push([ms[0].parent_id, ms[0].kid_name, ms.length,
      ms.map(x => x.stripe_payment_id).join(' | '), ms.map(x => x.package_name).join(' | ')]);
  }
  writeFileSync('audit-duplicate-kids.csv', csv(dupeCsv) + '\n');

  // ── Q5: active sub_ with zeroed sessions or expired dates ──
  const subs = rows.filter(m => (m.stripe_payment_id || '').startsWith('sub_'));
  const q5 = {
    zero:    subs.filter(m => (m.sessions_total || 0) === 0).length,
    expired: subs.filter(m => m.expires_at && Date.parse(m.expires_at) < now).length,
    both:    subs.filter(m => (m.sessions_total || 0) === 0 && m.expires_at && Date.parse(m.expires_at) < now).length,
  };
  console.log(`\n── Q5: sub_ active memberships health ──`);
  console.log(`  sub_ active total:            ${subs.length}`);
  console.log(`  ...with sessions_total = 0:   ${q5.zero}`);
  console.log(`  ...with expires_at in past:   ${q5.expired}`);
  console.log(`  ...with BOTH:                 ${q5.both}`);

  // ── Q3: cross-check each sub_ against its REAL Stripe status ──
  console.log(`\n── Q3: cross-checking ${subs.length} sub_ memberships against Stripe (read-only)... ──`);
  const statusCount = {};
  const stale = [['kid_name', 'parent_id', 'stripe_payment_id', 'stripe_status', 'sessions', 'expires_at', 'package']];
  let genuineActive = 0;
  const seenActiveKid = new Set();
  for (let i = 0; i < subs.length; i++) {
    const m = subs[i];
    let st = 'RETRIEVE_FAILED';
    try {
      const sub = await stripe.subscriptions.retrieve(m.stripe_payment_id);
      st = sub.status;  // active | trialing | past_due | canceled | unpaid | incomplete | incomplete_expired | paused
    } catch (e) {
      st = `error:${e.code || e.message.slice(0, 24)}`;
    }
    statusCount[st] = (statusCount[st] || 0) + 1;
    if (st === 'active' || st === 'trialing') {
      genuineActive++;
      seenActiveKid.add(`${m.parent_id}::${(m.kid_name || '').toLowerCase().trim()}`);
    } else {
      stale.push([m.kid_name, m.parent_id, m.stripe_payment_id, st,
        `${m.sessions_used}/${m.sessions_total}`, dayOf(m.expires_at), m.package_name]);
    }
    if ((i + 1) % 20 === 0) console.error(`   ...${i + 1}/${subs.length}`);
  }
  writeFileSync('audit-stale-subs.csv', csv(stale) + '\n');

  console.log(`\n  Stripe status of the ${subs.length} sub_ memberships:`);
  for (const [k, n] of Object.entries(statusCount).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(22)} ${n}`);
  console.log(`\n  Genuinely active/trialing in Stripe: ${genuineActive}`);
  console.log(`  ...unique kids among those:          ${seenActiveKid.size}`);
  console.log(`  Stale (active in DB, NOT active in Stripe): ${subs.length - genuineActive}  → audit-stale-subs.csv`);

  // ── Composition summary of the app's count ──
  console.log(`\n================ COMPOSITION OF THE APP'S "ACTIVE MEMBERS" ================`);
  console.log(`  App count (status='active' rows):        ${rows.length}`);
  console.log(`  = genuine active subs (Stripe-confirmed): ${genuineActive}`);
  console.log(`  + stale subs (canceled/past_due/etc):     ${subs.length - genuineActive}`);
  console.log(`  + one-time (pi_):                         ${byKind['pi (one-time)'] || 0}`);
  console.log(`  + manual:                                ${byKind['manual'] || 0}`);
  console.log(`  + null/empty:                            ${byKind['null/empty'] || 0}`);
  console.log(`  + cs_/other:                             ${(byKind['cs (checkout session)'] || 0) + (byKind['other'] || 0)}`);
  console.log(`  (of which duplicate-kid extra rows:      ${extraRows})`);
  console.log(`\nCSVs written: audit-stale-subs.csv, audit-duplicate-kids.csv`);
  console.log(`NO changes were made to the database or Stripe. ✅\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
