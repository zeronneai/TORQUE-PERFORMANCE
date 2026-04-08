import React, { useState, useMemo, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Card, Badge, Avatar, PageHeader, Btn, Modal, Label, StatCard, ProgressBar } from '../../components/UI'
import { supabase } from '../../supabaseClient'
import { useAdminData, normDate, PACK_INFO, TYPE_COLORS, parentName } from '../../hooks/useAdminData'

// ── SCHEDULE PAGE ─────────────────────────────────────────────────────────────
export function Schedule() {
  const { bookings, profiles, loading } = useAdminData()
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  // Enriquecer bookings con profile del padre
  const enriched = useMemo(() => bookings.map(b => ({
    ...b,
    profile: profiles.find(pr => pr.id === b.parent_id) || null,
  })), [bookings, profiles])

  // Próximas sesiones ordenadas
  const upcoming = useMemo(() =>
    enriched
      .filter(b => normDate(b.session_date) >= today)
      .sort((a, b) => {
        const dd = normDate(a.session_date).localeCompare(normDate(b.session_date))
        return dd !== 0 ? dd : (a.session_time||'').localeCompare(b.session_time||'')
      })
  , [enriched, today])

  // Mapa fecha → bookings
  const bookingsByDate = useMemo(() => {
    const map = {}
    enriched.forEach(b => {
      const key = normDate(b.session_date)
      if (!key) return
      if (!map[key]) map[key] = []
      map[key].push(b)
    })
    return map
  }, [enriched])

  // Calendário
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:18, color:'var(--muted)' }}>Cargando...</div>
    </div>
  )

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Academy" title="Schedule" subtitle="Todas las sesiones agendadas" />

      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:20, alignItems:'start' }}>

        {/* ── CALENDARIO ── */}
        <div style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
          {/* Nav mes */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <button onClick={() => { setViewDate(new Date(year,month-1,1)); setSelectedDay(null) }}
              style={{ background:'var(--navy4)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, fontWeight:700 }}>‹</button>
            <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:20, letterSpacing:'0.06em', color:'var(--white)', textTransform:'uppercase' }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <button onClick={() => { setViewDate(new Date(year,month+1,1)); setSelectedDay(null) }}
              style={{ background:'var(--navy4)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, fontWeight:700 }}>›</button>
          </div>

          {/* Headers días */}
          <div className="cal-grid" style={{ marginBottom:6 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign:'center', fontFamily:'var(--font-display)', fontSize:11, fontWeight:700, color:'var(--muted2)', letterSpacing:'0.08em', padding:'4px 0', textTransform:'uppercase' }}>{d}</div>
            ))}
          </div>

          {/* Grid días */}
          <div className="cal-grid" style={{ gap:4 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const iso    = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayBks = bookingsByDate[iso] || []
              const hasB   = dayBks.length > 0
              const isToday    = iso === today
              const isSelected = iso === selectedDay
              return (
                <div key={iso}
                  onClick={() => hasB && setSelectedDay(isSelected ? null : iso)}
                  style={{
                    aspectRatio:'1', display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center', borderRadius:8,
                    cursor: hasB ? 'pointer' : 'default', transition:'all 0.15s',
                    overflow:'hidden', minWidth:0,
                    background: isSelected ? 'rgba(34,197,110,0.18)' : hasB ? 'rgba(34,197,110,0.09)' : isToday ? 'rgba(255,255,255,0.07)' : 'transparent',
                    border: isSelected ? '1.5px solid rgba(34,197,110,0.5)' : hasB ? '1px solid rgba(34,197,110,0.2)' : isToday ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                  }}>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight: hasB||isToday ? 800 : 500, fontSize:13, lineHeight:1,
                    color: isSelected ? 'var(--green2)' : hasB ? 'var(--green2)' : isToday ? 'var(--white)' : 'var(--text2)' }}>
                    {day}
                  </span>
                  {hasB && (
                    <div style={{ display:'flex', gap:2, marginTop:2, flexWrap:'nowrap', justifyContent:'center', overflow:'hidden' }}>
                      {dayBks.slice(0,3).map((b,bi) => (
                        <div key={bi} style={{ width:4, height:4, borderRadius:'50%', flexShrink:0, background: TYPE_COLORS[b.session_type] || 'var(--green2)' }} />
                      ))}
                    </div>
                  )}
                  {hasB && dayBks.length > 3 && (
                    <span style={{ fontSize:8, color:'var(--green2)', fontFamily:'var(--font-display)', fontWeight:700, marginTop:1, lineHeight:1 }}>
                      +{dayBks.length - 3}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Panel día seleccionado */}
          {selectedDay && bookingsByDate[selectedDay] && (
            <div style={{ marginTop:16, padding:'14px 16px', background:'rgba(34,197,110,0.06)', border:'1px solid rgba(34,197,110,0.2)', borderRadius:10 }}>
              <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:13, color:'var(--green2)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10 }}>
                {new Date(selectedDay+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}
                {' — '}{bookingsByDate[selectedDay].length} sesiones
              </div>
              {bookingsByDate[selectedDay]
                .sort((a,b) => (a.session_time||'').localeCompare(b.session_time||''))
                .map((b,i) => {
                  const pName = parentName(b.profile)
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop: i>0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background: TYPE_COLORS[b.session_type]||'var(--green2)', flexShrink:0 }} />
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--offwhite)', fontWeight:600, minWidth:65 }}>{b.session_time}</span>
                      <span style={{ fontSize:12, color:'var(--white)', fontWeight:500 }}>{b.kid_name}</span>
                      {pName && <span style={{ fontSize:11, color:'var(--muted)' }}>· {pName}</span>}
                      <span style={{ marginLeft:'auto', fontSize:11, color: TYPE_COLORS[b.session_type]||'var(--green2)', fontFamily:'var(--font-display)', fontStyle:'italic', textAlign:'right' }}>{b.session_type}</span>
                    </div>
                  )
                })}
            </div>
          )}

          {/* Leyenda */}
          <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:12 }}>
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'var(--muted)' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:color }} />
                {type}
              </div>
            ))}
          </div>
        </div>

        {/* ── LISTA PRÓXIMAS ── */}
        <div style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:16, color:'var(--white)', marginBottom:16, letterSpacing:'0.04em' }}>PRÓXIMAS SESIONES</div>
          {upcoming.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted)', fontSize:13, lineHeight:1.7 }}>No hay sesiones agendadas.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {upcoming.slice(0,20).map(b => {
                const iso = normDate(b.session_date)
                const typeColor = TYPE_COLORS[b.session_type] || 'var(--green2)'
                const pName = parentName(b.profile)
                return (
                  <div key={b.id}
                    onClick={() => { setSelectedDay(iso); setViewDate(new Date(iso+'T12:00:00')) }}
                    style={{ padding:'12px 14px', background:'rgba(255,255,255,0.03)', border:`1px solid ${iso===selectedDay?'rgba(34,197,110,0.3)':'var(--border)'}`, borderRadius:10, cursor:'pointer', transition:'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:13, color:'var(--white)' }}>
                        {new Date(iso+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',month:'short',day:'numeric'})}
                      </div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:typeColor, fontWeight:600 }}>{b.session_time}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                      <div style={{ width:5, height:5, borderRadius:'50%', background:typeColor }} />
                      <span style={{ fontSize:12, fontWeight:500, color:'var(--offwhite)' }}>{b.kid_name}</span>
                      {pName && <span style={{ fontSize:11, color:'var(--muted)' }}>· {pName}</span>}
                      <span style={{ marginLeft:'auto', fontSize:11, color:'var(--muted)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>{b.session_type}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PAYMENTS PAGE ─────────────────────────────────────────────────────────────
export function Payments() {
  const { memberships, profiles, loading } = useAdminData()

  const totalRevenue = useMemo(() =>
    memberships.reduce((sum, m) => sum + (PACK_INFO[m.package_name]?.price || 0), 0)
  , [memberships])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:18, color:'var(--muted)' }}>Cargando...</div>
    </div>
  )

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Finance" title="Payments" subtitle="Resumen de facturación y membresías activas" />

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        <StatCard label="Ingresos del Mes"   value={`$${totalRevenue.toLocaleString()}`}  sub="membresías activas" icon="💰" />
        <StatCard label="Membresías Activas" value={memberships.length}                   sub="jugadores activos"  icon="✅" />
        <StatCard label="Paquete A"          value={memberships.filter(m=>m.package_name==='PAQUETE A').length}   sub={`$260/mes`} icon="⚾" />
        <StatCard label="Paquete MLB"        value={memberships.filter(m=>m.package_name==='PAQUETE MLB').length} sub={`$600/mes`} icon="🏆" />
      </div>

      <Card style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-display)', fontSize:16, fontWeight:800 }}>
          Resumen de Membresías Activas
        </div>

        {memberships.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>💳</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontStyle:'italic' }}>No hay membresías activas</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                {['Jugador','Padre/Madre','Paquete','Sesiones','Restantes','Precio'].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', color:'var(--text3)', fontFamily:'var(--font-display)', fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', borderBottom:'1px solid var(--border)', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberships.map(m => {
                const profile = profiles.find(pr => pr.id === m.parent_id)
                const pName = parentName(profile) || `ID: ${(m.parent_id||'').slice(0,8)}…`
                const remaining = (m.sessions_total||0) - (m.sessions_used||0)
                const pkgColor = PACK_INFO[m.package_name]?.color || 'var(--muted)'
                const initials = (m.kid_name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)
                return (
                  <tr key={m.id}
                    style={{ borderBottom:'1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar initials={initials} size={28} color={pkgColor} />
                        <span style={{ fontWeight:500 }}>{m.kid_name}</span>
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px', color:'var(--text2)', fontSize:12 }}>{pName}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ fontFamily:'var(--font-display)', fontWeight:700, color:pkgColor }}>{m.package_name || '—'}</span>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <span style={{ fontSize:12, color:'var(--muted)' }}>{m.sessions_used||0}/{m.sessions_total||0} usadas</span>
                        <ProgressBar value={m.sessions_used||0} max={m.sessions_total||1}
                          color={remaining<=0?'var(--red)':remaining<=2?'var(--amber)':'var(--green)'} height={4} />
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <Badge color={remaining<=0?'red':remaining<=2?'amber':'green'}>{remaining} restantes</Badge>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ fontFamily:'var(--font-display)', fontWeight:700, color:'var(--green2)', fontSize:15 }}>
                        ${PACK_INFO[m.package_name]?.price?.toLocaleString() || '—'}
                      </span>
                      <span style={{ fontSize:11, color:'var(--muted)', marginLeft:4 }}>/mes</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ── EVENTS PAGE (lee/escribe en Supabase) ─────────────────────────────────────
export function Events() {
  const [events, setEvents] = useState([])
  const [loadingEvts, setLoadingEvts] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title:'', date:'', time:'', location:'', description:'', type:'clinic', spots:20, image:'⚾' })

  const typeColor = { showcase:'red', camp:'gold', clinic:'blue', social:'green' }

  useEffect(() => {
    supabase.from('events').select('*').order('date', { ascending: true })
      .then(({ data }) => { setEvents(data || []); setLoadingEvts(false) })
      .catch(() => setLoadingEvts(false))
  }, [])

  const handleAdd = async () => {
    if (!form.title || !form.date) return
    setSaving(true)
    const { data, error } = await supabase.from('events').insert([{
      title: form.title, date: form.date, time: form.time,
      location: form.location, description: form.description,
      type: form.type, spots: form.spots, registered: 0, image: form.image,
    }]).select().single()
    setSaving(false)
    if (!error && data) {
      setEvents(prev => [...prev, data])
      setShowAdd(false)
      setForm({ title:'', date:'', time:'', location:'', description:'', type:'clinic', spots:20, image:'⚾' })
    }
  }

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Academy" title="Events" subtitle="Showcases, camps y clínicas · visibles para los padres"
        action={<Btn onClick={() => setShowAdd(true)}><Plus size={14} /> New Event</Btn>} />

      {loadingEvts ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>Cargando eventos...</div>
      ) : events.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--muted)' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📅</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontStyle:'italic' }}>No hay eventos. Crea el primero.</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16 }}>
          {events.map(ev => {
            const pct = ((ev.registered||0) / (ev.spots||1)) * 100
            const spotsLeft = (ev.spots||0) - (ev.registered||0)
            return (
              <Card key={ev.id} highlight={ev.type === 'showcase'}>
                <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                  <div style={{ fontSize:36, flexShrink:0, lineHeight:1 }}>{ev.image || '⚾'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:800, lineHeight:1.2 }}>{ev.title}</div>
                      <Badge color={typeColor[ev.type] || 'default'}>{ev.type}</Badge>
                    </div>
                    <div style={{ fontSize:13, color:'var(--accent)', fontFamily:'var(--font-display)', fontWeight:700, marginBottom:4 }}>{ev.date}{ev.time ? ` · ${ev.time}` : ''}</div>
                    {ev.location && <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10 }}>📍 {ev.location}</div>}
                    {ev.description && <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6, marginBottom:14 }}>{ev.description}</p>}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
                      <span style={{ color:'var(--text3)' }}>{ev.registered||0} registrados</span>
                      <span style={{ color: spotsLeft<=5?'var(--amber)':'var(--green2)', fontWeight:600 }}>{spotsLeft} lugares disponibles</span>
                    </div>
                    <ProgressBar value={ev.registered||0} max={ev.spots||1} color={pct>=90?'var(--red)':pct>=60?'var(--amber)':'var(--green)'} />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Create New Event">
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div><Label>Título *</Label><input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} placeholder="Spring Showcase 2026" /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><Label>Fecha *</Label><input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} /></div>
            <div><Label>Hora</Label><input type="time" value={form.time} onChange={e => setForm(p=>({...p,time:e.target.value}))} /></div>
            <div><Label>Tipo</Label>
              <select value={form.type} onChange={e => setForm(p=>({...p,type:e.target.value}))}>
                {['showcase','camp','clinic','social'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>Cupo máximo</Label><input type="number" value={form.spots} onChange={e => setForm(p=>({...p,spots:+e.target.value}))} /></div>
          </div>
          <div><Label>Lugar</Label><input value={form.location} onChange={e => setForm(p=>({...p,location:e.target.value}))} placeholder="Torque Performance Field" /></div>
          <div><Label>Emoji / Imagen</Label><input value={form.image} onChange={e => setForm(p=>({...p,image:e.target.value}))} placeholder="⚾" style={{ maxWidth:80 }} /></div>
          <div><Label>Descripción</Label><textarea value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} style={{ minHeight:80 }} /></div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Btn>
            <Btn onClick={handleAdd} disabled={saving}><Plus size={14} /> {saving ? 'Guardando…' : 'Crear Evento'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
