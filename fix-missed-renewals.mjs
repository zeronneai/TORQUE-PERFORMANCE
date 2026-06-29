// ============================================================
// TORQUE PERFORMANCE — Fix Missed Monthly Renewals (READ-THEN-CONFIRM)
// Repairs memberships whose recurring subscription kept charging while
// invoice.payment_succeeded was disabled, but were never refreshed.
//
// Re-runs the SAME detection as find-missed-renewals.mjs (no CSV input),
// prints a full BEFORE → AFTER table, and WRITES NOTHING until you type
// 'yes' at the confirmation prompt.
//
// For each affected membership it applies what the webhook renewal branch
// would have done:
//   sessions_used  = 0
//   status         = 'active'
//   sessions_total = by package (A 4 / AA 8 / AAA 12 / MLB 20)
//                    MLB WITH a discount on the latest invoice (MLBSUMMER /
//                    anything bringing it to $400) = 9999 (unlimited)
//   expires_at     = last paid invoice date + 1 month
//   purchased_at   = last paid invoice date   (mirrors the webhook renewal;
//                    shown in the table — see note when you review)
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   $env:VITE_SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   node fix-missed-renewals.mjs
//
// Run (bash/zsh):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node fix-missed-renewals.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
import https from 'https';

const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_KEY)   { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }
if (!SUPABASE_URL) { console.error('Missing VITE_SUPABASE_URL'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Handled separately by the owner — never touched by this script.
const EXCLUDE_EMAILS = new Set([
  'maldo2504@gmail.com',        // Jerry Gomez — Package A label but MLB sessions, double-charge review
  'jesus.r.flores00@gmail.com', // unmatched sub — needs membership creation, not update
  'jessica.arlene03@gmail.com', // unmatched sub — needs membership creation, not update
]);

const MLB_UNLIMITED = 9999;
const BASE_SESSIONS = { 'Package A': 4, 'Package AA': 8, 'Package AAA': 12, 'Package MLB': 20 };

// Recurring (subscription) price IDs only — same set as find-missed-renewals.mjs.
const PRICE_INFO = {
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': { pkg: 'Package A',   billingType: 'm6'  },
  'price_1TLqDmAPTWbxe0YysigUumPn': { pkg: 'Package A',   billingType: 'm12' },
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': { pkg: 'Package AA',  billingType: 'm6'  },
  'price_1TLqDjAPTWbxe0YyTsqaUdt5': { pkg: 'Package AA',  billingType: 'm12' },
  'price_1TLqDkAPTWbxe0YydXEB3YqT': { pkg: 'Package AAA', billingType: 'm6'  },
  'price_1TLqDjAPTWbxe0YyuyUujCu4': { pkg: 'Package AAA', billingType: 'm12' },
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': { pkg: 'Package MLB', billingType: 'm6'  },
  'price_1TLqDjAPTWbxe0YyVQxRaHFs': { pkg: 'Package MLB', billingType: 'm12' },
  'price_1TLqDdAPTWbxe0YytEOlF7ZH': { pkg: 'Package A',   billingType: 'stand_legacy' },
  'price_1TLqDgAPTWbxe0Yy7yaP3VX3': { pkg: 'Package AA',  billingType: 'stand_legacy' },
  'price_1TLqDhAPTWbxe0YyXXJQZrh7': { pkg: 'Package AAA', billingType: 'stand_legacy' },
  'price_1TLqDdAPTWbxe0YydO64XMLw': { pkg: 'Package MLB', billingType: 'stand_legacy' },
};

function stripeGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: 'api.stripe.com', path, method: 'GET',
        headers: { Authorization: `Bearer ${STRIPE_KEY}` } },
      res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error(`JSON parse error: ${body.slice(0, 200)}`)); }
        });
      });
    req.on('error', reject);
    req.end();
  });
}

function addMonthsIso(unixSec, months) {
  const d = new Date(unixSec * 1000);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}
const isoDate = (unixSec) => unixSec ? new Date(unixSec * 1000).toISOString().split('T')[0] : '';
const dayOf   = (iso) => iso ? iso.split('T')[0] : '';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function confirm(question) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); res(ans.trim().toLowerCase()); });
  });
}

// Latest PAID invoice object for a subscription (full object — used for date + discount).
async function lastPaidInvoice(subId) {
  const resp = await stripeGet(`/v1/invoices?subscription=${subId}&status=paid&limit=1`);
  if (resp.error) { console.error(`  invoice lookup error for ${subId}:`, resp.error.message); return null; }
  return resp.data?.[0] ?? null;
}

function discountInfo(inv) {
  if (!inv) return { has: false, amountPaid: null, label: '' };
  const amounts = inv.total_discount_amounts || [];
  const totalDisc = amounts.reduce((a, d) => a + (d.amount || 0), 0);
  const has = totalDisc > 0
    || inv.discount != null
    || (Array.isArray(inv.discounts) && inv.discounts.length > 0);
  const label = inv.discount?.coupon?.name || inv.discount?.coupon?.id
    || (has ? `discount $${(totalDisc / 100).toFixed(0)}` : '');
  return { has, amountPaid: inv.amount_paid, label };
}

