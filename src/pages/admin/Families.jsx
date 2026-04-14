import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { Card, Badge, Avatar, PageHeader, ProgressBar } from '../../components/UI'
import { useAdminData, PACK_INFO, parentName, normDate } from '../../hooks/useAdminData'

export default function Families() {
  const { players, memberships, profiles, loading } = useAdminData()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})

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

      <div style={{ position:'relative', marginBottom:16 }}>
        <Search size={14} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by parent name, player or email..."
          style={{ paddingLeft:40 }} />
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
    </div>
  )
}
