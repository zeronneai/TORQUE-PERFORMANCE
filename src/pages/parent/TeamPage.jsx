import React, { useState, useEffect } from 'react'
import { useSession } from '@clerk/clerk-react'
import { supabase } from '../../supabaseClient'
import { API_BASE } from '../../lib/apiBase'
import { TEAM_PRICE, TEAM_AGES, teamLabel, suggestedTeam, packageIsActive, teamIsOpen, teamStatus, nextBillingLabel, MIDMONTH } from '../../lib/team'

// Torque Team: $250/month team subscription. Only for players that already have an
// active session package; without one the card is locked and points to the packages.
export default function TeamPage({ players = [], parentId, onBuy, justJoined }) {
  const { session } = useSession()
  const [teamRows, setTeamRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [pick, setPick] = useState({})          // kid_name -> team age
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState({})

  async function load() {
    if (!parentId) return
    const { data } = await supabase.from('team_memberships').select('*')
      .eq('parent_id', parentId).in('status', ['active', 'past_due'])
    setTeamRows(data || [])
    setLoading(false)
    return data || []
  }

  useEffect(() => {
    load().catch(() => setLoading(false))
    // Coming back from Stripe: the webhook can take a few seconds, so poll briefly.
    if (justJoined) {
      let n = 0
      const t = setInterval(async () => { n++; await load().catch(() => {}); if (n >= 6) clearInterval(t) }, 2500)
      return () => clearInterval(t)
    }
  }, [parentId, justJoined])

  // A team row counts unless it has already ended (canceled, or cancel date passed).
  const rowFor = (p) => teamRows.find(r =>
    (r.kid_name || '').toLowerCase().trim() === (p.kid_name || '').toLowerCase().trim() && teamStatus(r) !== 'canceled')
  const open = teamIsOpen()
  const firstCharge = nextBillingLabel()   // null = today is the 5th, charged now
  const chargeNote = !firstCharge ? `$${TEAM_PRICE} is charged today, then on the 5th of every month.`
    : MIDMONTH === 'prorate' ? `Today you pay only the days until ${firstCharge}. Then $${TEAM_PRICE} on the 5th of every month.`
    : `Nothing is charged today. First charge of $${TEAM_PRICE} on ${firstCharge}, then on the 5th of every month.`
  const shortDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : ''

  async function authHeaders() {
    const token = session ? await session.getToken() : null
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  }

  // Cancel: one confirmation, no fee. Prepaid month is kept, no refund, no renewal.
  async function cancelTeam(p, row) {
    const until = shortDate(row.current_period_end)
    const ok = window.confirm(`Cancel ${p.kid_name}'s Torque Team subscription?\n\n${p.kid_name} stays on the team until ${until || 'the end of the paid month'}. No more charges after that. The current month is prepaid and is not refunded.`)
    if (!ok) return
    setBusy(p.kid_name); setErr(e => ({ ...e, [p.kid_name]: null }))
    try {
      const r = await fetch(`${API_BASE}/api/cancellation`, {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ action: 'team_cancel', teamMembershipId: row.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Could not cancel. Try again.')
      await load()
    } catch (e) { setErr(x => ({ ...x, [p.kid_name]: e.message })) }
    setBusy(null)
  }

  // Declined card: open Stripe's billing page so the parent can update it.
  async function updateCard(p, row) {
    setBusy(p.kid_name); setErr(e => ({ ...e, [p.kid_name]: null }))
    try {
      const r = await fetch(`${API_BASE}/api/create-billing-portal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: row.stripe_subscription_id }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.url) { window.location.href = d.url; return }
      throw new Error(d.error || 'Could not open billing. Contact your coach.')
    } catch (e) { setErr(x => ({ ...x, [p.kid_name]: e.message })) }
    setBusy(null)
  }

  async function join(p) {
    const age = pick[p.kid_name] ?? suggestedTeam(p)
    if (!age) { setErr(e => ({ ...e, [p.kid_name]: 'Pick a team first.' })); return }
    setBusy(p.kid_name); setErr(e => ({ ...e, [p.kid_name]: null }))
    try {
      const token = session ? await session.getToken() : null
      const r = await fetch(`${API_BASE}/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ kind: 'team', kidName: p.kid_name, teamAge: age }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.url) { window.location.href = d.url; return }
      const msg = d.error === 'notOpenYet' ? 'Torque Team sign-ups open on November 5.'
        : d.error === 'needsPackage' ? `${p.kid_name} needs an active session package first.`
        : d.error === 'alreadyOnTeam' ? `${p.kid_name} is already on a Torque Team.`
        : (d.error || 'Could not start checkout. Try again.')
      setErr(e => ({ ...e, [p.kid_name]: msg }))
    } catch {
      setErr(e => ({ ...e, [p.kid_name]: 'Connection problem. Try again.' }))
    }
    setBusy(null)
  }

  const label = { fontSize:10, color:'var(--muted2)', letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic' }

  return (
    <div className="animate-fade-up">
      <div className="section-eyebrow">Parent Portal</div>
      <h1 className="section-title">TORQUE TEAM</h1>
      <div className="section-bar" />

      <div style={{ fontSize:14, color:'var(--muted)', marginBottom:20, maxWidth:620, lineHeight:1.6 }}>
        Torque Team is our team program by age: 9U, 10U, 11U, 12U and 13U. It is <b style={{ color:'var(--text)' }}>${TEAM_PRICE}/month</b> and
        it is only for players who already train with a Torque session package.
      </div>

      {justJoined && (
        <div style={{ padding:'12px 16px', borderRadius:10, background:'rgba(34,197,110,0.08)', border:'1px solid rgba(34,197,110,0.25)', color:'var(--green2)', fontSize:13, marginBottom:16 }}>
          Payment received. Your player will show up on the team in a few seconds.
        </div>
      )}

      {players.length === 0 && (
        <div style={{ padding:'40px 0', textAlign:'center', color:'var(--muted)', fontSize:14 }}>Add a player first from the Dashboard.</div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {players.map(p => {
          const row = rowFor(p)
          const hasPkg = packageIsActive(p.active_membership)
          const sel = pick[p.kid_name] ?? suggestedTeam(p) ?? ''
          return (
            <div key={p.id || p.kid_name} style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:22 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22, color:'var(--text)' }}>{p.kid_name}</div>
                  <div style={{ ...label, marginTop:2 }}>{p.active_membership?.package_name || 'No session package'}</div>
                </div>

                {row ? (() => {
                  const st = teamStatus(row)
                  const color = st === 'unpaid' ? '#e04060' : st === 'ending' ? '#E8A020' : '#22c56e'
                  const text = st === 'unpaid' ? 'PAYMENT NOT PROCESSED' : st === 'ending' ? 'CANCELED' : 'ACTIVE'
                  return (
                    <div style={{ textAlign:'right' }}>
                      <div style={{ display:'inline-block', padding:'6px 14px', borderRadius:999, background:`${color}1f`, border:`1px solid ${color}`, color, fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, letterSpacing:'0.05em' }}>
                        TEAM {teamLabel(row.team_age)} · {text}
                      </div>
                      {row.current_period_end && st !== 'unpaid' && (
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>
                          {st === 'ending' ? 'On the team until' : 'Renews'} {shortDate(row.current_period_end)}
                        </div>
                      )}
                    </div>
                  )
                })() : null}
              </div>

              {row && teamStatus(row) === 'unpaid' && (
                <div style={{ marginTop:16, padding:'14px 16px', borderRadius:10, background:'rgba(224,64,96,0.08)', border:'1px solid rgba(224,64,96,0.3)' }}>
                  <div style={{ fontSize:13, color:'#e04060', fontWeight:700 }}>Payment not processed</div>
                  <div style={{ fontSize:13, color:'var(--muted)', marginTop:4, lineHeight:1.5 }}>
                    We could not charge this month's ${TEAM_PRICE}. Team access is paused until the card is updated.
                  </div>
                  {row.stripe_subscription_id && (
                    <button className="btn-primary" disabled={busy === p.kid_name} onClick={() => updateCard(p, row)} style={{ marginTop:12, padding:'10px 18px', fontSize:13 }}>
                      {busy === p.kid_name ? 'Opening…' : 'Update card'}
                    </button>
                  )}
                </div>
              )}

              {row && teamStatus(row) === 'active' && (
                <div style={{ marginTop:14, textAlign:'right' }}>
                  <button disabled={busy === p.kid_name} onClick={() => cancelTeam(p, row)}
                    style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, textDecoration:'underline', cursor:'pointer', padding:0 }}>
                    {busy === p.kid_name ? 'Canceling…' : 'Cancel team subscription'}
                  </button>
                </div>
              )}

              {!row && !loading && !open && (
                <div style={{ marginTop:16, fontSize:13, color:'var(--muted)' }}>Sign-ups open on November 5.</div>
              )}

              {!row && !loading && open && (
                hasPkg ? (
                  <div style={{ marginTop:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                    <select className="torque-input" value={sel} style={{ marginTop:0, maxWidth:180 }}
                      onChange={e => setPick(s => ({ ...s, [p.kid_name]: parseInt(e.target.value, 10) }))}>
                      <option value="" disabled>Choose team</option>
                      {TEAM_AGES.map(a => <option key={a} value={a}>Team {teamLabel(a)}</option>)}
                    </select>
                    <button className="btn-primary" disabled={busy === p.kid_name} onClick={() => join(p)} style={{ padding:'12px 20px', fontSize:14 }}>
                      {busy === p.kid_name ? 'Opening checkout…' : `Join for $${TEAM_PRICE}/mo`}
                    </button>
                    <div style={{ flexBasis:'100%', fontSize:12, color:'var(--muted)' }}>{chargeNote}</div>
                  </div>
                ) : (
                  <div style={{ marginTop:16, padding:'14px 16px', borderRadius:10, background:'rgba(13,27,42,0.04)', border:'1px dashed var(--border)' }}>
                    <div style={{ fontSize:13, color:'var(--text)', fontWeight:600 }}>🔒 Session package required</div>
                    <div style={{ fontSize:13, color:'var(--muted)', marginTop:4, lineHeight:1.5 }}>
                      To join a Torque Team, {p.kid_name} needs an active session package first (A, AA, AAA or MLB).
                    </div>
                    <button className="btn-primary" onClick={() => onBuy?.(p)} style={{ marginTop:12, padding:'10px 18px', fontSize:13 }}>
                      See session packages
                    </button>
                  </div>
                )
              )}

              {err[p.kid_name] && <div style={{ marginTop:10, fontSize:12, color:'#e04060' }}>{err[p.kid_name]}</div>}
            </div>
          )
        })}
      </div>

      <div style={{ fontSize:12, color:'var(--muted)', marginTop:20 }}>
        Billed by card on the 5th of every month, prepaid. You can cancel any time: the player stays on the team until the end of the paid month and there are no refunds.
      </div>
    </div>
  )
}
