// ============================================================
// TORQUE PERFORMANCE — Delete truly-empty player rows from the owner's list
// READ-THEN-CONFIRM (dry-run by default; --apply writes).
//
// For the sheet rows that matched NO membership (players who registered but never
// bought a plan), this removes their `players` row — but ONLY when the row is
// truly empty. Never touches profiles or Clerk accounts.
//
// INPUT: same CSV (header with parent_name, parent_email, kid_name, package_name).
//   Pass the path as an argument (default ./delete-list.csv).
//
// MATCHING (against the players table):
//   key = normalized(parent_email via profiles) + '::' + normalized(kid_name)
//   normalize = lowercase, trim, NBSP/narrow-NBSP/figure-space/zero-width/BOM → space,
//   collapse whitespace. 0 or >1 matching players rows → NOT guessed; written to
//   players-ambiguous.csv.
//
// EMPTINESS: a matched players row is deleted ONLY if that parent+kid has NO rows in
//   player_memberships (any status), bookings, checkins, or promo_registrations
//   (promo uses player_name). Any hit → skipped, reason(s) listed in
//   players-skip-nonempty.csv.
//
// OUTPUTS (always): players-backup.csv (FULL contents of every row that would be
//   deleted — this is the rollback: re-insert to restore), delete-players-plan.csv,
//   players-ambiguous.csv, players-skip-nonempty.csv.
//
// Run (bash):
//   VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node delete-empty-players.mjs delete-list.csv
//   ...add --apply to delete.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
import { readFileSync, writeFileSync } from 'fs';

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) { console.error('Missing env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const APPLY = process.argv.includes('--apply');
const CSV_PATH = process.argv.slice(2).find(a => a.toLowerCase().endsWith('.csv')) || 'delete-list.csv';

const supabase = createClient(SB_URL, SB_KEY);

const norm = (s) => (s == null ? '' : String(s))
  .replace(/[   ​﻿]/g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function parseCSV(text) {
  const rows = []; let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function confirm(q) {
  return new Promise(res => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res(a.trim().toLowerCase()); }); });
}
// Set of `${parent_id}::${normKid}` for every row in a related table (paginated).
async function loadRelateSet(table, kidCol) {
  const set = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(`parent_id, ${kidCol}`).range(from, from + 999);
    if (error) { console.error(`Could not read ${table}: ${error.message}`); process.exit(1); }
    for (const r of (data || [])) set.add(`${r.parent_id}::${norm(r[kidCol])}`);
    if (!data || data.length < 1000) break;
  }
  return set;
}

