// Shared cancellation logic (NOT an endpoint — the `_` prefix makes Vercel ignore it).
// Single authoritative source used by cancel-quote (display), create-cancellation-checkout
// (charge), cancel-membership (no-fee), and the webhook. The fee is computed HERE and
// recomputed on every call — clients never supply a fee.

// ── Per-version rule registry ────────────────────────────────────────────────
// Keyed by the EXACT contract_version string stored on the waiver, then by billing_type.
// Old waivers stored the label ('12-Month' etc.); the current re-sign stores '2026-09'.
// Adding a future version = add a key here; the calculator never changes.
//   none            → month-to-month: no fee (stand)
//   buyout_remaining→ m6: fee = ALL remaining months × monthly, cancel immediately
//   fee_capped      → m12: fee = min(remaining, capMonths) × monthly, cancel at period end
//   refuse          → annual: not cancellable in-app
export const CANCELLATION_RULES = {
  '2026-09': {
    stand:  { kind: 'none' },
    m6:     { kind: 'buyout_remaining' },
    m12:    { kind: 'fee_capped', capMonths: 3 },
    annual: { kind: 'refuse' },
  },
  // Legacy label-as-version waivers (pre-2026-09). m12 cap was TWO months back then.
  '12-Month':          { m12: { kind: 'fee_capped', capMonths: 2 } },
  '6-Month':           { m6:  { kind: 'buyout_remaining' } },
  'Month-to-Month':    { stand: { kind: 'none' } },
  'Annual (Lump Sum)': { annual: { kind: 'refuse' } },
};

// Returns the rule, or NULL for any unknown version / missing billing_type rule.
// NULL means REFUSE — there is deliberately no fallback that could invent a fee.
export function resolveRule(version, billingType) {
  if (!version || !billingType) return null;
  return CANCELLATION_RULES[version]?.[billingType] ?? null;
}

const norm = (s) => (s || '').toLowerCase().trim();   // same kid matching used in the gate/admin

// Whole months from `fromMs` to `toMs` (0 if not in the future). No proration.
export function wholeMonthsBetween(fromMs, toMs) {
  if (!(toMs > fromMs)) return 0;
  const a = new Date(fromMs), b = new Date(toMs);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m--;
  return Math.max(0, m);
}

// The ONE authoritative computation. Never throws for business cases; returns a decision.
// decision ∈ 'fee' | 'free_cancel' | 'info_only' | 'refuse'.
export async function computeCancellationQuote({ stripe, supabase, parentId, kidName, membershipId }) {
  // 1) Active membership for this parent+kid (or by id).
  let q = supabase.from('player_memberships')
    .select('id, parent_id, kid_name, package_name, billing_type, term_start, term_end, status, stripe_payment_id, expires_at');
  q = membershipId ? q.eq('id', membershipId) : q.eq('parent_id', parentId).ilike('kid_name', kidName);
  const { data: mem, error: memErr } = await q.eq('status', 'active').limit(1).maybeSingle();
  if (memErr) return { ok: false, error: 'lookup_failed' };
  if (!mem) return { ok: false, decision: 'refuse', reason: 'no_active_membership' };

  const billingType = mem.billing_type;

  // 2) The parent's SIGNED version for THIS kid = latest waiver, matched trim+lowercase.
  const { data: wv } = await supabase.from('waivers')
    .select('kid_name, contract_version, agreed_at')
    .eq('parent_id', mem.parent_id)
    .order('agreed_at', { ascending: false });
  const kidKey = norm(mem.kid_name);
  const signedVersion = (wv || []).find(w => norm(w.kid_name) === kidKey)?.contract_version || null;

  // 3) No waiver at all → refuse (never guess a fee).
  if (!signedVersion) return { ok: true, decision: 'refuse', reason: 'no_waiver', membership: mem, billingType };

  // 4) Resolve the rule. Unknown version / missing rule → refuse.
  const rule = resolveRule(signedVersion, billingType);
  if (!rule) return { ok: true, decision: 'refuse', reason: 'no_rule_for_version', signedVersion, billingType, membership: mem };

  const base = { ok: true, membership: mem, billingType, signedVersion, kind: rule.kind };

  // 5) Non-cancellable (annual).
  if (rule.kind === 'refuse') return { ...base, decision: 'refuse', reason: 'non_cancellable', termEnd: mem.term_end };

  // 6) Month-to-month (stand): informational for a one-time pi_, free cancel for a legacy sub_.
  if (rule.kind === 'none') {
    const isSub = (mem.stripe_payment_id || '').startsWith('sub_');
    return { ...base, decision: isSub ? 'free_cancel' : 'info_only', feeCents: 0, subId: isSub ? mem.stripe_payment_id : null, expiresAt: mem.expires_at, cancelMode: 'period_end' };
  }

  // 7) m6 / m12 need the live subscription for the ACTUAL monthly amount + period end.
  const subId = mem.stripe_payment_id;
  if (!(subId || '').startsWith('sub_')) return { ...base, decision: 'refuse', reason: 'no_subscription' };
  let sub;
  try { sub = await stripe.subscriptions.retrieve(subId); }
  catch { return { ...base, decision: 'refuse', reason: 'stripe_unavailable' }; }

  const monthly = sub.items?.data?.[0]?.price?.unit_amount;   // LIVE actual charge, in cents
  if (monthly == null) return { ...base, decision: 'refuse', reason: 'no_unit_amount' };  // tiered → refuse, don't guess

  const customer  = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const periodEnd = sub.current_period_end ? sub.current_period_end * 1000 : null;
  const termEndMs = mem.term_end ? Date.parse(mem.term_end) : null;
  const monthsRemaining = termEndMs ? wholeMonthsBetween(Date.now(), termEndMs) : 0;

  // Past term (0 remaining) → no commitment left → free cancel at period end.
  if (monthsRemaining <= 0) {
    return { ...base, decision: 'free_cancel', feeCents: 0, monthly, monthsRemaining: 0, subId, customer, effectiveAt: periodEnd, cancelMode: 'period_end', subStatus: sub.status };
  }

  if (rule.kind === 'buyout_remaining') {   // m6: pay ALL remaining months, cancel immediately
    return { ...base, decision: 'fee', feeCents: monthsRemaining * monthly, monthly, monthsRemaining, capMonths: null, cancelMode: 'immediate', effectiveAt: Date.now(), subId, customer, subStatus: sub.status };
  }
  if (rule.kind === 'fee_capped') {         // m12: min(remaining, cap) months, cancel at period end
    const feeCents = Math.min(monthsRemaining, rule.capMonths) * monthly;
    return { ...base, decision: 'fee', feeCents, monthly, monthsRemaining, capMonths: rule.capMonths, cancelMode: 'period_end', effectiveAt: periodEnd, subId, customer, subStatus: sub.status };
  }
  return { ...base, decision: 'refuse', reason: 'unhandled_kind' };
}
