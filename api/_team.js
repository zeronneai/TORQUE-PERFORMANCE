// Torque Team subscription helpers (NOT an endpoint: the `_` prefix makes Vercel ignore it).
// Used by api/create-checkout.js (kind: 'team'), api/stripe-webhook.js and api/admin.js.
//
// The Stripe product + monthly price are created by code the first time they are
// needed and found again by lookup_key afterwards, so nothing has to be set up by
// hand in the Stripe dashboard. To change the price later, bump TEAM_LOOKUP_KEY
// (e.g. torque_team_monthly_275) and TEAM_PRICE_CENTS; existing subscribers keep
// the price they signed up with.
import { getVerifiedUserId } from './_auth.js';

export const TEAM_PRICE_CENTS = 25000;                 // $250 / month
export const TEAM_LOOKUP_KEY  = 'torque_team_monthly_250';
export const TEAM_AGES        = [9, 10, 11, 12, 13];   // 9U ... 13U
export const TEAM_SUCCESS_URL = 'https://app.torquebaseball.us/?team=success';
export const TEAM_CANCEL_URL  = 'https://app.torquebaseball.us/?team=cancel';

export async function getTeamPriceId(stripe) {
  const found = await stripe.prices.list({ lookup_keys: [TEAM_LOOKUP_KEY], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const product = await stripe.products.create({
    name: 'Torque Team',
    description: 'Monthly Torque Team subscription (requires an active Torque session package).',
    metadata: { type: 'team' },
  });
  const price = await stripe.prices.create({
    product:     product.id,
    currency:    'usd',
    unit_amount: TEAM_PRICE_CENTS,
    recurring:   { interval: 'month' },
    lookup_key:  TEAM_LOOKUP_KEY,
    nickname:    'Torque Team $250/mo',
  });
  return price.id;
}

// A session package counts only if it is active and not past its paid-through date.
export function hasActivePackage(rows, kidName) {
  const now = Date.now();
  const key = (kidName || '').toLowerCase().trim();
  return (rows || []).some(m =>
    (m.kid_name || '').toLowerCase().trim() === key &&
    (m.status || '').toLowerCase() === 'active' &&
    (!m.expires_at || new Date(m.expires_at).getTime() > now)
  );
}

// POST /api/create-checkout  { kind:'team', kidName, teamAge }  + Authorization: Bearer <Clerk token>
export async function handleTeamCheckout(req, res, { stripe, supabase }) {
  const parentId = await getVerifiedUserId(req);
  if (!parentId) return res.status(401).json({ error: 'Please sign in again.' });

  const b = req.body || {};
  const kidName = String(b.kidName || '').trim();
  const teamAge = parseInt(b.teamAge, 10);
  if (!kidName) return res.status(400).json({ error: 'Missing player.' });
  if (!TEAM_AGES.includes(teamAge)) return res.status(400).json({ error: 'Pick a team (9U to 13U).' });

  // The player must belong to this parent.
  const { data: kids } = await supabase.from('players').select('kid_name').eq('parent_id', parentId);
  const kid = (kids || []).find(k => (k.kid_name || '').toLowerCase().trim() === kidName.toLowerCase());
  if (!kid) return res.status(404).json({ error: 'Player not found.' });

  // Gate: an active session package is required.
  const { data: mems } = await supabase.from('player_memberships')
    .select('kid_name, status, expires_at').eq('parent_id', parentId);
  if (!hasActivePackage(mems, kid.kid_name)) {
    return res.status(403).json({ error: 'needsPackage' });
  }

  // Already on a team?
  const { data: existing } = await supabase.from('team_memberships')
    .select('id, status').eq('parent_id', parentId).ilike('kid_name', kid.kid_name)
    .in('status', ['active', 'past_due']);
  if (existing && existing.length) return res.status(409).json({ error: 'alreadyOnTeam' });

  let email;
  try {
    const { data: prof } = await supabase.from('profiles').select('email').eq('id', parentId).maybeSingle();
    email = prof?.email || undefined;
  } catch { /* optional */ }

  const priceId = await getTeamPriceId(stripe);
  const md = { type: 'team', parent_id: parentId, kid_name: kid.kid_name, team_age: String(teamAge) };
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: TEAM_SUCCESS_URL,
    cancel_url:  TEAM_CANCEL_URL,
    // Deliberately NOT in the membership `parentId__kidName__priceId` shape so the
    // membership logic in the webhook can never mistake this for a package.
    client_reference_id: `team__${parentId}`,
    metadata: md,
    subscription_data: { metadata: md, description: `Torque Team ${teamAge}U: ${kid.kid_name}` },
    ...(email ? { customer_email: email } : {}),
  });
  return res.status(200).json({ url: session.url });
}

// ── Webhook helpers ─────────────────────────────────────────────────────────
export async function teamCheckoutCompleted(session, supabase) {
  const md = session.metadata || {};
  const teamAge = parseInt(md.team_age, 10);
  const row = {
    parent_id:              md.parent_id,
    kid_name:               md.kid_name,
    team_age:               TEAM_AGES.includes(teamAge) ? teamAge : 9,
    status:                 'active',
    stripe_subscription_id: session.subscription,
    stripe_session_id:      session.id,
    updated_at:             new Date().toISOString(),
  };
  const { error } = await supabase.from('team_memberships')
    .upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw error;
}

// Each paid month: mark active and store the paid-through date. If this invoice
// arrives before checkout.session.completed (Stripe does not guarantee order),
// the row is created here from the subscription metadata.
export async function teamInvoicePaid(sub, supabase) {
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  const fields = {
    status:               'active',
    current_period_end:   periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at:           new Date().toISOString(),
  };
  const { data, error } = await supabase.from('team_memberships')
    .update(fields).eq('stripe_subscription_id', sub.id).select('id');
  if (error) throw error;
  if (data && data.length) return;
  const md = sub.metadata || {};
  const teamAge = parseInt(md.team_age, 10);
  const { error: insErr } = await supabase.from('team_memberships').upsert({
    ...fields,
    parent_id:              md.parent_id,
    kid_name:               md.kid_name,
    team_age:               TEAM_AGES.includes(teamAge) ? teamAge : 9,
    stripe_subscription_id: sub.id,
  }, { onConflict: 'stripe_subscription_id' });
  if (insErr) throw insErr;
}
