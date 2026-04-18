// ============================================================
// TORQUE PERFORMANCE — MIGRATION SCRIPT
// Creates users in Clerk + inserts memberships in Supabase
// Run once: node migrate_members.js
// ============================================================

import Clerk from '@clerk/clerk-sdk-node';
import { createClient } from '@supabase/supabase-js';

// ── CONFIG ──────────────────────────────────────────────────
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const clerk = Clerk({ secretKey: CLERK_SECRET_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── MEMBERSHIP IDs FROM SUPABASE (memberships table) ────────
// Run this query first to get the UUIDs:
// SELECT id, name FROM memberships;
// Then fill in below:
const MEMBERSHIP_IDS = {
  'A':   '93e92b42-7453-46c2-9660-12426eaa51a5',
  'AA':  'be63127a-09a3-4320-bfd6-cf18c69b9def',
  'AAA': 'd2dd367c-1d1c-490a-8cb3-aafc52690e93',
  'MLB': '56f084fd-c4d1-4ed1-a7e3-ae3ed889c87e',
};

// Sessions per month per package
const SESSIONS_PER_MONTH = {
  'A':   4,
  'AA':  8,
  'AAA': 12,
};

// ── MEMBERS DATA ─────────────────────────────────────────────
const MEMBERS = [
  // ── PACKAGE A ──
  { name: 'MAGGIE GARCIA',      phone: '(915) 309-9573', email: 'camrigav@gmail.com',            package: 'A',   plan: 'stand', months: 1,  payment: 234,  sibling: false, date_paid: '2026-03-13' },
  { name: 'CRYSTAL HADLEY',     phone: '(703) 727-1094', email: 'sunshne52105@aol.com',           package: 'A',   plan: 'stand', months: 1,  payment: 234,  sibling: false, date_paid: '2026-01-23' },
  { name: 'JOSIAH MAXWELL',     phone: '(915) 433-6066', email: 'josiahmaxwell@gmail.com',        package: 'A',   plan: 'stand', months: 1,  payment: 260,  sibling: false, date_paid: '2026-03-18' },
  { name: 'LILY SAUCEDO',       phone: '(915) 867-4433', email: 'lilisau@icloud.com',             package: 'A',   plan: 'm6',    months: 6,  payment: 221,  sibling: false, date_paid: '2026-03-21' },
  { name: 'HORTENCIA LAZCANO',  phone: '(915) 502-2162', email: 'tenchita12@hotmail.com',         package: 'A',   plan: 'm6',    months: 6,  payment: 221,  sibling: false, date_paid: '2026-03-30' },
  { name: 'MARIA NEGRON',       phone: '(915) 253-9882', email: 'mnegron52@gmail.com',            package: 'A',   plan: 'm6',    months: 6,  payment: 221,  sibling: false, date_paid: '2026-04-06' },
  { name: 'DANIEL TARANGO',     phone: '(915) 525-5731', email: 'danielt2115@yahoo.com',          package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-04-06' },
  { name: 'ERIKA CANO',         phone: '(915) 777-5945', email: 'erikag118@gmail.com',            package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-04-06' },
  { name: 'ALLAN DILLON',       phone: '(915) 373-8923', email: 'allan_dillon@hotmail.com',       package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-03-25' },
  { name: 'JAIME ROMERO',       phone: '(915) 219-6135', email: 'jaimeromero3006@gmail.com',      package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-04-01' },
  { name: 'LENIN DOMINGUEZ',    phone: '(915) 342-6126', email: 'lenindgz1307@gmail.com',         package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-04-07' },
  { name: 'ANGELICA RIVERA',    phone: '+52 656 206 1708', email: 'angelikariverb@hotmail.com',   package: 'A',   plan: 'm12',   months: 12, payment: 221,  sibling: false, date_paid: '2026-03-31' },
  { name: 'JOSE ESCAJEDA',      phone: '(915) 328-6788', email: 'escajeda.joe@gmail.com',         package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-03-16' },
  { name: 'CHRISTINA VELEZ',    phone: '(915) 920-8397', email: 'cmastorgaa@gmail.com',           package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-03-13' },
  { name: 'GIGI FRANCO',        phone: '(915) 305-0332', email: 'gigivfranco@gmail.com',          package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-03-12' },
  { name: 'DANIEL PADILLA',     phone: '(915) 471-3203', email: 'danny.padilla0013@gmail.com',    package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-03-31' },
  { name: 'EDUARDO TORRES',     phone: '(915) 549-2912', email: 'eddietorres88@gmail.com',        package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-03-13' },
  { name: 'ALBERT SANCHEZ',     phone: '(915) 269-2535', email: 'berts31@aol.com',                package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-03-25' },
  { name: 'CYNTHIA AGUILERA',   phone: '(915) 252-0772', email: 'belmancindy@gmail.com',          package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-04-03' },
  { name: 'YVETTE MALDONADO',   phone: '(915) 497-3318', email: 'maldo2504@gmail.com',            package: 'A',   plan: 'm12',   months: 12, payment: 208,  sibling: false, date_paid: '2026-03-13' },
  { name: 'JOE BUSBEE',         phone: '(512) 541-9836', email: 'kanescrawler@yahoo.com',         package: 'A',   plan: 'annual',months: 12, payment: 2340, sibling: false, date_paid: '2026-02-16' },
  { name: 'OZZIE ALVAREZ',      phone: '(915) 539-1318', email: 'ozziealvarez2003@yahoo.com',     package: 'A',   plan: 'annual',months: 12, payment: 2340, sibling: false, date_paid: '2026-01-07' },
  // ── PACKAGE AA ──
  { name: 'ANTONIO MARQUEZ',    phone: '(915) 408-1930', email: 'marquez.22antonio@gmail.com',    package: 'AA',  plan: 'stand', months: 1,  payment: 360,  sibling: false, date_paid: '2026-04-09' },
  { name: 'ELIBORIO FIGUEROA',  phone: '(915) 261-2255', email: 'efigueroa111@gmail.com',         package: 'AA',  plan: 'm6',    months: 6,  payment: 306,  sibling: false, date_paid: '2026-03-12' },
  { name: 'ADRIAN MACIAS',      phone: '(915) 316-7905', email: 'macias.adrian90@gmail.com',      package: 'AA',  plan: 'm6',    months: 6,  payment: 306,  sibling: false, date_paid: '2026-03-11' },
  { name: 'MATTHEW FINO',       phone: '(915) 881-7623', email: 'matt_fino@yahoo.com',            package: 'AA',  plan: 'm6',    months: 6,  payment: 306,  sibling: false, date_paid: '2026-03-25' },
  { name: 'MCKAYLA DEMULLING',  phone: '(402) 213-2634', email: 'mmdemulling@gmail.com',          package: 'AA',  plan: 'm6',    months: 6,  payment: 306,  sibling: false, date_paid: '2026-04-08' },
  { name: 'ALEJANDRO SAUCEDO',  phone: '(915) 502-4498', email: 'asauce1996@gmail.com',           package: 'AA',  plan: 'm6',    months: 6,  payment: 306,  sibling: false, date_paid: '2026-04-07' },
  { name: 'ANDREW/MELANIE DE LA ROSA', phone: '(915) 487-8327', email: 'adelarosa@ldcm-solutions.com', package: 'AA', plan: 'm6', months: 6, payment: 306, sibling: false, date_paid: '2026-04-08' },
  { name: 'ANDREW/MELANIE DE LA ROSA (SIBLING)', phone: '(915) 487-8327', email: 'adelarosa@ldcm-solutions.com', package: 'AA', plan: 'm6', months: 6, payment: 180, sibling: true, date_paid: '2026-04-08' },
  { name: 'EBER ALVAREZ',       phone: '(915) 603-1209', email: 'eberalvarez@yahoo.com',          package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-04-08' },
  { name: 'MELLANY RODRIGUEZ',  phone: '(210) 385-4622', email: 'mellanyrodriguez3@gmail.com',    package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-03-11' },
  { name: 'ROMAN ESTRADA',      phone: '(915) 603-8974', email: 'romanestrada0603@gmail.com',     package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-03-18' },
  { name: 'SERGIO LUEVANOS',    phone: '(619) 822-8101', email: '619luevanos@gmail.com',          package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-03-24' },
  { name: 'KATHLYN DUBY',       phone: '(915) 274-4651', email: 'kathlyne.duby@yahoo.com',        package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-04-01' },
  { name: 'JESUS MUNIZ',        phone: '(915) 256-0800', email: 'coachjesse2426@gmail.com',       package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-03-14' },
  { name: 'PEDRO HERRERA',      phone: '(915) 261-4518', email: 'ph284546@gmail.com',             package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-04-07' },
  { name: 'FELIPE BERMUDEZ',    phone: '(915) 342-0424', email: 'felipeb19@yahoo.com',            package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-04-07' },
  { name: 'ROBERT MENCHACA',    phone: '(915) 449-8280', email: 'rcm322@hotmail.com',             package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-04-06' },
  { name: 'ALEJANDRO SANCHEZ',  phone: '(915) 637-9656', email: 'mangoshelados@hotmail.com',      package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-04-07' },
  { name: 'ALMA ROMERO',        phone: '(915) 268-4083', email: 'aaromero1031@gmail.com',         package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-03-14' },
  { name: 'DANIEL HERRERA',     phone: '(915) 213-9305', email: 'herreradaniel23@yahoo.com',      package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-03-13' },
  { name: 'TANIA GONZALEZ',     phone: '(424) 527-1758', email: 'g_tania15@icloud.com',           package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-04-07' },
  { name: 'LORENZO AGUILAR',    phone: '(432) 803-2630', email: 'larry-1999@hotmail.com',         package: 'AA',  plan: 'm12',   months: 12, payment: 288,  sibling: false, date_paid: '2026-04-02' },
  { name: 'ISMAEL MARTINEZ',    phone: '(915) 731-0819', email: 'destian2021@gmail.com',          package: 'AA',  plan: 'annual',months: 12, payment: 3240, sibling: false, date_paid: '2026-01-28' },
  // ── PACKAGE AAA ──
  { name: 'JESUS MENDOZA',      phone: '(915) 990-5326', email: 'jmendo62@gmail.com',             package: 'AAA', plan: 'm12',   months: 12, payment: 352,  sibling: false, date_paid: '2026-03-13' },
  // ── NUEVOS MIEMBROS (Apr 18, 2026) ──
  { name: 'RICARDO FLORES',     phone: '+52 656 338 7996', email: 'ro.ortegaf80@gmail.com',       package: 'A',   plan: 'm12',   months: 1,  payment: 208,  sibling: false, date_paid: '2026-04-13' },
  { name: 'MICHAEL BAMBA',      phone: '(808) 857-6250', email: 'michael_bamba_3@hotmail.com',    package: 'AA',  plan: 'm12',   months: 1,  payment: 288,  sibling: false, date_paid: '2026-04-13' },
  { name: 'DEREK ARMENDARIZ',   phone: '(915) 412-7493', email: 'dejoma29@gmail.com',             package: 'AA',  plan: 'm12',   months: 1,  payment: 288,  sibling: false, date_paid: '2026-04-14' },
];

// ── HELPERS ──────────────────────────────────────────────────
function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function getSessionsTotal(pkg, months) {
  return (SESSIONS_PER_MONTH[pkg] || 4) * months;
}

// ── MAIN ─────────────────────────────────────────────────────
async function migrate() {
  console.log(`\n🚀 Starting migration of ${MEMBERS.length} members...\n`);

  const results = { success: [], failed: [] };
  const processedEmails = new Set();

  for (const member of MEMBERS) {
    try {
      console.log(`Processing: ${member.name} (${member.email})`);

      // 1. Create or find user in Clerk
      let clerkUser;
      const existing = await clerk.users.getUserList({ emailAddress: [member.email] });

      if (existing.length > 0) {
        clerkUser = existing[0];
        console.log(`  ✓ Clerk user already exists: ${clerkUser.id}`);
      } else if (!processedEmails.has(member.email)) {
        // Only create Clerk user once per email
        clerkUser = await clerk.users.createUser({
          emailAddress: [member.email],
          firstName: member.name.split(' ')[0],
          lastName: member.name.split(' ').slice(1).join(' '),
          skipPasswordRequirement: true,
        });
        console.log(`  ✓ Clerk user created: ${clerkUser.id}`);
      } else {
        // Sibling — reuse existing clerk user for same email
        const found = await clerk.users.getUserList({ emailAddress: [member.email] });
        clerkUser = found[0];
        console.log(`  ✓ Reusing Clerk user for sibling: ${clerkUser.id}`);
      }
      processedEmails.add(member.email);

      // 2. Insert/upsert profile in Supabase
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: clerkUser.id,
          full_name: member.name,
          phone: member.phone,
          email: member.email,
          role: 'parent',
        }, { onConflict: 'id' });

      if (profileError) throw new Error(`Profile error: ${profileError.message}`);
      console.log(`  ✓ Profile upserted`);

      // 3. Insert player_membership in Supabase
      const purchasedAt = new Date(member.date_paid).toISOString();
      const expiresAt = addMonths(member.date_paid, member.months);
      const sessionsTotal = getSessionsTotal(member.package, member.months);
      const membershipId = MEMBERSHIP_IDS[member.package];

      const { error: membershipError } = await supabase
        .from('player_memberships')
        .insert({
          parent_id: clerkUser.id,
          kid_name: member.name, // Owner can update individual kid names later
          membership_id: membershipId,
          sessions_total: sessionsTotal,
          sessions_used: 0,
          sessions_remaining: sessionsTotal,
          status: 'active',
          stripe_payment_id: 'migrated',
          purchased_at: purchasedAt,
          expires_at: expiresAt,
          package_name: member.package,
          stripe_session_id: 'migrated',
        });

      if (membershipError) throw new Error(`Membership error: ${membershipError.message}`);
      console.log(`  ✓ Membership inserted — expires ${expiresAt.split('T')[0]}\n`);

      results.success.push(member.name);

    } catch (err) {
      console.error(`  ✗ FAILED: ${member.name} — ${err.message}\n`);
      results.failed.push({ name: member.name, error: err.message });
    }
  }

  // ── SUMMARY ──
  console.log('\n════════════════════════════════════');
  console.log(`✅ SUCCESS: ${results.success.length}`);
  console.log(`❌ FAILED:  ${results.failed.length}`);
  if (results.failed.length > 0) {
    console.log('\nFailed members:');
    results.failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  }
  console.log('════════════════════════════════════\n');
}

migrate().catch(console.error);
