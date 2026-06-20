// ============================================================
// TORQUE PERFORMANCE — Cross-Reference Active Subs vs Memberships (by email)
// READ-ONLY. audit-subscriptions.mjs groups by Stripe customer ID, which
// misses double-charges where the same parent has multiple Stripe customer
// records (one per checkout) — each subscription sits under a different
// customer ID and never gets grouped. This script groups by EMAIL instead,
// and cross-references against Supabase to find subscriptions that don't
// match anything the parent is currently active on (a sign the parent
// upgraded/changed plans and the old subscription was never cancelled).
//
// Does NOT cancel or refund anything.
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   $env:VITE_SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   node cross-reference-subscriptions.mjs
//
// Run (bash/zsh):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node cross-reference-subscriptions.mjs
//
// Output: cross-reference-subscriptions.csv + a console summary
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { createWriteStream } from 'fs';
import https from 'https';

const STRIPE_KEY    = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_KEY)   { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }
if (!SUPABASE_URL) { console.error('Missing VITE_SUPABASE_URL'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Every recurring (subscription-capable) price ID, tagged by package.
// One-time prices (new stand, annual) never produce subscriptions, so
// they're intentionally excluded — they can't appear in this report.
const PRICE_MAP = {
  'price_1TLqDdAPTWbxe0YytEOlF7ZH': 'Package A',
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': 'Package A',
  'price_1TLqDmAPTWbxe0YysigUumPn': 'Package A',
  'price_1TLqDgAPTWbxe0Yy7yaP3VX3': 'Package AA',
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': 'Package AA',
  'price_1TLqDjAPTWbxe0YyTsqaUdt5': 'Package AA',
  'price_1TLqDhAPTWbxe0YyXXJQZrh7': 'Package AAA',
  'price_1TLqDkAPTWbxe0YydXEB3YqT': 'Package AAA',
  'price_1TLqDjAPTWbxe0YyuyUujCu4': 'Package AAA',
  'price_1TLqDdAPTWbxe0YydO64XMLw': 'Package MLB',
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': 'Package MLB',
  'price_1TLqDjAPTWbxe0YyVQxRaHFs': 'Package MLB',
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

function formatAmount(unitAmount, currency) {
  if (unitAmount == null) return '';
  return `${(unitAmount / 100).toFixed(2)} ${(currency || '').toUpperCase()}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchActiveSubscriptions() {
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
      const item    = sub.items?.data?.[0];
      const price   = item?.price;
      const priceId = price?.id ?? '';
      const cust    = sub.customer && typeof sub.customer === 'object' ? sub.customer : {};
      const email   = (cust.email ?? '').toLowerCase().trim();
      if (!email) continue; // can't cross-reference without an email

      subs.push({
        customer_email:  email,
        customer_name:   cust.name ?? '',
        subscription_id: sub.id,
        price_id:        priceId,
        package_name:    PRICE_MAP[priceId] ?? 'Unknown',
        amount:          formatAmount(price?.unit_amount, price?.currency),
        interval:        price?.recurring?.interval ?? '',
        created_date:    new Date(sub.created * 1000).toISOString().split('T')[0],
        period_end:      sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString().split('T')[0] : '',
      });
    }

    if (!resp.has_more) break;
    startingAfter = data[data.length - 1].id;
  }

  return subs;
}

async function main() {
  const subs = await fetchActiveSubscriptions();
  console.error(`\nTotal active subscriptions (with email): ${subs.length}`);

  const uniqueEmails = [...new Set(subs.map(s => s.customer_email))];
  console.error(`Unique customer emails: ${uniqueEmails.length}`);

  // ── Look up matching parent profiles in Supabase, by email ──
  console.error('\nLooking up parent profiles in Supabase...');
  const profiles = [];
  for (const batch of chunk(uniqueEmails, 200)) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('email', batch);
    if (error) { console.error('Supabase profiles error:', error.message); process.exit(1); }
    profiles.push(...(data || []));
  }
  const profileByEmail = new Map(profiles.map(p => [(p.email ?? '').toLowerCase().trim(), p]));
  console.error(`Matched ${profileByEmail.size} of ${uniqueEmails.length} emails to a Supabase profile.`);

  // ── Pull every membership row for those parents ──
  const parentIds = [...new Set(profiles.map(p => p.id))];
  const memberships = [];
  for (const batch of chunk(parentIds, 200)) {
    const { data, error } = await supabase
      .from('player_memberships')
      .select('parent_id, kid_name, package_name, status, expires_at')
      .in('parent_id', batch);
    if (error) { console.error('Supabase player_memberships error:', error.message); process.exit(1); }
    memberships.push(...(data || []));
  }

  // parent_id -> Set of package names currently active (status active AND not expired)
  const now = new Date();
  const activePackagesByParent = new Map();
  const activeMembershipCountByParent = new Map();
  for (const m of memberships) {
    const isActive = m.status?.toLowerCase() === 'active' && m.expires_at && new Date(m.expires_at) > now;
    if (!isActive) continue;
    if (!activePackagesByParent.has(m.parent_id)) activePackagesByParent.set(m.parent_id, new Set());
    activePackagesByParent.get(m.parent_id).add(m.package_name);
    activeMembershipCountByParent.set(m.parent_id, (activeMembershipCountByParent.get(m.parent_id) || 0) + 1);
  }

  // How many active Stripe subs does each email have? (closes the gap audit-subscriptions.mjs
  // missed — multiple Stripe customer IDs per email weren't grouped there)
  const subCountByEmail = new Map();
  for (const s of subs) subCountByEmail.set(s.customer_email, (subCountByEmail.get(s.customer_email) || 0) + 1);

  // ── Cross-reference ──
  const rows = [];
  for (const sub of subs) {
    const profile  = profileByEmail.get(sub.customer_email);
    const parentId = profile?.id;
    const activePackages   = parentId ? (activePackagesByParent.get(parentId) || new Set()) : new Set();
    const membershipCount  = parentId ? (activeMembershipCountByParent.get(parentId) || 0) : 0;
    const subCount         = subCountByEmail.get(sub.customer_email) || 0;

    const packageMismatch = !activePackages.has(sub.package_name);
    const countMismatch   = subCount > membershipCount; // more active subs than active memberships for this parent
    const superseded      = !profile ? '' : (packageMismatch || countMismatch) ? 'YES' : '';

    rows.push({
      email:                       sub.customer_email,
      parent_name:                 profile?.full_name || sub.customer_name || '',
      subscription_package:        sub.package_name,
      subscription_id:             sub.subscription_id,
      subscription_amount:         sub.amount,
      subscription_interval:       sub.interval,
      subscription_created:        sub.created_date,
      subscription_period_end:     sub.period_end,
      current_membership_packages: [...activePackages].join('; '),
      superseded_flag:             superseded,
      flag_reason:                 !profile ? 'NO_PROFILE_MATCH'
                                    : packageMismatch ? 'package not in active memberships'
                                    : countMismatch   ? 'more active subs than active memberships'
                                    : '',
    });
  }

  // ── Write CSV ──
  const out = createWriteStream('cross-reference-subscriptions.csv');
  const headers = [
    'email', 'parent_name', 'subscription_package', 'subscription_id',
    'subscription_amount', 'subscription_interval', 'subscription_created',
    'subscription_period_end', 'current_membership_packages',
    'superseded_flag', 'flag_reason',
  ];
  out.write(headers.join(',') + '\n');
  for (const r of rows) out.write(headers.map(h => csvEscape(r[h])).join(',') + '\n');
  out.end(() => console.error(`\n✅ Saved cross-reference-subscriptions.csv (${rows.length} rows)`));

  // ── Console summary ──
  const flagged = rows.filter(r => r.superseded_flag === 'YES');
  const noMatch = rows.filter(r => r.flag_reason === 'NO_PROFILE_MATCH');

  console.log('\n' + '='.repeat(90));
  console.log(`SUPERSEDED / SUSPECT SUBSCRIPTIONS: ${flagged.length} of ${rows.length}`);
  console.log('='.repeat(90));
  for (const r of flagged) {
    console.log(
      `${r.email}  ${r.subscription_id}  ${r.subscription_package}  ${r.subscription_amount}/${r.subscription_interval}  ` +
      `→ active: [${r.current_membership_packages || 'none'}]  (${r.flag_reason})`
    );
  }
  if (noMatch.length > 0) {
    console.log(`\n⚠️  ${noMatch.length} subscription(s) have an email with no matching Supabase profile — can't verify, review manually.`);
  }
  console.log('\n' + '='.repeat(90));
}

main().catch(err => { console.error(err); process.exit(1); });
