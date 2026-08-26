// ============================================================
// TORQUE PERFORMANCE — Rescue Stripe-CONFIRMED-ACTIVE members who are BLOCKED
//
// Target: they genuinely pay (Stripe subscription is active/trialing RIGHT NOW)
// but can't book (sessions_total = 0 OR expires_at in the past). Lost revenue.
//
// STRICT SAFETY: Stripe is checked FIRST. Only subscriptions whose live status is
// 'active' or 'trialing' are ever considered. Everything else — canceled, past_due,
// paused, unpaid, incomplete, retrieve errors — is SKIPPED and only counted. So the
// 4 past_due and 3 paused accounts (and all stale/canceled subs) are never touched.
//
// For each blocked-but-paying membership it restores from Stripe (source of truth):
//     sessions_total = package amount (from the Stripe PRICE; package_name fallback)
//     sessions_used  = 0
//     expires_at     = current_period_end   (paid-through date)
//     purchased_at   = current_period_start (start of the paid period)
//
// Already-correct rows (active sub, sessions_total > 0 AND future expires_at) are
// skipped — nothing to do.
//
// READ-THEN-CONFIRM: DRY RUN by default (prints the plan, writes nothing).
// Pass --apply to write; it still prints the full plan and waits for "yes".
//
// Run (bash):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node rescue-active-blocked.mjs
//   ...same, add --apply to write.
// Run (PowerShell): set the three $env vars, then: node rescue-active-blocked.mjs [--apply]
// ============================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import readline from 'readline';

const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!STRIPE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env: need STRIPE_SECRET_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const APPLY = process.argv.includes('--apply');

// Case (c): a genuine NEW billing cycle advances the paid-through date by ~1 month.
// Require Stripe's current_period_end to be at least this far beyond the stored
// expires_at so a 1–2 day date skew within the SAME cycle never counts as a renewal.
const NEW_CYCLE_MARGIN_MS = 20 * 86400000;   // 20 days

const stripe   = new Stripe(STRIPE_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const dayOf = (iso) => (iso || '').split('T')[0];

// Sessions per Stripe price id (mirrors api/stripe-webhook.js). Primary source.
const PRICE_SESSIONS = {
  'price_1Tk92RAPTWbxe0YyE8zgXLet': 4, 'price_1TLqDdAPTWbxe0YytEOlF7ZH': 4,
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': 4, 'price_1TLqDmAPTWbxe0YysigUumPn': 4, 'price_1TLqDlAPTWbxe0YyljY5WD6Y': 4,
  'price_1Tk92RAPTWbxe0Yy4zaPZkvx': 8, 'price_1TLqDgAPTWbxe0Yy7yaP3VX3': 8,
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': 8, 'price_1TLqDjAPTWbxe0YyTsqaUdt5': 8, 'price_1TLqDkAPTWbxe0YykcsrB50f': 8,
  'price_1Tk92RAPTWbxe0YyM8hl6j9s': 12, 'price_1TLqDhAPTWbxe0YyXXJQZrh7': 12,
  'price_1TLqDkAPTWbxe0YydXEB3YqT': 12, 'price_1TLqDjAPTWbxe0YyuyUujCu4': 12, 'price_1TLqDkAPTWbxe0Yy8UHtMvEJ': 12,
  'price_1Tk92SAPTWbxe0YyRaxsup9N': 20, 'price_1TLqDdAPTWbxe0YydO64XMLw': 20,
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': 20, 'price_1TLqDjAPTWbxe0YyVQxRaHFs': 20, 'price_1TLqDjAPTWbxe0Yy6fRLwlFM': 20,
};
const PACKAGE_SESSIONS = { 'A': 4, 'Package A': 4, 'AA': 8, 'Package AA': 8, 'AAA': 12, 'Package AAA': 12, 'MLB': 20, 'Package MLB': 20 };

// MANUAL-OVERRIDE EXCLUSIONS — never touched, regardless of Stripe state.
// Keyed by stripe_payment_id OR membership id. Add special manual cases here.
const EXCLUDE = new Set([
  'sub_1Tgdy2APTWbxe0Yy349NP64h',  // Oscar — manual MLB→AA downgrade; leave exactly as-is.
]);

function confirm(q) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res(a.trim().toLowerCase()); });
  });
}

