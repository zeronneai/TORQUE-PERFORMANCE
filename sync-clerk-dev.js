// ============================================================
// TORQUE PERFORMANCE — Clerk Production Account Sync
// Data source: Supabase profiles CSV export (hardcoded below).
// Creates/finds each user in Clerk production, then outputs
// SQL UPDATE statements to sync IDs in all three tables.
//
// Run:
//   CLERK_SECRET_KEY=sk_live_... node sync-clerk-dev.js > sync-output.sql
// ============================================================

import { createClerkClient } from '@clerk/clerk-sdk-node';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  console.error('Missing env var: CLERK_SECRET_KEY');
  process.exit(1);
}

const isProd = CLERK_SECRET_KEY.startsWith('sk_live_');
console.error(`\nClerk instance: ${isProd ? '🟢 PRODUCTION (sk_live_)' : '🟡 DEVELOPMENT (sk_test_)'}`);

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

// Supabase profiles export — id is the current (dev) Clerk ID stored in Supabase
const PROFILES = [
  { id: 'user_3D97XrU2N7RObEZcMaOwnACfaOz', email: 'macias.adrian90@gmail.com',       name: 'Adrian Macias' },
  { id: 'user_3D957BnQDYgMgdOQDoTR7eZYBi7', email: 'berts31@aol.com',                 name: 'Albert Sanchez' },
  { id: 'user_3D996mC1r35EFgMo2S1uULH1fJw', email: 'mangoshelados@hotmail.com',        name: 'Alejandro Sanchez' },
  { id: 'user_3D918KwiaD3xNe8p5ZgYCnYWk4r', email: 'asauce1996@gmail.com',             name: 'Alejandro Saucedo' },
  { id: 'user_3EF5twyC2NeyJjjhhqScTKobnQq', email: 'anakaren.beltran@gmail.com',       name: 'Alex Bobadilla' },
  { id: 'user_3DNCvsC8xACRstoRXQkOXGTpyyU', email: '2645dunoon@gmail.com',             name: 'Alex Zuniga' },
  { id: 'user_3D90ZcIB5FyQk4KJRjR3ws5czzn', email: 'allan_dillon@hotmail.com',         name: 'Allan Dillon' },
  { id: 'user_3DgkIPwkBAkMh2tocSMz8XmrVpo', email: 'mdelarosa531@gmail.com',           name: 'Andrew de la Rosa' },
  { id: 'user_3EFCCAdcHoaoeuGttovVrjXDUYX', email: 'angel28facio@icloud.com',          name: 'Angel Facio' },
  { id: 'user_3D93CcDZaVTwPhYbPGE0oUI2685', email: 'angelikariverb@hotmail.com',       name: 'Angelica Rivera' },
  { id: 'user_3D949Wm594yLHJLV596FpC4biiW', email: 'marquez.22antonio@gmail.com',      name: 'Antonio Marquez' },
  { id: 'user_3DxgsoOFDZom0H6YSvpitw2dj3R', email: 'rodztury@gmail.com',               name: 'Arturo Rodriguez' },
  { id: 'user_3D9CxUviUkkpSdPZ7oh3zICl9I9', email: 'rigo838@gmail.com',                name: 'Ben Arras' },
  { id: 'user_3DoTJHF50PAOqWpzupbqY0nDRcr', email: 'cfdz88@yahoo.com',                 name: 'Carlos Fernandez' },
  { id: 'user_3D92HY5Z32SsuSminpqgAVDVLCz', email: 'cmen24@gmail.com',                 name: 'Cesar Mendoza' },
  { id: 'user_3D92k47z6HSG55O44FBNCicSFWa', email: 'cmastorgaa@gmail.com',             name: 'Christina Velez' },
  { id: 'user_3D99QHTyUPEUwUjbS9GPC9SPmF4', email: 'houseofhorrorbullies@gmail.com',  name: 'Crystal Carranza' },
  { id: 'user_3D91DretiumlKKP18ZtvStwnOpv', email: 'belmancindy@gmail.com',            name: 'Cynthia Aguilera' },
  { id: 'user_3D91svWLojbx7IagMA6fEaxcfpk', email: 'herreradaniel23@yahoo.com',        name: 'Daniel Herrera' },
  { id: 'user_3D92uEBDMaklhSGqHVnHsqOSQlk', email: 'danny.padilla0013@gmail.com',     name: 'Daniel Padilla' },
  { id: 'user_3D90p04p02fM1YLtIqWfrRE5ezz', email: 'danielt2115@yahoo.com',            name: 'Daniel Tarango' },
  { id: 'user_3D95a6PA4pbC7nAYEmgrLKCfwNu', email: 'kyosoracerboy@yahoo.com',          name: 'Danny Torres' },
  { id: 'user_3D96A2V1GjBhsW2s0YDpyRfTxNx', email: 'dejoma29@gmail.com',              name: 'Derek Armendariz' },
  { id: 'user_3E5wbgi4mbxEMDlmvDn8qhWDWHQ', email: 'eberalvarez@yahoo.com',           name: 'Eber Alvarez' },
  { id: 'user_3DxmyMaAqGJRhooI68pQIoN5yhd', email: 'e-rodriguez25@hotmail.com',        name: 'Edgar Rodriguez' },
  { id: 'user_3DvEgOxzNjjRqktf3jXiBsDaYXJ', email: 'eduardocruz5@aol.com',            name: 'Eduardo Cruz' },
  { id: 'user_3D968dKNEoy8hOVAissozH9Fq4C', email: 'eddietorres88@gmail.com',          name: 'Eduardo Torres' },
  { id: 'user_3D98gghcfGCnvIwCcxlQH2d9S91', email: 'efigueroa111@gmail.com',           name: 'Eliborio Figueroa' },
  { id: 'user_3D9FnWgmJUTP6SkNf8jgT0YemSv', email: 'erikag118@gmail.com',              name: 'Erika Cano' },
  { id: 'user_3D97DKKScReSB9TtHVQSXYItT4f', email: 'felipeb19@yahoo.com',              name: 'Felipe Bermudez' },
  { id: 'user_3DzaELNhkyncKOv2Y1BzIjKxOZj', email: 'frankmar25@gmail.com',             name: 'Frank Martinez' },
  { id: 'user_3D9A5eghSVz5eBG4m5FzPgXIvDY', email: 'jgtorres247@icloud.com',           name: 'Gabriel Torres' },
  { id: 'user_3DfncI8XGee4aUPcR1yBjBQc6h5', email: 'gerardo.urquiza@gmail.com',        name: 'Gerardo Urquiza' },
  { id: 'user_3D94kVHtyttyxUkSksgXZUIopEj', email: 'gigivfranco@gmail.com',            name: 'Gigi Franco' },
  { id: 'user_3DxoKCswXam2IXR0Coht28TpHre', email: 'invoicemaca@gmail.com',            name: 'Guillermo Martinez' },
  { id: 'user_3D95HbHDWnfGeyqaGN5EJT3OfdC', email: 'tenchita12@hotmail.com',           name: 'Hortencia Lazcano' },
  { id: 'user_3D93PtG5kLzQvdVQfWTfpY9rkww', email: 'shinjibruni@naver.com',            name: 'Hyunjae Kim' },
  { id: 'user_3D94NOymJrLm18BtfiH3VN2c739', email: 'imelda171819@yahoo.com',           name: 'Imelda Ubanda' },
  // Duplicate email — two Supabase rows; both old IDs mapped to same production ID
  { id: 'user_3Dx9D0Qz5ef7FmANY29qF8tkKXh', email: 'inesleonorsanchez80@gmail.com',   name: 'Ines Sanchez' },
  { id: 'user_3DmmiOau2BXUfnyydrKnnGDzdDL', email: 'inesleonorsanchez80@gmail.com',   name: 'Ines Sanchez (duplicate)' },
  { id: 'user_3E3pyIAebgGP3rsnpCMnlAFNHHA', email: 'ibbarajas@yahoo.com',              name: 'Irma Ruiz' },
  { id: 'user_3D93S7yjzHBjrm9s8LEe1rUU4IS', email: 'jmora0037@gmail.com',             name: 'Javier Mora' },
  { id: 'user_3EElVdsitlBLrOQkYbVYJ0lAJKx', email: 'abnforce@yahoo.com',               name: 'Jesus' },
  { id: 'user_3D99QDbUKNsSpkzTRvPjtpn60xt', email: 'jmendo62@gmail.com',               name: 'Jesus Mendoza' },
  { id: 'user_3CMC9dVh6WMgUupZo294EbAN9VE', email: 'coachjesse2426@gmail.com',         name: 'Jesus Muniz' },
  { id: 'user_3D90mSkF5ZdKoQMJayrruhFt3Jp', email: 'jjheredia@yahoo.com',              name: 'JJ Heredia' },
  { id: 'user_3D91IgI7iA3oJvIVZID0Lr5Dq2d', email: 'joearrieta334533@gmail.com',      name: 'Joe Arrieta' },
  { id: 'user_3DxfmuGmO4CqrR3jhbEKEPkTDNG', email: 'kanescrawler@yahoo.com',           name: 'Joe Busbee' },
  { id: 'user_3D91mn0VB2znAzhmdf8sdzMJ2hp', email: 'johnnyperea52@yahoo.com',          name: 'Johnny Perea' },
  { id: 'user_3D950grCF8Vb371mcedWapGrNFR', email: 'escajeda.joe@gmail.com',           name: 'Jose Escajeda' },
  { id: 'user_3D91Y5eEc1i8G7mRsFFW9flkkt1', email: 'josiahmaxwell@gmail.com',          name: 'Josiah Maxwell' },
  { id: 'user_3D93jxYP3PBVLJx1Ry0AVsqwkx8', email: 'pach33ks90@gmail.com',            name: 'Josue Pacheco' },
  { id: 'user_3D96Kru4c2nMjs5ZIlZkoBrIWrN', email: 'klarissamonique07@gmail.com',      name: 'Klarissa Gonzalez' },
  { id: 'user_3DwwNkrLP8ou5XisGe17lEhU92y', email: 'krystalvillegas2@gmail.com',       name: 'Krystal Villegas' },
  { id: 'user_3D93upxnRsX2q7sLb5phr0HAsBv', email: 'lenindgz1307@gmail.com',           name: 'Lenin Dominguez' },
  { id: 'user_3DjwoyViwyBl9QFxQCpmqhzRt5i', email: 'munizliliana51@gmail.com',         name: 'Liliana Muniz' },
  { id: 'user_3D93FrMvS6fZKCPcnUdp37LDIKy', email: 'lilisau@icloud.com',              name: 'Lilly Saucedo' },
  { id: 'user_3Dge4eVy2iin9VOUxGTXmkkqqW4', email: 'lrandreas@gmail.com',              name: 'Lindsey Sims' },
  { id: 'user_3D973kXK2IEiFXtV22T0yU8O7Q8', email: 'larry-1999@hotmail.com',           name: 'Lorenzo Aguilar' },
  { id: 'user_3DvGcUBMeKO8zVMCYNVTKbNr7Z4', email: 'luisadriancadena@yahoo.com',      name: 'Luis Cadena' },
  { id: 'user_3D95qwprDaQtSaFczT5VQDnJi7L', email: 'camrigav@gmail.com',              name: 'Maggie Garcia' },
  { id: 'user_3DugrUNdYhK1iqp9NuPuf4Unt8r', email: 'cameronrilen@aol.com',            name: 'Maggie Garcia (2)' },
  { id: 'user_3D9288sboiL7Q70x0jqwzYCEqyM', email: 'marco597@hotmail.com',             name: 'Marco Terrazas' },
  { id: 'user_3D98Rvl0ES5qsX0DoDS1wMMBT0p', email: 'mnegron52@gmail.com',              name: 'Maria Negron' },
  { id: 'user_3D92WW2GsH1ia9xqU6FFJC0snpU', email: 'matt_fino@yahoo.com',             name: 'Matthew Fino' },
  { id: 'user_3D94OjOZD9JiupCQkb2CVwTAyKX', email: 'mmdemulling@gmail.com',            name: 'McKayla Demulling' },
  { id: 'user_3D90pQCzJEnBuJP4KgAEEsTc28k', email: 'melissals06@yahoo.com',            name: 'Melissa Balandran' },
  { id: 'user_3D94s7zJitAvjZGPllqWKdfugpK', email: 'przmelissa@yahoo.com',             name: 'Melissa Perez' },
  { id: 'user_3D99hsQwpLOdcusfxAT7kgqH0or', email: 'mellanyrodriguez3@gmail.com',      name: 'Mellany Rodriguez' },
  { id: 'user_3D9613ryZTdimz0jMOUG6TBc5T8', email: 'michael_bamba_3@hotmail.com',     name: 'Michael Bamba' },
  { id: 'user_3D90O6GQ5qPmrBhOufFnPvQ4uZf', email: 'navarromimielle@yahoo.com',       name: 'Mimielle Navarro' },
  { id: 'user_3D95fC1OILW724lL9rEb9MGgoRx', email: 'nick-rodriguez@att.net',           name: 'Nicolas Rodriguez' },
  { id: 'user_3Dy1IoAJvqB1kEhVja66nsWIhlQ', email: 'ozziealvarez2003@yahoo.com',       name: 'Ozzie Alvarez' },
  { id: 'user_3D9Ev10FaLqfkL5E0cRbN5E5GjA', email: 'ph284546@gmail.com',              name: 'Pedro Herrera' },
  { id: 'user_3D91WNj9b5Huo7FQxLKILU0ZqnK', email: 'mgomezjr@me.com',                name: 'Porfirio Gomez' },
  { id: 'user_3BUz6g6FlwOZV9uiudddhdV2j5j', email: 'fabianburgos0304@gmail.com',      name: 'Prueba 1 ONNE' },
  { id: 'user_3D91lI5MsZK6Z6iQgKUlPlS2kmo', email: 'rachel.n.anthony@gmail.com',      name: 'Rachel Collins' },
  { id: 'user_3D96cL7UnJakIXEC4X9f6IXFzkj', email: 'rafasegovia@hotmail.com',          name: 'Rafa Segovia' },
  { id: 'user_3D95By0BNRjIiIKYv8GIGoicssI', email: 'rramirezg2@gmail.com',            name: 'Rafael Ramirez Garcia' },
  { id: 'user_3D98Fgff0vjYR0IFhehtA7L232m', email: 'ro.ortegaf80@gmail.com',           name: 'Ricardo Ortega Flores' },
  { id: 'user_3D98frYpwMLdelDztHvFTfK842x', email: 'rcm322@hotmail.com',               name: 'Robert Menchaca' },
  { id: 'user_3D9FeyJV1qJQTwSBHg5FVuzxGw8', email: 'romanestrada0603@gmail.com',      name: 'Roman Estrada' },
  { id: 'user_3D9AOPQezmo9dYsmnwostR7elwQ', email: 'samuel19rosales1@gmail.com',       name: 'Samuel Rosales' },
  { id: 'user_3DxnQjNnCD6BcTi0XUHSpnK6xlN', email: '619luevanos@gmail.com',           name: 'Sergio Luevanos' },
  { id: 'user_3DuhWZdjShavO8tAwuCyF9pWe31', email: 'stephkg915@gmail.com',             name: 'Stephanie Hernandez' },
  { id: 'user_3D92iCPkuGRoHXwuVEKbsUxvBsv', email: 'g_tania15@icloud.com',            name: 'Tania Gonzalez' },
  { id: 'user_3D97ELsaIEJXd5SevzIGtmhsGYT', email: 'tbonds915@icloud.com',            name: 'Tommy Bonds' },
  { id: 'user_3D96K9DwSanarEmUahL4XD1f1uj', email: 'maldo2504@gmail.com',              name: 'Yvette Maldonado' },
];

