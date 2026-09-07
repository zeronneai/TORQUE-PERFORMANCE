// ============================================================
// TORQUE PERFORMANCE — Term / overbilling audit (READ-ONLY)
//
// Classifies every ACTIVE membership with a sub_ payment by its LIVE Stripe price:
//   A) legacy recurring "stand" (founders month-to-month)
//   B) m6  (6-month commitment)
//   C) m12 (12-month commitment)
// (Membership rows don't store the price id, so we read it from Stripe.)
//
// For each: kid, parent name/email/phone, package, category/price, the subscription's
// created date, and cycles billed (count of PAID invoices).
//
// Flags B/C members PAST their committed term (more paid cycles than 6/12), with how
// many extra cycles/months and the extra $ charged beyond term (summed from the
// invoices after the term). Also joins waivers (parent_id + kid_name, most recent) to
// show the billing_type they SIGNED and flag mismatches (e.g. signed 'stand', on m6).
//
// NO writes anywhere (Supabase select + Stripe retrieve/list only).
//
// Run (bash):
//   STRIPE_SECRET_KEY=sk_live_... VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node audit-term-overbilling.mjs
// Run (PowerShell): set the three $env vars, then: node audit-term-overbilling.mjs
// Output: term-audit.csv + a console summary.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { writeFileSync } from 'fs';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!STRIPE_KEY || !SB_URL || !SB_KEY) {
  console.error('Missing env: STRIPE_SECRET_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const stripe = new Stripe(STRIPE_KEY);
const supabase = createClient(SB_URL, SB_KEY);

// price id → { category, package, term(months, null=month-to-month), expectedSigned }
const PRICE = {
  // A — legacy recurring stand
  'price_1TLqDdAPTWbxe0YytEOlF7ZH': { cat: 'A-legacy-stand', pkg: 'A',   term: null, signed: 'stand' },
  'price_1TLqDgAPTWbxe0Yy7yaP3VX3': { cat: 'A-legacy-stand', pkg: 'AA',  term: null, signed: 'stand' },
  'price_1TLqDhAPTWbxe0YyXXJQZrh7': { cat: 'A-legacy-stand', pkg: 'AAA', term: null, signed: 'stand' },
  'price_1TLqDdAPTWbxe0YydO64XMLw': { cat: 'A-legacy-stand', pkg: 'MLB', term: null, signed: 'stand' },
  // B — m6
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': { cat: 'B-m6', pkg: 'A',   term: 6,  signed: 'm6' },
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': { cat: 'B-m6', pkg: 'AA',  term: 6,  signed: 'm6' },
  'price_1TLqDkAPTWbxe0YydXEB3YqT': { cat: 'B-m6', pkg: 'AAA', term: 6,  signed: 'm6' },
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': { cat: 'B-m6', pkg: 'MLB', term: 6,  signed: 'm6' },
  // C — m12
  'price_1TLqDmAPTWbxe0YysigUumPn': { cat: 'C-m12', pkg: 'A',   term: 12, signed: 'm12' },
  'price_1TLqDjAPTWbxe0YyTsqaUdt5': { cat: 'C-m12', pkg: 'AA',  term: 12, signed: 'm12' },
  'price_1TLqDjAPTWbxe0YyuyUujCu4': { cat: 'C-m12', pkg: 'AAA', term: 12, signed: 'm12' },
  'price_1TLqDjAPTWbxe0YyVQxRaHFs': { cat: 'C-m12', pkg: 'MLB', term: 12, signed: 'm12' },
};

const dayOf = (iso) => (iso || '').split('T')[0];
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function monthsBetween(fromMs, toMs) {
  const a = new Date(fromMs), b = new Date(toMs);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m--;
  return Math.max(0, m);
}

async function paidInvoices(subId) {
  const all = [];
  let starting_after;
  for (let i = 0; i < 10; i++) {  // up to 1000 invoices
    const page = await stripe.invoices.list({ subscription: subId, status: 'paid', limit: 100, ...(starting_after ? { starting_after } : {}) });
    all.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1]?.id;
  }
  return all.sort((a, b) => a.created - b.created);  // oldest first
}

