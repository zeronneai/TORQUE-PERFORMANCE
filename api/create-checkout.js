import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUCCESS_URL = 'https://app.torquebaseball.us/?payment=success';
const CANCEL_URL  = 'https://app.torquebaseball.us';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, kidName, priceId, sibling, billingType } = req.body;
  if (!userId || !kidName || !priceId) {
    return res.status(400).json({ error: 'Missing required fields: userId, kidName, priceId' });
  }

  try {
    const ref = encodeURIComponent(`${userId}__${kidName}__${priceId}`);

    // 'annual' is a one-time upfront payment; all other plans are recurring subscriptions.
    // Webhook reads isAnnual = (session.mode === 'payment') — must stay in sync.
    const mode = billingType === 'annual' ? 'payment' : 'subscription';

    const sessionParams = {
      mode,
      line_items:          [{ price: priceId, quantity: 1 }],
      client_reference_id: ref,
      success_url:         SUCCESS_URL,
      cancel_url:          CANCEL_URL,
    };

    if (sibling) {
      // Locks 50% sibling coupon — hides the promo-code field so it can't be removed.
      // Never set both discounts and allow_promotion_codes (Stripe rejects it).
      sessionParams.discounts = [{ coupon: 'A5V5CD9F' }];
    } else {
      // First child: allow promo codes (e.g. MLBSUMMER). Works in both payment + subscription mode.
      sessionParams.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
