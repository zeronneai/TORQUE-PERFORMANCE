// Academy-closed days. Source of truth = Supabase table `closed_dates`
// (managed from Admin → Schedule). FALLBACK_CLOSED keeps the app correct
// even before the table exists or if the read fails.
import { supabase } from '../supabaseClient'

const FALLBACK_CLOSED = {
  '2026-07-24': 'Closed',
  '2026-07-25': 'Closed',
  '2026-09-07': 'Labor Day',
  '2026-10-10': 'Tryouts',
  '2026-10-23': 'Closed', '2026-10-24': 'Closed', '2026-10-25': 'Closed',
  '2026-10-26': 'Closed', '2026-10-27': 'Closed', '2026-10-28': 'Closed',
  '2026-10-29': 'Closed', '2026-10-30': 'Closed', '2026-10-31': 'Closed',
}

let closed = { ...FALLBACK_CLOSED }

export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// July 4th every year + any closed day.
export const isClosedDay = (d) => (d.getMonth() === 6 && d.getDate() === 4) || ymd(d) in closed
export const closedReason = (d) =>
  (d.getMonth() === 6 && d.getDate() === 4) ? 'Independence Day' : (closed[ymd(d)] || null)

// Loads the DB list and merges it over the fallback. Returns the merged map.
// DB removals win for dates that exist in the table era; fallback only fills gaps
// when the table read fails.
export async function loadClosedDates() {
  try {
    const { data, error } = await supabase.from('closed_dates').select('day, reason')
    if (error) throw error
    const fromDb = {}
    ;(data || []).forEach(r => { fromDb[String(r.day).slice(0, 10)] = r.reason || 'Closed' })
    closed = data && data.length ? fromDb : { ...FALLBACK_CLOSED }
  } catch (e) {
    console.warn('[closed-dates] using fallback list:', e.message || e)
    closed = { ...FALLBACK_CLOSED }
  }
  return { ...closed }
}

export const getClosedMap = () => ({ ...closed })
