import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, UserPlus } from 'lucide-react'
import { Card, Badge, Avatar, PageHeader, ProgressBar, Modal } from '../../components/UI'
import { useAdminData, PACK_INFO, parentName, normDate } from '../../hooks/useAdminData'

const EMPTY_FORM = { parentName: '', email: '', phone: '', kidName: '', package: 'A', planType: 'monthly', startDate: '' }

export default function Families() {
  const { players, memberships, profiles, loading, refetch } = useAdminData()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})
  const [showAddMember, setShowAddMember] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  async function handleAddMember(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/add-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
      setShowAddMember(false)
      setForm(EMPTY_FORM)
      await refetch()
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
          onClick={() => { setShowAddMember(true); setSaveError(null) }}
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
                  <div style={{ fontFamily:'var(--font-display)', fontSize:17, fontWeight:800 }}>{pName}</div>
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
                        display:'grid', gridTemplateColumns:'1.4fr 1fr 1.4fr',
                        gap:20, alignItems:'center',
                      }}>
                        {/* Player info */}
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <Avatar initials={initials} size={36} color={pkgColor} />
                          <div>
                            <div style={{ fontSize:14, fontWeight:600 }}>{player.kid_name}</div>
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
                              <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                                ${PACK_INFO[m.package_name]?.price?.toLocaleString() || '—'}/mo
                              </div>
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

      {/* Add Member Modal */}
      <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Add New Member" width={480}>
        <form onSubmit={handleAddMember} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Parent Name *</label>
              <input required placeholder="Full name" {...field('parentName')} style={{ width:'100%', margin:0 }} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Email *</label>
              <input required type="email" placeholder="email@example.com" {...field('email')} style={{ width:'100%', margin:0 }} />
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Phone</label>
              <input placeholder="(915) 000-0000" {...field('phone')} style={{ width:'100%', margin:0 }} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Kid Name *</label>
              <input required placeholder="Player full name" {...field('kidName')} style={{ width:'100%', margin:0 }} />
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Package *</label>
              <select required value={form.package} onChange={e => setForm(f => ({ ...f, package: e.target.value }))} style={{ width:'100%', margin:0, background:'var(--navy3)', color:'var(--white)', border:'1px solid var(--border2)', borderRadius:8, padding:'10px 12px', fontSize:13 }}>
                <option value="A">Paquete A — 4 sessions/mo</option>
                <option value="AA">Paquete AA — 8 sessions/mo</option>
                <option value="AAA">Paquete AAA — 12 sessions/mo</option>
                <option value="MLB">Paquete MLB — 20 sessions/mo</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Plan Type *</label>
              <select required value={form.planType} onChange={e => setForm(f => ({ ...f, planType: e.target.value }))} style={{ width:'100%', margin:0, background:'var(--navy3)', color:'var(--white)', border:'1px solid var(--border2)', borderRadius:8, padding:'10px 12px', fontSize:13 }}>
                <option value="monthly">Month to Month</option>
                <option value="m6">6 meses — 15% descuento</option>
                <option value="m12">12 meses — 20% descuento</option>
                <option value="annual">Anual pago único — 25% descuento</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:5 }}>Start Date *</label>
            <input required type="date" {...field('startDate')} style={{ width:'100%', margin:0 }} />
          </div>

          {saveError && (
            <div style={{ background:'rgba(255,50,50,0.1)', border:'1px solid rgba(255,80,80,0.3)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#ff6b6b' }}>
              {saveError}
            </div>
          )}

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
            <button type="button" onClick={() => setShowAddMember(false)} style={{ padding:'10px 20px', background:'transparent', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text2)', cursor:'pointer', fontSize:13 }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding:'10px 22px', background:'#4fa8ff', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:13, cursor:saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Creating…' : 'Create Member'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
