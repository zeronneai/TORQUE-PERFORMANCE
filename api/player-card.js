import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { getVerifiedUserId } from './_auth.js';
import { PHOTO_BUCKET, newToken, parseCode, epParts, epYmd, walkInSlot, teamState, ageOf, verdict } from './_card.js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const SIGNED_SECONDS = 60 * 60;          // photo links last 1 hour
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

// Player cards + entrance scanner. Every call needs Authorization: Bearer <Clerk token>.
//   Parents: my_cards            → their players' cards (token for the QR, photo link, live info)
//            photo_upload        { playerId, image: dataURL }   (own players only)
//   Admins:  scan                { code, commit }  → verdict; commit=true auto-confirms a green scan
//            confirm             { token, override: true }      → "Let in anyway" on a red scan
//            photo_upload        (any player)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getVerifiedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in again.' });
  const b = req.body || {};
  try {
    switch (b.action) {
      case 'my_cards':     return await myCards(userId, res);
      case 'photo_upload': return await photoUpload(b, userId, res);
      case 'scan':         return (await isAdmin(userId)) ? await scan(b, userId, res) : res.status(403).json({ error: 'Admins only.' });
      case 'confirm':      return (await isAdmin(userId)) ? await confirm(b, userId, res) : res.status(403).json({ error: 'Admins only.' });
      default:             return res.status(400).json({ error: 'Missing or invalid action.' });
    }
  } catch (err) {
    console.error(`[player-card] ${b.action} error:`, err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}

async function isAdmin(userId) {
  try { return (await clerk.users.getUser(userId))?.publicMetadata?.role === 'admin'; }
  catch { return false; }
}

const key = (s) => (s || '').toLowerCase().trim();

async function signedPhoto(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_SECONDS);
  return data?.signedUrl || null;
}

async function ensureCard(player) {
  const pid = String(player.id);
  const { data: card } = await supabase.from('player_cards').select('*').eq('player_id', pid).maybeSingle();
  if (card) {
    if (card.kid_name !== player.kid_name) {      // keep the name in sync after a rename
      await supabase.from('player_cards').update({ kid_name: player.kid_name, updated_at: new Date().toISOString() }).eq('player_id', pid);
      card.kid_name = player.kid_name;
    }
    return card;
  }
  const row = { player_id: pid, parent_id: player.parent_id, kid_name: player.kid_name, token: newToken() };
  const { data: ins, error } = await supabase.from('player_cards').insert(row).select('*').single();
  if (error) {   // created at the same moment by another request
    const { data: again } = await supabase.from('player_cards').select('*').eq('player_id', pid).maybeSingle();
    if (again) return again;
    throw error;
  }
  return ins;
}

// Everything the card and the scanner show, read live.
async function liveInfo(player) {
  const [{ data: mems }, { data: teams }] = await Promise.all([
    supabase.from('player_memberships').select('*').eq('parent_id', player.parent_id).eq('status', 'active'),
    supabase.from('team_memberships').select('*').eq('parent_id', player.parent_id).in('status', ['active', 'past_due']),
  ]);
  const membership = (mems || []).filter(m => key(m.kid_name) === key(player.kid_name))
    .sort((a, b) => String(b.purchased_at || '').localeCompare(String(a.purchased_at || '')))[0] || null;
  const team = (teams || []).find(t => key(t.kid_name) === key(player.kid_name) && teamState(t) !== 'canceled') || null;
  return { membership, team };
}

function publicInfo(player, card, membership, team, photoUrl) {
  return {
    player_id: String(player.id),
    kid_name: player.kid_name,
    age: ageOf(player),
    token: card?.token || null,
    photo_url: photoUrl,
    package_name: membership?.package_name || null,
    sessions_total: membership?.sessions_total ?? null,
    sessions_left: membership ? Math.max(0, (membership.sessions_total || 0) - (membership.sessions_used || 0)) : null,
    package_expires: membership?.expires_at || null,
    team_age: team?.team_age ?? null,
    team_state: team ? teamState(team) : null,
  };
}

// ── Parent ────────────────────────────────────────────────────────────────────
async function myCards(parentId, res) {
  const { data: players } = await supabase.from('players').select('*').eq('parent_id', parentId);
  const out = [];
  for (const p of players || []) {
    const card = await ensureCard(p);
    const { membership, team } = await liveInfo(p);
    out.push(publicInfo(p, card, membership, team, await signedPhoto(card.photo_path)));
  }
  return res.status(200).json({ cards: out });
}

