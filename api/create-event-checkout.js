import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SUCCESS_URL = 'https://app.torquebaseball.us/?event=success';
const CANCEL_URL  = 'https://app.torquebaseball.us';
const TTL_MINUTES = 30;   // must match reserve_promo_spot default + Stripe min expiry

// One-time checkout for a paid promo event (e.g. the Labor Day camp).
// STRICT CAP: a spot is reserved atomically via reserve_promo_spot() BEFORE the
// Stripe session is created; if the event is sold out (or the kid's age is out of
// range) the RPC returns null and we never create a session. The registration is
// confirmed later by the webhook (checkout.session.completed, metadata.type=promo_event).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = req.body || {};
    const eventId    = (b.eventId || '').trim();
    const slug       = (b.slug || '').trim();
    const parentId   = (b.parentId || '').trim();
    const parentName = (b.parentName || '').trim();
    const playerName = (b.playerName || '').trim();
    const email      = (b.email || '').trim();
    const phone      = (b.phone || '').trim();
    const playerAge  = parseInt(b.playerAge, 10);

    if ((!eventId && !slug) || !parentId || !playerName || Number.isNaN(playerAge)) {
      return res.status(400).json({ error: 'Missing required fields (event, parentId, playerName, playerAge).' });
    }

    // Load the target event (must be active). We need its Stripe price + age range.
    let q = supabase.from('promo_events')
      .select('id, slug, title, stripe_price_id, price_cents, min_age, max_age, active');
    q = eventId ? q.eq('id', eventId) : q.eq('slug', slug);
    const { data: ev, error: evErr } = await q.maybeSingle();

    if (evErr)          return res.status(500).json({ error: 'Could not load event.' });
    if (!ev || !ev.active) return res.status(404).json({ error: 'Event not found or not active.' });
    if (!ev.stripe_price_id) return res.status(500).json({ error: 'Event has no Stripe price configured.' });

    // Friendly age-range error before we bother reserving (RPC also enforces this).
    if ((ev.min_age != null && playerAge < ev.min_age) ||
        (ev.max_age != null && playerAge > ev.max_age)) {
      return res.status(422).json({ error: 'ageOutOfRange', min_age: ev.min_age, max_age: ev.max_age });
    }

    // ── Atomic reservation (strict cap). null = sold out (or age gate). ──
    const { data: regId, error: rpcErr } = await supabase.rpc('reserve_promo_spot', {
      p_event_id:    ev.id,
      p_parent_id:   parentId,
      p_parent_name: parentName,
      p_player_name: playerName,
      p_player_age:  playerAge,
      p_email:       email,
      p_phone:       phone,
      p_ttl_minutes: TTL_MINUTES,
    });
    if (rpcErr) { console.error('[create-event-checkout] reserve error:', rpcErr.message); return res.status(500).json({ error: 'Reservation failed.' }); }
    if (!regId) return res.status(409).json({ soldOut: true, error: 'This event is sold out.' });

    // ── Create the one-time Stripe checkout session. ──
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: ev.stripe_price_id, quantity: 1 }],
        success_url: SUCCESS_URL,
        cancel_url:  CANCEL_URL,
        expires_at:  Math.floor(Date.now() / 1000) + TTL_MINUTES * 60,
        ...(email ? { customer_email: email } : {}),
        // Discriminator the webhook keys on — event payments must NEVER be
        // parsed as memberships. client_reference_id is deliberately NOT in the
        // membership `parentId__kidName__priceId` shape.
        client_reference_id: `promo__${regId}`,
        metadata: { type: 'promo_event', promo_event_id: ev.id, registration_id: regId },
      });
    } catch (stripeErr) {
      // Release the just-reserved spot so an abandoned session doesn't hold it.
      await supabase.from('promo_registrations')
        .update({ status: 'expired' }).eq('id', regId).eq('status', 'pending');
      console.error('[create-event-checkout] Stripe error:', stripeErr.message);
      return res.status(500).json({ error: stripeErr.message });
    }

    // Link the session to the reservation so the webhook (and expiry release) can match it.
    await supabase.from('promo_registrations')
      .update({ stripe_session_id: session.id }).eq('id', regId);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[create-event-checkout] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}
