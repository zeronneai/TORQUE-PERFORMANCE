import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Public endpoint: how many spots are left for a promo event. Drives the flyer
// announcement, the Promos section, and the pay button's SOLD OUT state.
// A spot is "taken" if it's paid OR a still-valid pending reservation.
// Query: ?slug=<slug> or ?eventId=<uuid>; with neither, returns the active event.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { slug, eventId } = req.query || {};

    let q = supabase.from('promo_events')
      .select('id, slug, title, description, flyer_url, price_cents, event_date, event_time, age_range, min_age, max_age, capacity, active');
    if (eventId)   q = q.eq('id', eventId);
    else if (slug) q = q.eq('slug', slug);
    else           q = q.eq('active', true);
    const { data: ev, error: evErr } = await q.maybeSingle();

    if (evErr) { console.error('[event-status] load error:', evErr.message); return res.status(500).json({ error: 'Could not load event.' }); }
    if (!ev)   return res.status(200).json({ event: null, soldOut: false, spotsRemaining: 0 });

    const nowISO = new Date().toISOString();
    const { count: paidCount } = await supabase
      .from('promo_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('promo_event_id', ev.id)
      .eq('status', 'paid');
    const { count: pendingCount } = await supabase
      .from('promo_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('promo_event_id', ev.id)
      .eq('status', 'pending')
      .gt('reserved_until', nowISO);

    const taken          = (paidCount || 0) + (pendingCount || 0);
    const spotsRemaining = Math.max(0, ev.capacity - taken);
    const soldOut        = spotsRemaining <= 0;

    return res.status(200).json({ event: ev, taken, spotsRemaining, soldOut });
  } catch (err) {
    console.error('[event-status] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}
