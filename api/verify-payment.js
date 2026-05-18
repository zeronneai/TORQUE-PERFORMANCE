import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PRICE_INFO = {
  // PACKAGE A (live)
  'price_1TLqDdAPTWbxe0YytEOlF7ZH': { sessions: 4,  name: 'Package A' },
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': { sessions: 4,  name: 'Package A' },
  'price_1TLqDmAPTWbxe0YysigUumPn': { sessions: 4,  name: 'Package A' },
  'price_1TLqDlAPTWbxe0YyljY5WD6Y': { sessions: 4,  name: 'Package A' },
  // PACKAGE AA (live)
  'price_1TLqDgAPTWbxe0Yy7yaP3VX3': { sessions: 8,  name: 'Package AA' },
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': { sessions: 8,  name: 'Package AA' },
  'price_1TLqDjAPTWbxe0YyTsqaUdt5': { sessions: 8,  name: 'Package AA' },
  'price_1TLqDkAPTWbxe0YykcsrB50f': { sessions: 8,  name: 'Package AA' },
  // PACKAGE AAA (live)
  'price_1TLqDhAPTWbxe0YyXXJQZrh7': { sessions: 12, name: 'Package AAA' },
  'price_1TLqDkAPTWbxe0YydXEB3YqT': { sessions: 12, name: 'Package AAA' },
  'price_1TLqDjAPTWbxe0YyuyUujCu4': { sessions: 12, name: 'Package AAA' },
  'price_1TLqDkAPTWbxe0Yy8UHtMvEJ': { sessions: 12, name: 'Package AAA' },
  // PACKAGE MLB (live)
  'price_1TLqDdAPTWbxe0YydO64XMLw': { sessions: 20, name: 'Package MLB' },
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': { sessions: 20, name: 'Package MLB' },
  'price_1TLqDjAPTWbxe0YyVQxRaHFs': { sessions: 20, name: 'Package MLB' },
  'price_1TLqDjAPTWbxe0Yy6fRLwlFM': { sessions: 20, name: 'Package MLB' },
};

function addMonths(unixTs, months) {
  const d = new Date(unixTs * 1000);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session_id = req.query?.session_id || req.body?.session_id;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id);
  } catch (err) {
    console.error('[verify-payment] Stripe retrieve error:', err.message);
    return res.status(400).json({ error: 'Invalid session_id' });
  }

  if (session.payment_status !== 'paid') {
    return res.status(402).json({ error: 'Payment not completed', status: session.payment_status });
  }

  // Dedup: webhook may have already processed this session
  const { data: alreadyDone } = await supabase
    .from('player_memberships')
    .select('id, expires_at, sessions_total')
    .eq('stripe_session_id', session_id)
    .maybeSingle();

  if (alreadyDone) {
    const nowIso = new Date().toISOString();
    if (alreadyDone.expires_at > nowIso && alreadyDone.sessions_total > 0) {
      console.log('[verify-payment] Already processed by webhook:', session_id);
      return res.status(200).json({ ok: true, message: 'already_processed' });
    }
    // Found by stripe_session_id but membership still expired — fall through to re-process
    console.log('[verify-payment] Record found but membership still expired — re-processing:', session_id);
  }

  const ref   = decodeURIComponent(session.client_reference_id || '');
  const parts = ref.split('__');
  if (parts.length !== 3) {
    console.error('[verify-payment] Invalid client_reference_id:', ref);
    return res.status(400).json({ error: 'Invalid client_reference_id' });
  }

  const [parentId, kidName, priceId] = parts;
  const info = PRICE_INFO[priceId];
  if (!info) {
    console.error('[verify-payment] Unknown price ID:', priceId);
    return res.status(400).json({ error: 'Unknown price ID' });
  }

  const isAnnual        = session.mode === 'payment';
  const stripePaymentId = isAnnual ? session.payment_intent : session.subscription;
  const purchasedAt     = new Date(session.created * 1000).toISOString();
  const expiresAt       = addMonths(session.created, isAnnual ? 12 : 1);

  // Always replace sessions_total with the package amount and reset sessions_used to 0,
  // regardless of what the member had remaining before.
  const payload = {
    sessions_total:    info.sessions,
    sessions_used:     0,
    package_name:      info.name,
    stripe_payment_id: stripePaymentId,
    stripe_session_id: session_id,
    status:            'active',
    purchased_at:      purchasedAt,
    expires_at:        expiresAt,
  };

  // Update existing record (e.g. manual member paying via Stripe) or insert new
  const { data: existing } = await supabase
    .from('player_memberships')
    .select('id')
    .eq('parent_id', parentId)
    .ilike('kid_name', kidName)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('player_memberships').update(payload).eq('id', existing.id);
    if (error) {
      console.error('[verify-payment] Update error:', error);
      return res.status(500).json({ error: error.message });
    }
  } else {
    const { error } = await supabase.from('player_memberships').insert({ ...payload, parent_id: parentId, kid_name: kidName });
    if (error) {
      console.error('[verify-payment] Insert error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  console.log(`[verify-payment] ✅ ${existing ? 'Updated' : 'Created'} — ${kidName} / ${info.name} / ${info.sessions} sessions (${isAnnual ? 'annual' : 'monthly'})`);
  return res.status(200).json({ ok: true, package: info.name, sessions: info.sessions });
}