async function main() {
  // Active sub_ memberships (paginated).
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('player_memberships')
      .select('id, kid_name, parent_id, package_name, stripe_payment_id, purchased_at, expires_at')
      .eq('status', 'active').like('stripe_payment_id', 'sub_%').range(from, from + 999);
    if (error) { console.error('Supabase error:', error.message); process.exit(1); }
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  // Contact info + signed billing_type.
  const pids = [...new Set(rows.map(r => r.parent_id).filter(Boolean))];
  const prof = new Map(), waiverByKey = new Map();
  for (let i = 0; i < pids.length; i += 200) {
    const chunk = pids.slice(i, i + 200);
    const { data: pf } = await supabase.from('profiles').select('id, full_name, phone, email').in('id', chunk);
    for (const p of (pf || [])) prof.set(p.id, p);
    const { data: wv } = await supabase.from('waivers')
      .select('parent_id, kid_name, parent_name, phone, email, billing_type, contract_version, agreed_at')
      .in('parent_id', chunk).order('agreed_at', { ascending: false });
    for (const w of (wv || [])) {
      const k = `${w.parent_id}::${(w.kid_name || '').toLowerCase().trim()}`;
      if (!waiverByKey.has(k)) waiverByKey.set(k, w);   // first = most recent
    }
  }

  console.error(`\nClassifying ${rows.length} active sub_ membership(s) against Stripe (read-only)...`);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    if ((i + 1) % 20 === 0) console.error(`  ...${i + 1}/${rows.length}`);
    let sub;
    try { sub = await stripe.subscriptions.retrieve(m.stripe_payment_id); }
    catch (e) { out.push({ m, error: `retrieve failed: ${e.message.slice(0, 40)}` }); continue; }

    const priceId = sub.items?.data?.[0]?.price?.id;
    const meta = PRICE[priceId] || { cat: 'OTHER', pkg: '?', term: null, signed: null };

    const invs = await paidInvoices(m.stripe_payment_id);
    const cycles = invs.length;
    const term = meta.term;                       // 6, 12, or null
    const pastTerm = term != null && cycles > term;
    const extraCycles = pastTerm ? cycles - term : 0;
    const extraChargedCents = pastTerm ? invs.slice(term).reduce((s, inv) => s + (inv.amount_paid || 0), 0) : 0;
    const monthsElapsed = monthsBetween(sub.created * 1000, Date.now());
    const extraMonths = term != null ? Math.max(0, monthsElapsed - term) : null;

    const p = prof.get(m.parent_id) || {};
    const w = waiverByKey.get(`${m.parent_id}::${(m.kid_name || '').toLowerCase().trim()}`) || {};
    const signed = w.billing_type || null;
    const mismatch = signed && meta.signed && signed !== meta.signed;

    out.push({
      m, sub, priceId, meta, cycles, term, pastTerm, extraCycles, extraChargedCents, monthsElapsed, extraMonths,
      parent_name: p.full_name || w.parent_name || '',
      email: p.email || w.email || '',
      phone: p.phone || w.phone || '',
      signed, mismatch, stripeStatus: sub.status,
    });
  }

  // CSV
  const cols = ['category', 'package', 'kid_name', 'parent_name', 'email', 'phone', 'price_id',
    'stripe_created', 'stripe_status', 'cycles_billed', 'term_months', 'past_term', 'extra_cycles',
    'extra_months', 'extra_charged_usd', 'signed_billing_type', 'mismatch', 'sub_id'];
  const lines = out.filter(r => !r.error).map(r => [
    r.meta.cat, r.meta.pkg, r.m.kid_name, r.parent_name, r.email, r.phone, r.priceId,
    dayOf(new Date(r.sub.created * 1000).toISOString()), r.stripeStatus,
    r.cycles, r.term ?? 'month-to-month', r.pastTerm ? 'YES' : '', r.extraCycles || '',
    r.extraMonths ?? '', (r.extraChargedCents / 100).toFixed(2), r.signed || '(none)',
    r.mismatch ? 'YES' : '', r.m.stripe_payment_id,
  ].map(csvCell).join(','));
  const errs = out.filter(r => r.error);
  writeFileSync('term-audit.csv', '﻿' + cols.join(',') + '\n' + lines.join('\n') + '\n');

  // Console summary
  const byCat = {};
  for (const r of out) if (!r.error) byCat[r.meta.cat] = (byCat[r.meta.cat] || 0) + 1;
  const b = out.filter(r => !r.error && r.meta.cat === 'B-m6');
  const c = out.filter(r => !r.error && r.meta.cat === 'C-m12');
  const bPast = b.filter(r => r.pastTerm), cPast = c.filter(r => r.pastTerm);
  const totalExtra = out.reduce((s, r) => s + (r.extraChargedCents || 0), 0) / 100;
  const mismatches = out.filter(r => r.mismatch);

  console.log(`\n================ TERM / OVERBILLING AUDIT ================`);
  console.log(`Active sub_ memberships: ${rows.length}`);
  console.log(`By category: ${JSON.stringify(byCat)}`);
  if (errs.length) console.log(`Stripe retrieve errors: ${errs.length}`);
  console.log(`\nB) m6  — total ${b.length}, PAST 6-mo term: ${bPast.length}`);
  console.log(`C) m12 — total ${c.length}, PAST 12-mo term: ${cPast.length}`);
  console.log(`\n💸 Total extra charged beyond term (all past-term members): $${totalExtra.toFixed(2)}`);
  console.log(`\nPast-term members (contact these):`);
  for (const r of [...bPast, ...cPast].sort((a, z) => z.extraChargedCents - a.extraChargedCents)) {
    console.log(`  [${r.meta.cat}] ${r.m.kid_name} — ${r.parent_name || '(no name)'} | ${r.phone || 'no phone'} | ${r.email || 'no email'}`);
    console.log(`     started ${dayOf(new Date(r.sub.created * 1000).toISOString())}, ${r.cycles} cycles billed (term ${r.term}) → ${r.extraCycles} extra, ~$${(r.extraChargedCents / 100).toFixed(2)} beyond term`);
  }
  console.log(`\n⚠️  Signed-vs-price MISMATCHES: ${mismatches.length}`);
  for (const r of mismatches) {
    console.log(`  ${r.m.kid_name} (${r.parent_name}) — signed '${r.signed}' but on ${r.meta.cat} price [${r.priceId}]`);
  }
  console.log(`\nFull detail in term-audit.csv. NO changes were made. ✅\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
