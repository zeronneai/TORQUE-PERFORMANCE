// ============================================================
// TORQUE PERFORMANCE — Rescue members whose sessions were zeroed by Task B
//
// Context: while the daily cron ran a stale build (no Task D safety net), Task B
// zeroed sessions of active autopay members whose renewal webhook was missed.
// This restores those victims from Stripe — the SOURCE OF TRUTH — setting both
// sessions AND dates so they can book again.
//
// Target rows: status='active', stripe_payment_id like 'sub_%', expires_at in the
// past, AND (sessions_total = 0 OR sessions_used >= sessions_total).
//
// For each, it retrieves the Stripe subscription. If the sub is active/trialing
// AND current_period_end is in the FUTURE (they've paid through a future date),
// it's a victim and we restore:
//     sessions_total = package amount (from the Stripe PRICE, package_name fallback)
//     sessions_used  = 0
//     expires_at     = current_period_end   (paid-through date)
//     purchased_at   = current_period_start (start of the paid period)
//
// EDGE CASE handled: the session restore is keyed off the Stripe state (active +
// future period), NOT off any purchased_at comparison — so members whose
// purchased_at was already advanced are still restored. No victim is missed.
//
// Rows whose sub is cancelled/unpaid, or whose current_period_end is NOT in the
// future, are left untouched (genuinely expired) and reported as skipped.
//
// READ-THEN-CONFIRM: dry-run by default (prints the plan, writes nothing).
// Pass --apply to write; it still prints the full plan and waits for "yes".
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   $env:VITE_SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   node rescue-zeroed-members.mjs            # dry run (safe)
//   node rescue-zeroed-members.mjs --apply    # writes after you type "yes"
//
// Run (bash):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node rescue-zeroed-members.mjs --apply
// ============================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import readline from 'readline';

const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_KEY)   { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }
if (!SUPABASE_URL) { console.error('Missing VITE_SUPABASE_URL'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const APPLY = process.argv.includes('--apply');

const stripe   = new Stripe(STRIPE_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const dayOf = (iso) => (iso || '').split('T')[0];

// Primary source of truth: Stripe price id -> sessions (mirrors api/stripe-webhook.js).
const PRICE_SESSIONS = {
  // Package A (4)
  'price_1Tk92RAPTWbxe0YyE8zgXLet': 4, 'price_1TLqDdAPTWbxe0YytEOlF7ZH': 4,
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': 4, 'price_1TLqDmAPTWbxe0YysigUumPn': 4,
  'price_1TLqDlAPTWbxe0YyljY5WD6Y': 4,
  // Package AA (8)
  'price_1Tk92RAPTWbxe0Yy4zaPZkvx': 8, 'price_1TLqDgAPTWbxe0Yy7yaP3VX3': 8,
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': 8, 'price_1TLqDjAPTWbxe0YyTsqaUdt5': 8,
  'price_1TLqDkAPTWbxe0YykcsrB50f': 8,
  // Package AAA (12)
  'price_1Tk92RAPTWbxe0YyM8hl6j9s': 12, 'price_1TLqDhAPTWbxe0YyXXJQZrh7': 12,
  'price_1TLqDkAPTWbxe0YydXEB3YqT': 12, 'price_1TLqDjAPTWbxe0YyuyUujCu4': 12,
  'price_1TLqDkAPTWbxe0Yy8UHtMvEJ': 12,
  // Package MLB (20)
  'price_1Tk92SAPTWbxe0YyRaxsup9N': 20, 'price_1TLqDdAPTWbxe0YydO64XMLw': 20,
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': 20, 'price_1TLqDjAPTWbxe0YyVQxRaHFs': 20,
  'price_1TLqDjAPTWbxe0Yy6fRLwlFM': 20,
};

// Fallback: package_name -> sessions (used only if the Stripe price isn't in the map above).
const PACKAGE_SESSIONS = {
  'A': 4,  'Package A': 4,
  'AA': 8, 'Package AA': 8,
  'AAA': 12, 'Package AAA': 12,
  'MLB': 20, 'Package MLB': 20,
};

// MANUAL-OVERRIDE EXCLUSIONS — never touched, regardless of Stripe state.
// Keyed by stripe_payment_id OR membership id. These reflect deliberate manual
// arrangements that must NOT be overwritten by an automated Stripe-based restore.
const EXCLUDE = new Set([
  'sub_1Tgdy2APTWbxe0Yy349NP64h',  // Oscar — manual MLB→AA downgrade (total 8 / used 6, expires 2026-08-18). Stripe still shows MLB, so an auto-restore would wrongly give 8 fresh sessions + a Sep date. Leave as-is.
]);

function confirm(question) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); res(ans.trim().toLowerCase()); });
  });
}

