// ============================================================
// TORQUE PERFORMANCE — Check Month-to-Month (stand) Price Config
// READ-ONLY. Queries Stripe for the 4 'stand' price IDs (one per
// package, from PACKS.prices.stand in ParentPortal.jsx) and reports
// whether each is configured as 'recurring' or 'one_time' in Stripe.
//
// Why this matters: Stripe Checkout Sessions with mode:'payment'
// REQUIRE one_time prices. If a 'stand' price ID is still typed
// 'recurring' in Stripe, create-checkout.js will throw at runtime
// once stand switches to mode:'payment' — a new one-time price
// (same amount) would need to be created and swapped in.
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   node check-stand-prices.mjs
//
// Run (bash/zsh):
//   STRIPE_SECRET_KEY=sk_live_... node check-stand-prices.mjs
// ============================================================

import https from 'https';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }

// The 4 'stand' (month-to-month) price IDs — one per package.
// Source: PACKS.prices.stand in src/pages/parent/ParentPortal.jsx
const STAND_PRICES = [
  { priceId: 'price_1TLqDdAPTWbxe0YytEOlF7ZH', pkg: 'Package A'   },
  { priceId: 'price_1TLqDgAPTWbxe0Yy7yaP3VX3', pkg: 'Package AA'  },
  { priceId: 'price_1TLqDhAPTWbxe0YyXXJQZrh7', pkg: 'Package AAA' },
  { priceId: 'price_1TLqDdAPTWbxe0YydO64XMLw', pkg: 'Package MLB' },
];

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

function formatAmount(unitAmount, currency) {
  if (unitAmount == null) return '—';
  return `${(unitAmount / 100).toFixed(2)} ${(currency || '').toUpperCase()}`;
}

async function main() {
  console.error('\nQuerying Stripe for stand (month-to-month) price configuration...\n');

  const rows = [];
  for (const { priceId, pkg } of STAND_PRICES) {
    const price = await stripeGet(`/v1/prices/${priceId}?expand[]=product`);
    if (price.error) {
      rows.push({ priceId, pkg, error: price.error.message });
      continue;
    }
    rows.push({
      priceId,
      pkg,
      productName: price.product?.name ?? '',
      type:        price.type, // 'recurring' | 'one_time'
      interval:    price.recurring?.interval ?? '',
      amount:      formatAmount(price.unit_amount, price.currency),
      active:      price.active,
    });
  }

  console.log('='.repeat(100));
  console.log(
    'PACKAGE'.padEnd(13), 'PRICE ID'.padEnd(32), 'TYPE'.padEnd(11),
    'INTERVAL'.padEnd(10), 'AMOUNT'.padEnd(14), 'ACTIVE'
  );
  console.log('-'.repeat(100));

  let recurringCount = 0;
  for (const r of rows) {
    if (r.error) {
      console.log(`${r.pkg.padEnd(13)} ${r.priceId.padEnd(32)} ERROR: ${r.error}`);
      continue;
    }
    if (r.type === 'recurring') recurringCount++;
    console.log(
      r.pkg.padEnd(13),
      r.priceId.padEnd(32),
      r.type.padEnd(11),
      r.interval.padEnd(10),
      r.amount.padEnd(14),
      r.active
    );
  }
  console.log('='.repeat(100));

  if (recurringCount > 0) {
    console.log(`\n⚠️  ${recurringCount} of ${rows.length} 'stand' price(s) are still type 'recurring'.`);
    console.log('   These will FAIL in a mode:\'payment\' Checkout Session.');
    console.log('   A new one-time price (same amount) must be created in Stripe and');
    console.log('   swapped into PACKS.prices.stand for that package before deploying.');
  } else {
    console.log(`\n✅ All ${rows.length} 'stand' prices are type 'one_time' — safe for mode:'payment'.`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
