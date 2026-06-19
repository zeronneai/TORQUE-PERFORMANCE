// ============================================================
// TORQUE PERFORMANCE — Audit Active Subscriptions
// READ-ONLY. Lists every active Stripe subscription, flags
// customers with 2+ active subs (likely double-charges from
// plan upgrades that never cancelled the old subscription), and
// marks legacy recurring 'stand' (month-to-month) subs vs the
// 6-month/12-month contract subs.
//
// Does NOT cancel or refund anything.
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   node audit-subscriptions.mjs
//
// Run (bash/zsh):
//   STRIPE_SECRET_KEY=sk_live_... node audit-subscriptions.mjs
//
// Output: audit-subscriptions.csv + a console summary
// ============================================================

import { createWriteStream } from 'fs';
import https from 'https';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }

// Every recurring (subscription-capable) price ID, tagged by package + billing type.
// 'stand_legacy' = old recurring month-to-month price (no longer sold, but still
// renewing for anyone who bought before the one-time-price switch).
// One-time prices (new stand, annual) never produce subscriptions, so they're
// intentionally excluded — they can't appear in this report.
const PRICE_MAP = {
  // Package A
  'price_1TLqDdAPTWbxe0YytEOlF7ZH': { pkg: 'Package A',   billingType: 'stand_legacy' },
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': { pkg: 'Package A',   billingType: 'm6'           },
  'price_1TLqDmAPTWbxe0YysigUumPn': { pkg: 'Package A',   billingType: 'm12'          },
  // Package AA
  'price_1TLqDgAPTWbxe0Yy7yaP3VX3': { pkg: 'Package AA',  billingType: 'stand_legacy' },
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': { pkg: 'Package AA',  billingType: 'm6'           },
  'price_1TLqDjAPTWbxe0YyTsqaUdt5': { pkg: 'Package AA',  billingType: 'm12'          },
  // Package AAA
  'price_1TLqDhAPTWbxe0YyXXJQZrh7': { pkg: 'Package AAA', billingType: 'stand_legacy' },
  'price_1TLqDkAPTWbxe0YydXEB3YqT': { pkg: 'Package AAA', billingType: 'm6'           },
  'price_1TLqDjAPTWbxe0YyuyUujCu4': { pkg: 'Package AAA', billingType: 'm12'          },
  // Package MLB
  'price_1TLqDdAPTWbxe0YydO64XMLw': { pkg: 'Package MLB', billingType: 'stand_legacy' },
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': { pkg: 'Package MLB', billingType: 'm6'           },
  'price_1TLqDjAPTWbxe0YyVQxRaHFs': { pkg: 'Package MLB', billingType: 'm12'          },
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

async function main() {
  console.error('\nFetching active subscriptions from Stripe...');

  const rows = [];
  let startingAfter = null;
  let page = 0;

  while (true) {
    let url = '/v1/subscriptions?status=active&limit=100'
      + '&expand[]=data.customer&expand[]=data.items.data.price';
    if (startingAfter) url += `&starting_after=${startingAfter}`;

    const resp = await stripeGet(url);
    if (resp.error) { console.error('Stripe error:', resp.error.message); process.exit(1); }

    const subs = resp.data || [];
    page++;
    console.error(`  Page ${page}: ${subs.length} active subs`);

    for (const sub of subs) {
      const item    = sub.items?.data?.[0];
      const price   = item?.price;
      const priceId = price?.id ?? '';
      const mapped  = PRICE_MAP[priceId];
      const cust    = sub.customer && typeof sub.customer === 'object' ? sub.customer : {};

      rows.push({
        customer_id:          cust.id ?? sub.customer ?? '',
        customer_email:       cust.email ?? '',
        customer_name:        cust.name ?? '',
        subscription_id:      sub.id,
        price_id:             priceId,
        package_name:         mapped?.pkg ?? 'Unknown',
        billing_type:         mapped?.billingType ?? 'unrecognized',
        amount:               formatAmount(price?.unit_amount, price?.currency),
        interval:             price?.recurring?.interval ?? '',
        created_date:         new Date(sub.created * 1000).toISOString().split('T')[0],
        current_period_end:   sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString().split('T')[0] : '',
      });
    }

    if (!resp.has_more) break;
    startingAfter = subs[subs.length - 1].id;
  }

  console.error(`\nTotal active subscriptions: ${rows.length}`);

  // ── Flag customers with 2+ active subscriptions ──
  const byCustomer = new Map();
  for (const r of rows) {
    const key = r.customer_id || r.customer_email;
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key).push(r);
  }
  for (const r of rows) {
    const key = r.customer_id || r.customer_email;
    const group = byCustomer.get(key);
    r.multiple_active_subs = group.length >= 2 ? 'YES' : '';
    r.active_sub_count     = group.length;
  }

  // ── Write CSV ──
  const out = createWriteStream('audit-subscriptions.csv');
  const headers = [
    'customer_email', 'customer_name', 'subscription_id', 'price_id',
    'package_name', 'billing_type', 'amount', 'interval',
    'created_date', 'current_period_end',
    'multiple_active_subs', 'active_sub_count',
  ];
  out.write(headers.join(',') + '\n');
  for (const r of rows) {
    out.write(headers.map(h => csvEscape(r[h])).join(',') + '\n');
  }
  out.end(() => console.error(`\n✅ Saved audit-subscriptions.csv (${rows.length} rows)`));

  // ── Console summary ──
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  const byType = {};
  for (const r of rows) byType[r.billing_type] = (byType[r.billing_type] || 0) + 1;
  console.log('\nActive subscriptions by billing type:');
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type.padEnd(15)} ${count}`);
  }

  const duped = [...byCustomer.entries()].filter(([, group]) => group.length >= 2);
  console.log(`\nCustomers with 2+ active subscriptions: ${duped.length}`);
  if (duped.length > 0) {
    console.log('(likely double-charges from upgrades that never cancelled the old sub)\n');
    for (const [key, group] of duped) {
      const name = group[0].customer_name || group[0].customer_email || key;
      console.log(`  ${name} <${group[0].customer_email}> — ${group.length} active subs:`);
      for (const r of group) {
        console.log(`      ${r.subscription_id}  ${r.package_name} (${r.billing_type})  ${r.amount}/${r.interval}  created ${r.created_date}`);
      }
    }
  }
  console.log('\n' + '='.repeat(80));
}

main().catch(err => { console.error(err); process.exit(1); });
