// ============================================================
// TORQUE PERFORMANCE — Deactivate memberships from the owner's "Delete" list
// READ-THEN-CONFIRM (dry-run by default; --apply writes).
//
// Sets status = 'inactive' (NOT 'canceled' — 'canceled' is reserved for real
// subscription cancellations so data cleanup stays distinguishable from churn).
//
// INPUT: a CSV of the owner's sheet with a header row containing at least:
//   parent_name, parent_email, kid_name, package_name
// Pass the path as an argument (default ./delete-list.csv).
//
// MATCHING (against status='active' memberships only):
//   key = normalized(parent_email) + '::' + normalized(kid_name)
//   normalize = lowercase, strip, replace U+00A0 (and other NBSP) with a normal
//   space, collapse whitespace. A sheet row that matches ZERO or MORE THAN ONE
//   active membership is NOT guessed — it is skipped and written to ambiguous.csv.
//
// STRIPE SAFETY: for a matched membership on a 'sub_' id, retrieve the subscription;
//   if Stripe says active/trialing, DO NOT deactivate — skip and report loudly.
//   'manual' / 'pi_' / null ids have nothing to check and proceed.
//
// OUTPUTS (always): deactivate-plan.csv (what would change), ambiguous.csv,
//   stripe-active-skips.csv, and (the rollback) deactivate-rollback.csv with each
//   touched id + its previous status.
//
// Run (bash):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node deactivate-from-list.mjs delete-list.csv          # dry run
//   ...add --apply to write.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import readline from 'readline';
import { readFileSync, writeFileSync } from 'fs';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!STRIPE_KEY || !SB_URL || !SB_KEY) {
  console.error('Missing env: STRIPE_SECRET_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const APPLY = process.argv.includes('--apply');
const CSV_PATH = process.argv.slice(2).find(a => a.toLowerCase().endsWith('.csv')) || 'delete-list.csv';

const stripe = new Stripe(STRIPE_KEY);
const supabase = createClient(SB_URL, SB_KEY);
const ACTIVE_STRIPE = new Set(['active', 'trialing']);

// Normalize for matching: NBSP → space, collapse whitespace, trim, lowercase.
const norm = (s) => (s == null ? '' : String(s))
  .replace(/[\u00a0\u2007\u202f\u200b\ufeff]/g, ' ')  // NBSP/narrow-NBSP/figure-space/zero-width/BOM
  .replace(/\s+/g, ' ').trim().toLowerCase();
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

// Minimal RFC-ish CSV parser (handles quotes, escaped quotes, commas, CRLF).
function parseCSV(text) {
  const rows = []; let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function confirm(q) {
  return new Promise(res => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res(a.trim().toLowerCase()); }); });
}

