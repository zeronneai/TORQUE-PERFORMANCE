// ============================================================
// TORQUE PERFORMANCE — Find Missed Monthly Renewals
// READ-ONLY. During the window when invoice.payment_succeeded was NOT
// enabled on the Stripe webhook, recurring subscriptions kept charging
// but the app never reset sessions / extended expiry. This script finds
// those members: a renewal invoice was PAID in Stripe, but the matching
// player_membership was never refreshed.
//
// Scope: all subscription-type (recurring) price IDs — m6, m12, AND the
// legacy month-to-month ('stand') subs, since all three relied on the
// same webhook event. billing_type in the CSV lets you filter to m6/m12.
//
// Does NOT modify anything.
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   $env:VITE_SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   node find-missed-renewals.mjs
//
// Run (bash/zsh):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node find-missed-renewals.mjs
//
// Output: find-missed-renewals.csv + a console summary
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { createWriteStream } from 'fs';
import https from 'https';

const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_KEY)   { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }
if (!SUPABASE_URL) { console.error('Missing VITE_SUPABASE_URL'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Recurring (subscription) price IDs only. One-time prices (new stand, annual)
// never produce subscriptions, so they're excluded — they can't have renewals.
const PRICE_INFO = {
  // m6 / m12 contracts
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': { pkg: 'Package A',   billingType: 'm6',  sessions: 4  },
  'price_1TLqDmAPTWbxe0YysigUumPn': { pkg: 'Package A',   billingType: 'm12', sessions: 4  },
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': { pkg: 'Package AA',  billingType: 'm6',  sessions: 8  },
  'price_1TLqDjAPTWbxe0YyTsqaUdt5': { pkg: 'Package AA',  billingType: 'm12', sessions: 8  },
  'price_1TLqDkAPTWbxe0YydXEB3YqT': { pkg: 'Package AAA', billingType: 'm6',  sessions: 12 },
  'price_1TLqDjAPTWbxe0YyuyUujCu4': { pkg: 'Package AAA', billingType: 'm12', sessions: 12 },
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': { pkg: 'Package MLB', billingType: 'm6',  sessions: 20 },
  'price_1TLqDjAPTWbxe0YyVQxRaHFs': { pkg: 'Package MLB', billingType: 'm12', sessions: 20 },
  // legacy month-to-month (recurring) — phased out but may still be billing
  'price_1TLqDdAPTWbxe0YytEOlF7ZH': { pkg: 'Package A',   billingType: 'stand_legacy', sessions: 4  },
  'price_1TLqDgAPTWbxe0Yy7yaP3VX3': { pkg: 'Package AA',  billingType: 'stand_legacy', sessions: 8  },
  'price_1TLqDhAPTWbxe0YyXXJQZrh7': { pkg: 'Package AAA', billingType: 'stand_legacy', sessions: 12 },
  'price_1TLqDdAPTWbxe0YydO64XMLw': { pkg: 'Package MLB', billingType: 'stand_legacy', sessions: 20 },
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

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function isoDate(unixSec) {
  return unixSec ? new Date(unixSec * 1000).toISOString().split('T')[0] : '';
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Most recent PAID invoice for a subscription (the renewal charge that should have
// triggered invoice.payment_succeeded). Returns unix seconds, or null.
async function lastPaidInvoiceDate(subId) {
  const resp = await stripeGet(`/v1/invoices?subscription=${subId}&status=paid&limit=1`);
  if (resp.error) { console.error(`  invoice lookup error for ${subId}:`, resp.error.message); return null; }
  const inv = resp.data?.[0];
  if (!inv) return null;
  return inv.status_transitions?.paid_at ?? inv.created ?? null;
}

// Count of paid invoices (>1 means at least one renewal beyond the initial charge).
async function paidInvoiceCount(subId) {
  // limit 100 is plenty for an academy member's monthly history
  const resp = await stripeGet(`/v1/invoices?subscription=${subId}&status=paid&limit=100`);
  if (resp.error) return null;
  return (resp.data || []).length;
}

async function fetchActiveRecurringSubs() {
  console.error('\nFetching active subscriptions from Stripe...');
  const subs = [];
  let startingAfter = null;
  let page = 0;

  while (true) {
    let url = '/v1/subscriptions?status=active&limit=100'
      + '&expand[]=data.customer&expand[]=data.items.data.price';
    if (startingAfter) url += `&starting_after=${startingAfter}`;

    const resp = await stripeGet(url);
    if (resp.error) { console.error('Stripe error:', resp.error.message); process.exit(1); }

    const data = resp.data || [];
    page++;
    console.error(`  Page ${page}: ${data.length} active subs`);

    for (const sub of data) {
      const priceId = sub.items?.data?.[0]?.price?.id ?? '';
      const info    = PRICE_INFO[priceId];
      if (!info) continue; // not a recognized recurring plan
      const cust  = sub.customer && typeof sub.customer === 'object' ? sub.customer : {};
      subs.push({
        subId:       sub.id,
        email:       (cust.email ?? '').toLowerCase().trim(),
        name:        cust.name ?? '',
        priceId,
        pkg:         info.pkg,
        billingType: info.billingType,
        sessions:    info.sessions,
        periodStart: sub.current_period_start,
        periodEnd:   sub.current_period_end,
      });
    }

    if (!resp.has_more) break;
    startingAfter = data[data.length - 1].id;
  }
  return subs;
}

// Fallback: resolve a sub to (parentId, kidName) via its checkout session ref.
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

async function main() {
  const subs = await fetchActiveRecurringSubs();
  console.error(`\nActive recurring subscriptions (m6/m12/stand_legacy): ${subs.length}`);

  // ── Enrich with last paid invoice date + paid invoice count ──
  console.error('Fetching paid-invoice history per subscription...');
  for (let i = 0; i < subs.length; i++) {
    subs[i].lastInvoiceUnix = await lastPaidInvoiceDate(subs[i].subId);
    subs[i].paidInvoices    = await paidInvoiceCount(subs[i].subId);
    process.stderr.write(`\r  ${i + 1}/${subs.length}`);
  }
  console.error('');

  // ── Primary match: player_memberships by stripe_payment_id == subId ──
  const subIds = subs.map(s => s.subId);
  const membershipBySub = new Map();
  for (const batch of chunk(subIds, 200)) {
    const { data, error } = await supabase
      .from('player_memberships')
      .select('id, parent_id, kid_name, package_name, status, purchased_at, expires_at, sessions_total, sessions_used, stripe_payment_id')
      .in('stripe_payment_id', batch);
    if (error) { console.error('Supabase memberships error:', error.message); process.exit(1); }
    for (const m of (data || [])) membershipBySub.set(m.stripe_payment_id, m);
  }

  // ── Fallback for unmatched subs: checkout-session ref, then email → profile ──
  const unmatched = subs.filter(s => !membershipBySub.has(s.subId));
  if (unmatched.length) {
    console.error(`\nResolving ${unmatched.length} sub(s) not matched by stripe_payment_id (fallback)...`);

    // Pre-load profiles by email for the email fallback
    const emails = [...new Set(unmatched.map(s => s.email).filter(Boolean))];
    const profileByEmail = new Map();
    for (const batch of chunk(emails, 200)) {
      const { data } = await supabase.from('profiles').select('id, email, full_name').in('email', batch);
      for (const p of (data || [])) profileByEmail.set((p.email ?? '').toLowerCase().trim(), p);
    }

    for (const s of unmatched) {
      // (a) precise: checkout-session client_reference_id → parent_id + kid_name
      const ref = await refFromCheckoutSession(s.subId);
      if (ref) {
        const { data } = await supabase
          .from('player_memberships')
          .select('id, parent_id, kid_name, package_name, status, purchased_at, expires_at, sessions_total, sessions_used, stripe_payment_id')
          .eq('parent_id', ref.parentId)
          .ilike('kid_name', ref.kidName)
          .maybeSingle();
        if (data) { s._fallbackMatch = { ...data, _method: 'checkout_ref' }; continue; }
      }
      // (b) email → profile → memberships (only if the parent has exactly one)
      const prof = profileByEmail.get(s.email);
      if (prof) {
        const { data } = await supabase
          .from('player_memberships')
          .select('id, parent_id, kid_name, package_name, status, purchased_at, expires_at, sessions_total, sessions_used, stripe_payment_id')
          .eq('parent_id', prof.id);
        if (data && data.length === 1) s._fallbackMatch = { ...data[0], _method: 'email_single' };
        else if (data && data.length > 1) s._fallbackMatch = { _method: 'email_ambiguous', _count: data.length };
      }
    }
  }

  // ── Build rows + flag ──
  const rows = [];
  for (const s of subs) {
    const m = membershipBySub.get(s.subId) || (s._fallbackMatch?.id ? s._fallbackMatch : null);
    const matchMethod = membershipBySub.has(s.subId) ? 'stripe_payment_id'
                      : s._fallbackMatch?._method || 'NO_MATCH';

    const lastInvMs   = s.lastInvoiceUnix ? s.lastInvoiceUnix * 1000 : null;
    const purchasedMs = m?.purchased_at ? Date.parse(m.purchased_at) : null;
    const expiresMs   = m?.expires_at   ? Date.parse(m.expires_at)   : null;

    const daysPurchaseToInvoice = (lastInvMs != null && purchasedMs != null)
      ? Math.round((lastInvMs - purchasedMs) / 86_400_000) : '';
    const expiresBeforeLastInvoice = (lastInvMs != null && expiresMs != null) ? (expiresMs < lastInvMs) : '';

    // A renewal was paid well after the last membership refresh (>2 days rules out the
    // initial same-day invoice), OR the membership already expired despite a recent paid invoice.
    const renewalPaidNotApplied = typeof daysPurchaseToInvoice === 'number' && daysPurchaseToInvoice > 2;
    const needsFix = m
      ? ((renewalPaidNotApplied || expiresBeforeLastInvoice === true) ? 'YES' : '')
      : 'REVIEW (no membership match)';

    rows.push({
      email:                s.email,
      kid_name:             m?.kid_name ?? '',
      package:              s.pkg,
      billing_type:         s.billingType,
      subscription_id:      s.subId,
      paid_invoices:        s.paidInvoices ?? '',
      last_invoice_date:    isoDate(s.lastInvoiceUnix),
      membership_purchased_at: m?.purchased_at ? m.purchased_at.split('T')[0] : '',
      membership_expires_at:   m?.expires_at   ? m.expires_at.split('T')[0]   : '',
      sessions_total:       m?.sessions_total ?? '',
      sessions_used:        m?.sessions_used ?? '',
      days_purchase_to_invoice: daysPurchaseToInvoice,
      expires_before_last_invoice: expiresBeforeLastInvoice,
      match_method:         matchMethod,
      needs_fix:            needsFix,
    });
  }

  // ── Write CSV ──
  const headers = [
    'email', 'kid_name', 'package', 'billing_type', 'subscription_id',
    'paid_invoices', 'last_invoice_date', 'membership_purchased_at',
    'membership_expires_at', 'sessions_total', 'sessions_used',
    'days_purchase_to_invoice', 'expires_before_last_invoice',
    'match_method', 'needs_fix',
  ];
  const out = createWriteStream('find-missed-renewals.csv');
  out.write(headers.join(',') + '\n');
  for (const r of rows) out.write(headers.map(h => csvEscape(r[h])).join(',') + '\n');
  out.end(() => console.error(`\n✅ Saved find-missed-renewals.csv (${rows.length} rows)`));

  // ── Console summary ──
  const fix    = rows.filter(r => r.needs_fix === 'YES');
  const review = rows.filter(r => String(r.needs_fix).startsWith('REVIEW'));

  console.log('\n' + '='.repeat(95));
  console.log(`MISSED RENEWALS (paid in Stripe, membership not refreshed): ${fix.length} of ${rows.length}`);
  console.log('='.repeat(95));
  for (const r of fix) {
    console.log(
      `${r.email}  ${r.kid_name || '(no kid)'}  ${r.package} (${r.billing_type})  sub ${r.subscription_id}\n` +
      `    last paid invoice ${r.last_invoice_date} | purchased ${r.membership_purchased_at} | expires ${r.membership_expires_at} | ` +
      `sessions ${r.sessions_used}/${r.sessions_total} | +${r.days_purchase_to_invoice}d since refresh`
    );
  }
  if (review.length) {
    console.log(`\n⚠️  ${review.length} active recurring sub(s) could NOT be matched to a membership — review manually:`);
    for (const r of review) console.log(`    ${r.email}  sub ${r.subscription_id}  ${r.package} (${r.billing_type})  [${r.match_method}]`);
  }
  console.log('\n' + '='.repeat(95));
}

main().catch(err => { console.error(err); process.exit(1); });
