// ============================================================
// TORQUE PERFORMANCE — Backfill plan/term fields (read-then-confirm)
//
// Fills the new columns on EXISTING active memberships:
//   stripe_price_id, billing_type, term_months, term_start, term_end
//
// RULES:
//   • Only fills a column that is currently NULL — never overwrites a value a live
//     write (checkout/renewal) already set. Per-field, independently.
//   • Never guesses. A subscription on a price not in the known map, or any row it
//     can't classify (manual/no dates), is written NOTHING and listed in
//     unclassified.csv for manual decision.
//   • sub_  → price id + created date come from Stripe; price maps to billing_type/term_months.
//   • pi_   → billing_type from the expiry window (stand ≈ 1mo, annual > ~12mo, matching
//             how the app itself distinguishes them); price id recovered from the stored
//             checkout session (cs_) line items when available.
//
// term_start = commitment start (sub.created for subs; purchased_at for annual prepaid).
// term_end   = term_start + term_months (null for month-to-month 'stand').
//
// DRY RUN by default (writes nothing). Pass --apply to write (asks 'yes' first).
// Always writes: backfill-plan.csv (intended/applied patches) + unclassified.csv.
//
// Run (bash):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node backfill-plan-fields.mjs
//   ...add --apply to write.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import readline from 'readline';
import { writeFileSync } from 'fs';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!STRIPE_KEY || !SB_URL || !SB_KEY) {
  console.error('Missing env: STRIPE_SECRET_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const APPLY = process.argv.includes('--apply');
const stripe = new Stripe(STRIPE_KEY);
const supabase = createClient(SB_URL, SB_KEY);

// price id → { billing_type, term_months }. Mirrors PRICE_INFO in api/stripe-webhook.js
// (includes the legacy recurring "stand" prices). The 4 unknown custom prices are
// deliberately absent → they land in unclassified.csv.
const PRICE = {
  // A
  'price_1Tk92RAPTWbxe0YyE8zgXLet': ['stand', null], 'price_1TLqDdAPTWbxe0YytEOlF7ZH': ['stand', null],
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': ['m6', 6], 'price_1TLqDmAPTWbxe0YysigUumPn': ['m12', 12], 'price_1TLqDlAPTWbxe0YyljY5WD6Y': ['annual', 12],
  // AA
  'price_1Tk92RAPTWbxe0Yy4zaPZkvx': ['stand', null], 'price_1TLqDgAPTWbxe0Yy7yaP3VX3': ['stand', null],
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': ['m6', 6], 'price_1TLqDjAPTWbxe0YyTsqaUdt5': ['m12', 12], 'price_1TLqDkAPTWbxe0YykcsrB50f': ['annual', 12],
  // AAA
  'price_1Tk92RAPTWbxe0YyM8hl6j9s': ['stand', null], 'price_1TLqDhAPTWbxe0YyXXJQZrh7': ['stand', null],
  'price_1TLqDkAPTWbxe0YydXEB3YqT': ['m6', 6], 'price_1TLqDjAPTWbxe0YyuyUujCu4': ['m12', 12], 'price_1TLqDkAPTWbxe0Yy8UHtMvEJ': ['annual', 12],
  // MLB
  'price_1Tk92SAPTWbxe0YyRaxsup9N': ['stand', null], 'price_1TLqDdAPTWbxe0YydO64XMLw': ['stand', null],
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': ['m6', 6], 'price_1TLqDjAPTWbxe0YyVQxRaHFs': ['m12', 12], 'price_1TLqDjAPTWbxe0Yy6fRLwlFM': ['annual', 12],
};

const iso = (unixSec) => new Date(unixSec * 1000).toISOString();
const dayOf = (s) => (s || '').split('T')[0];
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function addMonthsIso(startIso, months) {
  const d = new Date(startIso); d.setMonth(d.getMonth() + months); return d.toISOString();
}
// only set a column if we have a real value AND the row's column is currently null
function fill(patch, row, key, val) {
  if (val != null && row[key] == null) patch[key] = val;
}
function confirm(q) {
  return new Promise(res => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res(a.trim().toLowerCase()); }); });
}

