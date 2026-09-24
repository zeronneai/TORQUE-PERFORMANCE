import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fixed slug for this tryout — set server-side so every row is grouped together
// and an incoming value can't scatter registrations across bogus slugs.
const TRYOUT_SLUG = 'torque-youth-tryout-2026-10-10';

const clamp = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// Age → (age_group, time_slot), derived SERVER-SIDE so the parent never picks the
// wrong slot. 9U means "9 and under" (an 8-year-old registers into 9U), so there is
// no lower bound beyond a sane positive age. Upper limit is 13; above that is rejected.
function slotForAge(age) {
  if (!Number.isInteger(age) || age < 1) return null; // not a real age
  if (age <= 9)                 return { age_group: '9U',      time_slot: '9:00 AM' };   // 9 and under
  if (age === 10 || age === 11) return { age_group: '11U',     time_slot: '11:00 AM' };  // 10–11
  if (age === 12 || age === 13) return { age_group: '12U/13U', time_slot: '1:00 PM' };   // 12–13
  return null;                                                                           // over 13
}

// Public tryout-registration endpoint for the static landing site. Free event —
// no payment, just capture who's coming. Inserts with the service-role key.
export default async function handler(req, res) {
  // CORS — set on every response, before any early return, so the landing
  // (torquebaseball.us) can POST cross-origin. The preflight MUST allow the
  // Content-Type header or the browser blocks the real POST.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = req.body || {};

    // Honeypot: bots fill hidden fields. If present/filled, pretend success, insert nothing.
    if (b.company || b.website || b.honeypot) return res.status(200).json({ ok: true });

    const parent_name  = clamp(b.parentName, 120);
    const parent_email = clamp(b.parentEmail, 160);
    const parent_phone = clamp(b.parentPhone, 40);
    const player_name  = clamp(b.playerName, 120);

    // Age drives the slot. Parse strictly; reject anything outside 9–13 with a clear message.
    const player_age = parseInt(b.playerAge, 10);
    const slot = slotForAge(player_age);
    if (!slot) {
      return res.status(400).json({ error: 'This tryout is for players 13 and under. Please enter a valid age.' });
    }

    // Require a player, a parent name, and at least one way to reach them.
    if (!player_name || !parent_name || (!parent_email && !parent_phone)) {
      return res.status(400).json({ error: 'Missing player name, parent name, or a phone/email to contact you.' });
    }

    const row = {
      tryout_slug:  TRYOUT_SLUG,   // forced — never trust an incoming slug
      parent_name,
      parent_email,
      parent_phone,
      player_name,
      player_age,                  // integer, validated above
      age_group:    slot.age_group, // derived server-side
      time_slot:    slot.time_slot, // derived server-side
      position:     clamp(b.position, 60),
      current_team: clamp(b.currentTeam, 120),
      notes:        clamp(b.notes, 1000),
      status:       'registered',  // forced — never trust an incoming status
      // created_at left to the DB default (server time) — incoming timestamp ignored
    };

    const { error } = await supabase.from('tryout_registrations').insert(row);
    if (error) {
      console.error('[create-tryout-registration] insert failed:', error.message);
      return res.status(500).json({ error: 'Could not save your registration.' });
    }

    return res.status(200).json({ ok: true, age_group: slot.age_group, time_slot: slot.time_slot });
  } catch (err) {
    console.error('[create-tryout-registration] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}
