// Torque Team ($250/month). Teams by age: 9U to 13U. Mirrors api/_team.js.
export const TEAM_PRICE = 250
export const TEAM_AGES = [9, 10, 11, 12, 13]
export const teamLabel = (age) => `${age}U`

// Current age from birthdate when we have it, otherwise the age typed at sign-up.
export function playerAge(p) {
  if (p?.birthdate) {
    const b = new Date(p.birthdate + 'T12:00:00')
    if (!isNaN(b)) {
      const t = new Date()
      let a = t.getFullYear() - b.getFullYear()
      if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--
      return a
    }
  }
  const n = parseInt(p?.age, 10)
  return Number.isNaN(n) ? null : n
}

// Suggested team for a player (null when the age is unknown or outside 9..13).
export function suggestedTeam(p) {
  const a = playerAge(p)
  return a != null && TEAM_AGES.includes(a) ? a : null
}

// Same rule the server applies: an active package that is not past its paid-through date.
export function packageIsActive(m) {
  if (!m) return false
  if ((m.status || '').toLowerCase() !== 'active') return false
  return !m.expires_at || new Date(m.expires_at) > new Date()
}

// Sign-ups open Thursday Nov 5, 2026 (El Paso time). Mirror of api/_team.js.
export const TEAM_OPENS_AT = '2026-11-05T00:00:00-07:00'
export const teamIsOpen = () => Date.now() >= Date.parse(TEAM_OPENS_AT)

// Status the app shows. Besides what Stripe tells us via webhook, a row whose paid
// month ended more than 2 days ago without a renewal is treated as unpaid, so a
// declined card is caught even if a webhook never arrives.
const GRACE_MS = 2 * 86400000
export function teamStatus(row) {
  if (!row) return null
  if (row.status === 'canceled') return 'canceled'
  const end = row.current_period_end ? Date.parse(row.current_period_end) : null
  if (row.cancel_at_period_end && end && Date.now() > end) return 'canceled'
  if (row.status === 'past_due') return 'unpaid'
  if (end && !row.cancel_at_period_end && Date.now() > end + GRACE_MS) return 'unpaid'
  return row.cancel_at_period_end ? 'ending' : 'active'
}