async function main() {
  // ── Load + parse the sheet ──
  let raw;
  try { raw = readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, ''); }
  catch (e) { console.error(`Could not read CSV "${CSV_PATH}": ${e.message}`); process.exit(1); }
  const table = parseCSV(raw).filter(r => r.some(c => (c || '').trim() !== ''));
  if (table.length < 2) { console.error('CSV has no data rows.'); process.exit(1); }
  const header = table[0].map(h => norm(h));
  const col = (name) => header.indexOf(name);
  const iEmail = col('parent_email'), iKid = col('kid_name'), iParent = col('parent_name'), iPkg = col('package_name');
  if (iEmail < 0 || iKid < 0) { console.error(`CSV must have parent_email and kid_name columns. Found: ${header.join(', ')}`); process.exit(1); }
  const sheet = table.slice(1).map(r => ({
    parent_name: iParent >= 0 ? r[iParent] : '', parent_email: r[iEmail], kid_name: r[iKid], package_name: iPkg >= 0 ? r[iPkg] : '',
  }));

  // ── Load active memberships + parent emails ──
  const mems = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('player_memberships')
      .select('id, parent_id, kid_name, package_name, status, stripe_payment_id')
      .eq('status', 'active').range(from, from + 999);
    if (error) { console.error('Supabase error:', error.message); process.exit(1); }
    mems.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const pids = [...new Set(mems.map(m => m.parent_id).filter(Boolean))];
  const emailByParent = new Map();
  for (let i = 0; i < pids.length; i += 200) {
    const { data: profs } = await supabase.from('profiles').select('id, email').in('id', pids.slice(i, i + 200));
    for (const p of (profs || [])) emailByParent.set(p.id, p.email);
  }

  // Index active memberships by normalized email::kid (a group may hold >1 → ambiguous).
  const byKey = new Map();
  for (const m of mems) {
    const email = emailByParent.get(m.parent_id);
    if (!email) continue;                          // no email → can't be matched from the sheet
    const key = `${norm(email)}::${norm(m.kid_name)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(m);
  }

  // ── Match each sheet row ──
  const plan = [], ambiguous = [], stripeActive = [];
  console.error(`\nMatching ${sheet.length} sheet row(s) against ${mems.length} active membership(s)...`);
  for (const row of sheet) {
    const key = `${norm(row.parent_email)}::${norm(row.kid_name)}`;
    const matches = byKey.get(key) || [];
    if (matches.length !== 1) {
      ambiguous.push({ row, count: matches.length, matched: matches.map(m => `${m.id} (${m.package_name}, ${m.stripe_payment_id || 'null'})`).join(' | ') });
      continue;
    }
    plan.push({ row, m: matches[0] });
  }

  // ── Stripe safety check for matched sub_ memberships ──
  const toDeactivate = [];
  let checked = 0;
  for (const p of plan) {
    const pid = p.m.stripe_payment_id || '';
    if (pid.startsWith('sub_')) {
      checked++;
      if (checked % 20 === 0) console.error(`  ...Stripe-checked ${checked}`);
      let st = 'retrieve_error';
      try { st = (await stripe.subscriptions.retrieve(pid)).status; } catch { st = 'retrieve_error'; }
      if (ACTIVE_STRIPE.has(st)) { stripeActive.push({ ...p, stripeStatus: st }); continue; }  // DO NOT deactivate
    }
    toDeactivate.push(p);   // manual / pi_ / null, or a sub_ that's not active in Stripe
  }

  // ── Write CSVs (always) ──
  const planRows = [['id', 'kid_name', 'parent_name', 'parent_email', 'sheet_package', 'membership_package', 'stripe_payment_id', 'current_status', 'new_status']];
  for (const p of toDeactivate) planRows.push([p.m.id, p.m.kid_name, p.row.parent_name, p.row.parent_email, p.row.package_name, p.m.package_name, p.m.stripe_payment_id, p.m.status, 'inactive']);
  writeFileSync('deactivate-plan.csv', '﻿' + planRows.map(r => r.map(csvCell).join(',')).join('\n') + '\n');
  // rollback = prior state of exactly the rows we will touch
  writeFileSync('deactivate-rollback.csv', '﻿' + [['id', 'kid_name', 'old_status'], ...toDeactivate.map(p => [p.m.id, p.m.kid_name, p.m.status])].map(r => r.map(csvCell).join(',')).join('\n') + '\n');
  writeFileSync('ambiguous.csv', '﻿' + [['parent_name', 'parent_email', 'kid_name', 'package_name', 'match_count', 'matched'], ...ambiguous.map(a => [a.row.parent_name, a.row.parent_email, a.row.kid_name, a.row.package_name, a.count, a.matched])].map(r => r.map(csvCell).join(',')).join('\n') + '\n');
  writeFileSync('stripe-active-skips.csv', '﻿' + [['id', 'kid_name', 'parent_email', 'stripe_payment_id', 'stripe_status'], ...stripeActive.map(s => [s.m.id, s.m.kid_name, s.row.parent_email, s.m.stripe_payment_id, s.stripeStatus])].map(r => r.map(csvCell).join(',')).join('\n') + '\n');

  // ── Report ──
  console.log('\n' + '='.repeat(104));
  console.log(`DEACTIVATION PLAN — status 'active' → 'inactive'${APPLY ? '' : '   [DRY RUN — no writes]'}`);
  console.log('='.repeat(104));
  for (const p of toDeactivate) {
    const pkgWarn = norm(p.row.package_name) && norm(p.row.package_name) !== norm(p.m.package_name) ? `  ⚠ sheet pkg "${p.row.package_name}" ≠ membership "${p.m.package_name}"` : '';
    console.log(`• ${p.m.kid_name}  |  ${p.row.parent_name || '—'}  |  ${p.row.parent_email}  |  ${p.m.package_name || '—'}  |  ${p.m.stripe_payment_id || 'null'}  |  ${p.m.status} → inactive${pkgWarn}`);
  }
  console.log('='.repeat(104));
  console.log(`Sheet rows:                 ${sheet.length}`);
  console.log(`Matched cleanly & to deactivate: ${toDeactivate.length}`);
  console.log(`Ambiguous (0 or >1 match):  ${ambiguous.length}   → ambiguous.csv`);
  console.log(`Skipped — Stripe says ACTIVE/trialing (owner marked delete): ${stripeActive.length}   → stripe-active-skips.csv`);
  if (stripeActive.length) {
    console.log(`\n⚠️  OWNER MARKED DELETE BUT STRIPE SAYS ACTIVE — ask before touching these:`);
    for (const s of stripeActive) console.log(`   · ${s.m.kid_name} (${s.row.parent_email}) — ${s.m.stripe_payment_id} — Stripe ${s.stripeStatus}`);
  }
  console.log(`\nCSVs written: deactivate-plan.csv, deactivate-rollback.csv, ambiguous.csv, stripe-active-skips.csv`);

  if (toDeactivate.length === 0) { console.log('\nNothing to deactivate. ✅'); process.exit(0); }
  if (!APPLY) { console.log('\nDRY RUN — no changes written. Review the CSVs, then re-run with --apply.'); process.exit(0); }

  const ans = await confirm(`\nDeactivate ${toDeactivate.length} membership(s) (status → inactive)? Type 'yes': `);
  if (ans !== 'yes') { console.log('Aborted — no changes written.'); process.exit(0); }

  console.log('\nApplying...');
  let ok = 0; const fails = [];
  for (const p of toDeactivate) {
    const { error } = await supabase.from('player_memberships')
      .update({ status: 'inactive' })
      .eq('id', p.m.id).eq('status', 'active');   // guard: only flip if still active
    if (error) { fails.push(`${p.m.kid_name}: ${error.message}`); console.error(`  ✗ ${p.m.kid_name}: ${error.message}`); }
    else { ok++; console.log(`  ✓ ${p.m.kid_name} → inactive`); }
  }
  console.log(`\nDone. ${ok}/${toDeactivate.length} deactivated.${fails.length ? ` ${fails.length} failed.` : ''}`);
  console.log(`Rollback: deactivate-rollback.csv → update player_memberships set status='active' where id in (<ids>).`);
}

main().catch(e => { console.error(e); process.exit(1); });
