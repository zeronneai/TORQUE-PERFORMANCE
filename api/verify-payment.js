import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PACKAGE_SESSIONS = {
  // PAQUETE A
  'price_1TFiVSAaoJKjkq1OgPOYmeX7': { sessions: 4,   name: 'Paquete A' },
  'price_1TFiVSAaoJKjkq1OvDzbHwbd': { sessions: 24,  name: 'Paquete A' },
  'price_1TFiWHAaoJKjkq1OaioJwHRp': { sessions: 48,  name: 'Paquete A' },
  'price_1TFiWHAaoJKjkq1Oge43FYOo': { sessions: 48,  name: 'Paquete A' },
  // PAQUETE AA
  'price_1TFiX7AaoJKjkq1OLnC5HLaS': { sessions: 8,   name: 'Paquete AA' },
  'price_1TFiYpAaoJKjkq1OxvBFuzPJ': { sessions: 48,  name: 'Paquete AA' },
  'price_1TFiYpAaoJKjkq1O8oFYz5VK': { sessions: 96,  name: 'Paquete AA' },
  'price_1TFiYpAaoJKjkq1OBHUagz9Y': { sessions: 96,  name: 'Paquete AA' },
  // PAQUETE AAA
  'price_1TFia1AaoJKjkq1O9XQZ5YbZ': { sessions: 12,  name: 'Paquete AAA' },
  'price_1TFiaXAaoJKjkq1OTrt1aWsR': { sessions: 72,  name: 'Paquete AAA' },
  'price_1TFiaXAaoJKjkq1OObbQEbnX': { sessions: 144, name: 'Paquete AAA' },
  'price_1TFiaXAaoJKjkq1OW0sZ5nOP': { sessions: 144, name: 'Paquete AAA' },
  // PAQUETE MLB
  'price_1TFibiAaoJKjkq1Oi9ZGJwyy': { sessions: 20,  name: 'Paquete MLB' },
  'price_1TFicFAaoJKjkq1OK0b6zjq5': { sessions: 120, name: 'Paquete MLB' },
  'price_1TFicFAaoJKjkq1OBV6hiqhS': { sessions: 240, name: 'Paquete MLB' },
  'price_1TFicFAaoJKjkq1O0GJqz9Th': { sessions: 240, name: 'Paquete MLB' },
};

export default async function handler(req, res) {
  // Allow CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session_id = req.query?.session_id || req.body?.session_id;

  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

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

  // Check if already processed (idempotent)
  const { data: existing } = await supabase
    .from('player_memberships')
    .select('id')
    .eq('stripe_session_id', session_id)
    .maybeSingle();

  if (existing) {
    console.log('[verify-payment] Already processed:', session_id);
    return res.status(200).json({ ok: true, message: 'already_processed' });
  }

  // Parse client_reference_id: parentId__kidName__priceId
  const ref = decodeURIComponent(session.client_reference_id || '');
  const parts = ref.split('__');
  if (parts.length !== 3) {
    console.error('[verify-payment] Invalid client_reference_id:', ref);
    return res.status(400).json({ error: 'Invalid client_reference_id' });
  }

  const [parentId, kidName, priceId] = parts;
  const packageInfo = PACKAGE_SESSIONS[priceId];

  if (!packageInfo) {
    console.error('[verify-payment] Unknown price ID:', priceId);
    return res.status(400).json({ error: 'Unknown price ID' });
  }

  const { error: insertError } = await supabase
    .from('player_memberships')
    .insert({
      parent_id: parentId,
      kid_name: kidName,
      package_name: packageInfo.name,
      sessions_total: packageInfo.sessions,
      sessions_used: 0,
      stripe_payment_id: session.payment_intent,
      stripe_session_id: session_id,
      status: 'active',
    });

  if (insertError) {
    console.error('[verify-payment] Supabase insert error:', insertError);
    return res.status(500).json({ error: insertError.message });
  }

  console.log(`[verify-payment] ✅ Membership created: ${kidName} - ${packageInfo.name} - ${packageInfo.sessions} sesiones`);
  return res.status(200).json({ ok: true, message: 'created', package: packageInfo.name, sessions: packageInfo.sessions });
}
