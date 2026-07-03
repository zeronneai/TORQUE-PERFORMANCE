// Supabase Edge Function — monthly-session-reset
// Schedule: cron "5 0 * * *" (00:05 AM every day)
//
// Task A — Monthly reset: resets sessions for annual-plan members whose
//           purchased_at day-of-month matches today.
//           Example: purchased_at = 2026-03-15 → sessions reset every month on the 15th.
//
// Task B — Expiry zeroing: sets sessions_total = 0 / sessions_used = 0 for any
//           active membership whose expires_at is already in the past.
//
// Task C — Expiry email alerts: emails the parent when an active membership is
//           exactly 30, 14 or 7 days from expiring. Matching EXACT day counts
//           means each milestone fires once (no dedup table needed). Requires
//           RESEND_API_KEY; skips silently if unset (so it's inert until
//           configured). If the cron misses a day, that day's cohort is skipped.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SESSIONS_BY_PACKAGE: Record<string, number> = {
  'A': 4,    'Package A': 4,
  'AA': 8,   'Package AA': 8,
  'AAA': 12, 'Package AAA': 12,
  'MLB': 20, 'Package MLB': 20,
}

// Milestones (in days before expiry) that trigger a reminder email.
const ALERT_DAYS = new Set([30, 14, 7])
const APP_URL = Deno.env.get('APP_URL') || 'https://app.torquebaseball.us'

// Whole days from today (UTC midnight) until a timestamp — date-only, so the
// time component of expires_at doesn't cause off-by-one matches.
function daysUntilUTC(dateStr: string, todayUTC: number): number {
  const d = new Date(dateStr)
  const dUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((dUTC - todayUTC) / 86_400_000)
}

async function sendExpiryEmail(opts: {
  to: string; parentName: string; kidName: string; packageName: string;
  days: number; expiresAt: string;
}): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return false
  const from = Deno.env.get('RESEND_FROM_EMAIL') || 'Torque Performance <alerts@torqueperformance.app>'

  const expDate = new Date(opts.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
  const whenText = opts.days === 7 ? 'in 1 week'
    : opts.days === 14 ? 'in 2 weeks'
    : `in ${opts.days} days`
  const hello = opts.parentName ? `Hi ${opts.parentName},` : 'Hi,'

  const text = [
    hello,
    '',
    `This is a friendly reminder that ${opts.kidName}'s ${opts.packageName} membership at Torque Performance expires ${whenText} — on ${expDate}.`,
    '',
    'Renew now to keep training sessions active and avoid any interruption:',
    APP_URL,
    '',
    'Questions? Just reply to this email or reach us on WhatsApp.',
    '',
    '— Torque Performance',
  ].join('\n')

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: `${opts.kidName}'s membership expires ${whenText} — renew to keep training`,
        text,
      }),
    })
    if (!r.ok) {
      console.error('[monthly-reset] Task C — Resend HTTP error:', r.status, await r.text())
      return false
    }
    return true
  } catch (e) {
    console.error('[monthly-reset] Task C — send failed:', (e as Error).message)
    return false
  }
}

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  const todayDay = now.getDate()         // day of month: 1–31
  const nowISO   = now.toISOString()
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  // ── TASK A: Monthly session reset for annual plans ──────────────────────────

  // Fetch all active memberships that have not yet expired.
  // Reused by Task A (annual reset) and Task C (expiry email alerts).
  const { data: memberships, error } = await supabase
    .from('player_memberships')
    .select('id, parent_id, kid_name, package_name, purchased_at, expires_at')
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

  console.log(`[monthly-reset] Task A — Day ${todayDay}: checked ${memberships?.length ?? 0} active annual members, reset ${updated}`)

  // ── TASK B: Zero out sessions for expired memberships ───────────────────────

  const { data: expired, error: expFetchErr } = await supabase
    .from('player_memberships')
    .select('id')
    .eq('status', 'active')
    .lt('expires_at', nowISO)
    .gt('sessions_total', 0)

  let zeroed = 0
  const expireErrors: string[] = []

  if (expFetchErr) {
    expireErrors.push(`Fetch expired error: ${expFetchErr.message}`)
  } else if (expired && expired.length > 0) {
    const ids = expired.map(m => m.id)
    const { error: zeroErr } = await supabase
      .from('player_memberships')
      .update({ sessions_total: 0, sessions_used: 0 })
      .in('id', ids)

    if (zeroErr) {
      expireErrors.push(`Zero update error: ${zeroErr.message}`)
    } else {
      zeroed = ids.length
      console.log(`[monthly-reset] Task B — Zeroed sessions for ${zeroed} expired memberships`)
    }
  }

  console.log(`[monthly-reset] Task B — Found ${expired?.length ?? 0} expired-with-sessions, zeroed ${zeroed}`)

  // ── TASK C: Expiry reminder emails at 30 / 14 / 7 days ──────────────────────

  const resendConfigured = !!Deno.env.get('RESEND_API_KEY')
  let emailsSent = 0
  const emailErrors: string[] = []

  // Active + not-expired memberships (reuse Task A's fetch) whose expiry hits a milestone.
  const dueForAlert = (memberships ?? [])
    .map(m => ({ ...m, _days: m.expires_at ? daysUntilUTC(m.expires_at, todayUTC) : null }))
    .filter(m => m._days != null && ALERT_DAYS.has(m._days))

  if (!resendConfigured) {
    console.warn('[monthly-reset] Task C — RESEND_API_KEY not set; skipping emails')
  } else if (dueForAlert.length > 0) {
    // Look up parent emails/names in one query
    const parentIds = [...new Set(dueForAlert.map(m => m.parent_id).filter(Boolean))]
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', parentIds)
    const profById = new Map((profs ?? []).map(p => [p.id, p]))

    for (const m of dueForAlert) {
      const prof = profById.get(m.parent_id)
      if (!prof?.email) {
        emailErrors.push(`No email for parent ${m.parent_id} (kid ${m.kid_name})`)
        continue
      }
      const ok = await sendExpiryEmail({
        to:          prof.email,
        parentName:  prof.full_name || '',
        kidName:     m.kid_name || 'your player',
        packageName: m.package_name || 'membership',
        days:        m._days as number,
        expiresAt:   m.expires_at,
      })
      if (ok) {
        emailsSent++
        console.log(`[monthly-reset] Task C — sent ${m._days}-day alert → ${prof.email} (${m.kid_name})`)
      } else {
        emailErrors.push(`Send failed for ${prof.email} (kid ${m.kid_name})`)
      }
    }
  }

  console.log(`[monthly-reset] Task C — ${dueForAlert.length} due, ${emailsSent} sent`)

  return new Response(
    JSON.stringify({
      ok: true,
      taskA: { today_day: todayDay, candidates: toReset.length, updated, errors },
      taskB: { expired_found: expired?.length ?? 0, zeroed, errors: expireErrors },
      taskC: { resend_configured: resendConfigured, due: dueForAlert.length, sent: emailsSent, errors: emailErrors },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
