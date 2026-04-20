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

function calcExpires(startDate, planType) {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + (planType === 'annual' ? 12 : 1));
  return d.toISOString();
}

function calcSessions(pkg, planType) {
  const base = SESSIONS_PER_PACKAGE[pkg] || 4;
  return planType === 'annual' ? base * 12 : base;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { parentName, email, phone, kidName, package: pkg, startDate, planType = 'monthly', kidName2, package2, planType2 = 'monthly' } = req.body;
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

    // 3. Insert player
    const { error: playerError } = await supabase
      .from('players')
      .insert({ parent_id: clerkUser.id, kid_name: kidName, birthdate: null, age: null });
    if (playerError) throw new Error(`Player: ${playerError.message}`);

    // 4. Insert membership
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
      });
    if (membershipError) throw new Error(`Membership: ${membershipError.message}`);

    // Optional second player (sibling)
    if (kidName2) {
      const pkg2 = package2 || pkg;
      const { error: player2Error } = await supabase
        .from('players')
        .insert({ parent_id: clerkUser.id, kid_name: kidName2, birthdate: null, age: null });
      if (player2Error) throw new Error(`Player 2: ${player2Error.message}`);

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
        });
      if (membership2Error) throw new Error(`Membership 2: ${membership2Error.message}`);
    }

    console.log(`[add-member] ✅ ${parentName} / ${kidName}${kidName2 ? ' + ' + kidName2 : ''} — Package ${pkg} / ${planType}`);
    return res.status(200).json({ ok: true, clerkId: clerkUser.id });
  } catch (err) {
    console.error('[add-member] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
