import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const RETURN_URL = 'https://app.torquebaseball.us/?billing=updated';

// Resolve the Stripe customer id for a parent's recurring subscription, then hand
// them Stripe's hosted Customer Portal to update their saved card / manage billing.
// Primary path: subscription id (sub_...) -> subscription.customer. Fallbacks:
// checkout session id -> session.customer, then customer lookup by email.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subscriptionId, sessionId, email } = req.body || {};

  if (!subscriptionId && !sessionId && !email) {
    return res.status(400).json({ error: 'Missing subscriptionId (or sessionId / email fallback).' });
  }

  try {
    let customer = null;

    // 1. Primary — subscription id (sub_...) → its customer.
    if (subscriptionId) {
      if (!String(subscriptionId).startsWith('sub_')) {
        return res.status(400).json({ error: `Not a recurring subscription (got "${subscriptionId}"). Only m6/m12 subscriptions have a card on file.` });
      }
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      } catch (e) {
        console.error('[billing-portal] subscription retrieve failed:', subscriptionId, e.message);
        // fall through to fallbacks
      }
    }

    // 2. Fallback — checkout session id (cs_...) → its customer.
    if (!customer && sessionId) {
      try {
        const cs = await stripe.checkout.sessions.retrieve(sessionId);
        customer = typeof cs.customer === 'string' ? cs.customer : cs.customer?.id;
      } catch (e) {
        console.error('[billing-portal] session retrieve failed:', sessionId, e.message);
      }
    }

    // 3. Last resort — find a customer by email (ambiguous; may not own the sub).
    if (!customer && email) {
      try {
        const list = await stripe.customers.list({ email, limit: 1 });
        customer = list.data[0]?.id || null;
      } catch (e) {
        console.error('[billing-portal] customer list by email failed:', e.message);
      }
    }

    if (!customer) {
      return res.status(404).json({ error: 'Could not resolve a Stripe customer for this account. If you have an active subscription, contact Torque Performance.' });
    }

    let portal;
    try {
      portal = await stripe.billingPortal.sessions.create({ customer, return_url: RETURN_URL });
    } catch (e) {
      // Most common cause: the Customer Portal isn't enabled/configured in the Stripe Dashboard.
      console.error('[billing-portal] billingPortal.sessions.create failed:', e.message);
      const hint = /configuration|No configuration|not been created|portal/i.test(e.message || '')
        ? ' (Enable the Customer Portal in Stripe → Settings → Billing → Customer portal.)'
        : '';
      return res.status(500).json({ error: `Could not open the billing portal.${hint}` });
    }

    return res.status(200).json({ url: portal.url });
  } catch (err) {
    console.error('[create-billing-portal] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
