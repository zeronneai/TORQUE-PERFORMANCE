// ============================================================
// TORQUE PERFORMANCE — Deactivate CONFIRMED-CANCELED memberships (read-then-confirm)
//
// Flips status 'active' → 'inactive' for memberships whose Stripe subscription is
// CANCELED, so they stop counting as active members. Changes ONLY the status field —
// never sessions, dates, or anything else.
//
// Why 'inactive': the app counts active members strictly by status='active', and its
// STATUS color map defines 'inactive' (not 'canceled'), so Families etc. render it
// correctly. Everything non-'active' drops out of active counts/booking.
//
// SCOPE (who gets deactivated):
//   • Any active sub_ membership whose LIVE Stripe status is exactly 'canceled'
//     (this is the audit's canceled set, re-verified live at run time).
//   • Plus two owner-confirmed subs by id (FORCE_DEACTIVATE) — Sergio, Markus.
//
// NEVER deactivated:
//   • Anyone Stripe now reports active/trialing (e.g. resubscribed) — SKIPPED + reported,
//     even the FORCE ones (reported as CONFLICT for you to re-confirm).
//   • Explicit EXCLUDE_SUBS / EXCLUDE_NAMES (Rex-paused, the past_due folks, Jacob-mixup).
//     past_due/paused are already out of scope (status must be 'canceled'); the name
//     guard is a belt-and-suspenders that ALWAYS reports what it skipped.
//
// SAFETY: re-checks Stripe live right before each change; writes a rollback CSV of the
// prior state (id, old status, sessions, expires_at) before applying.
//
// DRY RUN by default (no writes). Pass --apply to write (asks 'yes' first).
//
// Run (bash):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node deactivate-canceled.mjs
//   ...add --apply to write.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import readline from 'readline';
import { writeFileSync } from 'fs';

const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!STRIPE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env: need STRIPE_SECRET_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const APPLY = process.argv.includes('--apply');
const NEW_STATUS = 'inactive';

const stripe   = new Stripe(STRIPE_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const dayOf = (iso) => (iso || '').split('T')[0];
const ACTIVE = new Set(['active', 'trialing']);

// Owner-confirmed canceled — deactivate by sub id (unless Stripe now says active).
const FORCE_DEACTIVATE = new Set([
  'sub_1TfR5cAPTWbxe0YyK7kogyRD',  // Sergio Moreno
  'sub_1TiLqPAPTWbxe0YymDhqJ1t6',  // Markus Gutierrez
]);
// Never touch — by sub id.
const EXCLUDE_SUBS = new Set([
  'sub_1TgdPrAPTWbxe0Yy1XqHnUgj',  // Rex Arellano — paused on purpose
]);
// Never touch — by name (belt-and-suspenders; matched in kid_name + parent_name).
const EXCLUDE_NAMES = [
  'joseph saucedo', 'grayson franco', 'brandon muniz', 'rex arellano',
  'jacob', 'christopher rodriguez', 'arturo rodriguez',
];

const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function confirm(q) {
  return new Promise(res => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res(a.trim().toLowerCase()); }); });
}

