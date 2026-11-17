// "Ask Torque" (Admin > Ask Torque): Claude answers questions about the academy's data.
// READ ONLY by design: Claude gets a text snapshot of the data and no tools, so it can
// never change anything. The snapshot is rebuilt at most every 10 minutes per server
// instance (Stripe + Supabase reads), so answers are near real time.
// Env: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (optional).

const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const TTL = 10 * 60 * 1000;
let cache = { at: 0, text: null };

const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '-');
const low = (s) => (s || '').trim().toLowerCase();
const money = (cents) => `$${Math.round((cents || 0) / 100).toLocaleString('en-US')}`;
const clean = (s) => String(s ?? '').replace(/[|\n\r\t]+/g, ' ').trim();

async function all(supabase, table, select = '*') {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) return out;            // a missing table must not break the whole answer
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function buildSnapshot({ supabase, stripe }) {
  if (cache.text && Date.now() - cache.at < TTL) return cache.text;
  const now = Date.now();
  const since13m = Math.floor((now - 400 * 86400000) / 1000);
  const ago = (days) => now - days * 86400000;

  const [profiles, players, mems, team, bookings, checkins, leads, feedback] = await Promise.all([
    all(supabase, 'profiles', 'id, full_name, email, phone'),
    all(supabase, 'players', 'parent_id, kid_name, age, birthdate'),
    all(supabase, 'player_memberships'),
    all(supabase, 'team_memberships'),
    all(supabase, 'bookings', 'parent_id, kid_name, session_date, session_time, status'),
    all(supabase, 'checkins', 'parent_id, kid_name, checked_in_at'),
    all(supabase, 'leads'),
    all(supabase, 'cancellation_feedback'),
  ]);

  // ── Stripe: subscriptions + charges, linked to families ──
  const byPayment = new Map(mems.filter(m => m.stripe_payment_id).map(m => [m.stripe_payment_id, m]));
  const emailToPid = new Map(profiles.filter(p => p.email).map(p => [low(p.email), p.id]));
  const custToPid = new Map();
  const subsByPid = new Map();
  for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    const m = byPayment.get(s.id);
    if (!m) continue;
    custToPid.set(s.customer, m.parent_id);
    const end = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
    subsByPid.set(m.parent_id, [...(subsByPid.get(m.parent_id) || []), { kid: m.kid_name, status: s.status, end: end ? end * 1000 : null, amount: s.items?.data?.[0]?.price?.unit_amount }]);
  }
  const paysByPid = new Map();
  const monthly = new Map();
  let unknownPayer = 0;
  for await (const ch of stripe.charges.list({ limit: 100, created: { gte: since13m } })) {
    if (ch.status !== 'succeeded' || !ch.paid) continue;
    const net = ch.amount - (ch.amount_refunded || 0);
    if (net <= 0) continue;
    const ym = new Date(ch.created * 1000).toISOString().slice(0, 7);
    monthly.set(ym, (monthly.get(ym) || 0) + net);
    const m = byPayment.get(ch.payment_intent);
    const pid = m?.parent_id || custToPid.get(ch.customer) || emailToPid.get(low(ch.billing_details?.email || ch.receipt_email));
    if (!pid) { if (ch.created * 1000 >= ago(31)) unknownPayer += net; continue; }
    paysByPid.set(pid, [...(paysByPid.get(pid) || []), { at: ch.created * 1000, net, kind: ch.invoice ? (m ? 'invoice' : 'invoice') : 'card' }]);
  }

  // ── Family lines ──
  const kidKey = (pid, kid) => `${pid}::${low(kid)}`;
  const memsByKid = new Map(); for (const m of mems) memsByKid.set(kidKey(m.parent_id, m.kid_name), [...(memsByKid.get(kidKey(m.parent_id, m.kid_name)) || []), m]);
  const teamByKid = new Map(team.map(t => [kidKey(t.parent_id, t.kid_name), t]));
  const fbByKid = new Map(); for (const f of feedback) fbByKid.set(kidKey(f.parent_id, f.kid_name), f);
  const count = (rows, pid, kid, field, days) => {
    const list = rows.filter(r => r.parent_id === pid && low(r.kid_name) === low(kid) && r[field] && new Date(r[field]).getTime() >= ago(days) && new Date(r[field]).getTime() <= now + 60 * 86400000);
    const past = list.filter(r => new Date(r[field]).getTime() <= now).map(r => new Date(r[field]).getTime());
    return { n: list.length, last: past.length ? day(Math.max(...past)) : '-' };
  };
  const kidsByPid = new Map(); for (const k of players) kidsByPid.set(k.parent_id, [...(kidsByPid.get(k.parent_id) || []), k]);

  let payingFamilies = 0, payingPlayers = 0, appActive = 0;
  const famLines = [];
  for (const p of profiles) {
    const pays = (paysByPid.get(p.id) || []).sort((a, b) => b.at - a.at);
    const liveSubs = (subsByPid.get(p.id) || []).filter(s => ['active', 'trialing'].includes(s.status) && (!s.end || s.end > now));
    const paidRecently = pays.some(x => x.at >= ago(31));
    const paying = paidRecently || liveSubs.length > 0;
    if (paying) payingFamilies++;
    const last = pays[0];
    const lifetime = pays.reduce((s, x) => s + x.net, 0);
    const lines = [`FAMILY | ${clean(p.full_name)} | ${clean(p.email)} | ${clean(p.phone) || 'no phone'} | paying_now: ${paying ? 'YES' : 'no'} | last_payment: ${last ? `${day(last.at)} ${money(last.net)}` : 'never'} | paid_since_${new Date(now - 400 * 86400000).toISOString().slice(0, 7)}: ${money(lifetime)}`];
    const kids = new Map((kidsByPid.get(p.id) || []).map(k => [low(k.kid_name), k]));
    for (const m of mems.filter(m => m.parent_id === p.id)) if (!kids.has(low(m.kid_name))) kids.set(low(m.kid_name), { kid_name: m.kid_name });
    for (const k of kids.values()) {
      const ms = (memsByKid.get(kidKey(p.id, k.kid_name)) || []).sort((a, b) => String(b.purchased_at || '').localeCompare(String(a.purchased_at || '')));
      const m = ms.find(x => x.status === 'active') || ms[0];
      const sub = (subsByPid.get(p.id) || []).find(s => low(s.kid) === low(k.kid_name));
      const t = teamByKid.get(kidKey(p.id, k.kid_name));
      const fb = fbByKid.get(kidKey(p.id, k.kid_name));
      const b60 = count(bookings, p.id, k.kid_name, 'session_date', 60);
      const c30 = count(checkins, p.id, k.kid_name, 'checked_in_at', 30);
      const subPaying = sub && ['active', 'trialing'].includes(sub.status) && (!sub.end || sub.end > now);
      const kidPaying = m?.status === 'active' && (subPaying || (m.purchased_at && new Date(m.purchased_at).getTime() >= ago(31)) || (m.expires_at && new Date(m.expires_at).getTime() > now && String(m.stripe_payment_id || '').startsWith('in_')));
      if (kidPaying) payingPlayers++;
      if (m?.status === 'active') appActive++;
      const since = ms.length ? day(ms.map(x => x.purchased_at).filter(Boolean).sort()[0]) : '-';
      lines.push(`  PLAYER | ${clean(k.kid_name)} | age ${k.age ?? '-'} | ` + (m
        ? `${clean(m.package_name)} | app_status ${m.status} | plan ${m.billing_type || '-'} | member_since ${since} | current_period ${day(m.purchased_at)} to ${day(m.expires_at)} | sessions_left ${(m.sessions_total || 0) - (m.sessions_used || 0)} of ${m.sessions_total || 0} | paid_by ${String(m.stripe_payment_id || '').startsWith('sub_') ? 'subscription' : String(m.stripe_payment_id || '').startsWith('pi_') ? 'one-time card' : String(m.stripe_payment_id || '').startsWith('in_') ? 'invoice' : m.stripe_payment_id === 'manual' ? 'cash/manual' : 'unknown'}`
          + (sub ? ` | stripe_sub ${sub.status}${sub.end ? ` next ${day(sub.end)}` : ''} ${money(sub.amount)}` : '')
          + (m.canceled_at || m.cancel_effective_at ? ` | canceled ${day(m.canceled_at || m.cancel_effective_at)}` : '')
        : 'no membership ever')
        + ` | paying_now ${kidPaying ? 'YES' : 'no'}`
        + (t ? ` | torque_team ${t.team_age}U ${t.status}` : '')
        + ` | bookings_past60d_plus_upcoming ${b60.n} (last ${b60.last}) | checkins_last30d ${c30.n} (last ${c30.last})`
        + (fb ? ` | cancel_reason ${clean(fb.reason)}${fb.details ? `: ${clean(fb.details)}` : ''}` : ''));
    }
    famLines.push(lines.join('\n'));
  }

  const months = [...monthly.entries()].sort().slice(-13).map(([m, c]) => `${m}: ${money(c)}`).join(' | ');
  const leadLines = leads.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map(l => `LEAD | ${day(l.created_at)} | ${clean(l.parent_name)} | ${clean(l.phone)} | ${clean(l.email)} | player ${clean(l.player_name)} age ${clean(l.player_age)} | source ${clean(l.source)} | status ${clean(l.status)}${l.notes ? ` | notes ${clean(l.notes)}` : ''}`);

  cache = {
    at: now,
    text: [
      `DATA SNAPSHOT taken ${new Date(now).toISOString()} (El Paso time is UTC-7).`,
      `TOTALS: paying families now ${payingFamilies} | paying players now ${payingPlayers} | players marked active in the app ${appActive} | registered parent accounts ${profiles.length} | leads ${leads.length}`,
      `STRIPE MONEY COLLECTED BY MONTH (all successful charges, after refunds, before Stripe fees): ${months}`,
      unknownPayer ? `Payments in the last 31 days that could not be matched to a family: ${money(unknownPayer)}` : '',
      '',
      ...famLines,
      '',
      ...leadLines,
    ].filter(x => x !== null).join('\n'),
  };
  return cache.text;
}

