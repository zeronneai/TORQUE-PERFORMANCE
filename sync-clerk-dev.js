// ============================================================
// TORQUE PERFORMANCE — Clerk Production Account Sync
// Reads all profiles from Supabase, creates (or finds) each
// user in Clerk production, and outputs SQL to update IDs.
//
// Run:
//   CLERK_SECRET_KEY=sk_live_... \
//   VITE_SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   node sync-clerk-dev.js > sync-output.sql
// ============================================================

import { createClerkClient } from '@clerk/clerk-sdk-node';
import { createClient } from '@supabase/supabase-js';

const CLERK_SECRET_KEY     = process.env.CLERK_SECRET_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Accept URLs with or without /rest/v1/ path suffix
const rawUrl     = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_URL = rawUrl ? new URL(rawUrl).origin : '';

if (!CLERK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars: CLERK_SECRET_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const isProd = CLERK_SECRET_KEY.startsWith('sk_live_');
console.error(`\nClerk instance: ${isProd ? '🟢 PRODUCTION (sk_live_)' : '🟡 DEVELOPMENT (sk_test_)'}`);
console.error(`Supabase URL:   ${SUPABASE_URL}\n`);

const clerk    = createClerkClient({ secretKey: CLERK_SECRET_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // 1. Load all profiles from Supabase
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role')
    .order('full_name');

  if (profilesErr) {
    console.error(`Failed to load profiles: ${profilesErr.message}`);
    process.exit(1);
  }

  const validProfiles = profiles.filter(p => p.email);
  console.error(`Found ${validProfiles.length} profiles with email addresses.\n`);

  const results = [];
  const skipped = [];
  const failed  = [];

  for (const profile of validProfiles) {
    const { id: oldId, email, full_name, phone } = profile;

    try {
      // 2. Create or find Clerk production user
      const existingResult = await clerk.users.getUserList({ emailAddress: [email] });
      const existingUsers  = Array.isArray(existingResult) ? existingResult : (existingResult.data ?? []);

      let clerkUser;
      let action;

      if (existingUsers.length > 0) {
        clerkUser = existingUsers[0];
        action    = 'found';
        console.error(`  ✓ Found   ${email} → ${clerkUser.id}`);
      } else {
        const nameParts = (full_name || email.split('@')[0]).split(' ');
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
        console.error(`    ↳ IDs already match — skipping`);
        skipped.push(email);
        continue;
      }

      results.push({ email, oldId, newId, action, name: full_name });

    } catch (err) {
      console.error(`  ✗ FAILED  ${email}: ${err.message}`);
      failed.push({ email, error: err.message });
    }
  }

  // 3. Generate SQL ──────────────────────────────────────────
  console.log('-- ============================================================');
  console.log('-- Torque Performance — Clerk Production Sync SQL');
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log(`-- Profiles processed: ${validProfiles.length}`);
  console.log('-- Run in Supabase Dashboard → SQL Editor');
  console.log('-- ============================================================\n');

  for (const { email, oldId, newId, action, name } of results) {
    console.log(`-- ${name || email} (${action})`);
    console.log(`-- ${email}`);
    console.log(`-- old id: ${oldId}`);
    console.log(`-- new id: ${newId}`);
    console.log(`BEGIN;`);
    console.log(`  UPDATE players            SET parent_id = '${newId}' WHERE parent_id = '${oldId}';`);
    console.log(`  UPDATE player_memberships SET parent_id = '${newId}' WHERE parent_id = '${oldId}';`);
    console.log(`  UPDATE profiles           SET id        = '${newId}' WHERE id        = '${oldId}';`);
    console.log(`COMMIT;\n`);
  }

  // 4. Summary ──────────────────────────────────────────────
  console.error('\n════════════════════════════════════════');
  console.error(`✅ SQL generated: ${results.length} users`);
  console.error(`   created:  ${results.filter(r => r.action === 'created').length}`);
  console.error(`   found:    ${results.filter(r => r.action === 'found').length}`);
  console.error(`⏭  Skipped:  ${skipped.length} (IDs already match)`);
  console.error(`❌ Failed:   ${failed.length}`);
  if (failed.length > 0) {
    console.error('\nFailed:');
    failed.forEach(f => console.error(`  - ${f.email}: ${f.error}`));
  }
  console.error('════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
