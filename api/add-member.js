import { createClerkClient } from '@clerk/clerk-sdk-node';
import { createClient } from '@supabase/supabase-js';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MEMBERSHIP_IDS = {
  'A':   '93e92b42-7453-46c2-9660-12426eaa51a5',
  'AA':  'be63127a-09a3-4320-bfd6-cf18c69b9def',
  'AAA': 'd2dd367c-1d1c-490a-8cb3-aafc52690e93',
  'MLB': '56f084fd-c4d1-4ed1-a7e3-ae3ed889c87e',
};

const SESSIONS_PER_PACKAGE = { 'A': 4, 'AA': 8, 'AAA': 12, 'MLB': 20 };

const PRICE_TABLE = {
  A:   { monthly: 260, m6: 234, m12: 221, annual: 2496 },
  AA:  { monthly: 360, m6: 324, m12: 306, annual: 3456 },
  AAA: { monthly: 440, m6: 396, m12: 374, annual: 4224 },
  MLB: { monthly: 600, m6: 540, m12: 510, annual: 5760 },
};

// Stripe Payment Links + matching price IDs (needed for client_reference_id)
const STRIPE_LINKS = {
  A: {
    monthly: { link: 'https://buy.stripe.com/test_dRmbJ04Jtgweb8A61YfrW00', price: 'price_1TLqDdAPTWbxe0YytEOlF7ZH' },
    m6:      { link: 'https://buy.stripe.com/test_4gM14mdfZ3Js4KcaiefrW01', price: 'price_1TLqDmAPTWbxe0YyqbHEcuFr' },
    m12:     { link: 'https://buy.stripe.com/test_7sY00i2Bl7ZI0tW8a6frW02', price: 'price_1TLqDmAPTWbxe0YysigUumPn' },
    annual:  { link: 'https://buy.stripe.com/test_cNifZgb7Reo6ccE9eafrW04', price: 'price_1TLqDlAPTWbxe0YyljY5WD6Y' },
  },
  AA: {
    monthly: { link: 'https://buy.stripe.com/test_28EaEW4Jt7ZIa4w1LIfrW05', price: 'price_1TLqDgAPTWbxe0Yy7yaP3VX3' },
    m6:      { link: 'https://buy.stripe.com/test_6oUaEW2Bl5RA90scqmfrW06', price: 'price_1TLqDkAPTWbxe0YyZu4hFrI3' },
    m12:     { link: 'https://buy.stripe.com/test_fZu9ASdfZ93MdgI4XUfrW07', price: 'price_1TLqDjAPTWbxe0YyTsqaUdt5' },
    annual:  { link: 'https://buy.stripe.com/test_4gM9ASa3N93Mb8A0HEfrW08', price: 'price_1TLqDkAPTWbxe0YykcsrB50f' },
  },
  AAA: {
    monthly: { link: 'https://buy.stripe.com/test_bJeaEW2Bl5RA6SkduqfrW09', price: 'price_1TLqDhAPTWbxe0YyXXJQZrh7' },
    m6:      { link: 'https://buy.stripe.com/test_aFa7sKb7Rgwe4Kc762frW0a', price: 'price_1TLqDkAPTWbxe0YydXEB3YqT' },
    m12:     { link: 'https://buy.stripe.com/test_cNi8wOa3N3JsccEeyufrW0b', price: 'price_1TLqDjAPTWbxe0YyuyUujCu4' },
    annual:  { link: 'https://buy.stripe.com/test_7sYfZg4JtbbUccE0HEfrW0c', price: 'price_1TLqDkAPTWbxe0Yy8UHtMvEJ' },
  },
  MLB: {
    monthly: { link: 'https://buy.stripe.com/test_4gM3cu5Nx1Bk3G8eyufrW0d', price: 'price_1TLqDdAPTWbxe0YydO64XMLw' },
    m6:      { link: 'https://buy.stripe.com/test_14A9ASb7R4Nw0tW762frW0e', price: 'price_1TLqDlAPTWbxe0YyEIZi7YR5' },
    m12:     { link: 'https://buy.stripe.com/test_dRm00i1xhcfY7Wo0HEfrW0f', price: 'price_1TLqDjAPTWbxe0YyVQxRaHFs' },
    annual:  { link: 'https://buy.stripe.com/test_fZu8wO1xh1Bk7Wo2PMfrW0g', price: 'price_1TLqDjAPTWbxe0Yy6fRLwlFM' },
  },
};

function calcSessions(pkg, planType) {
  const base = SESSIONS_PER_PACKAGE[pkg] || 4;
  return planType === 'annual' ? base * 12 : base;
}

function calcExpires(startDate, planType) {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + (planType === 'annual' ? 12 : 1));
  return d.toISOString();
}

