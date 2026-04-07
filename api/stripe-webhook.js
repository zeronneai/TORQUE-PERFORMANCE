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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Decodear userId__kidName__priceId
    const ref = decodeURIComponent(session.client_reference_id || '');
    const parts = ref.split('__');

    if (parts.length !== 3) {
      console.error('client_reference_id inválido:', ref);
      return res.status(400).json({ error: 'Invalid client_reference_id' });
    }

    const [parentId, kidName, priceId] = parts;
    const packageInfo = PACKAGE_SESSIONS[priceId];

    if (!packageInfo) {
      console.error('Price ID no encontrado:', priceId);
      return res.status(400).json({ error: 'Unknown price ID' });
    }

    const { error } = await supabase
      .from('player_memberships')
      .insert({
        parent_id: parentId,
        kid_name: kidName,
        package_name: packageInfo.name,
        sessions_total: packageInfo.sessions,
        sessions_used: 0,
        stripe_payment_id: session.payment_intent,
        stripe_session_id: session.id,
        status: 'active',
      });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'DB insert failed' });
    }

    console.log(`✅ Membresía creada: ${kidName} - ${packageInfo.name} - ${packageInfo.sessions} sesiones`);
  }

  res.status(200).json({ received: true });
}
