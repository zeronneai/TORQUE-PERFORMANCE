import React, { useState, useEffect, useMemo } from 'react'
import { useSession } from '@clerk/clerk-react'
import { Trash2 } from 'lucide-react'
import { Modal } from '../../components/UI'
import { API_BASE } from '../../lib/apiBase'
import { normDate } from '../../hooks/useAdminData'
import { isClosedDay, closedReason, loadClosedDates } from '../../lib/closedDates'
import { CANCEL_REASONS } from '../../lib/cancelReasons'

// Admin "Manage player" modal: adjust the membership (sessions, package, renewal date,
// status), book sessions on the family's behalf, and cancel upcoming bookings.
// All writes go through api/admin.js (admin role verified server-side).

const PACKAGES = [
  { name: 'Package A',   sessions: 4 },
  { name: 'Package AA',  sessions: 8 },
  { name: 'Package AAA', sessions: 12 },
  { name: 'Package MLB', sessions: 20 },
]
const WEEKDAY_TIMES  = ['4:00 PM', '5:00 PM', '6:00 PM']
const SATURDAY_TIMES = ['12:00 PM', '1:00 PM', '2:00 PM']

const SEL = { width:'100%', margin:0, background:'var(--navy3)', color:'var(--text)', border:'1px solid var(--border2)', borderRadius:8, padding:'9px 11px', fontSize:13, boxSizing:'border-box' }
const LBL = { fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }
const SECTION = { padding:'16px 0', borderTop:'1px solid var(--border)' }
const H = { fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:14, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text)', marginBottom:10 }
const PRIMARY = { padding:'9px 18px', background:'var(--blue, #3b82f6)', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }
const STEP = { width:34, height:34, borderRadius:8, border:'1px solid var(--border2)', background:'var(--navy3)', color:'var(--text)', fontSize:18, fontWeight:700, cursor:'pointer' }

