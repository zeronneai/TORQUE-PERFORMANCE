// ============================================================
// TORQUE PERFORMANCE — Look up unknown Stripe prices (READ-ONLY)
// Retrieves each price + its product and prints what the owner actually created.
// Also counts how many active subscriptions currently sit on each price.
// No writes. Run:
//   STRIPE_SECRET_KEY=sk_live_... node lookup-prices.mjs
// ============================================================
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
if (!process.env.STRIPE_SECRET_KEY) { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }

const PRICE_IDS = [
  'price_1UBUaSAPTWbxe0YyWWfqiNMg',  // Avery Sanchez
  'price_1UAvCIAPTWbxe0YyVNgFJdDl',  // Mauricio Martinez
  'price_1TvNe4APTWbxe0YyPP4vxjdF',  // shared: Levi (A) + Felipe Bermudez (MLB)
];

for (const id of PRICE_IDS) {
  console.log('\n' + '='.repeat(70));
  try {
    const price = await stripe.prices.retrieve(id, { expand: ['product'] });
    const amt = price.unit_amount != null ? `$${(price.unit_amount / 100).toFixed(2)} ${price.currency?.toUpperCase()}` : '(no unit_amount / tiered?)';
    const rec = price.recurring ? `every ${price.recurring.interval_count || 1} ${price.recurring.interval}` : 'ONE-TIME (no recurring)';
    // Count active subs on this price (paginate a bit).
    let active = 0, sa;
    for (let i = 0; i < 10; i++) {
      const page = await stripe.subscriptions.list({ price: id, status: 'active', limit: 100, ...(sa ? { starting_after: sa } : {}) });
      active += page.data.length;
      if (!page.has_more) break;
      sa = page.data[page.data.length - 1].id;
    }
    console.log(`PRICE ${id}`);
    console.log(`  active:        ${price.active}`);
    console.log(`  amount:        ${amt}`);
    console.log(`  billing:       ${rec}`);
    console.log(`  nickname:      ${price.nickname || '(none)'}`);
    console.log(`  product:       ${price.product?.name || price.product} (${price.product?.id || ''}, active=${price.product?.active})`);
    console.log(`  active subs on this price: ${active}`);
  } catch (e) {
    console.log(`PRICE ${id} — retrieve failed: ${e.message}`);
  }
}
console.log('\nNo changes made. ✅\n');
