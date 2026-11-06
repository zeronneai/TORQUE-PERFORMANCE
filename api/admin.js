import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { listContent, contentAction } from './_content.js';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { getVerifiedUserId } from './_auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 120;
const MAX_CAPACITY = 16;
const WEEKDAY_TIMES = ['4:00 PM', '5:00 PM', '6:00 PM'];
const SATURDAY_TIMES = ['12:00 PM', '1:00 PM', '2:00 PM'];
const PACKAGES = ['Package A', 'Package AA', 'Package AAA', 'Package MLB'];
const STATUSES = ['active', 'inactive', 'canceled', 'expired'];
const CANCEL_REASONS = ['cost', 'schedule', 'coaching', 'facility', 'moving', 'other_sport', 'results', 'other'];

// Admin-only actions for the Torque admin panel. Every call needs
// Authorization: Bearer <Clerk session token> of a user with publicMetadata.role === 'admin'.
//
//   closed_add        { start, end?, reason? }          block days for booking
//   closed_remove     { days: [...] }                   re-open days
//   membership_adjust { membershipId, sessions_total?, sessions_used?, package_name?, expires_at?, status?, cancel_reason?, cancel_details? }
//   booking_create    { parentId, kidName, date, time, deduct? }   book on behalf of a family
//   booking_cancel    { bookingId, refund? }            cancel a booking (optionally return the session)
//   team_move         { teamMembershipId, teamAge }     move a player to another Torque Team (9..13)
//   team_cancel       { teamMembershipId, when }        cancel the $250/mo team sub ('period_end' | 'now')
//   content_list      {}                               Admin > Content: videos from Roots Engine
//   content_action    { op, id, ... }                  save | approve | reject | pending | upload | cover | day | refresh
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Roots Engine (panel de métricas de la agencia): solo números agregados, sin nombres ni correos.
  // Va antes del login de Clerk porque lo llama otro servidor con su propia llave.
  if (req.body?.action === 'metrics') return metricsReport(req, res);

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
      case 'team_move':         return await teamMove(b, userId, res);
      case 'team_cancel':       return await teamCancel(b, userId, res);
      case 'content_list':      return res.status(200).json(await listContent());
      case 'content_action':    return await contentRelay(b, res);
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

  // Optional cancellation survey answer recorded by the coach (when they cancel/deactivate someone).
  if (b.cancel_reason) {
    if (!CANCEL_REASONS.includes(b.cancel_reason)) return res.status(400).json({ error: 'Invalid cancel reason.' });
    const { data: full } = await supabase.from('player_memberships')
      .select('parent_id, kid_name, package_name, billing_type').eq('id', id).maybeSingle();
    const { error: fbErr } = await supabase.from('cancellation_feedback').insert({
      parent_id: full?.parent_id || 'unknown', kid_name: full?.kid_name || cur.kid_name, membership_id: id,
      package_name: full?.package_name || null, billing_type: full?.billing_type || null,
      reason: b.cancel_reason, details: String(b.cancel_details || '').trim().slice(0, 1000) || null, source: 'admin',
    });
    if (fbErr) console.error('[admin] cancel feedback insert failed:', fbErr.message);
  }
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

// ── Torque Team ──────────────────────────────────────────────────────────────
async function teamMove(b, userId, res) {
  const id = String(b.teamMembershipId || '');
  const age = parseInt(b.teamAge, 10);
  if (!id || !(age >= 9 && age <= 13)) return res.status(400).json({ error: 'Pick a team from 9U to 13U.' });
  const { data, error } = await supabase.from('team_memberships')
    .update({ team_age: age, updated_at: new Date().toISOString() }).eq('id', id).select('kid_name, stripe_subscription_id');
  if (error || !data?.length) return res.status(404).json({ error: 'Not found.' });
  // Keep Stripe metadata in sync so a re-created row lands on the right team.
  if (data[0].stripe_subscription_id) {
    try { await stripe.subscriptions.update(data[0].stripe_subscription_id, { metadata: { team_age: String(age) } }); }
    catch (e) { console.error('[admin] team_move stripe metadata:', e.message); }
  }
  console.log(`[admin] ${userId} moved ${data[0].kid_name} to ${age}U`);
  return res.status(200).json({ ok: true });
}

async function teamCancel(b, userId, res) {
  const id = String(b.teamMembershipId || '');
  const now = b.when === 'now';
  const { data: row } = await supabase.from('team_memberships')
    .select('id, kid_name, stripe_subscription_id, status').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'Not found.' });
  const nowIso = new Date().toISOString();
  if (row.stripe_subscription_id) {
    try {
      if (now) await stripe.subscriptions.cancel(row.stripe_subscription_id);
      else     await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
    } catch (e) {
      if (!/no such subscription|resource_missing|cancel/i.test(e.message || '')) {
        console.error('[admin] team_cancel stripe:', e.message);
        return res.status(502).json({ error: 'Stripe could not cancel it: ' + e.message });
      }
    }
  }
  const upd = now || !row.stripe_subscription_id
    ? { status: 'canceled', canceled_at: nowIso, cancel_at_period_end: false, updated_at: nowIso }
    : { cancel_at_period_end: true, updated_at: nowIso };
  await supabase.from('team_memberships').update(upd).eq('id', id);
  console.log(`[admin] ${userId} cancelled team sub for ${row.kid_name} (${now ? 'now' : 'period end'})`);
  return res.status(200).json({ ok: true });
}


