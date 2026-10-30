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
