// Supabase Edge Function — monthly-session-reset
// Schedule: cron "1 0 1 * *" (00:01 AM on the 1st of every month)
// Resets sessions_total and sessions_used for all annual-plan members still within their period.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SESSIONS_BY_PACKAGE: Record<string, number> = {
  'A': 4,         'Paquete A': 4,
  'AA': 8,        'Paquete AA': 8,
  'AAA': 12,      'Paquete AAA': 12,
  'MLB': 20,      'Paquete MLB': 20,
}

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date().toISOString()

  // Fetch all active memberships that have not yet expired
  const { data: memberships, error } = await supabase
    .from('player_memberships')
    .select('id, package_name, purchased_at, expires_at')
    .eq('status', 'active')
    .gt('expires_at', now)

  if (error) {
    console.error('[monthly-reset] Fetch error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // Annual plans: expires_at - purchased_at > 300 days
  const annualMembers = (memberships ?? []).filter(m => {
    if (!m.purchased_at || !m.expires_at) return false
    const diffDays = (new Date(m.expires_at).getTime() - new Date(m.purchased_at).getTime()) / 86_400_000
    return diffDays > 300
  })

  let updated = 0
  const errors: string[] = []

  for (const m of annualMembers) {
    const sessions = SESSIONS_BY_PACKAGE[m.package_name]
    if (!sessions) {
      errors.push(`Unknown package: ${m.package_name} (id ${m.id})`)
      continue
    }

    const { error: upErr } = await supabase
      .from('player_memberships')
      .update({ sessions_total: sessions, sessions_used: 0 })
      .eq('id', m.id)

    if (upErr) {
      errors.push(`Update failed for id ${m.id}: ${upErr.message}`)
    } else {
      updated++
    }
  }

  console.log(`[monthly-reset] Done — ${updated}/${annualMembers.length} annual members reset`)
  return new Response(
    JSON.stringify({ ok: true, total_annual: annualMembers.length, updated, errors }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