async function refFromCheckoutSession(subId) {
  try {
    const resp = await stripeGet(`/v1/checkout/sessions?subscription=${subId}&limit=1`);
    const cs = resp.data?.[0];
    if (!cs?.client_reference_id) return null;
    const parts = decodeURIComponent(cs.client_reference_id).split('__');
    if (parts.length >= 2 && parts[0] && parts[1]) return { parentId: parts[0], kidName: parts[1] };
  } catch { /* ignore */ }
  return null;
}

const MEMBERSHIP_COLS =
  'id, parent_id, kid_name, package_name, status, purchased_at, expires_at, sessions_total, sessions_used, stripe_payment_id';

async function main() {
  // ── 1. Active recurring subs ──
  console.error('\nFetching active subscriptions from Stripe...');
  const subs = [];
  let startingAfter = null, page = 0;
  while (true) {
    let url = '/v1/subscriptions?status=active&limit=100&expand[]=data.customer&expand[]=data.items.data.price';
    if (startingAfter) url += `&starting_after=${startingAfter}`;
    const resp = await stripeGet(url);
    if (resp.error) { console.error('Stripe error:', resp.error.message); process.exit(1); }
    const data = resp.data || [];
    page++;
    console.error(`  Page ${page}: ${data.length} active subs`);
    for (const sub of data) {
      const priceId = sub.items?.data?.[0]?.price?.id ?? '';
      const info = PRICE_INFO[priceId];
      if (!info) continue;
      const cust = sub.customer && typeof sub.customer === 'object' ? sub.customer : {};
      subs.push({
        subId: sub.id,
        email: (cust.email ?? '').toLowerCase().trim(),
        name:  cust.name ?? '',
        priceId, pkg: info.pkg, billingType: info.billingType,
      });
    }
    if (!resp.has_more) break;
    startingAfter = data[data.length - 1].id;
  }
  console.error(`\nActive recurring subscriptions: ${subs.length}`);

  // ── 2. Latest paid invoice (date + discount) per sub ──
  console.error('Fetching latest paid invoice per subscription...');
  for (let i = 0; i < subs.length; i++) {
    const inv = await lastPaidInvoice(subs[i].subId);
    subs[i].invoice = inv;
    subs[i].lastInvoiceUnix = inv ? (inv.status_transitions?.paid_at ?? inv.created ?? null) : null;
    process.stderr.write(`\r  ${i + 1}/${subs.length}`);
  }
  console.error('');

  // ── 3. Match to memberships (stripe_payment_id, then checkout-ref, then email) ──
  const membershipBySub = new Map();
  for (const batch of chunk(subs.map(s => s.subId), 200)) {
    const { data, error } = await supabase.from('player_memberships').select(MEMBERSHIP_COLS).in('stripe_payment_id', batch);
    if (error) { console.error('Supabase memberships error:', error.message); process.exit(1); }
    for (const m of (data || [])) membershipBySub.set(m.stripe_payment_id, m);
  }

  const unmatched = subs.filter(s => !membershipBySub.has(s.subId));
  if (unmatched.length) {
    console.error(`Resolving ${unmatched.length} sub(s) via fallback...`);
    const emails = [...new Set(unmatched.map(s => s.email).filter(Boolean))];
    const profileByEmail = new Map();
    for (const batch of chunk(emails, 200)) {
      const { data } = await supabase.from('profiles').select('id, email').in('email', batch);
      for (const p of (data || [])) profileByEmail.set((p.email ?? '').toLowerCase().trim(), p);
    }
    for (const s of unmatched) {
      const ref = await refFromCheckoutSession(s.subId);
      if (ref) {
        const { data } = await supabase.from('player_memberships').select(MEMBERSHIP_COLS)
          .eq('parent_id', ref.parentId).ilike('kid_name', ref.kidName).maybeSingle();
        if (data) { s._fallbackMatch = data; continue; }
      }
      const prof = profileByEmail.get(s.email);
      if (prof) {
        const { data } = await supabase.from('player_memberships').select(MEMBERSHIP_COLS).eq('parent_id', prof.id);
        if (data && data.length === 1) s._fallbackMatch = data[0];
      }
    }
  }

  // ── 4. Detect missed renewals (same rule as find-missed-renewals) + build fix plan ──
  const plan = [];
  const skippedExcluded = [];
  for (const s of subs) {
    const m = membershipBySub.get(s.subId) || (s._fallbackMatch?.id ? s._fallbackMatch : null);
    if (!m) continue; // unmatched → owner handles separately

    const lastInvMs   = s.lastInvoiceUnix ? s.lastInvoiceUnix * 1000 : null;
    const purchasedMs = m.purchased_at ? Date.parse(m.purchased_at) : null;
    const expiresMs   = m.expires_at   ? Date.parse(m.expires_at)   : null;
    if (lastInvMs == null) continue;

    const daysPurchaseToInvoice = purchasedMs != null ? Math.round((lastInvMs - purchasedMs) / 86_400_000) : null;
    const expiresBeforeLastInvoice = expiresMs != null ? (expiresMs < lastInvMs) : false;
    const needsFix = (daysPurchaseToInvoice != null && daysPurchaseToInvoice > 2) || expiresBeforeLastInvoice;
    if (!needsFix) continue;

    if (EXCLUDE_EMAILS.has(s.email)) { skippedExcluded.push({ s, m }); continue; }

    // sessions_total by package; MLB unlimited if the latest invoice carried a discount (or paid <= $400)
    let newSessionsTotal = BASE_SESSIONS[s.pkg] ?? null;
    const disc = discountInfo(s.invoice);
    let mlbNote = '';
    if (s.pkg === 'Package MLB') {
      const unlimited = disc.has || (disc.amountPaid != null && disc.amountPaid <= 40000);
      newSessionsTotal = unlimited ? MLB_UNLIMITED : 20;
      mlbNote = unlimited
        ? `MLB unlimited (${disc.label || `$${(disc.amountPaid / 100).toFixed(0)}`})`
        : `MLB standard ($${disc.amountPaid != null ? (disc.amountPaid / 100).toFixed(0) : '?'})`;
    }
    if (newSessionsTotal == null) continue; // unknown package — skip rather than guess

    plan.push({
      id: m.id,
      email: s.email,
      kid: m.kid_name,
      pkg: s.pkg,
      billingType: s.billingType,
      subId: s.subId,
      lastInvoiceDate: isoDate(s.lastInvoiceUnix),
      mlbNote,
      before: { used: m.sessions_used, total: m.sessions_total, expires: dayOf(m.expires_at), purchased: dayOf(m.purchased_at), status: m.status },
      after:  {
        used: 0, total: newSessionsTotal,
        expires: dayOf(addMonthsIso(s.lastInvoiceUnix, 1)),
        purchased: isoDate(s.lastInvoiceUnix),
        status: 'active',
      },
      _writeExpires: addMonthsIso(s.lastInvoiceUnix, 1),
      _writePurchased: new Date(s.lastInvoiceUnix * 1000).toISOString(),
    });
  }

  // ── 5. Print BEFORE → AFTER table ──
  console.log('\n' + '='.repeat(118));
  console.log(`PROPOSED FIXES: ${plan.length} membership(s)   (excluded ${skippedExcluded.length} handled separately)`);
  console.log('='.repeat(118));
  if (skippedExcluded.length) {
    console.log('\nExcluded (owner handling separately):');
    for (const { s } of skippedExcluded) console.log(`  - ${s.email}  sub ${s.subId}  ${s.pkg} (${s.billingType})`);
  }
  if (plan.length === 0) {
    console.log('\nNothing to fix. Exiting without changes.');
    process.exit(0);
  }
  console.log('');
  for (const p of plan) {
    console.log(`• ${p.email}  |  ${p.kid || '(no kid)'}  |  ${p.pkg} (${p.billingType})${p.mlbNote ? '  [' + p.mlbNote + ']' : ''}`);
    console.log(`    sub ${p.subId}  | last paid invoice ${p.lastInvoiceDate}`);
    console.log(`    sessions_used : ${p.before.used}  →  ${p.after.used}`);
    console.log(`    sessions_total: ${p.before.total}  →  ${p.after.total}`);
    console.log(`    expires_at    : ${p.before.expires || '—'}  →  ${p.after.expires}`);
    console.log(`    purchased_at  : ${p.before.purchased || '—'}  →  ${p.after.purchased}   (mirrors webhook renewal)`);
    console.log(`    status        : ${p.before.status}  →  ${p.after.status}`);
    console.log('');
  }
  console.log('='.repeat(118));
  console.log('NOTE: purchased_at is also updated to the last invoice date (the webhook renewal does this).');
  console.log('      It does NOT affect the annual-only monthly-reset cron (m6/m12/stand are out of its scope).');
  console.log('='.repeat(118));

  // ── 6. Confirm, then write ──
  const ans = await confirm(`\nApply these ${plan.length} updates to Supabase? Type 'yes' to proceed: `);
  if (ans !== 'yes') {
    console.log('Aborted — no changes written.');
    process.exit(0);
  }

  console.log('\nApplying updates...');
  let ok = 0;
  const failures = [];
  for (const p of plan) {
    const { error } = await supabase.from('player_memberships').update({
      sessions_total:   p.after.total,
      sessions_used:    0,
      status:           'active',
      expires_at:       p._writeExpires,
      purchased_at:     p._writePurchased,
    }).eq('id', p.id);
    if (error) { failures.push({ p, error: error.message }); console.error(`  ✗ ${p.email} / ${p.kid}: ${error.message}`); }
    else { ok++; console.log(`  ✓ ${p.email} / ${p.kid} → ${p.after.total} sessions, exp ${p.after.expires}`); }
  }

  console.log(`\nDone. ${ok}/${plan.length} updated.${failures.length ? ` ${failures.length} failed (see above).` : ''}`);
}

main().catch(err => { console.error(err); process.exit(1); });