async function main() {
  const nowISO = new Date().toISOString();

  // Active autopay memberships with a PAST expires_at.
  const { data: rows, error } = await supabase
    .from('player_memberships')
    .select('id, kid_name, parent_id, package_name, sessions_total, sessions_used, expires_at, purchased_at, stripe_payment_id')
    .eq('status', 'active')
    .like('stripe_payment_id', 'sub_%')
    .lt('expires_at', nowISO);

  if (error) { console.error('Supabase select error:', error.message); process.exit(1); }

  // Keep only the "zeroed OR used-up" rows — the Task B victim signature.
  const candidates = (rows || []).filter(m =>
    (m.sessions_total || 0) === 0 || (m.sessions_used || 0) >= (m.sessions_total || 0)
  );

  if (candidates.length === 0) {
    console.log('\nNo expired autopay members with zeroed/used-up sessions found. Nothing to do. ✅');
    process.exit(0);
  }

  // Parent emails for display.
  const parentIds = [...new Set(candidates.map(m => m.parent_id).filter(Boolean))];
  const emailById = new Map();
  for (let i = 0; i < parentIds.length; i += 200) {
    const { data: profs } = await supabase.from('profiles').select('id, email').in('id', parentIds.slice(i, i + 200));
    for (const p of (profs || [])) emailById.set(p.id, p.email);
  }

  console.error(`\nChecking ${candidates.length} candidate(s) against Stripe...`);
  const rescue = [];     // rows we will restore
  const skipped = [];    // rows left untouched, with a reason
  const excluded = [];   // rows on the manual-override list — never touched

  for (const m of candidates) {
    // Manual-override list wins over everything — skip before touching Stripe.
    if (EXCLUDE.has(m.stripe_payment_id) || EXCLUDE.has(m.id)) { excluded.push(m); continue; }

    let sub = null;
    try {
      sub = await stripe.subscriptions.retrieve(m.stripe_payment_id);
    } catch (e) {
      skipped.push({ ...m, reason: `Stripe retrieve failed: ${e.message.slice(0, 50)}` });
      continue;
    }

    const active = sub && (sub.status === 'active' || sub.status === 'trialing');
    const cpeMs  = sub?.current_period_end   ? sub.current_period_end   * 1000 : 0;
    const cpsMs  = sub?.current_period_start ? sub.current_period_start * 1000 : 0;

    // Rescue ONLY if the sub is active AND paid through a future date.
    if (!active) { skipped.push({ ...m, reason: `sub status '${sub?.status || 'unknown'}' (not active)` }); continue; }
    if (!(cpeMs > Date.now())) { skipped.push({ ...m, reason: `current_period_end not in future (${dayOf(new Date(cpeMs).toISOString())})` }); continue; }

    // Sessions: prefer the current Stripe price, fall back to package_name.
    const priceId  = sub.items?.data?.[0]?.price?.id;
    const sessions = PRICE_SESSIONS[priceId] ?? PACKAGE_SESSIONS[m.package_name] ?? null;
    if (!sessions) {
      skipped.push({ ...m, reason: `unknown package (price ${priceId || '—'}, package_name '${m.package_name || '—'}') — restore manually` });
      continue;
    }

    rescue.push({
      ...m,
      email: emailById.get(m.parent_id) || '—',
      newSessionsTotal: sessions,
      newExpires: new Date(cpeMs).toISOString(),
      newPurchased: cpsMs ? new Date(cpsMs).toISOString() : m.purchased_at,
      priceId,
    });
  }

  // ── Print plan ──
  console.log('\n' + '='.repeat(110));
  console.log(`RESCUE PLAN — ${rescue.length} victim(s) to restore${APPLY ? '' : '   [DRY RUN — no writes]'}`);
  console.log('='.repeat(110));
  for (const p of rescue) {
    console.log(
      `• ${p.kid_name}  |  ${p.email}  |  ${p.package_name || '—'}\n` +
      `    sub ${p.stripe_payment_id}  (price ${p.priceId || '—'})\n` +
      `    sessions:    ${p.sessions_used}/${p.sessions_total}  →  0/${p.newSessionsTotal}\n` +
      `    expires_at:  ${dayOf(p.expires_at)}  →  ${dayOf(p.newExpires)}\n` +
      `    purchased_at:${dayOf(p.purchased_at)}  →  ${dayOf(p.newPurchased)}`
    );
  }
  console.log('='.repeat(110));
  console.log(`${rescue.length} to restore, ${skipped.length} skipped, ${excluded.length} excluded (manual override).`);

  if (excluded.length) {
    console.log('\nExcluded (manual override — left EXACTLY as-is):');
    for (const e of excluded) console.log(`  · ${e.kid_name} (${e.stripe_payment_id}) — sessions ${e.sessions_used}/${e.sessions_total}, expires ${dayOf(e.expires_at)} [UNCHANGED]`);
  }

  if (skipped.length) {
    console.log('\nSkipped (NOT modified) — review manually if any look wrong:');
    for (const s of skipped) console.log(`  · ${s.kid_name} (${s.stripe_payment_id}) — ${s.reason}`);
  }

  if (rescue.length === 0) { console.log('\nNothing to restore. ✅'); process.exit(0); }

  if (!APPLY) {
    console.log('\nDRY RUN — no changes written. Re-run with --apply to restore these members.');
    process.exit(0);
  }

  const ans = await confirm(`\nRestore these ${rescue.length} member(s)? Type 'yes' to write: `);
  if (ans !== 'yes') { console.log('Aborted — no changes written.'); process.exit(0); }

  console.log('\nApplying...');
  let ok = 0; const failures = [];
  for (const p of rescue) {
    const { error: upErr } = await supabase
      .from('player_memberships')
      .update({
        sessions_total: p.newSessionsTotal,
        sessions_used:  0,
        expires_at:     p.newExpires,
        purchased_at:   p.newPurchased,
      })
      .eq('id', p.id);
    if (upErr) { failures.push(`${p.kid_name}: ${upErr.message}`); console.error(`  ✗ ${p.kid_name}: ${upErr.message}`); }
    else { ok++; console.log(`  ✓ ${p.kid_name} → 0/${p.newSessionsTotal}, expires ${dayOf(p.newExpires)}`); }
  }
  console.log(`\nDone. ${ok}/${rescue.length} restored.${failures.length ? ` ${failures.length} failed (see above).` : ''}`);
}

main().catch(err => { console.error(err); process.exit(1); });
