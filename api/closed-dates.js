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

// Admin-only management of academy-closed days (table public.closed_dates).
// POST { action: 'add', start: 'YYYY-MM-DD', end?: 'YYYY-MM-DD', reason?: string }
// POST { action: 'remove', days: ['YYYY-MM-DD', ...] }
// Caller must send Authorization: Bearer <Clerk session token> of a user whose
// publicMetadata.role === 'admin' (same rule the app uses to show the admin panel).
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
    console.error('[closed-dates] admin check failed:', e.message);
    return res.status(403).json({ error: 'Admins only.' });
  }

  try {
    const b = req.body || {};

    if (b.action === 'add') {
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
      if (error) { console.error('[closed-dates] add failed:', error.message); return res.status(500).json({ error: 'Could not save.' }); }

      // Tell the admin who is already booked on those days so they can reach out.
      const { data: affected } = await supabase.from('bookings')
        .select('id, session_date, session_time, kid_name, parent_id')
        .gte('session_date', start).lte('session_date', end).eq('status', 'confirmed');
      return res.status(200).json({ ok: true, added: rows.length, affectedBookings: affected || [] });
    }

    if (b.action === 'remove') {
      const days = (Array.isArray(b.days) ? b.days : []).filter(x => ISO.test(String(x)));
      if (!days.length) return res.status(400).json({ error: 'No days to remove.' });
      const { error } = await supabase.from('closed_dates').delete().in('day', days);
      if (error) { console.error('[closed-dates] remove failed:', error.message); return res.status(500).json({ error: 'Could not remove.' }); }
      return res.status(200).json({ ok: true, removed: days.length });
    }

    return res.status(400).json({ error: 'Missing or invalid action.' });
  } catch (err) {
    console.error('[closed-dates] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}
