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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { parentName, email, phone, kidName, package: pkg, startDate } = req.body;
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

    // 4. Insert membership (expires_at = startDate + 1 month)
    const purchasedAt = new Date(startDate).toISOString();
    const expiresDate = new Date(startDate);
    expiresDate.setMonth(expiresDate.getMonth() + 1);

    const { error: membershipError } = await supabase
      .from('player_memberships')
      .insert({
        parent_id: clerkUser.id,
        kid_name: kidName,
        membership_id: MEMBERSHIP_IDS[pkg],
        sessions_total: SESSIONS_PER_PACKAGE[pkg],
        sessions_used: 0,
        status: 'active',
        stripe_payment_id: 'manual',
        stripe_session_id: 'manual',
        purchased_at: purchasedAt,
        expires_at: expiresDate.toISOString(),
        package_name: pkg,
      });
    if (membershipError) throw new Error(`Membership: ${membershipError.message}`);

    console.log(`[add-member] ✅ ${parentName} / ${kidName} — Package ${pkg}`);
    return res.status(200).json({ ok: true, clerkId: clerkUser.id });
  } catch (err) {
    console.error('[add-member] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
