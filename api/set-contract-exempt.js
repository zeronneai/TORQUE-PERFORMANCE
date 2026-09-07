import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Admin-only toggle of profiles.contract_exempt (service-role write, so profiles
// stays closed to anon UPDATE). Called from the admin Contracts page.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = req.body || {};
    const parentId = (b.parentId || '').trim();
    const exempt = b.exempt === true;
    if (!parentId) return res.status(400).json({ error: 'Missing parentId' });

    const { error } = await supabase.from('profiles')
      .update({ contract_exempt: exempt })
      .eq('id', parentId);
    if (error) { console.error('[set-contract-exempt] update failed:', error.message); return res.status(500).json({ error: 'Could not update.' }); }

    return res.status(200).json({ ok: true, parentId, exempt });
  } catch (err) {
    console.error('[set-contract-exempt] error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
}
