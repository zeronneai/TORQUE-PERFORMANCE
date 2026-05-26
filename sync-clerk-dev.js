// ============================================================
// TORQUE PERFORMANCE — Clerk Dev Account Sync
// For users who exist in Supabase but need Clerk accounts created.
//
// What it does:
//   1. Creates (or finds) a Clerk account for each email
//   2. Looks up the current profile ID in Supabase
//   3. Prints SQL UPDATE statements to stdout
//
// Run:
//   CLERK_SECRET_KEY=sk_test_... \
//   VITE_SUPABASE_URL=https://... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   node sync-clerk-dev.js > sync-output.sql
// ============================================================

import { createClerkClient } from '@clerk/clerk-sdk-node';
import { createClient } from '@supabase/supabase-js';

const CLERK_SECRET_KEY      = process.env.CLERK_SECRET_KEY;
const SUPABASE_URL          = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CLERK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars: CLERK_SECRET_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const clerk    = createClerkClient({ secretKey: CLERK_SECRET_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const EMAILS = [
  'ozziealvarez2003@yahoo.com',
  'invoicemaca@gmail.com',
  '619luevanos@gmail.com',
  'e-rodriguez25@hotmail.com',
  'rodztury@gmail.com',
  'kanescrawler@yahoo.com',
  'inesleonorsanchez80@gmail.com',
  'luisadriancadena@yahoo.com',
  'eduardocruz5@aol.com',
  'mdelarosa531@gmail.com',
];

async function main() {
  const results  = [];
  const skipped  = [];
  const failed   = [];

  console.error(`\nProcessing ${EMAILS.length} emails...\n`);

  for (const email of EMAILS) {
    try {
      // 1. Find existing Supabase profile
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('email', email)
        .maybeSingle();

      if (profileErr) throw new Error(`Supabase lookup: ${profileErr.message}`);

      const oldId = profile?.id ?? null;

      // 2. Create or find Clerk user
      const existingResult = await clerk.users.getUserList({ emailAddress: [email] });
      const existingUsers  = Array.isArray(existingResult) ? existingResult : (existingResult.data ?? []);

      let clerkUser;
      let action;

      if (existingUsers.length > 0) {
        clerkUser = existingUsers[0];
        action    = 'found';
        console.error(`  ✓ Found   ${email} → ${clerkUser.id}`);
      } else {
        const nameParts = (profile?.full_name || email.split('@')[0]).split(' ');
        clerkUser = await clerk.users.createUser({
          emailAddress: [email],
          firstName:    nameParts[0],
          lastName:     nameParts.slice(1).join(' ') || undefined,
          username:     email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Date.now().toString().slice(-4),
          password:     'Torque2026!',
        });
        action = 'created';
        console.error(`  ✓ Created ${email} → ${clerkUser.id}`);
      }

      const newId = clerkUser.id;

      if (oldId === newId) {
        console.error(`    (IDs already match — skipping)`);
        skipped.push(email);
        continue;
      }

      results.push({ email, oldId, newId, action, name: profile?.full_name });

    } catch (err) {
      console.error(`  ✗ FAILED  ${email}: ${err.message}`);
      failed.push({ email, error: err.message });
    }
  }

  // ── Generate SQL ──────────────────────────────────────────
  if (results.length > 0) {
    console.log('-- ============================================================');
    console.log('-- Torque Performance — Clerk Dev Sync SQL');
    console.log(`-- Generated: ${new Date().toISOString()}`);
    console.log('-- Run in Supabase Dashboard → SQL Editor');
    console.log('-- ============================================================\n');

    for (const { email, oldId, newId, action, name } of results) {
      console.log(`-- ${name || email} (${action})`);
      console.log(`-- ${email}`);
      console.log(`-- old: ${oldId || 'NOT IN SUPABASE'}`);
      console.log(`-- new: ${newId}`);

      if (oldId) {
        console.log(`BEGIN;`);
        console.log(`  UPDATE players             SET parent_id = '${newId}' WHERE parent_id = '${oldId}';`);
        console.log(`  UPDATE player_memberships  SET parent_id = '${newId}' WHERE parent_id = '${oldId}';`);
        console.log(`  UPDATE profiles            SET id        = '${newId}' WHERE id        = '${oldId}';`);
        console.log(`COMMIT;\n`);
      } else {
        console.log(`-- ⚠️  No existing Supabase profile for ${email} — INSERT manually if needed`);
        console.log(`--    INSERT INTO profiles (id, email, role) VALUES ('${newId}', '${email}', 'parent');\n`);
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────
  console.error('\n════════════════════════════════════════');
  console.error(`✅ Processed:  ${results.length}`);
  console.error(`⏭  Skipped:   ${skipped.length} (IDs already match)`);
  console.error(`❌ Failed:     ${failed.length}`);
  if (failed.length > 0) {
    console.error('\nFailed:');
    failed.forEach(f => console.error(`  - ${f.email}: ${f.error}`));
  }
  console.error('════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
