// ============================================================
// TORQUE PERFORMANCE: READ-ONLY export to reconcile the app with Stripe
//
// Pulls everything needed to match member profiles with Stripe profiles
// (contact info, packages, payments) into ONE file: reconcile-data.json.
// Makes NO changes: only SELECTs from Supabase and LIST/RETRIEVE from Stripe.
//
// The file contains parents' names, emails and phones. Keep it private,
// do not commit it (it is in .gitignore) and delete it when we are done.
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   $env:VITE_SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   node reconcile-export.mjs
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
const SINCE = Math.floor(Date.UTC(2025, 0, 1) / 1000);   // payments since Jan 1, 2025
// Stripe caps autoPagingToArray at 10,000, so iterate instead.
async function list(it) { const out = []; for await (const x of it) out.push(x); return out; }
const iso = (s) => (s ? new Date(s * 1000).toISOString() : null);

async function all(table, select = '*') {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) { console.error(`  ! ${table}: ${error.message}`); return out; }
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  console.log(`  ${table}: ${out.length}`);
  return out;
}

async function main() {
  console.log('\nSupabase (read only)...');
  const profiles    = await all('profiles');
  const players     = await all('players');
  const memberships = await all('player_memberships');
  const team        = await all('team_memberships');
  const bookings    = await all('bookings', 'id, parent_id, kid_name, membership_id, session_date, status, created_at');

  console.log('\nStripe (read only)...');
  const customers = (await list(stripe.customers.list({ limit: 100 })))
    .map(c => ({ id: c.id, email: c.email, name: c.name, phone: c.phone, created: iso(c.created), metadata: c.metadata, deleted: !!c.deleted }));
  console.log(`  customers: ${customers.length}`);

  const subscriptions = (await list(stripe.subscriptions.list({ status: 'all', limit: 100 })))
    .map(s => ({
      id: s.id, customer: s.customer, status: s.status, created: iso(s.created),
      current_period_end: iso(s.current_period_end ?? s.items?.data?.[0]?.current_period_end),
      cancel_at_period_end: s.cancel_at_period_end, canceled_at: iso(s.canceled_at), ended_at: iso(s.ended_at),
      metadata: s.metadata, description: s.description,
      items: (s.items?.data || []).map(i => ({ price: i.price?.id, nickname: i.price?.nickname, amount: i.price?.unit_amount, interval: i.price?.recurring?.interval, interval_count: i.price?.recurring?.interval_count, quantity: i.quantity })),
      discount: s.discount?.coupon ? { id: s.discount.coupon.id, percent_off: s.discount.coupon.percent_off, amount_off: s.discount.coupon.amount_off } : null,
    }));
  console.log(`  subscriptions: ${subscriptions.length}`);

  const charges = (await list(stripe.charges.list({ limit: 100, created: { gte: SINCE } })))
    .map(c => ({
      id: c.id, created: iso(c.created), amount: c.amount, amount_refunded: c.amount_refunded, status: c.status, paid: c.paid, refunded: c.refunded,
      customer: c.customer, payment_intent: c.payment_intent, invoice: c.invoice, description: c.description,
      email: c.billing_details?.email || c.receipt_email, name: c.billing_details?.name, phone: c.billing_details?.phone, metadata: c.metadata,
    }));
  console.log(`  charges since 2025: ${charges.length}`);

  const sessions = [];
  for await (const s of stripe.checkout.sessions.list({ limit: 100, created: { gte: SINCE }, expand: ['data.line_items'] })) {
    if (s.status !== 'complete') continue;
    sessions.push({
      id: s.id, created: iso(s.created), mode: s.mode, customer: s.customer, email: s.customer_details?.email || s.customer_email,
      name: s.customer_details?.name, phone: s.customer_details?.phone, client_reference_id: s.client_reference_id,
      payment_intent: s.payment_intent, subscription: s.subscription, amount_total: s.amount_total, metadata: s.metadata,
      prices: (s.line_items?.data || []).map(li => ({ price: li.price?.id, nickname: li.price?.nickname, amount: li.amount_total })),
    });
  }
  console.log(`  completed checkouts since 2025: ${sessions.length}`);

  const prices = (await list(stripe.prices.list({ limit: 100, expand: ['data.product'] })))
    .map(p => ({ id: p.id, nickname: p.nickname, amount: p.unit_amount, interval: p.recurring?.interval || null, interval_count: p.recurring?.interval_count || null, active: p.active, lookup_key: p.lookup_key, product: p.product?.name }));
  console.log(`  prices: ${prices.length}`);

  const out = { exported_at: new Date().toISOString(), supabase: { profiles, players, memberships, team, bookings }, stripe: { customers, subscriptions, charges, sessions, prices } };
  writeFileSync('reconcile-data.json', JSON.stringify(out));
  console.log('\nDone: reconcile-data.json (send it to Claude). NO changes were made. ✅\n');
}

main().catch(e => { console.error(e); process.exit(1); });