async function main() {
  // 1) All active autopay memberships.
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('player_memberships')
      .select('id, kid_name, parent_id, package_name, sessions_total, sessions_used, expires_at, status, stripe_payment_id')
      .eq('status', 'active').like('stripe_payment_id', 'sub_%')
      .range(from, from + 999);
    if (error) { console.error('Supabase error:', error.message); process.exit(1); }
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  // parent names for exclusion + report
  const pids = [...new Set(rows.map(r => r.parent_id).filter(Boolean))];
  const nameById = new Map();
  for (let i = 0; i < pids.length; i += 200) {
    const { data: pf } = await supabase.from('profiles').select('id, full_name').in('id', pids.slice(i, i + 200));
    for (const p of (pf || [])) nameById.set(p.id, p.full_name || '');
  }

  console.error(`\nLoaded ${rows.length} active sub_ membership(s). Re-checking Stripe live...`);
  const plan = [], skipped = [], excluded = [], conflicts = [];

  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    if ((i + 1) % 20 === 0) console.error(`  ...${i + 1}/${rows.length}`);
    const parentName = nameById.get(m.parent_id) || '';
    const hay = `${m.kid_name || ''} ${parentName}`.toLowerCase();

    // Hard excludes (by id or name) — always reported, never touched.
    if (EXCLUDE_SUBS.has(m.stripe_payment_id) || EXCLUDE_NAMES.some(n => hay.includes(n))) {
      excluded.push({ ...m, parentName, reason: EXCLUDE_SUBS.has(m.stripe_payment_id) ? 'excluded sub id' : 'excluded name' });
      continue;
    }

    const isForce = FORCE_DEACTIVATE.has(m.stripe_payment_id);

    // Live Stripe re-check right before deciding.
    let st = 'retrieve_error';
    try { st = (await stripe.subscriptions.retrieve(m.stripe_payment_id)).status; } catch { st = 'retrieve_error'; }

    // NEVER deactivate someone Stripe now says is active/trialing.
    if (ACTIVE.has(st)) {
      if (isForce) conflicts.push({ ...m, parentName, st });   // owner said canceled but Stripe active
      else skipped.push({ ...m, parentName, st, why: 'active in Stripe' });
      continue;
    }

    // In scope? canceled (the audit set) OR a FORCE sub that isn't active.
    if (st === 'canceled' || isForce) {
      plan.push({ ...m, parentName, st, forced: isForce });
    } else {
      skipped.push({ ...m, parentName, st, why: 'not canceled / out of scope' });
    }
  }

  // 2) Rollback snapshot (prior state) — written in BOTH modes for review/restore.
  const rbCols = ['id', 'kid_name', 'parent_name', 'sub_id', 'stripe_status', 'old_status', 'new_status', 'sessions_total', 'sessions_used', 'expires_at'];
  const rbRows = plan.map(p => [p.id, p.kid_name, p.parentName, p.stripe_payment_id, p.st, p.status, NEW_STATUS, p.sessions_total, p.sessions_used, dayOf(p.expires_at)]);
  writeFileSync('deactivate-rollback.csv', '﻿' + rbCols.join(',') + '\n' + rbRows.map(r => r.map(csvCell).join(',')).join('\n') + '\n');

  // 3) Print plan.
  console.log('\n' + '='.repeat(104));
  console.log(`DEACTIVATE PLAN — ${plan.length} membership(s): status '${plan.length ? "active" : "-"}' → '${NEW_STATUS}'${APPLY ? '' : '   [DRY RUN — no writes]'}`);
  console.log('='.repeat(104));
  for (const p of plan) {
    console.log(`• ${p.kid_name}  |  ${p.parentName || '(no name)'}  |  ${p.package_name || '—'}  |  Stripe ${p.st}${p.forced ? '  [FORCE by sub id]' : ''}`);
    console.log(`    ${p.stripe_payment_id}  |  active → ${NEW_STATUS}  |  (sessions ${p.sessions_used}/${p.sessions_total}, expires ${dayOf(p.expires_at)} — UNCHANGED)`);
  }
  console.log('='.repeat(104));
  console.log(`To deactivate: ${plan.length}  (canceled: ${plan.filter(p => !p.forced || p.st === 'canceled').length}, forced: ${plan.filter(p => p.forced).length})`);
  console.log(`Rollback snapshot written: deactivate-rollback.csv  (restore with: update player_memberships set status=old_status where id=<id>)`);

  if (conflicts.length) {
    console.log(`\n⚠️  CONFLICTS — owner said canceled but Stripe now says ACTIVE (NOT deactivated, re-confirm):`);
    for (const c of conflicts) console.log(`  · ${c.kid_name} (${c.parentName}) ${c.stripe_payment_id} — Stripe ${c.st}`);
  }
  if (excluded.length) {
    console.log(`\nExcluded (DO NOT TOUCH list) — ${excluded.length}:`);
    for (const e of excluded) console.log(`  · ${e.kid_name} (${e.parentName}) ${e.stripe_payment_id} — ${e.reason}`);
  }
  // Group the non-canceled skips by Stripe status for a quick sanity check.
  const skipByStatus = skipped.reduce((a, s) => { a[s.st] = (a[s.st] || 0) + 1; return a; }, {});
  console.log(`\nSkipped (not in scope): ${skipped.length}  ${JSON.stringify(skipByStatus)}`);

  if (plan.length === 0) { console.log('\nNothing to deactivate. ✅'); process.exit(0); }
  if (!APPLY) { console.log('\nDRY RUN — no changes written. Review deactivate-rollback.csv, then re-run with --apply.'); process.exit(0); }

  const ans = await confirm(`\nDeactivate these ${plan.length} membership(s)? Type 'yes' to write: `);
  if (ans !== 'yes') { console.log('Aborted — no changes written.'); process.exit(0); }

  console.log('\nApplying (status only)...');
  let ok = 0; const fails = [];
  for (const p of plan) {
    const { error } = await supabase.from('player_memberships')
      .update({ status: NEW_STATUS })          // ONLY the status field
      .eq('id', p.id).eq('status', 'active');  // guard: only flip if still active
    if (error) { fails.push(`${p.kid_name}: ${error.message}`); console.error(`  ✗ ${p.kid_name}: ${error.message}`); }
    else { ok++; console.log(`  ✓ ${p.kid_name} → ${NEW_STATUS}`); }
  }
  console.log(`\nDone. ${ok}/${plan.length} deactivated.${fails.length ? ` ${fails.length} failed (see above).` : ''}`);
  console.log(`Rollback: deactivate-rollback.csv  →  update player_memberships set status='active' where id in (...).`);
}

main().catch(e => { console.error(e); process.exit(1); });
