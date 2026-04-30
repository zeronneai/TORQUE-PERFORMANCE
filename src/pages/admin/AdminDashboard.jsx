import React, { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { StatCard, Card, Badge, Avatar, PageHeader, ProgressBar } from '../../components/UI'
import { useAdminData, normDate, PACK_INFO, TYPE_COLORS, parentName } from '../../hooks/useAdminData'
import { supabase } from '../../supabaseClient'
import { Check } from 'lucide-react'

const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px', fontSize:12 }}>
      <div style={{ color:'var(--text2)', marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => <div key={i} style={{ color:p.color, fontWeight:600 }}>{p.name}: {p.value}</div>)}
    </div>
  )
}

export default function AdminDashboard() {
  const { players, memberships, bookings, profiles, loading } = useAdminData()
  const today = new Date().toISOString().split('T')[0]

  const [todayCheckins, setTodayCheckins] = useState([])
  const [toast, setToast] = useState(null)
  const [manualCheckinLoading, setManualCheckinLoading] = useState({})

  useEffect(() => {
    const todayStart = today + 'T00:00:00.000Z'
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T00:00:00.000Z'

    supabase
      .from('checkins')
      .select('*')
      .gte('checked_in_at', todayStart)
      .lt('checked_in_at', tomorrow)
      .order('checked_in_at', { ascending: false })
      .then(({ data }) => setTodayCheckins(data || []))

    const channel = supabase.channel('admin-checkins')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkins' }, (payload) => {
        const c = payload.new
        const cDate = new Date(c.checked_in_at).toISOString().split('T')[0]
        if (cDate === today) {
          setTodayCheckins(prev => [c, ...prev])
          setToast({ kidName: c.kid_name, remaining: c.sessions_remaining_after })
          setTimeout(() => setToast(null), 4000)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [today])

  async function handleManualCheckin(player) {
    const pid = player.parent_id
    const kidName = player.kid_name
    setManualCheckinLoading(p => ({ ...p, [player.id]: true }))
    try {
      const { data: mems } = await supabase
        .from('player_memberships').select('*')
        .eq('parent_id', pid).eq('kid_name', kidName).eq('status', 'active')
        .order('purchased_at', { ascending: false }).limit(1)

      const membership = mems?.[0]
      if (!membership) {
        setToast({ error: `${kidName}: no active membership` })
        setTimeout(() => setToast(null), 3500)
        return
      }
      const remaining = (membership.sessions_total || 0) - (membership.sessions_used || 0)
      if (remaining <= 0) {
        setToast({ error: `${kidName}: no sessions remaining` })
        setTimeout(() => setToast(null), 3500)
        return
      }

      const todayStart = today + 'T00:00:00.000Z'
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T00:00:00.000Z'
      const { data: existing } = await supabase
        .from('checkins').select('id')
        .eq('parent_id', pid).eq('kid_name', kidName)
        .gte('checked_in_at', todayStart).lt('checked_in_at', tomorrow)
        .maybeSingle()

      if (existing) {
        setToast({ error: `${kidName}: already checked in today` })
        setTimeout(() => setToast(null), 3500)
        return
      }

      const remainingAfter = remaining - 1
      await supabase.from('checkins').insert({ parent_id: pid, kid_name: kidName, membership_id: membership.id, sessions_remaining_after: remainingAfter })
      await supabase.from('player_memberships').update({ sessions_used: membership.sessions_used + 1 }).eq('id', membership.id)
      // Realtime adds the new row to todayCheckins automatically
    } catch (err) {
      console.error('Manual checkin error:', err)
    } finally {
      setManualCheckinLoading(p => ({ ...p, [player.id]: false }))
    }
  }

  const todayBookings = useMemo(() =>
    bookings.filter(b => normDate(b.session_date) === today)
  , [bookings, today])

  const monthlyRevenue = useMemo(() =>
    memberships.reduce((sum, m) => sum + (PACK_INFO[m.package_name]?.price || 0), 0)
  , [memberships])

  const expiringSoon = useMemo(() =>
    memberships.filter(m => ((m.sessions_total || 0) - (m.sessions_used || 0)) <= 2).length
  , [memberships])

  const sessionsByDay = useMemo(() => {
    const counts = { 1:0, 3:0, 5:0, 6:0 }
    bookings.forEach(b => {
      const d = normDate(b.session_date)
      if (!d) return
      const day = new Date(d + 'T12:00:00').getDay()
      if (day in counts) counts[day]++
    })
    return [
      { day: 'Mon', sessions: counts[1] },
      { day: 'Wed', sessions: counts[3] },
      { day: 'Fri', sessions: counts[5] },
      { day: 'Sat', sessions: counts[6] },
    ]
  }, [bookings])

  const pkgDist = useMemo(() =>
    Object.entries(PACK_INFO).map(([name, info]) => ({
      name,
      count: memberships.filter(m => m.package_name === name).length,
      color: info.color,
    }))
  , [memberships])

  const playersWithMembership = useMemo(() =>
    players.map(player => {
      const m = memberships.find(
        mem => mem.parent_id === player.parent_id &&
          mem.kid_name?.toLowerCase().trim() === player.kid_name?.toLowerCase().trim()
      )
      return { ...player, membership: m || null }
    }).filter(p => p.membership)
  , [players, memberships])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:18, color:'var(--muted)' }}>Loading...</div>
    </div>
  )

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Torque Performance" title="Command Center" subtitle="Academy operations overview" />

      {/* ── Check-ins de Hoy ── */}
      <Card style={{ marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16 }}>Check-ins de Hoy</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
              {new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })}
            </div>
          </div>
          <Badge color={todayCheckins.length > 0 ? 'green' : 'default'}>{todayCheckins.length} check-ins</Badge>
        </div>

        {todayCheckins.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0', color:'var(--muted)', fontSize:13 }}>
            No hay check-ins registrados hoy
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  {['Jugador','Padre','Hora','Sesiones rest.','Paquete'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'6px 10px', fontSize:11, fontFamily:'var(--font-display)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text3)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayCheckins.map((c, i) => {
                  const profile = profiles.find(pr => pr.id === c.parent_id)
                  const pName = parentName(profile) || '—'
                  const membership = memberships.find(m =>
                    m.parent_id === c.parent_id &&
                    m.kid_name?.toLowerCase().trim() === c.kid_name?.toLowerCase().trim()
                  )
                  const time = new Date(c.checked_in_at).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true })
                  const remaining = c.sessions_remaining_after
                  return (
                    <tr key={c.id || i} style={{ borderBottom:'1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <td style={{ padding:'10px 10px', fontWeight:600, whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--navy4)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:700, fontSize:12, color:'#fff', flexShrink:0 }}>
                            {(c.kid_name||'?')[0].toUpperCase()}
                          </div>
                          {c.kid_name}
                        </div>
                      </td>
                      <td style={{ padding:'10px 10px', color:'var(--text2)', whiteSpace:'nowrap' }}>{pName}</td>
                      <td style={{ padding:'10px 10px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text2)', whiteSpace:'nowrap' }}>{time}</td>
                      <td style={{ padding:'10px 10px', whiteSpace:'nowrap' }}>
                        <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:15, color: remaining <= 0 ? '#ff4466' : remaining <= 2 ? 'var(--amber)' : 'var(--green2)' }}>
                          {remaining}
                        </span>
                      </td>
                      <td style={{ padding:'10px 10px', whiteSpace:'nowrap' }}>
                        {membership ? (
                          <span style={{ fontSize:11, color: PACK_INFO[membership.package_name]?.color || 'var(--text3)', fontFamily:'var(--font-display)', fontWeight:700 }}>
                            {membership.package_name}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:14, marginBottom:24 }}>
        <StatCard label="Active Players"    value={memberships.length}              sub="active memberships"      icon="⚾" />
        <StatCard label="Today's Sessions"  value={todayBookings.length}            sub="confirmed for today"     icon="📅" />
        <StatCard label="Monthly Revenue"   value={`$${monthlyRevenue.toLocaleString()}`} sub="active memberships" icon="💰" />
        <StatCard label="Expiring Soon"     value={expiringSoon}                    sub="≤ 2 sessions left"       icon="⚠️" />
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14, marginBottom:24 }}>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16 }}>Sessions by Day</div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>Total booked sessions by day</div>
            </div>
            <Badge color="green">{bookings.length} total</Badge>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sessionsByDay} margin={{ top:4, right:4, left:-10, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill:'#4a5a70', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#4a5a70', fontSize:10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CT />} />
              <Bar dataKey="sessions" fill="rgba(255,255,255,0.7)" radius={[4,4,0,0]} name="sessions" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:4 }}>Active Packages</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>Memberships by package</div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {pkgDist.map(pkg => (
              <div key={pkg.name}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:5 }}>
                  <span style={{ color:'var(--text2)', fontSize:12 }}>{pkg.name}</span>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight:700, color:pkg.color }}>{pkg.count} players</span>
                </div>
                <div style={{ height:6, background:'var(--navy4)', borderRadius:6, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:6, background:pkg.color,
                    width: memberships.length > 0 ? `${(pkg.count / memberships.length) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Today's Bookings */}
      {todayBookings.length > 0 && (
        <Card style={{ marginBottom:14 }}>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, marginBottom:16 }}>
            Today's Sessions — {new Date().toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'})}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {todayBookings
              .sort((a,b) => (a.session_time||'').localeCompare(b.session_time||''))
              .map(b => {
                const profile = profiles.find(pr => pr.id === b.parent_id)
                const pName = parentName(profile)
                const typeColor = TYPE_COLORS[b.session_type] || 'var(--green2)'
                return (
                  <div key={b.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:typeColor, flexShrink:0 }} />
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600, color:'var(--white)', minWidth:70 }}>{b.session_time}</span>
                    <span style={{ fontSize:13, fontWeight:500 }}>{b.kid_name}</span>
                    {pName && <span style={{ fontSize:12, color:'var(--muted)' }}>· {pName}</span>}
                    <span style={{ marginLeft:'auto', fontSize:11, color:typeColor, fontFamily:'var(--font-display)', fontStyle:'italic' }}>{b.session_type}</span>
                  </div>
                )
              })}
          </div>
        </Card>
      )}

      {/* Players — Sessions Remaining */}
      <Card>
        <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, marginBottom:16 }}>Players — Sessions Remaining</div>
        {playersWithMembership.length === 0 ? (
          <div style={{ textAlign:'center', padding:24, color:'var(--muted)', fontSize:13 }}>No players with active membership</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:'8px 16px' }}>
            {playersWithMembership.map(player => {
              const m = player.membership
              const remaining = (m.sessions_total || 0) - (m.sessions_used || 0)
              const initials = (player.kid_name || '?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)
              const color = remaining <= 0 ? 'var(--text3)' : remaining <= 2 ? 'var(--amber)' : 'var(--navy4)'
              const isLoading = manualCheckinLoading[player.id]
              return (
                <div key={player.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <Avatar initials={initials} size={32} color={color} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, display:'flex', justifyContent:'space-between' }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{player.kid_name}</span>
                      <span style={{ fontSize:12, flexShrink:0, marginLeft:8,
                        color: remaining <= 0 ? '#ff4466' : remaining <= 2 ? 'var(--amber)' : 'var(--green2)' }}>
                        {remaining} left
                      </span>
                    </div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4 }}>{m.package_name}</div>
                    <ProgressBar value={m.sessions_used||0} max={m.sessions_total||1}
                      color={remaining<=0?'var(--red)':remaining<=2?'var(--amber)':'var(--green)'} />
                  </div>
                  <button
                    onClick={() => handleManualCheckin(player)}
                    disabled={isLoading || remaining <= 0}
                    title="Manual check-in"
                    style={{
                      padding:'5px 10px', flexShrink:0,
                      background: remaining <= 0 ? 'rgba(255,255,255,0.03)' : 'rgba(79,168,255,0.1)',
                      border: `1px solid ${remaining <= 0 ? 'var(--border)' : 'rgba(79,168,255,0.25)'}`,
                      borderRadius:6, color: remaining <= 0 ? 'var(--text3)' : '#4fa8ff',
                      fontSize:10, fontFamily:'var(--font-display)', fontWeight:700,
                      cursor: (isLoading || remaining <= 0) ? 'not-allowed' : 'pointer',
                      letterSpacing:'0.06em', textTransform:'uppercase',
                      opacity: isLoading ? 0.5 : 1,
                    }}
                  >
                    {isLoading ? '…' : <><Check size={10} style={{ display:'inline', marginRight:3 }} />In</>}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Toast notification */}
      {toast && (
        <div className="fade-in" style={{
          position:'fixed', bottom:24, right:24, zIndex:999,
          background: toast.error ? 'var(--navy3)' : '#22C56E',
          border: toast.error ? '1px solid rgba(255,68,102,0.4)' : 'none',
          color:'#fff', borderRadius:10, padding:'12px 20px',
          fontFamily:'var(--font-display)', fontWeight:700, fontSize:14,
          display:'flex', alignItems:'center', gap:10,
          boxShadow:'0 8px 32px rgba(0,0,0,0.4)', maxWidth:340,
        }}>
          {toast.error ? (
            <span style={{ color:'#ff6b6b' }}>⚠ {toast.error}</span>
          ) : (
            <><Check size={16} /> {toast.kidName} registró entrada — {toast.remaining} sesiones restantes</>
          )}
        </div>
      )}
    </div>
  )
}
