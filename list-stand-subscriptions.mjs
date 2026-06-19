// ============================================================
// TORQUE PERFORMANCE — List Active Month-to-Month (stand) Subscriptions
// Lists existing Stripe subscriptions still on a 'stand' (month-to-month)
// price ID. Use this after switching 'stand' to one-time payment, to find
// the legacy auto-renewing subs that need a deliberate cancel_at_period_end.
//
// READ-ONLY. This script does NOT cancel anything.
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   node list-stand-subscriptions.mjs
//
// Run (bash/zsh):
//   STRIPE_SECRET_KEY=sk_live_... node list-stand-subscriptions.mjs
//
// Output: prints a table to stdout and writes stand-subscriptions.csv
// ============================================================

import { createWriteStream } from 'fs';
import https from 'https';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }

// The four month-to-month ('stand') price IDs — one per package.
const STAND_PRICES = {
  'price_1TLqDdAPTWbxe0YytEOlF7ZH': 'Package A',
  'price_1TLqDgAPTWbxe0Yy7yaP3VX3': 'Package AA',
  'price_1TLqDhAPTWbxe0YyXXJQZrh7': 'Package AAA',
  'price_1TLqDdAPTWbxe0YydO64XMLw': 'Package MLB',
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

async function main() {
  console.error('\nFetching active subscriptions from Stripe...');

  const matches = [];
  let startingAfter = null;
  let page = 0;

  while (true) {
    // status=active only; expand customer so we get email/name in one call.
    let url = '/v1/subscriptions?status=active&limit=100&expand[]=data.customer';
    if (startingAfter) url += `&starting_after=${startingAfter}`;

    const resp = await stripeGet(url);
    if (resp.error) { console.error('Stripe error:', resp.error.message); process.exit(1); }

    const subs = resp.data || [];
    page++;
    console.error(`  Page ${page}: ${subs.length} active subs`);

    for (const sub of subs) {
      const item    = sub.items?.data?.[0];
      const priceId = item?.price?.id;
      if (priceId && STAND_PRICES[priceId]) {
        const cust = sub.customer && typeof sub.customer === 'object' ? sub.customer : {};
        matches.push({
          subscription_id: sub.id,
          customer_email:  cust.email ?? '',
          customer_name:   cust.name ?? '',
          package:         STAND_PRICES[priceId],
          price_id:        priceId,
          cancel_at_period_end: sub.cancel_at_period_end,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString().split('T')[0] : '',
        });
      }
    }

    if (!resp.has_more) break;
    startingAfter = subs[subs.length - 1].id;
  }

  console.error(`\nActive 'stand' (month-to-month) subscriptions: ${matches.length}\n`);

  if (matches.length === 0) {
    console.error('None found — nothing to cancel.');
    process.exit(0);
  }

  // Print readable table
  for (const m of matches) {
    console.error(
      `${m.subscription_id}  ${m.package.padEnd(11)}  next:${m.current_period_end}  ` +
      `${m.cancel_at_period_end ? '[already set to cancel]' : ''}  ${m.customer_name} <${m.customer_email}>`
    );
  }

  // Write CSV
  const out = createWriteStream('stand-subscriptions.csv');
  const headers = ['subscription_id','customer_email','customer_name','package','price_id','next_billing_date','cancel_at_period_end'];
  out.write(headers.join(',') + '\n');
  for (const m of matches) {
    out.write([
      m.subscription_id, m.customer_email, m.customer_name, m.package,
      m.price_id, m.current_period_end, m.cancel_at_period_end,
    ].map(csvEscape).join(',') + '\n');
  }
  out.end(() => console.error(`\n✅ Saved stand-subscriptions.csv (${matches.length} rows)`));
}

main().catch(err => { console.error(err); process.exit(1); });
