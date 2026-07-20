import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_SOURCES = new Set(['main-landing-trial', 'tournament-landing']);
const clamp = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// Public lead-capture endpoint for the static landing forms. Additive to the
// existing Google Apps Script (Sheet + email). Inserts with the service-role key.
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