export default function ManagePlayer({ player, membership, bookings = [], onClose, onChanged }) {
  const { session } = useSession()
  const open = !!player
  const m = membership

  // Membership form
  const [pkg, setPkg] = useState('')
  const [total, setTotal] = useState(0)
  const [used, setUsed] = useState(0)
  const [renews, setRenews] = useState('')
  const [status, setStatus] = useState('active')
  const [cancelReason, setCancelReason] = useState('')
  const [cancelDetails, setCancelDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  // Booking form
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [deduct, setDeduct] = useState(true)
  const [booking, setBooking] = useState(false)
  const [, setClosedTick] = useState(0)

  useEffect(() => {
    if (!open) return
    setPkg(PACKAGES.some(p => p.name === m?.package_name) ? m.package_name : '')
    setTotal(m?.sessions_total || 0)
    setUsed(m?.sessions_used || 0)
    setRenews(normDate(m?.expires_at) || '')
    setStatus(m?.status || 'active')
    setCancelReason(''); setCancelDetails('')
    setDate(''); setTime(''); setDeduct(!!m); setMsg(null)
    loadClosedDates().then(() => setClosedTick(n => n + 1))
  }, [open, m?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayIso = new Date().toISOString().split('T')[0]
  const upcoming = useMemo(() => !player ? [] : bookings
    .filter(b => b.parent_id === player.parent_id
      && (b.kid_name || '').toLowerCase().trim() === (player.kid_name || '').toLowerCase().trim()
      && normDate(b.session_date) >= todayIso)
    .sort((a, b) => (normDate(a.session_date) + a.session_time).localeCompare(normDate(b.session_date) + b.session_time)),
  [bookings, player, todayIso])

  const dateObj = date ? new Date(date + 'T12:00:00') : null
  const dateProblem = !dateObj ? null
    : dateObj.getDay() === 0 ? 'Closed on Sundays.'
    : isClosedDay(dateObj) ? `Blocked: ${closedReason(dateObj) || 'Closed'}.`
    : null
  const times = dateObj?.getDay() === 6 ? SATURDAY_TIMES : WEEKDAY_TIMES

  async function call(body) {
    const token = await session?.getToken()
    const res = await fetch(`${API_BASE}/api/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  const endingNow = m && m.status === 'active' && (status === 'canceled' || status === 'inactive')
  async function saveMembership() {
    if (used > total) { alert('Sessions used cannot be more than the total.'); return }
    if (endingNow && !cancelReason) { alert('Pick the reason they are leaving. It feeds the cancellation report.'); return }
    setSaving(true); setMsg(null)
    try {
      const body = { action: 'membership_adjust', membershipId: m.id, sessions_total: total, sessions_used: used, status }
      if (pkg) body.package_name = pkg
      if (renews) body.expires_at = renews
      if (endingNow) { body.cancel_reason = cancelReason; body.cancel_details = cancelDetails }
      await call(body)
      setMsg('Membership saved.')
      await onChanged()
    } catch (e) { alert('Could not save: ' + e.message) }
    finally { setSaving(false) }
  }

  async function book() {
    if (!date || !time || dateProblem) return
    setBooking(true); setMsg(null)
    try {
      await call({ action: 'booking_create', parentId: player.parent_id, kidName: player.kid_name, date, time, deduct })
      setMsg(`Booked ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })} at ${time}.`)
      if (deduct) setUsed(u => u + 1)
      setDate(''); setTime('')
      await onChanged()
    } catch (e) { alert('Could not book: ' + e.message) }
    finally { setBooking(false) }
  }

  async function cancel(bk) {
    const refund = confirm(`Cancel ${bk.kid_name} on ${normDate(bk.session_date)} at ${bk.session_time}?\n\nOK = cancel and RETURN the session to the player.\nCancel = keep the booking.`)
    if (!refund) return
    setMsg(null)
    try {
      await call({ action: 'booking_cancel', bookingId: bk.id, refund: true })
      setUsed(u => Math.max(0, u - 1))
      setMsg('Booking cancelled, session returned.')
      await onChanged()
    } catch (e) { alert('Could not cancel: ' + e.message) }
  }

  if (!open) return null
  const left = total - used

  return (
    <Modal open={open} onClose={onClose} title={`Manage ${player.kid_name}`} width={520}>
      {msg && <div style={{ marginBottom:12, padding:'9px 12px', borderRadius:8, fontSize:12, background:'rgba(34,197,110,0.08)', border:'1px solid rgba(34,197,110,0.25)', color:'var(--text)' }}>{msg}</div>}

      {/* ── MEMBERSHIP ── */}
      <div style={{ ...SECTION, borderTop:'none', paddingTop:0 }}>
        <div style={H}>Membership</div>
        {!m ? (
          <div style={{ fontSize:13, color:'var(--muted)' }}>No active membership. Use "Add Member" to set one up.</div>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <button style={STEP} onClick={() => setTotal(t => Math.max(used, t - 1))} title="Remove one session">−</button>
              <div style={{ textAlign:'center', minWidth:110 }}>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:26, color: left <= 0 ? 'var(--red)' : 'var(--green2)' }}>{left}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>sessions left ({used}/{total} used)</div>
              </div>
              <button style={STEP} onClick={() => setTotal(t => t + 1)} title="Add one session">+</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={LBL}>Package</label>
                <select style={SEL} value={pkg} onChange={e => {
                  const p = PACKAGES.find(x => x.name === e.target.value)
                  setPkg(e.target.value)
                  if (p) setTotal(Math.max(used, p.sessions))
                }}>
                  {!pkg && <option value="">{m.package_name || '(custom)'}</option>}
                  {PACKAGES.map(p => <option key={p.name} value={p.name}>{p.name} ({p.sessions}/mo)</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>Status</label>
                <select style={SEL} value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>
              <div>
                <label style={LBL}>Total sessions</label>
                <input style={SEL} type="number" min={0} max={999} value={total} onChange={e => setTotal(Math.max(0, parseInt(e.target.value || '0', 10)))} />
              </div>
              <div>
                <label style={LBL}>Sessions used</label>
                <input style={SEL} type="number" min={0} max={999} value={used} onChange={e => setUsed(Math.max(0, parseInt(e.target.value || '0', 10)))} />
              </div>
              {endingNow && (
                <div style={{ gridColumn:'1 / -1', padding:12, borderRadius:10, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.06)' }}>
                  <label style={LBL}>Why are they leaving?</label>
                  <select style={SEL} value={cancelReason} onChange={e => setCancelReason(e.target.value)}>
                    <option value="">Select a reason…</option>
                    {CANCEL_REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                  <input style={{ ...SEL, marginTop:8 }} type="text" maxLength={500} placeholder="Notes (optional)"
                    value={cancelDetails} onChange={e => setCancelDetails(e.target.value)} />
                </div>
              )}
              <div style={{ gridColumn:'1 / -1' }}>
                <label style={LBL}>Renews / access until</label>
                <input style={SEL} type="date" value={renews} onChange={e => setRenews(e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:8, lineHeight:1.5 }}>
              This changes the app only. It does not change what Stripe charges. On the next automatic renewal, sessions reset to whatever plan they pay for in Stripe.
            </div>
            <div style={{ marginTop:12, display:'flex', justifyContent:'flex-end' }}>
              <button style={{ ...PRIMARY, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={saveMembership}>{saving ? 'Saving…' : 'Save membership'}</button>
            </div>
          </>
        )}
      </div>

      {/* ── BOOK A SESSION ── */}
      <div style={SECTION}>
        <div style={H}>Book a session</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={LBL}>Date</label>
            <input style={SEL} type="date" min={todayIso} value={date} onChange={e => { setDate(e.target.value); setTime('') }} />
          </div>
          <div>
            <label style={LBL}>Time</label>
            <select style={SEL} value={time} disabled={!date || !!dateProblem} onChange={e => setTime(e.target.value)}>
              <option value="">Select…</option>
              {times.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {dateProblem && <div style={{ fontSize:12, color:'var(--red)', marginTop:6 }}>{dateProblem}</div>}
        <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:13, color:'var(--text2)', cursor:'pointer' }}>
          <input type="checkbox" checked={deduct} onChange={e => setDeduct(e.target.checked)} />
          Use a session from their plan
        </label>
        <div style={{ marginTop:12, display:'flex', justifyContent:'flex-end' }}>
          <button style={{ ...PRIMARY, opacity: (!date || !time || dateProblem || booking) ? 0.5 : 1 }}
            disabled={!date || !time || !!dateProblem || booking} onClick={book}>{booking ? 'Booking…' : 'Book session'}</button>
        </div>
      </div>

      {/* ── UPCOMING ── */}
      <div style={SECTION}>
        <div style={H}>Upcoming sessions</div>
        {upcoming.length === 0 ? (
          <div style={{ fontSize:13, color:'var(--muted)' }}>None booked.</div>
        ) : upcoming.map(bk => (
          <div key={bk.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize:13, color:'var(--text)', fontWeight:600 }}>
              {new Date(normDate(bk.session_date) + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
            </span>
            <span style={{ fontSize:12, color:'var(--muted)' }}>{bk.session_time}</span>
            <button onClick={() => cancel(bk)} title="Cancel and return session"
              style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', display:'flex' }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
