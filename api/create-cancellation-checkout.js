import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { computeCancellationQuote } from './_cancellation.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SUCCESS_URL = 'https://app.torquebaseball.us/?cancel=success';
const CANCEL_URL  = 'https://app.torquebaseball.us';
const PLAN_LABELS = { stand: 'Month-to-Month', m6: '6-Month', m12: '12-Month', annual: 'Annual' };

// Fee paths only (m6 buyout, m12 early-termination). RECOMPUTES the fee server-side via
// computeCancellationQuote — the client cannot supply or influence the amount. Creates a
// dynamically-priced one-time Checkout Session. Nothing about the membership or subscription
// changes here: the subscription is cancelled ONLY after payment succeeds, in the webhook
// (checkout.session.completed, metadata.type='cancellation'). Abandoned checkout = no change.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = req.body || {};
    const parentId = (b.parentId || '').trim();
    const kidName = (b.kidName || '').trim();
    const membershipId = (b.membershipId || '').trim();
    if (!membershipId && (!parentId || !kidName)) {
      return res.status(400).json({ error: 'Missing membershipId or (parentId + kidName).' });
    }

    // Authoritative recompute — ignore anything fee-related from the client.
    const quote = await computeCancellationQuote({ stripe, supabase, parentId, kidName, membershipId });
    if (!quote.ok && quote.error) return res.status(500).json({ error: quote.error });

    // Only a genuine fee decision proceeds here. Everything else is routed by decision so
    // the client can react (free cancel → cancel-membership; refuse/info → show a message).
    if (quote.decision !== 'fee') {
      return res.status(409).json({ error: 'not_a_fee_cancellation', decision: quote.decision, reason: quote.reason || null });
    }
    if (!Number.isInteger(quote.feeCents) || quote.feeCents <= 0) {
      return res.status(422).json({ error: 'invalid_fee', decision: quote.decision });
    }
    if (!quote.customer) return res.status(422).json({ error: 'no_stripe_customer' });

    const m = quote.membership;
    const label = PLAN_LABELS[quote.billingType] || quote.billingType;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: quote.customer,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: quote.feeCents,                              // server-computed cents
          product_data: { name: `Membership cancellation — ${m.kid_name} (${label})` },
        },
      }],
      success_url: SUCCESS_URL,
      cancel_url:  CANCEL_URL,
      // The webhook keys on metadata.type; it cancels the sub + records the row AFTER payment.
      client_reference_id: `cancel__${m.id}`,
      metadata: {
        type:             'cancellation',
        membership_id:    m.id,
        subscription_id:  quote.subId,
        parent_id:        m.parent_id,
        kid_name:         m.kid_name,
        cancel_mode:      quote.cancelMode,            // 'immediate' (m6) | 'period_end' (m12)
        fee_cents:        String(quote.feeCents),
        contract_version: quote.signedVersion,
        months_remaining: String(quote.monthsRemaining),
      },
    });

    return res.status(200).json({ url: session.url, fee_cents: quote.feeCents });
  } catch (err) {
    console.error('[create-cancellation-checkout] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
