import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { computeCancellationQuote } from './_cancellation.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// NO-FEE cancellations only. Recomputes the decision server-side:
//   free_cancel (stand-sub / past-term m6·m12) → schedule the Stripe sub to cancel at period
//                end (member keeps the month already paid) + record the pending cancellation.
//   info_only  (stand one-time pi_)            → nothing to cancel; returns an informational
//                message (access lapses at expires_at).
// Any decision with a fee is rejected here (must go through create-cancellation-checkout);
// 'refuse' is rejected with the reason. Finalization to status='canceled' happens later in
// the customer.subscription.deleted webhook handler.
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

    const quote = await computeCancellationQuote({ stripe, supabase, parentId, kidName, membershipId });
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
        console.error('[cancel-membership] stripe update failed:', quote.subId, e.message);
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
    console.error('[cancel-membership] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}
