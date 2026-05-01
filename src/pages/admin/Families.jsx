import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, UserPlus, Pencil } from 'lucide-react'
import { Card, Badge, Avatar, PageHeader, ProgressBar, Modal } from '../../components/UI'
import { useAdminData, PACK_INFO, parentName, normDate } from '../../hooks/useAdminData'
import { API_BASE } from '../../lib/apiBase'
import { supabase } from '../../supabaseClient'

const EMPTY_FORM = { parentName: '', email: '', phone: '', kidName: '', package: 'A', planType: 'monthly', kidName2: '', package2: 'A', planType2: 'monthly', startDate: '', paymentMethod: 'manual' }

const PRICE_TABLE = {
  A:   { monthly: 260, m6: 234, m12: 221, annual: 2496 },
  AA:  { monthly: 360, m6: 324, m12: 306, annual: 3456 },
  AAA: { monthly: 440, m6: 396, m12: 374, annual: 4224 },
  MLB: { monthly: 600, m6: 540, m12: 510, annual: 5760 },
}
const SEL = { width:'100%', margin:0, background:'var(--navy3)', color:'var(--white)', border:'1px solid var(--border2)', borderRadius:8, padding:'10px 12px', fontSize:13 }
const LBL = { fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }

export default function Families() {
  const { players, memberships, profiles, loading, refetch } = useAdminData()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})
  const [showAddMember, setShowAddMember] = useState(false)
  const [showPlayer2, setShowPlayer2] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [stripeResult, setStripeResult] = useState(null)
  const [editPlayer, setEditPlayer] = useState(null)
  const [editName, setEditName]     = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editParent, setEditParent]             = useState(null)
  const [editParentName, setEditParentName]     = useState('')
  const [editParentSaving, setEditParentSaving] = useState(false)

  async function handleEditSave() {
    if (!editPlayer || !editName.trim()) return
    const trimmed = editName.trim()
    const original = editPlayer.kid_name
    setEditSaving(true)
    try {
      const { error } = await supabase
        .from('players')
        .update({ kid_name: trimmed })
        .eq('parent_id', editPlayer.parent_id)
        .eq('kid_name', original)
      if (error) throw error

      const { error: error2 } = await supabase
        .from('player_memberships')
        .update({ kid_name: trimmed })
        .eq('parent_id', editPlayer.parent_id)
        .eq('kid_name', original)
      if (error2) throw error2

      setEditPlayer(null)
      setEditName('')
      await refetch()
    } catch (err) {
      console.error('[Families] Edit player failed:', err)
      alert('Error saving: ' + (err.message || JSON.stringify(err)))
    } finally {
      setEditSaving(false)
    }
  }

  async function handleEditParentSave() {
    if (!editParent || !editParentName.trim()) return
    const trimmed = editParentName.trim()
    setEditParentSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: trimmed })
        .eq('id', editParent.parent_id)
      if (error) throw error
      setEditParent(null)
      setEditParentName('')
      await refetch()
    } catch (err) {
      console.error('[Families] Edit parent name failed:', err)
      alert('Error saving: ' + (err.message || JSON.stringify(err)))
    } finally {
      setEditParentSaving(false)
    }
  }

  function closeAddModal() {
    setShowAddMember(false)
    setShowPlayer2(false)
    setForm(EMPTY_FORM)
    setSaveError(null)
    setStripeResult(null)
  }

  async function handleAddMember(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const payload = { ...form }
      if (!showPlayer2) { payload.kidName2 = ''; payload.package2 = ''; payload.planType2 = '' }
      const res = await fetch(`${API_BASE}/api/add-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
      if (form.paymentMethod === 'stripe' && data.stripeLink) {
        setStripeResult({
          parentName: form.parentName,
          kidName: form.kidName,
          stripeLink: data.stripeLink,
          kidName2: showPlayer2 ? form.kidName2 : null,
          stripeLink2: data.stripeLink2 || null,
        })
      } else {
        closeAddModal()
        await refetch()
      }
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (key) => ({
    value: form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  })

  // Group players by parent_id and join with profile and membership
  const families = useMemo(() => {
    const grouped = {}
    players.forEach(player => {
      const pid = player.parent_id
      if (!grouped[pid]) {
        const profile = profiles.find(pr => pr.id === pid) || null
        grouped[pid] = { parent_id: pid, profile, players: [] }
      }
      const membership = memberships.find(
        m => m.parent_id === pid &&
          m.kid_name?.toLowerCase().trim() === player.kid_name?.toLowerCase().trim()
      ) || null
      grouped[pid].players.push({ ...player, membership })
    })
    return Object.values(grouped)
  }, [players, memberships, profiles])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return families
    return families.filter(f => {
      const pName = (parentName(f.profile) || '').toLowerCase()
      const pEmail = (f.profile?.email || '').toLowerCase()
      const kidMatch = f.players.some(p => (p.kid_name || '').toLowerCase().includes(q))
      return pName.includes(q) || pEmail.includes(q) || kidMatch
    })
  }, [families, search])

  const toggleFamily = id => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const totalActive = families.reduce((s, f) => s + f.players.filter(p => p.membership).length, 0)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:18, color:'var(--muted)' }}>Loading...</div>
    </div>
  )

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Academy"
        title="Families & Players"
        subtitle={`${families.length} families · ${totalActive} active players`}
      />

      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <div style={{ position:'relative', flex:1 }}>
          <Search size={14} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by parent name, player or email..."
            style={{ paddingLeft:40, width:'100%' }} />
        </div>
        <button
          onClick={() => { setShowAddMember(true); setShowPlayer2(false); setSaveError(null) }}
          style={{ display:'flex', alignItems:'center', gap:7, padding:'0 18px', height:42, background:'#4fa8ff', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
        >
          <UserPlus size={15} /> Add Member
        </button>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:48, color:'var(--muted)' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>👥</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontStyle:'italic' }}>
            {search ? 'No results' : 'No families registered yet'}
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {filtered.map(family => {
          const isOpen = expanded[family.parent_id]
          const pName = parentName(family.profile) || `Parent ${family.parent_id.slice(0,6)}…`
          const pEmail = family.profile?.email || '—'
          const pPhone = family.profile?.phone || ''
          const initials = pName.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)

          return (
            <Card key={family.parent_id} style={{ padding:0, overflow:'hidden' }}>
              {/* Family header */}
              <div
                onClick={() => toggleFamily(family.parent_id)}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 20px', cursor:'pointer', transition:'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <Avatar initials={initials} size={42} color="var(--navy4)" />
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(14px, 4vw, 17px)', fontWeight:800 }}>{pName}</div>
                    <button
                      onClick={e => { e.stopPropagation(); setEditParent({ parent_id: family.parent_id }); setEditParentName(family.profile?.full_name || pName) }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:'0 2px', display:'flex', alignItems:'center' }}
                      title="Edit parent name"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                  <div style={{ fontSize:13, color:'var(--text2)', marginTop:2 }}>
                    {pEmail}{pPhone ? ` · ${pPhone}` : ''}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end' }}>
                  {family.players.map(p => (
                    <Badge key={p.id} color={p.membership ? 'green' : 'default'}>
                      {(p.kid_name || '').split(' ')[0]}
                    </Badge>
                  ))}
                  <Badge color="default">
                    {family.players.length} {family.players.length === 1 ? 'player' : 'players'}
                  </Badge>
                  {isOpen
                    ? <ChevronDown size={16} color="var(--text3)" />
                    : <ChevronRight size={16} color="var(--text3)" />}
                </div>
              </div>

              {/* Player details */}
              {isOpen && (
                <div style={{ borderTop:'1px solid var(--border)', background:'rgba(0,0,0,0.2)' }}>
                  {family.players.map((player, idx) => {
                    const m = player.membership
                    const remaining = m ? (m.sessions_total||0) - (m.sessions_used||0) : 0
                    const pkgColor = PACK_INFO[m?.package_name]?.color || 'var(--muted)'
                    const initials = (player.kid_name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)
                    return (
                      <div key={player.id} style={{
                        padding:'16px 24px',
                        borderBottom: idx < family.players.length - 1 ? '1px solid var(--border)' : 'none',
                        display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',
                        gap:20, alignItems:'center',
                      }}>
                        {/* Player info */}
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <Avatar initials={initials} size={36} color={pkgColor} />
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <div style={{ fontSize:14, fontWeight:600 }}>{player.kid_name}</div>
                              <button
                                onClick={e => { e.stopPropagation(); setEditPlayer(player); setEditName(player.kid_name) }}
                                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:'0 2px', display:'flex', alignItems:'center' }}
                                title="Edit player name"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                            <div style={{ fontSize:12, color:'var(--text3)' }}>
                              {player.age ? `${player.age} yrs` : ''}
                              {player.birthdate ? ` · Born ${player.birthdate}` : ''}
                            </div>
                          </div>
                        </div>

                        {/* Package */}
                        <div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Package</div>
                          {m ? (
                            <>
                              <div style={{ fontSize:13, fontWeight:600, color:pkgColor }}>{m.package_name || '—'}</div>
                              {(() => {
                                const base = PRICE_TABLE[m.package_name]?.monthly
                                const paid = m.monthly_price
                                if (!base) return <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>—</div>
                                if (!paid) return <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>${base.toLocaleString()}/mo</div>
                                const isAnnual = paid > base * 3
                                const isDiscounted = !isAnnual && paid < base
                                if (isAnnual) return (
                                  <div style={{ marginTop:2 }}>
                                    <div style={{ fontSize:11, color:'var(--muted)', textDecoration:'line-through' }}>${base.toLocaleString()}/mo</div>
                                    <div style={{ fontSize:11, fontWeight:700, color:'var(--green2)' }}>Pago único: ${paid.toLocaleString()}</div>
                                  </div>
                                )
                                if (isDiscounted) return (
                                  <div style={{ marginTop:2 }}>
                                    <div style={{ fontSize:11, color:'var(--muted)', textDecoration:'line-through' }}>${base.toLocaleString()}/mo</div>
                                    <div style={{ fontSize:11, fontWeight:700, color:'var(--green2)' }}>${paid.toLocaleString()}/mo</div>
                                  </div>
                                )
                                return <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>${paid.toLocaleString()}/mo</div>
                              })()}
                            </>
                          ) : (
                            <div style={{ fontSize:12, color:'var(--muted)' }}>No active membership</div>
                          )}
                        </div>

                        {/* Sessions */}
                        <div>
                          {m ? (
                            <>
                              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:5 }}>
                                {m.sessions_used||0}/{m.sessions_total||0} used
                                {' · '}
                                <span style={{ color: remaining<=0?'#ff4466':remaining<=2?'var(--amber)':'var(--green2)', fontWeight:600 }}>
                                  {remaining} remaining
                                </span>
                              </div>
                              <ProgressBar
                                value={m.sessions_used||0}
                                max={m.sessions_total||1}
                                color={remaining<=0?'var(--red)':remaining<=2?'var(--amber)':'var(--green)'}
                              />
                              {m.expires_at && (
                                <div style={{ fontSize:11, color:'var(--muted)', marginTop:5 }}>
                                  Renews: {new Date(normDate(m.expires_at) + 'T00:00:00').toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'numeric' })}
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ fontSize:12, color:'var(--muted)' }}>—</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Edit Parent Modal */}
      <Modal open={!!editParent} onClose={() => { setEditParent(null); setEditParentName('') }} title="Edit Parent Name" width={380}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={LBL}>Parent Name</label>
            <input
              value={editParentName}
              onChange={e => setEditParentName(e.target.value)}
              placeholder="Full name"
              style={{ width:'100%', margin:0 }}
              autoFocus
            />
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button type="button" onClick={() => { setEditParent(null); setEditParentName('') }}
              style={{ padding:'10px 20px', background:'transparent', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text2)', cursor:'pointer', fontSize:13 }}>
              Cancel
            </button>
            <button onClick={handleEditParentSave} disabled={editParentSaving || !editParentName.trim()}
              style={{ padding:'10px 22px', background:'#4fa8ff', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:13, cursor:(editParentSaving || !editParentName.trim()) ? 'not-allowed' : 'pointer', opacity:(editParentSaving || !editParentName.trim()) ? 0.7 : 1 }}>
              {editParentSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Player Modal */}
      <Modal open={!!editPlayer} onClose={() => { setEditPlayer(null); setEditName('') }} title="Edit Player Name" width={380}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={LBL}>Player Name</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Full name"
              style={{ width:'100%', margin:0 }}
              autoFocus
            />
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button type="button" onClick={() => { setEditPlayer(null); setEditName('') }}
              style={{ padding:'10px 20px', background:'transparent', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text2)', cursor:'pointer', fontSize:13 }}>
              Cancel
            </button>
            <button onClick={handleEditSave} disabled={editSaving || !editName.trim()}
              style={{ padding:'10px 22px', background:'#4fa8ff', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:13, cursor:(editSaving || !editName.trim()) ? 'not-allowed' : 'pointer', opacity:(editSaving || !editName.trim()) ? 0.7 : 1 }}>
              {editSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Member Modal */}
      <Modal open={showAddMember} onClose={closeAddModal} title={stripeResult ? 'Payment Links Ready' : 'Add New Member'} width={480}>
        {stripeResult ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:'rgba(34,197,110,0.08)', border:'1px solid rgba(34,197,110,0.2)', borderRadius:10, padding:'14px 16px', fontSize:13, color:'#22C56E' }}>
              ✅ Account created for <strong>{stripeResult.parentName}</strong>. Share the payment link(s) below.
            </div>
            <div>
              <label style={LBL}>Payment Link — {stripeResult.kidName}</label>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input readOnly value={stripeResult.stripeLink} style={{ width:'100%', margin:0, fontSize:11, color:'#4fa8ff' }} />
                <button type="button" onClick={() => navigator.clipboard.writeText(stripeResult.stripeLink)}
                  style={{ padding:'10px 14px', background:'#4fa8ff', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                  Copy
                </button>
              </div>
            </div>
            {stripeResult.stripeLink2 && (
              <div>
                <label style={LBL}>Payment Link — {stripeResult.kidName2}</label>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input readOnly value={stripeResult.stripeLink2} style={{ width:'100%', margin:0, fontSize:11, color:'#4fa8ff' }} />
                  <button type="button" onClick={() => navigator.clipboard.writeText(stripeResult.stripeLink2)}
                    style={{ padding:'10px 14px', background:'#4fa8ff', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                    Copy
                  </button>
                </div>
              </div>
            )}
            <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--text3)' }}>
              Sessions will be assigned automatically when the parent completes payment via Stripe.
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button type="button" onClick={async () => { await refetch(); closeAddModal() }}
                style={{ padding:'10px 22px', background:'#4fa8ff', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddMember} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12 }}>
              <div>
                <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Parent Name *</label>
                <input required placeholder="Full name" {...field('parentName')} style={{ width:'100%', margin:0 }} />
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Email *</label>
                <input required type="email" placeholder="email@example.com" {...field('email')} style={{ width:'100%', margin:0 }} />
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12 }}>
              <div>
                <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Phone</label>
                <input placeholder="(915) 000-0000" {...field('phone')} style={{ width:'100%', margin:0 }} />
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Kid Name *</label>
                <input required placeholder="Player full name" {...field('kidName')} style={{ width:'100%', margin:0 }} />
              </div>
            </div>

            {/* ── Player 1 package/plan ── */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12 }}>
              <div>
                <label style={LBL}>Package *</label>
                <select required value={form.package} onChange={e => setForm(f => ({ ...f, package: e.target.value }))} style={SEL}>
                  <option value="A">Paquete A — 4 sessions/mo</option>
                  <option value="AA">Paquete AA — 8 sessions/mo</option>
                  <option value="AAA">Paquete AAA — 12 sessions/mo</option>
                  <option value="MLB">Paquete MLB — 20 sessions/mo</option>
                </select>
              </div>
              <div>
                <label style={LBL}>Plan Type *</label>
                <select required value={form.planType} onChange={e => setForm(f => ({ ...f, planType: e.target.value }))} style={SEL}>
                  <option value="monthly">Month to Month (no discount)</option>
                  <option value="m6">6-Month Contract — 10% off</option>
                  <option value="m12">12-Month Contract — 15% off</option>
                  <option value="annual">Annual Lump Sum — 20% off (one payment)</option>
                </select>
              </div>
            </div>

            {/* Price preview — player 1 */}
            {form.package && form.planType && (() => {
              const price = PRICE_TABLE[form.package]?.[form.planType]
              const base = PRICE_TABLE[form.package]?.monthly
              if (!price || !base) return null
              const isAnnual = form.planType === 'annual'
              const isDiscounted = form.planType !== 'monthly'
              return (
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(34,197,110,0.06)', border:'1px solid rgba(34,197,110,0.15)', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
                  {isDiscounted && <span style={{ color:'var(--text3)', textDecoration:'line-through', fontSize:12 }}>${base.toLocaleString()}/mo</span>}
                  <strong style={{ color:'#22C56E' }}>
                    {isAnnual ? `Pago único: $${price.toLocaleString()}` : `$${price.toLocaleString()}/mo`}
                  </strong>
                </div>
              )
            })()}

            {/* ── Second Player toggle ── */}
            {!showPlayer2 ? (
              <button type="button" onClick={() => setShowPlayer2(true)} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'1px dashed var(--border2)', borderRadius:8, color:'var(--text2)', padding:'9px 14px', fontSize:13, cursor:'pointer', width:'100%', justifyContent:'center' }}>
                + Add Second Player (Sibling)
              </button>
            ) : (
              <div style={{ border:'1px solid var(--border2)', borderRadius:10, padding:'16px 16px 12px', background:'rgba(255,255,255,0.02)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#4fa8ff' }}>Second Player — Sibling</span>
                  <button type="button" onClick={() => { setShowPlayer2(false); setForm(f => ({ ...f, kidName2:'', package2:'A', planType2:'monthly' })) }} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:18, lineHeight:1 }}>✕</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div>
                    <label style={LBL}>Kid Name 2 *</label>
                    <input required={showPlayer2} placeholder="Player full name" value={form.kidName2} onChange={e => setForm(f => ({ ...f, kidName2: e.target.value }))} style={{ width:'100%', margin:0 }} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12 }}>
                    <div>
                      <label style={LBL}>Package 2 *</label>
                      <select value={form.package2} onChange={e => setForm(f => ({ ...f, package2: e.target.value }))} style={SEL}>
                        <option value="A">Paquete A — 4 sessions/mo</option>
                        <option value="AA">Paquete AA — 8 sessions/mo</option>
                        <option value="AAA">Paquete AAA — 12 sessions/mo</option>
                        <option value="MLB">Paquete MLB — 20 sessions/mo</option>
                      </select>
                    </div>
                    <div>
                      <label style={LBL}>Plan Type 2 *</label>
                      <select value={form.planType2} onChange={e => setForm(f => ({ ...f, planType2: e.target.value }))} style={SEL}>
                        <option value="monthly">Month to Month (no discount)</option>
                        <option value="m6">6-Month Contract — 10% off</option>
                        <option value="m12">12-Month Contract — 15% off</option>
                        <option value="annual">Annual Lump Sum — 20% off</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ background:'rgba(79,168,255,0.08)', border:'1px solid rgba(79,168,255,0.2)', borderRadius:7, padding:'8px 12px', fontSize:12, color:'#4fa8ff' }}>
                    {(() => {
                      const discBase = PRICE_TABLE[form.package2]?.[form.planType2] || 0
                      const sibPrice = Math.round(discBase * 0.5)
                      const monthlyBase = PRICE_TABLE[form.package2]?.monthly || 0
                      const isAnnual = form.planType2 === 'annual'
                      const fmt = (n) => n.toLocaleString()
                      return (
                        <>
                          Sibling discount: 50% off —{' '}
                          <strong>${isAnnual ? `Pago único: $${fmt(sibPrice)}` : `${fmt(sibPrice)}/mo`}</strong>
                          {' '}(<span style={{ textDecoration:'line-through' }}>${isAnnual ? fmt(discBase) : `${fmt(discBase)}/mo`}</span> · base ${fmt(monthlyBase)}/mo)
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* ── Payment Method ── */}
            <div>
              <label style={LBL}>Payment Method *</label>
              <div style={{ display:'flex', gap:8 }}>
                {['manual', 'stripe'].map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, paymentMethod: method }))}
                    style={{
                      flex:1, padding:'10px 0',
                      border:`2px solid ${form.paymentMethod === method ? '#4fa8ff' : 'var(--border2)'}`,
                      borderRadius:8,
                      background: form.paymentMethod === method ? 'rgba(79,168,255,0.12)' : 'transparent',
                      color: form.paymentMethod === method ? '#4fa8ff' : 'var(--text2)',
                      fontWeight:700, fontSize:13, cursor:'pointer',
                    }}
                  >
                    {method === 'manual' ? '💵 Manual' : '💳 Stripe Link'}
                  </button>
                ))}
              </div>
              {form.paymentMethod === 'stripe' && (
                <div style={{ marginTop:8, background:'rgba(79,168,255,0.06)', border:'1px solid rgba(79,168,255,0.2)', borderRadius:7, padding:'8px 12px', fontSize:12, color:'rgba(255,255,255,0.55)' }}>
                  Creates the account & player, returns a payment link to share. Sessions assigned automatically when payment is confirmed.
                </div>
              )}
            </div>

            {form.paymentMethod === 'manual' && (
              <div>
                <label style={LBL}>Start Date *</label>
                <input required type="date" {...field('startDate')} style={{ width:'100%', margin:0 }} />
              </div>
            )}

            {saveError && (
              <div style={{ background:'rgba(255,50,50,0.1)', border:'1px solid rgba(255,80,80,0.3)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#ff6b6b' }}>
                {saveError}
              </div>
            )}

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
              <button type="button" onClick={closeAddModal} style={{ padding:'10px 20px', background:'transparent', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text2)', cursor:'pointer', fontSize:13 }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={{ padding:'10px 22px', background:'#4fa8ff', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:13, cursor:saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Creating…' : form.paymentMethod === 'stripe' ? 'Create & Get Link' : 'Create Member'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