const INSTRUCTIONS = `You are "Ask Torque", the data assistant inside the admin panel of TX Torque Baseball Academy (El Paso, TX). Coaches and owners ask you about members, payments, attendance, leads and cancellations.

Rules:
- Answer ONLY from the data snapshot below. Never invent people, numbers or dates. If the snapshot does not have it, say so plainly.
- You can only read. You cannot change memberships, payments or anything else; if asked, say they can do it in Families > Manage.
- "Paying now" means a successful membership payment in the last 31 days or a subscription that is active and paid through today. That is the real active count; "app_status active" alone is not proof of payment.
- When the answer is a list of people, use a markdown table with the useful columns (parent, player, phone, email, package, dates). Say how many rows there are. For long lists show up to 50 rows and say how many more there are.
- Lead with the answer, keep it short and direct. Use the same language the user writes in.
- Never use em dashes or en dashes.
- Dates as "Nov 5, 2026". Money as "$1,234".`;

export async function askTorque({ supabase, stripe, messages }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { status: 503, body: { error: 'Ask Torque is not connected yet (missing ANTHROPIC_API_KEY).' } };
  const convo = (Array.isArray(messages) ? messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!convo.length || convo[convo.length - 1].role !== 'user') return { status: 400, body: { error: 'Ask a question.' } };

  const snapshot = await buildSnapshot({ supabase, stripe });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: 4000,
      system: [
        { type: 'text', text: INSTRUCTIONS },
        { type: 'text', text: snapshot, cache_control: { type: 'ephemeral' } },
      ],
      messages: convo,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('[ask] anthropic error', r.status, d?.error?.message);
    return { status: 502, body: { error: 'Claude could not answer right now. Try again in a moment.' } };
  }
  const text = (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
  return { status: 200, body: { answer: text, asOf: snapshot.slice(20, 44) } };
}
