import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { computeCancellationQuote } from './_cancellation.js';
import { getVerifiedUserId } from './_auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SUCCESS_URL = 'https://app.torquebaseball.us/?cancel=success';
const CANCEL_URL  = 'https://app.torquebaseball.us';
const PLAN_LABELS = { stand: 'Month-to-Month', m6: '6-Month', m12: '12-Month', annual: 'Annual' };

// Consolidated cancellation endpoint (folds the former cancel-quote,
// cancel-membership and create-cancellation-checkout into one function to stay
// under Vercel's function cap). The `action` field selects the path; each path
// reproduces its original handler EXACTLY — same status codes, same JSON shapes,
// same catch behavior — so the parent UI that branches on them is unaffected.
//   action:'quote'    → read-only breakdown (was cancel-quote)
//   action:'cancel'   → no-fee cancel / info-only (was cancel-membership)
//   action:'checkout' → fee checkout session (was create-cancellation-checkout)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = ((req.body || {}).action || '').trim();
  if (action === 'quote')    return handleQuote(req, res);
  if (action === 'cancel')   return handleCancel(req, res);
  if (action === 'checkout') return handleCheckout(req, res);
  return res.status(400).json({ error: 'Missing or invalid action.' });
}

// ── action:'quote' — was api/cancel-quote.js ──────────────────────────────────
// READ-ONLY. Returns the cancellation breakdown for the confirmation screen. No charge,
// no Stripe writes. The fee shown here is authoritative-computed but is recomputed again
// at charge time in the 'checkout' path — the client never gets to set it.
async function handleQuote(req, res) {
  try {
    // parentId comes from the verified token, NOT the body.
    const parentId = await getVerifiedUserId(req);
    if (!parentId) return res.status(401).json({ error: 'unauthorized' });
    const kidName = ((req.body || {}).kidName || '').trim();
    if (!kidName) return res.status(400).json({ error: 'Missing kidName.' });

    const quote = await computeCancellationQuote({ stripe, supabase, parentId, kidName });
    if (!quote.ok && quote.error) return res.status(500).json({ error: quote.error });

    const m = quote.membership || {};
    // Display-only payload (dollars derived from cents on the client).
    return res.status(200).json({
      decision:        quote.decision,           // 'fee' | 'free_cancel' | 'info_only' | 'refuse'
      reason:          quote.reason || null,
      kid_name:        m.kid_name || kidName,
      package_name:    m.package_name || null,
      billing_type:    quote.billingType || null,
      contract_version: quote.signedVersion || null,
      term_start:      m.term_start || null,
      term_end:        m.term_end || null,
      months_remaining: quote.monthsRemaining ?? null,
      monthly_cents:   quote.monthly ?? null,
      cap_months:      quote.capMonths ?? null,
      fee_cents:       quote.feeCents ?? null,
      cancel_mode:     quote.cancelMode || null,  // 'immediate' | 'period_end'
      effective_at:    quote.effectiveAt ? new Date(quote.effectiveAt).toISOString() : (m.expires_at || null),
    });
  } catch (err) {
    console.error('[cancellation:quote] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}

// ── action:'cancel' — was api/cancel-membership.js ────────────────────────────
// NO-FEE cancellations only. Recomputes the decision server-side:
//   free_cancel (stand-sub / past-term m6·m12) → schedule the Stripe sub to cancel at period
//                end (member keeps the month already paid) + record the pending cancellation.
//   info_only  (stand one-time pi_)            → nothing to cancel; returns an informational
//                message (access lapses at expires_at).
// Any decision with a fee is rejected here (must go through action:'checkout');
// 'refuse' is rejected with the reason. Finalization to status='canceled' happens later in
// the customer.subscription.deleted webhook handler.
async function handleCancel(req, res) {
  try {
    // parentId comes from the verified token, NOT the body.
    const parentId = await getVerifiedUserId(req);
    if (!parentId) return res.status(401).json({ error: 'unauthorized' });
    const kidName = ((req.body || {}).kidName || '').trim();
    if (!kidName) return res.status(400).json({ error: 'Missing kidName.' });

    const quote = await computeCancellationQuote({ stripe, supabase, parentId, kidName });
    if (!quote.ok && quote.error) return res.status(500).json({ error: quote.error });

    if (quote.decision === 'fee')     return res.status(409).json({ error: 'fee_required', reason: 'use create-cancellation-checkout' });
    if (quote.decision === 'refuse')  return res.status(403).json({ error: 'not_cancellable', reason: quote.reason || null });

    const m = quote.membership;

    // Month-to-month one-time: nothing recurring to cancel.
    if (quote.decision === 'info_only') {
      return res.status(200).json({ ok: true, info: true, message: 'Month-to-month plan — nothing to cancel. Access continues through the month already purchased and will not renew.', expires_at: m.expires_at || null });
    }

    // free_cancel → cancel the subscription at period end (keep the paid month).
    if (quote.decision === 'free_cancel') {
      if (!(quote.subId || '').startsWith('sub_')) return res.status(422).json({ error: 'no_subscription' });
      try {
        await stripe.subscriptions.update(quote.subId, { cancel_at_period_end: true });   // Stripe action FIRST
      } catch (e) {
        console.error('[cancellation:cancel] stripe update failed:', quote.subId, e.message);
        return res.status(502).json({ error: 'stripe_update_failed' });   // nothing recorded → nothing changed
      }
      const effectiveAt = quote.effectiveAt ? new Date(quote.effectiveAt).toISOString() : null;
      // Record the pending cancellation. status stays 'active' until the sub is actually
      // deleted (customer.subscription.deleted finalizes to 'canceled').
      await supabase.from('player_memberships').update({
        cancel_requested_at:     new Date().toISOString(),
        cancel_effective_at:     effectiveAt,
        cancel_fee_cents:        0,
        cancel_contract_version: quote.signedVersion,
      }).eq('id', m.id);
      return res.status(200).json({ ok: true, effective_at: effectiveAt });
    }

    return res.status(400).json({ error: 'unhandled_decision', decision: quote.decision });
  } catch (err) {
    console.error('[cancellation:cancel] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}

// ── action:'checkout' — was api/create-cancellation-checkout.js ───────────────
// Fee paths only (m6 buyout, m12 early-termination). RECOMPUTES the fee server-side via
// computeCancellationQuote — the client cannot supply or influence the amount. Creates a
// dynamically-priced one-time Checkout Session. Nothing about the membership or subscription
// changes here: the subscription is cancelled ONLY after payment succeeds, in the webhook
// (checkout.session.completed, metadata.type='cancellation'). Abandoned checkout = no change.
async function handleCheckout(req, res) {
  try {
    // parentId comes from the verified token, NOT the body.
    const parentId = await getVerifiedUserId(req);
    if (!parentId) return res.status(401).json({ error: 'unauthorized' });
    const kidName = ((req.body || {}).kidName || '').trim();
    if (!kidName) return res.status(400).json({ error: 'Missing kidName.' });

    // Authoritative recompute — ignore anything fee-related from the client.
    const quote = await computeCancellationQuote({ stripe, supabase, parentId, kidName });
    if (!quote.ok && quote.error) return res.status(500).json({ error: quote.error });

    // Only a genuine fee decision proceeds here. Everything else is routed by decision so
    // the client can react (free cancel → action:'cancel'; refuse/info → show a message).
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
    console.error('[cancellation:checkout] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
