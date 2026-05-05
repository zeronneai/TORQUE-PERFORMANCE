// Supabase Edge Function — monthly-session-reset
// Schedule: cron "5 0 * * *" (00:05 AM every day)
// Resets sessions for annual-plan members whose purchased_at day-of-month matches today.
// Example: purchased_at = 2026-03-15 → sessions reset every month on the 15th.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SESSIONS_BY_PACKAGE: Record<string, number> = {
  'A': 4,    'Paquete A': 4,
  'AA': 8,   'Paquete AA': 8,
  'AAA': 12, 'Paquete AAA': 12,
  'MLB': 20, 'Paquete MLB': 20,
}

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  const todayDay = now.getDate()         // day of month: 1–31
  const nowISO   = now.toISOString()

  // Fetch all active annual memberships that have not yet expired
  const { data: memberships, error } = await supabase
    .from('player_memberships')
    .select('id, package_name, purchased_at, expires_at')
    .eq('status', 'active')
    .gt('expires_at', nowISO)

  if (error) {
    console.error('[monthly-reset] Fetch error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // Keep only annual plans (expires_at - purchased_at > 300 days)
  // then filter to those whose purchase day-of-month matches today
  const toReset = (memberships ?? []).filter(m => {
    if (!m.purchased_at || !m.expires_at) return false

    const diffDays = (new Date(m.expires_at).getTime() - new Date(m.purchased_at).getTime()) / 86_400_000
    if (diffDays <= 300) return false  // not an annual plan

    const purchaseDay = new Date(m.purchased_at).getDate()
    return purchaseDay === todayDay
  })

  let updated = 0
  const errors: string[] = []

  for (const m of toReset) {
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
      console.log(`[monthly-reset] Reset ${sessions} sessions → id ${m.id} (${m.package_name}, purchase day ${todayDay})`)
    }
  }

  console.log(`[monthly-reset] Day ${todayDay} — checked ${memberships?.length ?? 0} active annual members, reset ${updated}`)
  return new Response(
    JSON.stringify({ ok: true, today_day: todayDay, candidates: toReset.length, updated, errors }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