async function main() {
  const now = Date.now();

  // 1) All active autopay memberships (paginated).
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('player_memberships')
      .select('id, kid_name, parent_id, package_name, sessions_total, sessions_used, expires_at, purchased_at, stripe_payment_id')
      .eq('status', 'active').like('stripe_payment_id', 'sub_%')
      .range(from, from + 999);
    if (error) { console.error('Supabase error:', error.message); process.exit(1); }
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  console.error(`\nLoaded ${rows.length} active sub_ membership(s). Checking each against Stripe (read-only)...`);

  // Parent emails for display.
  const pids = [...new Set(rows.map(r => r.parent_id).filter(Boolean))];
  const emailById = new Map();
  for (let i = 0; i < pids.length; i += 200) {
    const { data: profs } = await supabase.from('profiles').select('id, email').in('id', pids.slice(i, i + 200));
    for (const p of (profs || [])) emailById.set(p.id, p.email);
  }

  const rescue = [], excluded = [], needsManual = [], usedUpCurrent = [];
  const skip = { notActive: 0, alreadyOk: 0, noPeriod: 0, retrieveErr: 0 };
  const notActiveByStatus = {};

  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    if ((i + 1) % 20 === 0) console.error(`  ...${i + 1}/${rows.length}`);

    if (EXCLUDE.has(m.stripe_payment_id) || EXCLUDE.has(m.id)) { excluded.push(m); continue; }

    let sub;
    try { sub = await stripe.subscriptions.retrieve(m.stripe_payment_id); }
    catch (e) { skip.retrieveErr++; continue; }

    // 2) ONLY active/trialing survive. Everything else is left untouched.
    if (sub.status !== 'active' && sub.status !== 'trialing') {
      skip.notActive++; notActiveByStatus[sub.status] = (notActiveByStatus[sub.status] || 0) + 1;
      continue;
    }

    // Period info from Stripe — needed both for case (c) detection and for restore.
    const cpeMs = sub.current_period_end   ? sub.current_period_end   * 1000 : 0;
    const cpsMs = sub.current_period_start ? sub.current_period_start * 1000 : 0;

    // 3) Blocked? (a) sessions_total=0, (b) expired date, or
    //    (c) 0 remaining AND in a NEW paid period the DB hasn't reflected.
    const zero    = (m.sessions_total || 0) === 0;
    const expired = !!(m.expires_at && Date.parse(m.expires_at) < now);
    const usedUp  = (m.sessions_total || 0) > 0 && (m.sessions_used || 0) >= (m.sessions_total || 0);
    // SAFEGUARD for (c): a genuine NEW cycle means Stripe's paid-through date
    // (current_period_end) is WELL beyond the app's recorded expires_at — a full
    // renewal (~+1 month). Comparing period END vs stored expires_at with a margin
    // is robust against the 1–2 day date skew that a period_start comparison tripped on.
    const newPeriod = !!(cpeMs && m.expires_at && cpeMs > Date.parse(m.expires_at) + NEW_CYCLE_MARGIN_MS);
    const caseC     = usedUp && newPeriod;

    // Out of sessions within the CURRENT paid period (no new cycle) → normal usage. Don't rescue; list it.
    if (usedUp && !newPeriod && !zero && !expired) {
      usedUpCurrent.push({ ...m, email: emailById.get(m.parent_id) || '—',
        cps: cpsMs ? dayOf(new Date(cpsMs).toISOString()) : '—',
        cpe: cpeMs ? dayOf(new Date(cpeMs).toISOString()) : '—' });
      continue;
    }

    const cases = [];
    if (zero)    cases.push('a:sessions=0');
    if (expired) cases.push('b:expired');
    if (caseC)   cases.push('c:new-period-used-up');
    if (cases.length === 0) { skip.alreadyOk++; continue; }   // 7) already correct → skip

    // 4) Restore values from Stripe.
    if (!cpeMs) { skip.noPeriod++; continue; }
    const priceId  = sub.items?.data?.[0]?.price?.id;
    const sessions = PRICE_SESSIONS[priceId] ?? PACKAGE_SESSIONS[m.package_name] ?? null;
    if (!sessions) { needsManual.push({ ...m, reason: `unknown package (price ${priceId || '—'}, name '${m.package_name || '—'}')` }); continue; }

    rescue.push({
      ...m, email: emailById.get(m.parent_id) || '—', stripeStatus: sub.status, priceId,
      newSessionsTotal: sessions,
      newExpires: new Date(cpeMs).toISOString(),
      newPurchased: cpsMs ? new Date(cpsMs).toISOString() : m.purchased_at,
      cases: cases.join(' + '),
    });
  }

  // ── Plan ──
  console.log('\n' + '='.repeat(112));
  console.log(`RESCUE PLAN — ${rescue.length} Stripe-active member(s) currently BLOCKED${APPLY ? '' : '   [DRY RUN — no writes]'}`);
  console.log('='.repeat(112));
  for (const p of rescue) {
    console.log(
      `• ${p.kid_name}  |  ${p.email}  |  ${p.package_name || '—'}  |  Stripe ${p.stripeStatus}  |  CASE ${p.cases}\n` +
      `    sub ${p.stripe_payment_id}  (price ${p.priceId || '—'})\n` +
      `    sessions:    ${p.sessions_used}/${p.sessions_total}  →  0/${p.newSessionsTotal}\n` +
      `    expires_at:  ${dayOf(p.expires_at)}  →  ${dayOf(p.newExpires)}\n` +
      `    purchased_at:${dayOf(p.purchased_at)}  →  ${dayOf(p.newPurchased)}`
    );
  }
  console.log('='.repeat(112));
  const byCase = rescue.reduce((a, p) => { a[p.cases] = (a[p.cases] || 0) + 1; return a; }, {});
  console.log(`To rescue: ${rescue.length}  ${JSON.stringify(byCase)}`);
  console.log(`Skipped — not active/trialing in Stripe: ${skip.notActive}  ${JSON.stringify(notActiveByStatus)}`);
  console.log(`Skipped — already correct (sessions + future date): ${skip.alreadyOk}`);
  console.log(`NOT rescued — used-up-current-period (0 left, same paid cycle, normal usage): ${usedUpCurrent.length}`);
  for (const u of usedUpCurrent) {
    console.log(`  · ${u.kid_name}  |  ${u.email}  |  ${u.sessions_used}/${u.sessions_total}  |  Stripe period ${u.cps}→${u.cpe}  vs  stored expires ${dayOf(u.expires_at)} / purchased ${dayOf(u.purchased_at)}`);
  }
  console.log(`Skipped — excluded (manual override): ${excluded.length}${excluded.length ? '  → ' + excluded.map(e => `${e.kid_name} (${e.stripe_payment_id})`).join(', ') : ''}`);
  if (skip.noPeriod)    console.log(`Skipped — active but no current_period_end: ${skip.noPeriod}`);
  if (skip.retrieveErr) console.log(`Skipped — Stripe retrieve error: ${skip.retrieveErr}`);
  if (needsManual.length) {
    console.log(`\nNeeds manual review (active + blocked but unknown package — NOT rescued):`);
    for (const n of needsManual) console.log(`  · ${n.kid_name} (${n.stripe_payment_id}) — ${n.reason}`);
  }

  if (rescue.length === 0) { console.log('\nNothing to rescue. ✅'); process.exit(0); }
  if (!APPLY) { console.log('\nDRY RUN — no changes written. Re-run with --apply to restore these members.'); process.exit(0); }

  const ans = await confirm(`\nRestore these ${rescue.length} member(s)? Type 'yes' to write: `);
  if (ans !== 'yes') { console.log('Aborted — no changes written.'); process.exit(0); }

  console.log('\nApplying...');
  let ok = 0; const fails = [];
  for (const p of rescue) {
    const { error } = await supabase.from('player_memberships')
      .update({ sessions_total: p.newSessionsTotal, sessions_used: 0, expires_at: p.newExpires, purchased_at: p.newPurchased })
      .eq('id', p.id);
    if (error) { fails.push(`${p.kid_name}: ${error.message}`); console.error(`  ✗ ${p.kid_name}: ${error.message}`); }
    else { ok++; console.log(`  ✓ ${p.kid_name} → 0/${p.newSessionsTotal}, expires ${dayOf(p.newExpires)}`); }
  }
  console.log(`\nDone. ${ok}/${rescue.length} restored.${fails.length ? ` ${fails.length} failed (see above).` : ''}`);
}

main().catch(e => { console.error(e); process.exit(1); });