async function main() {
  const results  = [];
  const skipped  = [];
  const failed   = [];

  // Cache email → production Clerk ID to avoid duplicate API calls
  const emailToNewId = new Map();

  console.error(`Processing ${PROFILES.length} profiles (${new Set(PROFILES.map(p => p.email)).size} unique emails)...\n`);

  for (const { id: oldId, email, name } of PROFILES) {
    try {
      let newId;

      if (emailToNewId.has(email)) {
        newId = emailToNewId.get(email);
        console.error(`  ↳ Reusing cached ${email} → ${newId}  (duplicate row)`);
      } else {
        const existingResult = await clerk.users.getUserList({ emailAddress: [email] });
        const existingUsers  = Array.isArray(existingResult) ? existingResult : (existingResult.data ?? []);

        let clerkUser;
        let action;

        if (existingUsers.length > 0) {
          clerkUser = existingUsers[0];
          action    = 'found';
        } else {
          const nameParts = name.split(' ');
          clerkUser = await clerk.users.createUser({
            emailAddress: [email],
            firstName:    nameParts[0],
            lastName:     nameParts.slice(1).join(' ') || undefined,
            username:     email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Date.now().toString().slice(-4),
            password:     'Torque2026!',
          });
          action = 'created';
        }

        newId = clerkUser.id;
        emailToNewId.set(email, newId);
        console.error(`  ✓ ${action.padEnd(7)} ${name.padEnd(26)} ${email} → ${newId}`);
      }

      if (oldId === newId) {
        console.error(`    (IDs match — skipping)`);
        skipped.push({ name, email });
        continue;
      }

      results.push({ oldId, newId, name, email });

    } catch (err) {
      console.error(`  ✗ FAILED  ${name} (${email}): ${err.message}`);
      failed.push({ name, email, error: err.message });
    }
  }

  // ── Generate SQL ──────────────────────────────────────────
  console.log('-- ============================================================');
  console.log('-- Torque Performance — Clerk Production Sync SQL');
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log(`-- ${results.length} rows to update, ${skipped.length} already matched, ${failed.length} failed`);
  console.log('-- Run in Supabase Dashboard → SQL Editor');
  console.log('-- ============================================================\n');

  for (const { oldId, newId, name, email } of results) {
    console.log(`-- ${name} (${email})`);
    console.log(`-- old: ${oldId}`);
    console.log(`-- new: ${newId}`);
    console.log(`BEGIN;`);
    console.log(`  UPDATE players            SET parent_id = '${newId}' WHERE parent_id = '${oldId}';`);
    console.log(`  UPDATE player_memberships SET parent_id = '${newId}' WHERE parent_id = '${oldId}';`);
    console.log(`  UPDATE profiles           SET id        = '${newId}' WHERE id        = '${oldId}';`);
    console.log(`COMMIT;\n`);
  }

  // Flag the duplicate profile that will need cleanup
  const dupEmail = 'inesleonorsanchez80@gmail.com';
  const dupEntries = results.filter(r => r.email === dupEmail);
  if (dupEntries.length === 2) {
    const [keep, remove] = dupEntries;
    console.log(`-- ⚠️  DUPLICATE PROFILE CLEANUP for ${dupEmail}`);
    console.log(`-- After the UPDATEs above, two profiles rows share id='${keep.newId}'.`);
    console.log(`-- Delete the second (older) one:`);
    console.log(`-- DELETE FROM profiles WHERE id = '${remove.newId}' AND email = '${dupEmail}';`);
    console.log(`-- (Verify first: SELECT * FROM profiles WHERE email = '${dupEmail}';)\n`);
  }

  // ── Summary ───────────────────────────────────────────────
  console.error('\n════════════════════════════════════════');
  console.error(`✅ SQL generated: ${results.length} updates`);
  const created = [...emailToNewId].filter((_, i) => {
    // approximate — we logged action but didn't store it in map
    return true;
  });
  console.error(`⏭  Skipped:      ${skipped.length} (IDs already match)`);
  console.error(`❌ Failed:        ${failed.length}`);
  if (failed.length > 0) {
    console.error('\nFailed:');
    failed.forEach(f => console.error(`  - ${f.name} (${f.email}): ${f.error}`));
  }
  console.error('════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