// ── Métricas para Roots Engine ───────────────────────────────────────────────
// POST { action: 'metrics', days } con el header x-metrics-key = ROOTS_METRICS_KEY.
// Regresa solo conteos y montos por día (nada de nombres, correos ni teléfonos).
async function metricsReport(req, res) {
  const key = process.env.ROOTS_METRICS_KEY;
  if (!key || req.headers['x-metrics-key'] !== key) return res.status(403).json({ error: 'forbidden' });
  const days = Math.min(Math.max(parseInt(req.body?.days, 10) || 30, 1), 180);
  const now = Date.now();
  const since = new Date(now - days * 864e5);
  const prevSince = new Date(now - 2 * days * 864e5);
  const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);
  const inRange = (v, from, to = new Date(now)) => v && new Date(v) >= from && new Date(v) < to;

  async function rows(table) {
    const out = [];
    for (let from = 0; from < 20000; ) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
      if (error) return null; // tabla que no existe: se omite
      if (!data?.length) break;
      out.push(...data);
      from += data.length;
    }
    return out;
  }
  const count = (list, keyFn) => {
    const m = {};
    for (const x of list) { const k = keyFn(x); if (k) m[k] = (m[k] || 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
  };
  const series = (list, dateFn, valueFn = () => 1) => {
    const m = {};
    for (const x of list) { const d = day(dateFn(x)); if (d) m[d] = (m[d] || 0) + valueFn(x); }
    return m;
  };

  const [leads, members, teams, tryouts, promos] = await Promise.all([
    rows('leads'), rows('player_memberships'), rows('team_memberships'), rows('tryout_registrations'), rows('promo_registrations'),
  ]);

  // Pagos reales en Stripe (lo cobrado menos reembolsos)
  const charges = [];
  for await (const c of stripe.charges.list({ created: { gte: Math.floor(prevSince.getTime() / 1000) }, limit: 100 })) {
    if (c.paid && c.status === 'succeeded') charges.push(c);
    if (charges.length > 5000) break;
  }
  const net = (c) => (c.amount - (c.amount_refunded || 0)) / 100;
  const chCur = charges.filter((c) => c.created * 1000 >= since.getTime());
  const chPrev = charges.filter((c) => c.created * 1000 < since.getTime());

  const startOf = (m) => m.created_at || m.term_start || m.purchased_at;
  const cancelOf = (m) => m.cancel_requested_at || m.canceled_at;
  const L = leads || [], M = members || [], T = teams || [];
  const newMembers = M.filter((m) => inRange(startOf(m), since));
  const prevMembers = M.filter((m) => inRange(startOf(m), prevSince, since));
  const cancels = M.filter((m) => inRange(cancelOf(m), since));
  const leadsCur = L.filter((l) => inRange(l.created_at, since));
  const leadsPrev = L.filter((l) => inRange(l.created_at, prevSince, since));

  return res.status(200).json({
    ok: true,
    days,
    currency: (chCur[0] || charges[0])?.currency?.toUpperCase() || 'USD',
    revenue: { total: chCur.reduce((a, c) => a + net(c), 0), previous: chPrev.reduce((a, c) => a + net(c), 0), payments: chCur.length, byDay: series(chCur, (c) => c.created * 1000, net) },
    leads: leads ? {
      total: leadsCur.length,
      previous: leadsPrev.length,
      byDay: series(leadsCur, (l) => l.created_at),
      bySource: count(leadsCur, (l) => l.source || 'sin fuente'),
      byStatus: count(leadsCur, (l) => l.status || 'new'),
      converted: leadsCur.filter((l) => l.status === 'converted').length,
    } : null,
    members: members ? {
      active: M.filter((m) => m.status === 'active').length,
      new: newMembers.length,
      previousNew: prevMembers.length,
      byDay: series(newMembers, startOf),
      newByPackage: count(newMembers, (m) => m.package_name),
      newByPlan: count(newMembers, (m) => ({ stand: 'Mensual', m6: '6 meses', m12: '12 meses', annual: 'Anual' })[m.billing_type] || m.billing_type || 'Sin plan'),
      activeByPackage: count(M.filter((m) => m.status === 'active'), (m) => m.package_name),
      cancellations: cancels.length,
      cancelReasons: count(cancels, (m) => m.cancel_reason),
    } : null,
    teams: teams ? { active: T.filter((t) => t.status === 'active').length, new: T.filter((t) => inRange(t.started_at || t.created_at, since)).length } : null,
    tryouts: tryouts ? tryouts.filter((t) => inRange(t.created_at, since)).length : null,
    events: promos ? promos.filter((p) => inRange(p.created_at, since)).length : null,
  });
}

// ── Content (Roots Engine) ───────────────────────────────────────────────────
const CONTENT_ERRORS = {
  not_connected: 'Content approval is not connected yet.',
  token: 'Content approval is not connected yet.',
  changed: 'This video changed. Refresh the page.',
  bad_action: 'Unknown action.',
  down: 'Could not reach the content service. Try again in a moment.',
  failed: 'Could not save. Try again in a moment.',
};
async function contentRelay(b, res) {
  const r = await contentAction({ ...b, action: b.op });
  if (r.ok) return res.status(200).json(r);
  const code = r.error === 'changed' ? 409 : r.error === 'bad_action' ? 400 : (r.error === 'not_connected' || r.error === 'token') ? 503 : 502;
  return res.status(code).json({ error: r.message || CONTENT_ERRORS[r.error] || CONTENT_ERRORS.failed, setup: code === 503 });
}
