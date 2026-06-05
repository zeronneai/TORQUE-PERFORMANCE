// ============================================================
// TORQUE PERFORMANCE — Find Orphaned Stripe Payments
// Finds checkout.session.completed events in the last 30 days
// where client_reference_id is null (membership never created).
//
// Run (PowerShell):
//   $env:STRIPE_SECRET_KEY="sk_live_..."
//   node find-orphaned-payments.mjs
//
// Run (bash/zsh):
//   STRIPE_SECRET_KEY=sk_live_... node find-orphaned-payments.mjs
// ============================================================

import { createWriteStream } from 'fs';
import https from 'https';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }

// Price ID → package name + billing type (from stripe-webhook.js + STRIPE_LINKS)
const PRICE_INFO = {
  'price_1TLqDdAPTWbxe0YytEOlF7ZH': { pkg: 'Package A',   billing: 'Month-to-Month' },
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': { pkg: 'Package A',   billing: '6-Month'        },
  'price_1TLqDmAPTWbxe0YysigUumPn': { pkg: 'Package A',   billing: '12-Month'       },
  'price_1TLqDlAPTWbxe0YyljY5WD6Y': { pkg: 'Package A',   billing: 'Annual'         },
  'price_1TLqDgAPTWbxe0Yy7yaP3VX3': { pkg: 'Package AA',  billing: 'Month-to-Month' },
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': { pkg: 'Package AA',  billing: '6-Month'        },
  'price_1TLqDjAPTWbxe0YyTsqaUdt5': { pkg: 'Package AA',  billing: '12-Month'       },
  'price_1TLqDkAPTWbxe0YykcsrB50f': { pkg: 'Package AA',  billing: 'Annual'         },
  'price_1TLqDhAPTWbxe0YyXXJQZrh7': { pkg: 'Package AAA', billing: 'Month-to-Month' },
  'price_1TLqDkAPTWbxe0YydXEB3YqT': { pkg: 'Package AAA', billing: '6-Month'        },
  'price_1TLqDjAPTWbxe0YyuyUujCu4': { pkg: 'Package AAA', billing: '12-Month'       },
  'price_1TLqDkAPTWbxe0Yy8UHtMvEJ': { pkg: 'Package AAA', billing: 'Annual'         },
  'price_1TLqDdAPTWbxe0YydO64XMLw': { pkg: 'Package MLB', billing: 'Month-to-Month' },
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': { pkg: 'Package MLB', billing: '6-Month'        },
  'price_1TLqDjAPTWbxe0YyVQxRaHFs': { pkg: 'Package MLB', billing: '12-Month'       },
  'price_1TLqDjAPTWbxe0Yy6fRLwlFM': { pkg: 'Package MLB', billing: 'Annual'         },
};

// Payment link ID → package + billing (from STRIPE_LINKS in add-member.js / ParentPortal.jsx)
const PLINK_INFO = {
  'plink_1TLqDdAPTWbxe0YytEOlF7ZH': { pkg: 'Package A',   billing: 'Month-to-Month' },
  'plink_1TLqDmAPTWbxe0YyqbHEcuFr': { pkg: 'Package A',   billing: '6-Month'        },
  'plink_1TLqDmAPTWbxe0YysigUumPn': { pkg: 'Package A',   billing: '12-Month'       },
  'plink_1TLqDlAPTWbxe0YyljY5WD6Y': { pkg: 'Package A',   billing: 'Annual'         },
  'plink_1TLqDgAPTWbxe0Yy7yaP3VX3': { pkg: 'Package AA',  billing: 'Month-to-Month' },
  'plink_1TLqDkAPTWbxe0YyZu4hFrI3': { pkg: 'Package AA',  billing: '6-Month'        },
  'plink_1TLqDjAPTWbxe0YyTsqaUdt5': { pkg: 'Package AA',  billing: '12-Month'       },
  'plink_1TLqDkAPTWbxe0YykcsrB50f': { pkg: 'Package AA',  billing: 'Annual'         },
  'plink_1TLqDhAPTWbxe0YyXXJQZrh7': { pkg: 'Package AAA', billing: 'Month-to-Month' },
  'plink_1TLqDkAPTWbxe0YydXEB3YqT': { pkg: 'Package AAA', billing: '6-Month'        },
  'plink_1TLqDjAPTWbxe0YyuyUujCu4': { pkg: 'Package AAA', billing: '12-Month'       },
  'plink_1TLqDkAPTWbxe0Yy8UHtMvEJ': { pkg: 'Package AAA', billing: 'Annual'         },
  'plink_1TLqDdAPTWbxe0YydO64XMLw': { pkg: 'Package MLB', billing: 'Month-to-Month' },
  'plink_1TLqDlAPTWbxe0YyEIZi7YR5': { pkg: 'Package MLB', billing: '6-Month'        },
  'plink_1TLqDjAPTWbxe0YyVQxRaHFs': { pkg: 'Package MLB', billing: '12-Month'       },
  'plink_1TLqDjAPTWbxe0Yy6fRLwlFM': { pkg: 'Package MLB', billing: 'Annual'         },
};

function stripeGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.stripe.com',
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    };
    const req = https.request(opts, res => {
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

function resolvePackage(session) {
  // 1. Try price ID from line items (most reliable)
  const priceId = session._priceId;
  if (priceId && PRICE_INFO[priceId]) return PRICE_INFO[priceId];

  // 2. Try payment_link ID
  const plinkId = session.payment_link;
  if (plinkId && PLINK_INFO[plinkId]) return PLINK_INFO[plinkId];

  return { pkg: 'Unknown', billing: 'Unknown' };
}

async function fetchLineItemPriceId(sessionId) {
  try {
    const data = await stripeGet(`/v1/checkout/sessions/${sessionId}/line_items?limit=1`);
    return data.data?.[0]?.price?.id ?? null;
  } catch { return null; }
}

async function main() {
  const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // 30 days ago
  console.error('\nFetching checkout.session.completed events (last 30 days)...');

  const sessions = [];
  let startingAfter = null;
  let page = 0;

  // Paginate through all events
  while (true) {
    let url = `/v1/events?type=checkout.session.completed&limit=100&created[gte]=${since}`;
    if (startingAfter) url += `&starting_after=${startingAfter}`;

    const resp = await stripeGet(url);
    if (resp.error) { console.error('Stripe error:', resp.error.message); process.exit(1); }

    const events = resp.data || [];
    page++;
    console.error(`  Page ${page}: ${events.length} events`);

    for (const ev of events) {
      const s = ev.data.object;
      if (s.payment_status === 'paid' && !s.client_reference_id) {
        sessions.push(s);
      }
    }

    if (!resp.has_more) break;
    startingAfter = events[events.length - 1].id;
  }

  console.error(`\nOrphaned sessions (paid, no client_reference_id): ${sessions.length}`);

  if (sessions.length === 0) {
    console.error('Nothing to write — exiting.');
    process.exit(0);
  }

  // Enrich with line item price ID (to identify package)
  console.error('Fetching line items for each orphaned session...');
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    s._priceId = await fetchLineItemPriceId(s.id);
    process.stderr.write(`\r  ${i + 1}/${sessions.length}`);
  }
  console.error('');

  // Write CSV
  const out = createWriteStream('orphaned-payments.csv');
  const headers = ['session_id','created_date','customer_email','customer_name','subscription_id','payment_link','package','billing_type','amount_total_usd','price_id'];
  out.write(headers.join(',') + '\n');

  for (const s of sessions) {
    const { pkg, billing } = resolvePackage(s);
    const row = [
      s.id,
      new Date(s.created * 1000).toISOString().split('T')[0],
      s.customer_details?.email ?? s.customer_email ?? '',
      s.customer_details?.name ?? '',
      s.subscription ?? '',
      s.payment_link ?? '',
      pkg,
      billing,
      s.amount_total != null ? (s.amount_total / 100).toFixed(2) : '',
      s._priceId ?? '',
    ].map(csvEscape);
    out.write(row.join(',') + '\n');
  }

  out.end(() => {
    console.error(`\n✅ Saved orphaned-payments.csv (${sessions.length} rows)`);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