async function photoUpload(b, userId, res) {
  const pid = String(b.playerId || '');
  const { data: player } = await supabase.from('players').select('*').eq('id', pid).maybeSingle();
  if (!player) return res.status(404).json({ error: 'Player not found.' });
  if (player.parent_id !== userId && !(await isAdmin(userId))) return res.status(403).json({ error: 'Not your player.' });

  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ''));
  if (!m) return res.status(400).json({ error: 'Send a JPG, PNG or WEBP image.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_PHOTO_BYTES) return res.status(413).json({ error: 'Image too large (max 3 MB).' });

  const card = await ensureCard(player);
  const ext = m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg';
  const path = `${pid}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET)
    .upload(path, buf, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: false });
  if (upErr) { console.error('[player-card] upload:', upErr.message); return res.status(500).json({ error: 'Could not save the photo.' }); }

  await supabase.from('player_cards').update({ photo_path: path, updated_at: new Date().toISOString() }).eq('player_id', pid);
  if (card.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([card.photo_path]).catch(() => {});
  return res.status(200).json({ ok: true, photo_url: await signedPhoto(path) });
}

// ── Scanner (admin) ───────────────────────────────────────────────────────────
async function loadScan(token) {
  const { data: card } = await supabase.from('player_cards').select('*').eq('token', token).maybeSingle();
  if (!card) return null;
  const { data: player } = await supabase.from('players').select('*').eq('id', card.player_id).maybeSingle();
  const p = player || { id: card.player_id, parent_id: card.parent_id, kid_name: card.kid_name };
  const today = epParts().ymd;
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const [{ membership, team }, { data: bks }, { data: cis }, { data: prof }] = await Promise.all([
    liveInfo(p),
    supabase.from('bookings').select('id, kid_name, session_date, session_time, status')
      .eq('parent_id', p.parent_id).eq('session_date', today).eq('status', 'confirmed'),
    supabase.from('checkins').select('id, kid_name, checked_in_at')
      .eq('parent_id', p.parent_id).gte('checked_in_at', since),
    supabase.from('profiles').select('full_name, phone').eq('id', p.parent_id).maybeSingle(),
  ]);
  const bookingToday = (bks || []).find(x => key(x.kid_name) === key(p.kid_name)) || null;
  const checkinToday = (cis || []).find(x => key(x.kid_name) === key(p.kid_name) && epYmd(x.checked_in_at) === today) || null;
  return { card, player: p, membership, team, bookingToday, checkinToday, today, parent: prof || null };
}

function scanPayload(s, v, extra = {}) {
  return {
    ...publicInfo(s.player, s.card, s.membership, s.team, null),
    token: s.card.token,
    parent_name: s.parent?.full_name || null,
    parent_phone: s.parent?.phone || null,
    verdict: v.verdict,
    reason: v.reason,
    sessions_left: v.remaining,
    booking_time: s.bookingToday?.session_time || null,
    checked_in_at: s.checkinToday?.checked_in_at || null,
    ...extra,
  };
}

async function logScan(s, v, action, userId, bookingId = null, deducted = false) {
  await supabase.from('card_scans').insert({
    player_id: s?.player ? String(s.player.id) : null, parent_id: s?.player?.parent_id || null, kid_name: s?.player?.kid_name || null,
    verdict: v.verdict, reason: v.reason, action, booking_id: bookingId, deducted, scanned_by: userId,
  }).then(() => {}, () => {});
}

// Records attendance. plan: 'confirm' (booked today), 'walk_in' (book now + use a session),
// 'free' (override with no session available: attendance only).
async function commit(s, plan, userId) {
  const m = s.membership;
  const remaining = m ? Math.max(0, (m.sessions_total || 0) - (m.sessions_used || 0)) : 0;
  let bookingId = s.bookingToday?.id || null;
  let deducted = false;
  let after = remaining;

  if (plan === 'walk_in') {
    const { data: bk, error } = await supabase.from('bookings').insert([{
      parent_id: s.player.parent_id, kid_name: m?.kid_name || s.player.kid_name, membership_id: m?.id || null,
      session_date: s.today, session_time: walkInSlot(), status: 'confirmed',
    }]).select('id').single();
    if (error) throw error;
    bookingId = bk.id;
    await supabase.from('player_memberships').update({ sessions_used: (m.sessions_used || 0) + 1 }).eq('id', m.id);
    deducted = true;
    after = remaining - 1;
  }
  const { error: ciErr } = await supabase.from('checkins').insert({
    parent_id: s.player.parent_id, kid_name: s.player.kid_name, membership_id: m?.id || null,
    sessions_remaining_after: after,
  });
  if (ciErr) throw ciErr;
  return { bookingId, deducted, after };
}

async function scan(b, userId, res) {
  const token = parseCode(b.code);
  if (!token) return res.status(200).json({ verdict: 'unknown', reason: 'This is not a Torque player card.' });
  const s = await loadScan(token);
  if (!s) {
    await logScan(null, { verdict: 'unknown', reason: 'Card not recognized' }, 'none', userId);
    return res.status(200).json({ verdict: 'unknown', reason: 'Card not recognized. Ask the parent to open the card in the app.' });
  }
  const v = verdict(s);
  const photo = await signedPhoto(s.card.photo_path);
  if (v.verdict === 'ok' && b.commit) {
    const r = await commit(s, v.plan, userId);
    await logScan(s, v, v.plan === 'walk_in' ? 'walk_in' : 'confirmed', userId, r.bookingId, r.deducted);
    return res.status(200).json(scanPayload(s, v, { photo_url: photo, done: true, sessions_left: r.after }));
  }
  await logScan(s, v, v.verdict === 'warn' ? 'already' : 'none', userId);
  return res.status(200).json(scanPayload(s, v, { photo_url: photo, done: false }));
}

async function confirm(b, userId, res) {
  const token = parseCode(b.token);
  const s = token ? await loadScan(token) : null;
  if (!s) return res.status(404).json({ error: 'Card not recognized.' });
  if (!b.override) return res.status(400).json({ error: 'Missing override.' });
  if (s.checkinToday) return res.status(200).json({ ok: true, already: true });

  const m = s.membership;
  const remaining = m ? (m.sessions_total || 0) - (m.sessions_used || 0) : 0;
  const plan = s.bookingToday ? 'confirm' : (m && remaining > 0) ? 'walk_in' : 'free';
  const r = await commit(s, plan, userId);
  const v = verdict(s);
  await logScan(s, { verdict: v.verdict, reason: `Override: ${v.reason}` }, 'override', userId, r.bookingId, r.deducted);
  return res.status(200).json({ ok: true, deducted: r.deducted, sessions_left: r.after });
}
