import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { getVerifiedUserId } from './_auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 120;
const MAX_CAPACITY = 16;
const WEEKDAY_TIMES = ['4:00 PM', '5:00 PM', '6:00 PM'];
const SATURDAY_TIMES = ['12:00 PM', '1:00 PM', '2:00 PM'];
const PACKAGES = ['Package A', 'Package AA', 'Package AAA', 'Package MLB'];
const STATUSES = ['active', 'inactive', 'canceled', 'expired'];

// Admin-only actions for the Torque admin panel. Every call needs
// Authorization: Bearer <Clerk session token> of a user with publicMetadata.role === 'admin'.
//
//   closed_add        { start, end?, reason? }          block days for booking
//   closed_remove     { days: [...] }                   re-open days
//   membership_adjust { membershipId, sessions_total?, sessions_used?, package_name?, expires_at?, status? }
//   booking_create    { parentId, kidName, date, time, deduct? }   book on behalf of a family
//   booking_cancel    { bookingId, refund? }            cancel a booking (optionally return the session)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getVerifiedUserId(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    const u = await clerk.users.getUser(userId);
    if (u?.publicMetadata?.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  } catch (e) {
    console.error('[admin] role check failed:', e.message);
    return res.status(403).json({ error: 'Admins only.' });
  }

  const b = req.body || {};
  try {
    switch (b.action) {
      case 'closed_add':        return await closedAdd(b, userId, res);
      case 'closed_remove':     return await closedRemove(b, res);
      case 'membership_adjust': return await membershipAdjust(b, userId, res);
      case 'booking_create':    return await bookingCreate(b, userId, res);
      case 'booking_cancel':    return await bookingCancel(b, userId, res);
      default: return res.status(400).json({ error: 'Missing or invalid action.' });
    }
  } catch (err) {
    console.error(`[admin] ${b.action} error:`, err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}

// ── Closed dates ─────────────────────────────────────────────────────────────
async function closedAdd(b, userId, res) {
  const start = String(b.start || '');
  const end = String(b.end || b.start || '');
  if (!ISO.test(start) || !ISO.test(end)) return res.status(400).json({ error: 'Invalid date.' });
  if (end < start) return res.status(400).json({ error: 'End date is before start date.' });
  const reason = String(b.reason || 'Closed').trim().slice(0, 80) || 'Closed';

  const rows = [];
  const d = new Date(start + 'T12:00:00Z');
  const last = new Date(end + 'T12:00:00Z');
  while (d <= last) {
    rows.push({ day: d.toISOString().slice(0, 10), reason, created_by: userId });
    if (rows.length > MAX_RANGE_DAYS) return res.status(400).json({ error: `Range too long (max ${MAX_RANGE_DAYS} days).` });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const { error } = await supabase.from('closed_dates').upsert(rows, { onConflict: 'day' });
  if (error) { console.error('[admin] closed_add failed:', error.message); return res.status(500).json({ error: 'Could not save.' }); }

  const { data: affected } = await supabase.from('bookings')
    .select('id, session_date, session_time, kid_name, parent_id')
    .gte('session_date', start).lte('session_date', end).eq('status', 'confirmed');
  return res.status(200).json({ ok: true, added: rows.length, affectedBookings: affected || [] });
}

async function closedRemove(b, res) {
  const days = (Array.isArray(b.days) ? b.days : []).filter(x => ISO.test(String(x)));
  if (!days.length) return res.status(400).json({ error: 'No days to remove.' });
  const { error } = await supabase.from('closed_dates').delete().in('day', days);
  if (error) { console.error('[admin] closed_remove failed:', error.message); return res.status(500).json({ error: 'Could not remove.' }); }
  return res.status(200).json({ ok: true, removed: days.length });
}

// ── Membership adjustments ───────────────────────────────────────────────────
async function membershipAdjust(b, userId, res) {
  const id = String(b.membershipId || '');
  if (!id) return res.status(400).json({ error: 'Missing membershipId.' });

  const { data: cur, error: readErr } = await supabase.from('player_memberships')
    .select('id, kid_name, sessions_total, sessions_used, package_name, expires_at, status').eq('id', id).maybeSingle();
  if (readErr) return res.status(500).json({ error: 'Could not read membership.' });
  if (!cur) return res.status(404).json({ error: 'Membership not found.' });

  const patch = {};
  const int = (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 999 ? Number(v) : null);
  if (b.sessions_total !== undefined) {
    const v = int(b.sessions_total); if (v === null) return res.status(400).json({ error: 'Invalid sessions total.' });
    patch.sessions_total = v;
  }
  if (b.sessions_used !== undefined) {
    const v = int(b.sessions_used); if (v === null) return res.status(400).json({ error: 'Invalid sessions used.' });
    patch.sessions_used = v;
  }
  if (b.package_name !== undefined) {
    if (!PACKAGES.includes(b.package_name)) return res.status(400).json({ error: 'Invalid package.' });
    patch.package_name = b.package_name;
  }
  if (b.expires_at !== undefined) {
    if (!ISO.test(String(b.expires_at))) return res.status(400).json({ error: 'Invalid renewal date.' });
    patch.expires_at = new Date(b.expires_at + 'T23:59:00-06:00').toISOString();
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status.' });
    patch.status = b.status;
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to change.' });

  const { error } = await supabase.from('player_memberships').update(patch).eq('id', id);
  if (error) { console.error('[admin] membership_adjust failed:', error.message); return res.status(500).json({ error: 'Could not save.' }); }
  console.log(`[admin] ${userId} adjusted membership ${id} (${cur.kid_name}):`, JSON.stringify({ before: cur, patch }));
  return res.status(200).json({ ok: true, membershipId: id, patch });
}

// ── Bookings on behalf of a family ───────────────────────────────────────────
async function bookingCreate(b, userId, res) {
  const parentId = String(b.parentId || '');
  const kidName = String(b.kidName || '').trim();
  const date = String(b.date || '');
  const time = String(b.time || '');
  const deduct = b.deduct !== false;
  if (!parentId || !kidName) return res.status(400).json({ error: 'Missing player.' });
  if (!ISO.test(date)) return res.status(400).json({ error: 'Invalid date.' });

  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  if (dow === 0) return res.status(422).json({ error: 'The academy is closed on Sundays.' });
  const times = dow === 6 ? SATURDAY_TIMES : WEEKDAY_TIMES;
  if (!times.includes(time)) return res.status(422).json({ error: `Pick one of: ${times.join(', ')}.` });

  const { data: closed } = await supabase.from('closed_dates').select('day, reason').eq('day', date).maybeSingle();
  if (closed) return res.status(422).json({ error: `That day is blocked (${closed.reason || 'Closed'}).` });

  const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true })
    .eq('session_date', date).eq('session_time', time).eq('status', 'confirmed');
  if ((count || 0) >= MAX_CAPACITY) return res.status(409).json({ error: `That slot is full (${MAX_CAPACITY} players).` });

  const { data: mems } = await supabase.from('player_memberships')
    .select('id, sessions_total, sessions_used, kid_name').eq('parent_id', parentId).eq('status', 'active')
    .ilike('kid_name', kidName);
  const mem = (mems || [])[0] || null;
  if (deduct) {
    if (!mem) return res.status(422).json({ error: 'This player has no active membership. Uncheck "use a session" to book anyway.' });
    if ((mem.sessions_total || 0) - (mem.sessions_used || 0) <= 0)
      return res.status(422).json({ error: 'No sessions left. Add sessions first, or uncheck "use a session".' });
  }

  const { data: existing } = await supabase.from('bookings').select('id')
    .eq('parent_id', parentId).ilike('kid_name', kidName).eq('session_date', date).eq('status', 'confirmed');
  if ((existing || []).length) return res.status(409).json({ error: 'This player is already booked that day.' });

  const { data: ins, error: insErr } = await supabase.from('bookings').insert([{
    parent_id: parentId, kid_name: mem?.kid_name || kidName, membership_id: mem?.id || null,
    session_date: date, session_time: time, status: 'confirmed',
  }]).select('id').single();
  if (insErr) { console.error('[admin] booking insert failed:', insErr.message); return res.status(500).json({ error: 'Could not book: ' + insErr.message }); }

  if (deduct && mem) {
    await supabase.from('player_memberships').update({ sessions_used: (mem.sessions_used || 0) + 1 }).eq('id', mem.id);
  }
  console.log(`[admin] ${userId} booked ${kidName} ${date} ${time} (deduct=${deduct})`);
  return res.status(200).json({ ok: true, bookingId: ins.id });
}

async function bookingCancel(b, userId, res) {
  const id = String(b.bookingId || '');
  const refund = b.refund !== false;
  if (!id) return res.status(400).json({ error: 'Missing bookingId.' });

  const { data: bk } = await supabase.from('bookings').select('id, parent_id, kid_name, membership_id, session_date, session_time').eq('id', id).maybeSingle();
  if (!bk) return res.status(404).json({ error: 'Booking not found.' });

  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) { console.error('[admin] booking delete failed:', error.message); return res.status(500).json({ error: 'Could not cancel.' }); }

  if (refund) {
    let q = supabase.from('player_memberships').select('id, sessions_used');
    q = bk.membership_id ? q.eq('id', bk.membership_id)
                         : q.eq('parent_id', bk.parent_id).ilike('kid_name', bk.kid_name).eq('status', 'active');
    const { data: mems } = await q;
    const mem = (mems || [])[0];
    if (mem) await supabase.from('player_memberships').update({ sessions_used: Math.max(0, (mem.sessions_used || 0) - 1) }).eq('id', mem.id);
  }
  console.log(`[admin] ${userId} cancelled booking ${id} (${bk.kid_name} ${bk.session_date} ${bk.session_time}, refund=${refund})`);
  return res.status(200).json({ ok: true });
}