async function main() {
  // Active memberships + their current plan columns (so we only fill nulls).
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('player_memberships')
      .select('id, kid_name, parent_id, package_name, stripe_payment_id, stripe_session_id, purchased_at, expires_at, stripe_price_id, billing_type, term_months, term_start, term_end')
      .eq('status', 'active').range(from, from + 999);
    if (error) { console.error('Supabase error:', error.message); process.exit(1); }
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  console.error(`\nLoaded ${rows.length} active membership(s). Classifying (read-only pass)...`);

  const planned = [];       // { row, patch, note }
  const unclassified = [];  // { row, reason }
  const skippedFull = [];   // already fully populated → nothing to do

  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    if ((i + 1) % 20 === 0) console.error(`  ...${i + 1}/${rows.length}`);
    const pid = m.stripe_payment_id || '';
    const patch = {};
    let note = '';

    if (pid.startsWith('sub_')) {
      let sub;
      try { sub = await stripe.subscriptions.retrieve(pid); }
      catch (e) { unclassified.push({ row: m, reason: `sub retrieve failed: ${e.message.slice(0, 40)}` }); continue; }
      const priceId = sub.items?.data?.[0]?.price?.id;
      const map = PRICE[priceId];
      if (!map) { unclassified.push({ row: m, reason: `unknown price ${priceId || '(none)'}` }); continue; }
      const [billing, term] = map;
      const start = iso(sub.created);
      note = `sub ${billing}`;
      fill(patch, m, 'stripe_price_id', priceId);
      fill(patch, m, 'billing_type', billing);
      if (term != null) {                    // m6 / m12 / annual-via-sub (none today) → real term
        fill(patch, m, 'term_months', term);
        fill(patch, m, 'term_start', start);
        fill(patch, m, 'term_end', addMonthsIso(start, term));
      }
      // billing_type stand (term null) → month-to-month; term_* stay null (nothing to fill)
    } else if (pid.startsWith('pi_')) {
      // One-time: classify from the expiry window (matches the app's own stand/annual split).
      if (!m.purchased_at || !m.expires_at) { unclassified.push({ row: m, reason: 'pi_ with missing purchased_at/expires_at' }); continue; }
      const diffDays = (Date.parse(m.expires_at) - Date.parse(m.purchased_at)) / 86400000;
      const isAnnual = diffDays > 300;       // >~10 months ⇒ annual prepaid; else month-to-month stand
      note = `pi_ ${isAnnual ? 'annual' : 'stand'} (${Math.round(diffDays)}d)`;
      // recover the price id from the stored checkout session, if we have one
      let priceId = null;
      if ((m.stripe_session_id || '').startsWith('cs_')) {
        try { const li = await stripe.checkout.sessions.listLineItems(m.stripe_session_id, { limit: 1 }); priceId = li.data?.[0]?.price?.id || null; } catch { /* leave null */ }
      }
      fill(patch, m, 'stripe_price_id', priceId);
      fill(patch, m, 'billing_type', isAnnual ? 'annual' : 'stand');
      if (isAnnual) {
        fill(patch, m, 'term_months', 12);
        fill(patch, m, 'term_start', m.purchased_at);
        fill(patch, m, 'term_end', m.expires_at);   // prepaid: term end == access end
      }
    } else {
      // 'manual' or anything else — no reliable Stripe source. Do NOT guess.
      unclassified.push({ row: m, reason: `non-Stripe payment id "${pid || '(empty)'}"` });
      continue;
    }

    if (Object.keys(patch).length === 0) { skippedFull.push(m); continue; }  // already populated
    planned.push({ row: m, patch, note });
  }

  // ── CSVs (written in both modes) ──
  const planCols = ['id', 'kid_name', 'note', 'stripe_price_id', 'billing_type', 'term_months', 'term_start', 'term_end'];
  writeFileSync('backfill-plan.csv', '﻿' + planCols.join(',') + '\n' +
    planned.map(p => [p.row.id, p.row.kid_name, p.note, p.patch.stripe_price_id ?? '', p.patch.billing_type ?? '',
      p.patch.term_months ?? '', dayOf(p.patch.term_start), dayOf(p.patch.term_end)].map(csvCell).join(',')).join('\n') + '\n');
  writeFileSync('unclassified.csv', '﻿' + ['id', 'kid_name', 'parent_id', 'stripe_payment_id', 'package_name', 'reason'].join(',') + '\n' +
    unclassified.map(u => [u.row.id, u.row.kid_name, u.row.parent_id, u.row.stripe_payment_id, u.row.package_name, u.reason].map(csvCell).join(',')).join('\n') + '\n');

  // ── Report ──
  console.log('\n' + '='.repeat(96));
  console.log(`BACKFILL PLAN — ${planned.length} row(s) to fill${APPLY ? '' : '   [DRY RUN — no writes]'}`);
  console.log('='.repeat(96));
  for (const p of planned) {
    console.log(`• ${p.row.kid_name}  [${p.note}]  → ${JSON.stringify(Object.fromEntries(
      Object.entries(p.patch).map(([k, v]) => [k, /_start$|_end$/.test(k) ? dayOf(v) : v])))}`);
  }
  console.log('='.repeat(96));
  console.log(`To fill: ${planned.length}   Already populated (skipped): ${skippedFull.length}   Unclassified: ${unclassified.length}`);
  const byType = planned.reduce((a, p) => { a[p.patch.billing_type || '(partial)'] = (a[p.patch.billing_type || '(partial)'] || 0) + 1; return a; }, {});
  console.log(`By billing_type being set: ${JSON.stringify(byType)}`);
  if (unclassified.length) {
    console.log(`\n⚠️  UNCLASSIFIED (left untouched, see unclassified.csv) — ${unclassified.length}:`);
    for (const u of unclassified) console.log(`  · ${u.row.kid_name} (${u.row.stripe_payment_id}) — ${u.reason}`);
  }
  console.log(`\nWrote backfill-plan.csv (${planned.length}) and unclassified.csv (${unclassified.length}).`);

  if (planned.length === 0) { console.log('\nNothing to fill. ✅'); process.exit(0); }
  if (!APPLY) { console.log('\nDRY RUN — no changes written. Review the CSVs, then re-run with --apply.'); process.exit(0); }

  const ans = await confirm(`\nApply ${planned.length} backfill update(s) (fills only null columns)? Type 'yes': `);
  if (ans !== 'yes') { console.log('Aborted — no changes written.'); process.exit(0); }

  console.log('\nApplying...');
  let ok = 0; const fails = [];
  for (const p of planned) {
    const { error } = await supabase.from('player_memberships').update(p.patch).eq('id', p.row.id);
    if (error) { fails.push(`${p.row.kid_name}: ${error.message}`); console.error(`  ✗ ${p.row.kid_name}: ${error.message}`); }
    else { ok++; console.log(`  ✓ ${p.row.kid_name} [${p.note}]`); }
  }
  console.log(`\nDone. ${ok}/${planned.length} filled.${fails.length ? ` ${fails.length} failed (see above).` : ''}`);
  console.log(`Rollback (columns were null before): update player_memberships set stripe_price_id=null, billing_type=null, term_months=null, term_start=null, term_end=null where id in (<ids from backfill-plan.csv>);`);
}

main().catch(e => { console.error(e); process.exit(1); });
