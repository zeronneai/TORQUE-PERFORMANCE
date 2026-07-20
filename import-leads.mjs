// ============================================================
// TORQUE PERFORMANCE — one-time backfill of Google Sheet leads → Supabase `leads`
// READ CSV, insert each row. Idempotent: skips a row if a lead with the same
// email (or phone) + created_at already exists, so re-running never duplicates.
// Preserves the original created_at from the Timestamp column.
//
// Expected CSV headers (case-insensitive, from the Sheet export):
//   Timestamp, Parent Name, Phone, Email, Player Name, Player Age,
//   Preferred Day, Source, Status
//
// Run (PowerShell):
//   $env:VITE_SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   node import-leads.mjs leads-export.csv
//
// Run (bash):
//   VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node import-leads.mjs leads-export.csv
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_PATH = process.argv[2] || 'leads-export.csv';

if (!URL || !KEY) { console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(URL, KEY);
const VALID_STATUS = new Set(['new', 'contacted', 'converted', 'lost']);

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines, "").
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const norm = (s) => (s || '').trim().toLowerCase();

async function main() {
  const raw = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(raw).filter(r => r.some(c => (c || '').trim() !== ''));
  if (rows.length < 2) { console.error('CSV has no data rows.'); process.exit(1); }

  const headers = rows[0].map(norm);
  const col = (name) => headers.indexOf(name);
  const idx = {
    ts: col('timestamp'), parent: col('parent name'), phone: col('phone'), email: col('email'),
    player: col('player name'), age: col('player age'), day: col('preferred day'),
    source: col('source'), status: col('status'),
  };

  let inserted = 0, skipped = 0, failed = 0;
  const errors = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (i) => (i >= 0 && cells[i] != null ? String(cells[i]).trim() : '');

    const email = get(idx.email);
    const phone = get(idx.phone);
    const parent_name = get(idx.parent);

    // created_at from Timestamp; if unparseable, omit (DB default now() applies).
    const tsRaw = get(idx.ts);
    let createdISO;
    if (tsRaw) { const d = new Date(tsRaw); if (!isNaN(d.getTime())) createdISO = d.toISOString(); }

    let status = norm(get(idx.status));
    if (!VALID_STATUS.has(status)) status = 'new';

    // Idempotency: skip if same email (or phone/name) + created_at already present.
    let q = supabase.from('leads').select('id').limit(1);
    if (email) q = q.eq('email', email);
    else if (phone) q = q.eq('phone', phone);
    else if (parent_name) q = q.eq('parent_name', parent_name);
    else { skipped++; continue; } // nothing to identify the row
    if (createdISO) q = q.eq('created_at', createdISO);
    const { data: existing, error: selErr } = await q;
    if (selErr) { failed++; errors.push(`row ${r}: check failed — ${selErr.message}`); continue; }
    if (existing && existing.length) { skipped++; continue; }

    const row = {
      parent_name, phone, email,
      player_name: get(idx.player),
      player_age: get(idx.age),
      preferred_day: get(idx.day),
      source: get(idx.source) || 'unknown',
      status,
    };
    if (createdISO) row.created_at = createdISO;

    const { error: insErr } = await supabase.from('leads').insert(row);
    if (insErr) { failed++; errors.push(`row ${r} (${email || phone || parent_name}): ${insErr.message}`); }
    else inserted++;
    process.stderr.write(`\r  processed ${r}/${rows.length - 1}  (inserted ${inserted}, skipped ${skipped}, failed ${failed})`);
  }

  console.log(`\n\nDone. Inserted ${inserted}, skipped ${skipped} (already present), failed ${failed}.`);
  if (errors.length) { console.log('\nErrors:'); errors.slice(0, 20).forEach(e => console.log('  ' + e)); }
}

main().catch(err => { console.error(err); process.exit(1); });
