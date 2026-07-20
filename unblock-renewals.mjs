// ============================================================
// TORQUE PERFORMANCE — Immediate unblock for lapsed recurring members
// READ-THEN-CONFIRM. Finds active autopay (sub_) memberships that still have
// usable sessions but whose expires_at is in the past (renewal webhook didn't
// push the date) and moves expires_at forward so booking works again.
//
// ONLY updates expires_at. Never touches sessions, status, or anything else.
//
// New expires_at per row:
//   1) Stripe subscription.current_period_end  — if the lookup succeeds AND it's
//      in the future (what they actually paid through). Labeled "stripe-cpe".
//   2) fallback greatest(now, purchased_at) + 1 month — if the Stripe lookup
//      fails OR its current_period_end is itself in the past. Labeled "fallback".
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   $env:VITE_SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   node unblock-renewals.mjs
//
// Run (bash):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node unblock-renewals.mjs
//
// It prints the full plan and WAITS for you to type "yes" before writing.
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

const stripe   = new Stripe(STRIPE_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const dayOf = (iso) => (iso || '').split('T')[0];

function fallbackExpires(purchasedAt) {
  // greatest(now, purchased_at) + 1 month
  const base = Math.max(Date.now(), purchasedAt ? Date.parse(purchasedAt) : 0);
  const d = new Date(base);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function confirm(question) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); res(ans.trim().toLowerCase()); });
  });
}

async function main() {
  const nowISO = new Date().toISOString();

  // Active autopay memberships with a PAST expires_at (candidates).
  const { data: rows, error } = await supabase
    .from('player_memberships')
    .select('id, kid_name, parent_id, sessions_total, sessions_used, expires_at, purchased_at, stripe_payment_id')
    .eq('status', 'active')
    .like('stripe_payment_id', 'sub_%')
    .lte('expires_at', nowISO);

  if (error) { console.error('Supabase select error:', error.message); process.exit(1); }

  // Only those that still have usable sessions.
  const affected = (rows || []).filter(m => (m.sessions_total || 0) > (m.sessions_used || 0) && m.expires_at);

  if (affected.length === 0) {
    console.log('\nNo lapsed autopay members with usable sessions found. Nothing to do. ✅');
    process.exit(0);
  }

  // Parent emails for display.
  const parentIds = [...new Set(affected.map(m => m.parent_id).filter(Boolean))];
  const emailById = new Map();
  for (let i = 0; i < parentIds.length; i += 200) {
    const { data: profs } = await supabase.from('profiles').select('id, email').in('id', parentIds.slice(i, i + 200));
    for (const p of (profs || [])) emailById.set(p.id, p.email);
  }

  // Compute new expires_at per row (Stripe current_period_end preferred).
  console.error(`\nResolving ${affected.length} subscription period(s) from Stripe...`);
  const plan = [];
  for (const m of affected) {
    let newExpires = null, method = '';
    try {
      const sub = await stripe.subscriptions.retrieve(m.stripe_payment_id);
      const cpe = sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
      if (cpe && Date.parse(cpe) > Date.now()) { newExpires = cpe; method = 'stripe-cpe'; }
      else { newExpires = fallbackExpires(m.purchased_at); method = cpe ? 'fallback (cpe was past)' : 'fallback (no cpe)'; }
    } catch (e) {
      newExpires = fallbackExpires(m.purchased_at);
      method = `fallback (stripe error: ${e.message.slice(0, 40)})`;
    }
    plan.push({ ...m, email: emailById.get(m.parent_id) || '—', newExpires, method });
  }

  // ── Print plan ──
  console.log('\n' + '='.repeat(104));
  console.log(`UNBLOCK PLAN — ${plan.length} membership(s) (only expires_at will change)`);
  console.log('='.repeat(104));
  for (const p of plan) {
    console.log(
      `• ${p.kid_name}  |  ${p.email}  |  sessions ${p.sessions_used}/${p.sessions_total}\n` +
      `    sub ${p.stripe_payment_id}\n` +
      `    expires_at:  ${dayOf(p.expires_at)}  →  ${dayOf(p.newExpires)}   [${p.method}]`
    );
  }
  console.log('='.repeat(104));
  const stripeCount = plan.filter(p => p.method === 'stripe-cpe').length;
  console.log(`Method: ${stripeCount} from Stripe current_period_end, ${plan.length - stripeCount} from fallback (+1mo).`);
  console.log('This changes ONLY expires_at — sessions, status, and everything else are untouched.');

  const ans = await confirm(`\nApply these ${plan.length} expires_at updates? Type 'yes' to proceed: `);
  if (ans !== 'yes') { console.log('Aborted — no changes written.'); process.exit(0); }

  console.log('\nApplying...');
  let ok = 0; const failures = [];
  for (const p of plan) {
    const { error: upErr } = await supabase
      .from('player_memberships')
      .update({ expires_at: p.newExpires })   // ONLY this field
      .eq('id', p.id);
    if (upErr) { failures.push(`${p.kid_name}: ${upErr.message}`); console.error(`  ✗ ${p.kid_name}: ${upErr.message}`); }
    else { ok++; console.log(`  ✓ ${p.kid_name} → expires ${dayOf(p.newExpires)}`); }
  }
  console.log(`\nDone. ${ok}/${plan.length} updated.${failures.length ? ` ${failures.length} failed (see above).` : ''}`);
}

main().catch(err => { console.error(err); process.exit(1); });