async function main() {
  // ── Load + parse the sheet ──
  let raw;
  try { raw = readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, ''); }
  catch (e) { console.error(`Could not read CSV "${CSV_PATH}": ${e.message}`); process.exit(1); }
  const table = parseCSV(raw).filter(r => r.some(c => (c || '').trim() !== ''));
  if (table.length < 2) { console.error('CSV has no data rows.'); process.exit(1); }
  const header = table[0].map(h => norm(h));
  const col = (n) => header.indexOf(n);
  const iEmail = col('parent_email'), iKid = col('kid_name'), iParent = col('parent_name');
  if (iEmail < 0 || iKid < 0) { console.error(`CSV must have parent_email and kid_name. Found: ${header.join(', ')}`); process.exit(1); }
  const sheet = table.slice(1).map(r => ({ parent_name: iParent >= 0 ? r[iParent] : '', parent_email: r[iEmail], kid_name: r[iKid] }));

  // ── Load players (full rows) + parent emails ──
  const players = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('players').select('*').range(from, from + 999);
    if (error) { console.error('players read error:', error.message); process.exit(1); }
    players.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const pids = [...new Set(players.map(p => p.parent_id).filter(Boolean))];
  const emailByParent = new Map();
  for (let i = 0; i < pids.length; i += 200) {
    const { data: profs } = await supabase.from('profiles').select('id, email').in('id', pids.slice(i, i + 200));
    for (const p of (profs || [])) emailByParent.set(p.id, p.email);
  }

  // Index players by normalized email::kid.
  const byKey = new Map();
  for (const p of players) {
    const email = emailByParent.get(p.parent_id);
    if (!email) continue;
    const key = `${norm(email)}::${norm(p.kid_name)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(p);
  }

  // ── Load relation sets for the emptiness check ──
  console.error('\nLoading relation tables (memberships, bookings, checkins, promo_registrations)...');
  const memSet   = await loadRelateSet('player_memberships', 'kid_name');   // ANY status
  const bookSet  = await loadRelateSet('bookings', 'kid_name');
  const checkSet = await loadRelateSet('checkins', 'kid_name');
  const promoSet = await loadRelateSet('promo_registrations', 'player_name');

  // ── Match + emptiness ──
  const toDelete = [], ambiguous = [], nonEmpty = [];
  for (const row of sheet) {
    const key = `${norm(row.parent_email)}::${norm(row.kid_name)}`;
    const matches = byKey.get(key) || [];
    if (matches.length !== 1) { ambiguous.push({ row, count: matches.length, ids: matches.map(m => m.id).join(' | ') }); continue; }
    const p = matches[0];
    const relKey = `${p.parent_id}::${norm(p.kid_name)}`;
    const reasons = [];
    if (memSet.has(relKey))   reasons.push('has membership');
    if (bookSet.has(relKey))  reasons.push('has booking');
    if (checkSet.has(relKey)) reasons.push('has check-in');
    if (promoSet.has(relKey)) reasons.push('has promo registration');
    if (reasons.length) { nonEmpty.push({ row, p, reasons }); continue; }
    toDelete.push({ row, p });
  }

  // ── CSVs (always) ──
  // Backup = full contents of the rows to delete (dynamic columns → re-insertable).
  const allCols = [...new Set(toDelete.flatMap(({ p }) => Object.keys(p)))];
  const backup = [allCols, ...toDelete.map(({ p }) => allCols.map(c => p[c]))];
  writeFileSync('players-backup.csv', '﻿' + backup.map(r => r.map(csvCell).join(',')).join('\n') + '\n');
  writeFileSync('delete-players-plan.csv', '﻿' + [['player_id', 'kid_name', 'parent_name', 'parent_email'],
    ...toDelete.map(({ row, p }) => [p.id, p.kid_name, row.parent_name, row.parent_email])].map(r => r.map(csvCell).join(',')).join('\n') + '\n');
  writeFileSync('players-ambiguous.csv', '﻿' + [['parent_name', 'parent_email', 'kid_name', 'match_count', 'player_ids'],
    ...ambiguous.map(a => [a.row.parent_name, a.row.parent_email, a.row.kid_name, a.count, a.ids])].map(r => r.map(csvCell).join(',')).join('\n') + '\n');
  writeFileSync('players-skip-nonempty.csv', '﻿' + [['player_id', 'kid_name', 'parent_email', 'reasons'],
    ...nonEmpty.map(n => [n.p.id, n.p.kid_name, n.row.parent_email, n.reasons.join('; ')])].map(r => r.map(csvCell).join(',')).join('\n') + '\n');

  // ── Report ──
  console.log('\n' + '='.repeat(100));
  console.log(`DELETE-EMPTY-PLAYERS PLAN${APPLY ? '' : '   [DRY RUN — no writes]'}`);
  console.log('='.repeat(100));
  for (const { row, p } of toDelete) console.log(`• DELETE players ${p.id}  |  ${p.kid_name}  |  ${row.parent_name || '—'}  |  ${row.parent_email}`);
  console.log('='.repeat(100));
  console.log(`Sheet rows:                        ${sheet.length}`);
  console.log(`To delete (truly empty):           ${toDelete.length}   → players-backup.csv + delete-players-plan.csv`);
  console.log(`Skipped — has related data:        ${nonEmpty.length}   → players-skip-nonempty.csv`);
  console.log(`Ambiguous (0 or >1 players match): ${ambiguous.length}   → players-ambiguous.csv`);
  if (nonEmpty.length) {
    console.log(`\nSkipped (NOT empty — left intact):`);
    for (const n of nonEmpty) console.log(`  · ${n.p.kid_name} (${n.row.parent_email}) — ${n.reasons.join('; ')}`);
  }
  console.log(`\nCSVs written: players-backup.csv, delete-players-plan.csv, players-ambiguous.csv, players-skip-nonempty.csv`);

  if (toDelete.length === 0) { console.log('\nNothing to delete. ✅'); process.exit(0); }
  if (!APPLY) { console.log('\nDRY RUN — no changes written. Review the CSVs (esp. players-skip-nonempty), then re-run with --apply.'); process.exit(0); }

  const ans = await confirm(`\nDELETE ${toDelete.length} empty players row(s)? This removes them from the Families tab. Type 'yes': `);
  if (ans !== 'yes') { console.log('Aborted — no changes written.'); process.exit(0); }

  console.log('\nDeleting...');
  let ok = 0; const fails = [];
  for (const { p } of toDelete) {
    const { error } = await supabase.from('players').delete().eq('id', p.id);
    if (error) { fails.push(`${p.kid_name}: ${error.message}`); console.error(`  ✗ ${p.kid_name}: ${error.message}`); }
    else { ok++; console.log(`  ✓ deleted ${p.kid_name} (${p.id})`); }
  }
  console.log(`\nDone. ${ok}/${toDelete.length} deleted.${fails.length ? ` ${fails.length} failed.` : ''}`);
  console.log(`Rollback: re-insert rows from players-backup.csv (full contents preserved).`);
}

main().catch(e => { console.error(e); process.exit(1); });
