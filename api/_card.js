// Player card + entrance scanner logic (NOT an endpoint: `_` prefix).
// Pure helpers are exported separately so they can be tested without a database.
import crypto from 'crypto';

export const PHOTO_BUCKET = 'player-photos';
const TZ = 'America/Denver';                      // El Paso
const WEEKDAY_SLOTS = [16, 17, 18];               // 4, 5, 6 PM (same as booking)
const SATURDAY_SLOTS = [12, 13, 14];              // 12, 1, 2 PM

export const newToken = () => 'TQ' + crypto.randomBytes(16).toString('hex').toUpperCase();

// Accepts the raw text a camera or a USB/Bluetooth scanner reads and returns the token.
export function parseCode(raw) {
  const m = /TQ[0-9A-F]{32}/i.exec(String(raw || '').replace(/\s+/g, ''));
  return m ? m[0].toUpperCase() : null;
}

export function epParts(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: +p.hour % 24, minute: +p.minute, weekday: p.weekday };
}
export const epYmd = (d) => epParts(d instanceof Date ? d : new Date(d)).ymd;

const fmtHour = (h) => `${((h + 11) % 12) + 1}:00 ${h >= 12 ? 'PM' : 'AM'}`;

// Booking slot to use for a walk-in: the class that is on now (or about to start).
export function walkInSlot(now = new Date()) {
  const { hour, minute, weekday } = epParts(now);
  const slots = weekday === 'Sat' ? SATURDAY_SLOTS : weekday === 'Sun' ? null : WEEKDAY_SLOTS;
  if (!slots) return fmtHour(hour);
  const mins = hour * 60 + minute + 30;
  const started = slots.filter(h => h * 60 <= mins);
  return fmtHour(started.length ? started[started.length - 1] : slots[0]);
}

// Torque Team status (mirror of src/lib/team.js teamStatus).
export function teamState(row, now = Date.now()) {
  if (!row) return null;
  if (row.status === 'canceled') return 'canceled';
  const end = row.current_period_end ? Date.parse(row.current_period_end) : null;
  if (row.cancel_at_period_end && end && now > end) return 'canceled';
  if (row.status === 'past_due') return 'unpaid';
  if (end && !row.cancel_at_period_end && now > end + 2 * 86400000) return 'unpaid';
  return 'active';
}

export function ageOf(player, now = new Date()) {
  if (player?.birthdate) {
    const b = new Date(player.birthdate + 'T12:00:00Z');
    if (!isNaN(b)) {
      let a = now.getUTCFullYear() - b.getUTCFullYear();
      if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) a--;
      return a;
    }
  }
  const n = parseInt(player?.age, 10);
  return Number.isNaN(n) ? null : n;
}

// The verdict a scan shows. Order matters: payment problems first, then today.
//   ok      → green, auto-confirmed (booking today, or walk-in that uses a session)
//   warn    → yellow, already checked in today (nothing happens)
//   blocked → red, coach can "Let in anyway"
export function verdict({ membership, team, bookingToday, checkinToday, now = Date.now() }) {
  const remaining = membership ? (membership.sessions_total || 0) - (membership.sessions_used || 0) : 0;
  if (!membership) return { verdict: 'blocked', reason: 'No active package', remaining };
  if (membership.expires_at && Date.parse(membership.expires_at) < now)
    return { verdict: 'blocked', reason: 'Package expired', remaining };
  if (teamState(team, now) === 'unpaid')
    return { verdict: 'blocked', reason: 'Torque Team payment not processed', remaining };
  if (checkinToday) return { verdict: 'warn', reason: 'Already checked in today', remaining, plan: 'none' };
  if (bookingToday) return { verdict: 'ok', reason: `Booked for ${bookingToday.session_time}`, remaining, plan: 'confirm' };
  if (remaining > 0) return { verdict: 'ok', reason: 'Walk-in: 1 session used', remaining: remaining - 1, plan: 'walk_in' };
  return { verdict: 'blocked', reason: 'No sessions left', remaining };
}
