// ============================================================
// TORQUE PERFORMANCE — READ-ONLY export for the Meta ads impact report
//
// Pulls every sales / activity signal from Stripe and Supabase so we can compare
// periods WITH ads vs WITHOUT ads. Makes NO changes (only list/select calls).
//
// Privacy: emails, names and phones are NOT written. Each family becomes a short
// anonymous id (hash of the email), the same id in Stripe and Supabase rows, so we
// can still tell new families from returning ones.
//
// Output: ads-impact-data.json  (send this file back for the analysis)
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   $env:VITE_SUPABASE_URL="https://izkvitaoprtzkkmyeikr.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   node ads-impact-export.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { writeFileSync } from 'fs';
import { createHash } from 'crypto';

const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!STRIPE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env: need STRIPE_SECRET_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const stripe   = new Stripe(STRIPE_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SINCE = Math.floor(new Date('2026-03-01T00:00:00Z').getTime() / 1000);
const iso = (ts) => ts ? new Date(ts * 1000).toISOString() : null;
const fam = (email) => email ? createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 10) : null;
const idHash = (s) => s ? createHash('sha256').update(String(s)).digest('hex').slice(0, 10) : null;

async function all(list, label) {
  const out = [];
  for await (const x of list) { out.push(x); if (out.length % 200 === 0) console.log(`  ${label}: ${out.length}...`); }
  console.log(`  ${label}: ${out.length}`);
  return out;
}

async function table(name, cols) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(name).select('*').range(from, from + 999);
    if (error) { console.log(`  ${name}: skipped (${error.message})`); return null; }
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  console.log(`  ${name}: ${rows.length}`);
  return rows.map(r => Object.fromEntries(cols.filter(c => c in r).map(c => [c, r[c]])));
}

console.log('Stripe...');
const customers = await all(stripe.customers.list({ limit: 100 }), 'customers');
const custFam = new Map(customers.map(c => [c.id, fam(c.email)]));
const custCreated = new Map(customers.map(c => [c.id, iso(c.created)]));

const sessions = await all(stripe.checkout.sessions.list({ limit: 100, created: { gte: SINCE }, status: 'complete' }), 'checkout sessions');
const subs     = await all(stripe.subscriptions.list({ limit: 100, status: 'all', created: { gte: SINCE } }), 'subscriptions');
const invoices = await all(stripe.invoices.list({ limit: 100, created: { gte: SINCE }, status: 'paid' }), 'paid invoices');
const charges  = await all(stripe.charges.list({ limit: 100, created: { gte: SINCE } }), 'charges');

const stripeData = {
  checkout_sessions: sessions.map(s => ({
    created: iso(s.created), mode: s.mode, amount_total: s.amount_total, payment_status: s.payment_status,
    type: s.metadata?.type || (s.client_reference_id ? 'membership' : 'other'),
    price_id: s.client_reference_id ? decodeURIComponent(s.client_reference_id).split('__')[2] || null : null,
    family: custFam.get(s.customer) || fam(s.customer_details?.email),
    customer_created: custCreated.get(s.customer) || null,
  })),
  subscriptions: subs.map(s => ({
    id: idHash(s.id), created: iso(s.created), start_date: iso(s.start_date), status: s.status,
    canceled_at: iso(s.canceled_at), ended_at: iso(s.ended_at), cancel_at: iso(s.cancel_at),
    price_id: s.items?.data?.[0]?.price?.id || null,
    unit_amount: s.items?.data?.[0]?.price?.unit_amount ?? null,
    discount: !!s.discount, family: custFam.get(s.customer) || null,
  })),
  invoices: invoices.map(i => ({
    created: iso(i.created), amount_paid: i.amount_paid, billing_reason: i.billing_reason,
    subscription: idHash(typeof i.subscription === 'string' ? i.subscription : i.subscription?.id),
    family: custFam.get(i.customer) || fam(i.customer_email),
  })),
  charges: charges.map(c => ({
    created: iso(c.created), amount: c.amount, amount_refunded: c.amount_refunded, status: c.status,
    paid: c.paid, disputed: c.disputed, has_invoice: !!c.invoice,
    family: custFam.get(c.customer) || fam(c.billing_details?.email || c.receipt_email),
  })),
};

console.log('Supabase...');
const profiles = await table('profiles', ['id', 'email', 'created_at', 'role']);
const pidFam = new Map((profiles || []).map(p => [p.id, fam(p.email)]));
const withFam = (rows) => rows && rows.map(r => {
  const { parent_id, ...rest } = r;
  return { ...rest, family: pidFam.get(parent_id) || idHash(parent_id) };
});

const supa = {
  profiles: (profiles || []).map(p => ({ family: fam(p.email), created_at: p.created_at || null, role: p.role })),
  players: withFam(await table('players', ['parent_id', 'created_at', 'age'])),
  memberships: withFam(await table('player_memberships', ['parent_id', 'status', 'package_name', 'billing_type', 'term_months',
    'stripe_payment_id', 'purchased_at', 'expires_at', 'term_start', 'term_end', 'created_at', 'monthly_price',
    'cancel_requested_at', 'cancel_effective_at', 'canceled_at']))?.map(m => ({
      ...m, pay_kind: (m.stripe_payment_id || '').startsWith('sub_') ? 'sub' : (m.stripe_payment_id || '').startsWith('pi_') ? 'pi'
        : m.stripe_payment_id === 'manual' ? 'manual' : 'none', stripe_payment_id: undefined })),
  waivers: withFam(await table('waivers', ['parent_id', 'agreed_at', 'billing_type', 'package_name', 'contract_version'])),
  bookings: withFam(await table('bookings', ['parent_id', 'session_date', 'session_time', 'status', 'created_at'])),
  checkins: withFam(await table('checkins', ['parent_id', 'checked_in_at'])),
  leads: await table('leads', ['created_at', 'source', 'status', 'preferred_day', 'player_age']),
  promo_registrations: withFam(await table('promo_registrations', ['parent_id', 'promo_event_id', 'status', 'amount_cents', 'created_at'])),
  promo_events: await table('promo_events', ['id', 'slug', 'title', 'event_date', 'price_cents']),
  tryout_registrations: await table('tryout_registrations', ['created_at', 'age_group', 'time_slot']),
  cancellation_feedback: await table('cancellation_feedback', ['created_at', 'reason', 'source']),
};

const out = { exported_at: new Date().toISOString(), since: iso(SINCE), stripe: stripeData, supabase: supa };
writeFileSync('ads-impact-data.json', JSON.stringify(out));
console.log('\nWrote ads-impact-data.json — send this file back for the report. Nothing was changed.');
