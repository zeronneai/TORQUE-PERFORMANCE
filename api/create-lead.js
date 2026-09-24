import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_SOURCES = new Set(['main-landing-trial', 'tournament-landing']);
const clamp = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// ── Tryout registration (folded in from the former create-tryout-registration.js
//    to stay under Vercel's function cap). Reached ONLY when the body carries
//    type:'tryout'. Leads (the live landing form) post NO type and are handled by
//    the unchanged lead path below. ──
const TRYOUT_SLUG = 'torque-youth-tryout-2026-10-10';

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

// Self-contained tryout handler. Behaves exactly like the old dedicated endpoint:
// same validation order, same status codes, same JSON. Honeypot is already handled
// by the shared check in the main handler before this is called.
async function handleTryout(b, res) {
  const parent_name  = clamp(b.parentName, 120);
  const parent_email = clamp(b.parentEmail, 160);
  const parent_phone = clamp(b.parentPhone, 40);
  const player_name  = clamp(b.playerName, 120);

  // Age drives the slot. Parse strictly; reject anything over 13 with a clear message.
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
    console.error('[create-lead:tryout] insert failed:', error.message);
    return res.status(500).json({ error: 'Could not save your registration.' });
  }

  return res.status(200).json({ ok: true, age_group: slot.age_group, time_slot: slot.time_slot });
}

// Public form-intake endpoint for the static landing forms. Additive to the
// existing Google Apps Script (Sheet + email). Inserts with the service-role key.
// Default path = trial LEAD (unchanged). type:'tryout' → tryout registration.
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

    // Route tryout submissions; everything else is a trial lead. The live landing
    // leads form posts NO type field, so it falls through to the unchanged path below.
    if (b.type === 'tryout') return await handleTryout(b, res);

    // ── TRIAL LEAD (unchanged behavior — byte-for-byte the original create-lead) ──
    const parent_name = clamp(b.parentName, 120);
    const phone = clamp(b.phone, 40);
    const email = clamp(b.email, 160);

    // Require a name + at least one way to contact them.
    if (!parent_name || (!phone && !email)) {
      return res.status(400).json({ error: 'Missing parentName and phone or email.' });
    }

    const row = {
      parent_name,
      phone,
      email,
      player_name:   clamp(b.playerName, 120),
      player_age:    clamp(b.playerAge, 20),
      preferred_day: clamp(b.preferredDay, 60),
      source:        ALLOWED_SOURCES.has(b.source) ? b.source : 'unknown',
      status:        'new',   // forced — never trust an incoming status
      // created_at left to the DB default (server time) — incoming timestamp ignored
    };

    const { error } = await supabase.from('leads').insert(row);
    if (error) {
      console.error('[create-lead] insert failed:', error.message);
      return res.status(500).json({ error: 'Could not save lead.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[create-lead] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}
