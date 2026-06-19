// ============================================================
// TORQUE PERFORMANCE — Create One-Time Stand Prices
// READ-THEN-CREATE. For each of the 4 recurring month-to-month
// ('stand') prices, reads its unit_amount/currency/product from
// Stripe, then creates a matching ONE-TIME price under the SAME
// product (preserves MLBSUMMER promo-code and sibling-coupon
// eligibility, which are scoped at the product level).
//
// Does NOT touch the old recurring prices — they stay active so
// existing stand subscribers keep renewing until cancelled later.
// Does NOT modify any code — just prints the 4 new price IDs for
// you to paste back.
//
// Safe to re-run: each creation uses a deterministic Idempotency-Key
// derived from the source price ID, so re-running won't create
// duplicate one-time prices.
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   node create-stand-onetime-prices.mjs
//
// Run (bash/zsh):
//   STRIPE_SECRET_KEY=sk_live_... node create-stand-onetime-prices.mjs
// ============================================================

import https from 'https';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }

// The 4 recurring 'stand' (month-to-month) price IDs — one per package.
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

function stripePost(path, params, idempotencyKey) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const req = https.request(
      {
        hostname: 'api.stripe.com',
        path,
        method: 'POST',
        headers: {
          Authorization:        `Bearer ${STRIPE_KEY}`,
          'Content-Type':       'application/x-www-form-urlencoded',
          'Content-Length':     Buffer.byteLength(body),
          'Idempotency-Key':    idempotencyKey,
        },
      },
      res => {
        let resBody = '';
        res.on('data', d => resBody += d);
        res.on('end', () => {
          try { resolve(JSON.parse(resBody)); }
          catch { reject(new Error(`JSON parse error: ${resBody.slice(0, 200)}`)); }
        });
      });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function formatAmount(unitAmount, currency) {
  if (unitAmount == null) return '—';
  return `${(unitAmount / 100).toFixed(2)} ${(currency || '').toUpperCase()}`;
}

async function main() {
  console.error('\nStep 1/2 — Reading current recurring stand prices from Stripe...\n');

  const plan = [];
  for (const { priceId, pkg } of STAND_PRICES) {
    const price = await stripeGet(`/v1/prices/${priceId}`);
    if (price.error) {
      console.error(`  ERROR reading ${priceId} (${pkg}): ${price.error.message}`);
      process.exit(1);
    }
    if (price.type !== 'recurring') {
      console.error(`  WARNING: ${priceId} (${pkg}) is already type '${price.type}' — skipping creation, nothing to do.`);
      continue;
    }
    plan.push({
      pkg,
      oldPriceId: priceId,
      unitAmount: price.unit_amount,
      currency:   price.currency,
      productId:  price.product, // string ID, not expanded — same product as the recurring price
    });
    console.error(`  ${pkg.padEnd(13)} ${priceId}  ${formatAmount(price.unit_amount, price.currency)}  product=${price.product}`);
  }

  if (plan.length === 0) {
    console.error('\nNothing to create — all stand prices already non-recurring.');
    process.exit(0);
  }

  console.error('\nStep 2/2 — Creating matching one-time prices under the same products...\n');

  const results = [];
  for (const item of plan) {
    const idempotencyKey = `stand-onetime-${item.oldPriceId}`;
    const created = await stripePost('/v1/prices', {
      unit_amount: String(item.unitAmount),
      currency:    item.currency,
      product:     item.productId,
      nickname:    `${item.pkg} - Month-to-Month (One-Time)`,
      // No 'recurring' param => Stripe creates a one_time price by default.
    }, idempotencyKey);

    if (created.error) {
      console.error(`  ERROR creating one-time price for ${item.pkg}: ${created.error.message}`);
      results.push({ ...item, newPriceId: null, error: created.error.message });
      continue;
    }
    results.push({ ...item, newPriceId: created.id });
  }

  console.log('\n' + '='.repeat(100));
  console.log('NEW ONE-TIME STAND PRICE IDS');
  console.log('='.repeat(100));
  for (const r of results) {
    if (r.error) {
      console.log(`${r.pkg.padEnd(13)} FAILED — ${r.error}`);
      continue;
    }
    console.log(
      `${r.pkg.padEnd(13)} ${r.newPriceId.padEnd(32)} ${formatAmount(r.unitAmount, r.currency).padEnd(14)} ` +
      `(was recurring: ${r.oldPriceId})`
    );
  }
  console.log('='.repeat(100));

  const failed = results.filter(r => r.error);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} price(s) failed to create — see errors above.`);
  } else {
    console.log('\n✅ All one-time prices created. Paste the IDs above back so they can be wired into');
    console.log('   PACKS.prices.stand and the webhook PRICE_INFO table.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
