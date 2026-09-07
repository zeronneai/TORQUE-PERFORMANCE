import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { computeCancellationQuote } from './_cancellation.js';
import { getVerifiedUserId } from './_auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// READ-ONLY. Returns the cancellation breakdown for the confirmation screen. No charge,
// no Stripe writes. The fee shown here is authoritative-computed but is recomputed again
// at charge time in create-cancellation-checkout — the client never gets to set it.
// NOTE: follows the app's existing body-trusted posture (parentId comes from the client).
// Recommended hardening before/soon after launch: verify the Clerk session maps to parentId.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
    console.error('[cancel-quote] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}