function buildStripeLink(pkg, planType, clerkId, kidName) {
  const info = STRIPE_LINKS[pkg]?.[planType];
  if (!info) return null;
  const ref = encodeURIComponent(`${clerkId}__${kidName}__${info.price}`);
  return `${info.link}?client_reference_id=${ref}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    parentName, email, phone, kidName, package: pkg, startDate,
    planType = 'monthly', kidName2, package2, planType2 = 'monthly',
    paymentMethod = 'manual', specialPrice,
  } = req.body;

  if (!parentName || !email || !kidName || !pkg || !startDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Create or find Clerk user
    let clerkUser;
    const existing = await clerk.users.getUserList({ emailAddress: [email] });
    if (existing.length > 0) {
      clerkUser = existing[0];
    } else {
      clerkUser = await clerk.users.createUser({
        emailAddress: [email],
        firstName: parentName.split(' ')[0],
        lastName: parentName.split(' ').slice(1).join(' '),
        username: email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Date.now().toString().slice(-4),
        password: 'Torque2026!',
      });
    }

    // 2. Upsert profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: clerkUser.id, full_name: parentName, phone, email, role: 'parent' }, { onConflict: 'id' });
    if (profileError) throw new Error(`Profile: ${profileError.message}`);

    // 3. Insert player(s)
    const { error: playerError } = await supabase
      .from('players')
      .insert({ parent_id: clerkUser.id, kid_name: kidName, birthdate: null, age: null });
    if (playerError) throw new Error(`Player: ${playerError.message}`);

    const pkg2 = package2 || pkg;
    if (kidName2) {
      const { error: player2Error } = await supabase
        .from('players')
        .insert({ parent_id: clerkUser.id, kid_name: kidName2, birthdate: null, age: null });
      if (player2Error) throw new Error(`Player 2: ${player2Error.message}`);
    }

    // 4a. STRIPE flow — return payment links, do not create memberships yet
    if (paymentMethod === 'stripe') {
      const stripeLink  = buildStripeLink(pkg,  planType,  clerkUser.id, kidName);
      const stripeLink2 = kidName2 ? buildStripeLink(pkg2, planType2, clerkUser.id, kidName2) : null;
      console.log(`[add-member] ✅ Stripe — ${parentName} / ${kidName}${kidName2 ? ' + ' + kidName2 : ''}`);
      return res.status(200).json({ ok: true, clerkId: clerkUser.id, stripeLink, stripeLink2 });
    }

    // 4b. MANUAL flow — insert memberships immediately
    const sp = specialPrice ? Math.round(parseFloat(specialPrice)) : null;
    const effectivePrice1 = sp ?? (PRICE_TABLE[pkg]?.[planType] ?? null);
    const effectivePrice2 = sp != null ? Math.round(sp * 0.5) : (PRICE_TABLE[pkg2]?.monthly != null ? Math.round(PRICE_TABLE[pkg2].monthly * 0.5) : null);
    const { error: membershipError } = await supabase
      .from('player_memberships')
      .insert({
        parent_id: clerkUser.id,
        kid_name: kidName,
        membership_id: MEMBERSHIP_IDS[pkg],
        sessions_total: calcSessions(pkg, planType),
        sessions_used: 0,
        status: 'active',
        stripe_payment_id: 'manual',
        stripe_session_id: 'manual',
        purchased_at: new Date(startDate).toISOString(),
        expires_at: calcExpires(startDate, planType),
        package_name: pkg,
        monthly_price: effectivePrice1,
      });
    if (membershipError) throw new Error(`Membership: ${membershipError.message}`);

    if (kidName2) {
      const { error: membership2Error } = await supabase
        .from('player_memberships')
        .insert({
          parent_id: clerkUser.id,
          kid_name: kidName2,
          membership_id: MEMBERSHIP_IDS[pkg2],
          sessions_total: calcSessions(pkg2, planType2),
          sessions_used: 0,
          status: 'active',
          stripe_payment_id: 'manual',
          stripe_session_id: 'manual',
          purchased_at: new Date(startDate).toISOString(),
          expires_at: calcExpires(startDate, planType2),
          package_name: pkg2,
          sibling_discount: true,
          monthly_price: effectivePrice2,
        });
      if (membership2Error) throw new Error(`Membership 2: ${membership2Error.message}`);
    }

    console.log(`[add-member] ✅ Manual — ${parentName} / ${kidName}${kidName2 ? ' + ' + kidName2 : ''} — Package ${pkg} / ${planType}`);
    return res.status(200).json({ ok: true, clerkId: clerkUser.id });
  } catch (err) {
    console.error('[add-member] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
