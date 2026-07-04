import React, { useState, useEffect, useMemo } from 'react'
import { Activity, MessageCircle } from 'lucide-react'
import { Card, StatCard, Pill, Avatar, PageHeader } from '../../components/UI'
import { supabase } from '../../supabaseClient'
import {
  useAdminData, parentName, pkgColor, VIBRANT,
  HEALTH, healthBucket, playerKey,
} from '../../hooks/useAdminData'

// Only look back this far for "days since last visit"; anything older is churn anyway.
const WINDOW_DAYS = 60

export default function TorquePulse() {
  const { memberships, profiles, loading } = useAdminData()
  const [lastVisitByKey, setLastVisitByKey] = useState(null) // Map playerKey -> Date | null
  const [filter, setFilter] = useState('all') // all | at_risk | churn

  // Real data: most recent check-in per player (last WINDOW_DAYS from checkins table).
  useEffect(() => {
    const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
    supabase
      .from('checkins')
      .select('parent_id, kid_name, checked_in_at')
      .gte('checked_in_at', since)
      .then(({ data, error }) => {
        const map = new Map()
        if (!error) {
          for (const c of (data || [])) {
            const k = playerKey(c.parent_id, c.kid_name)
            const t = new Date(c.checked_in_at)
            if (!map.has(k) || t > map.get(k)) map.set(k, t)
          }
        }
        setLastVisitByKey(map)
      })
  }, [])

  // Build one row per active member (active membership), with health from last visit.
  const rows = useMemo(() => {
    if (!lastVisitByKey) return null
    const now = Date.now()
    return memberships.map(m => {
      const profile = profiles.find(pr => pr.id === m.parent_id) || null
      const last = lastVisitByKey.get(playerKey(m.parent_id, m.kid_name)) || null
      const daysSince = last ? Math.floor((now - last.getTime()) / 86400000) : null
      const bucket = healthBucket(daysSince)
      return {
        id: m.id,
        kidName: m.kid_name,
        parent: parentName(profile) || '—',
        phone: profile?.phone || '',
        email: profile?.email || '',
        pkg: m.package_name,
        daysSince,
        bucket,
      }
    }).sort((a, b) => {
      // Most urgent first: churn → at_risk → healthy; within a bucket, longer gap first.
      if (HEALTH[a.bucket].rank !== HEALTH[b.bucket].rank) return HEALTH[a.bucket].rank - HEALTH[b.bucket].rank
      const da = a.daysSince == null ? Infinity : a.daysSince
      const db = b.daysSince == null ? Infinity : b.daysSince
      return db - da
    })
  }, [memberships, profiles, lastVisitByKey])

  const counts = useMemo(() => {
    const c = { healthy: 0, at_risk: 0, churn: 0 }
    ;(rows || []).forEach(r => { c[r.bucket]++ })
    return c
  }, [rows])

  const filtered = useMemo(() => {
    if (!rows) return []
    if (filter === 'all') return rows
    return rows.filter(r => r.bucket === filter)
  }, [rows, filter])

  // Contact the parent — WhatsApp if we have a phone, else email. Friendly prefilled note.
  function contactHref(r) {
    const msg = `Hi ${r.parent}! We've missed ${r.kidName} at Torque Performance — ready to book the next training session? 💪`
    const digits = (r.phone || '').replace(/\D/g, '')
    if (digits.length >= 10) return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
    if (r.email) return `mailto:${r.email}?subject=${encodeURIComponent('We miss you at Torque!')}&body=${encodeURIComponent(msg)}`
    return null
  }

  if (loading || rows === null) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:18, color:'var(--muted)' }}>Loading Pulse…</div>
    </div>
  )

  const FILTERS = [
    { id:'all',     label:`All (${rows.length})` },
    { id:'at_risk', label:`At Risk (${counts.at_risk})` },
    { id:'churn',   label:`Churn Risk (${counts.churn})` },
  ]

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Retention" title="Torque Pulse"
        subtitle="Member attendance health — who's active, who's slipping, who to win back" />

      {/* KPI blocks */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'var(--space-4)', marginBottom:'var(--space-8)' }}>
        <StatCard label="Healthy"     value={counts.healthy}  sub="visited ≤ 7 days"   icon="💚" block={VIBRANT.green} />
        <StatCard label="At Risk"     value={counts.at_risk}  sub="8–14 days ago"      icon="⚠️" block={VIBRANT.amber} />
        <StatCard label="Churn Risk"  value={counts.churn}    sub="15+ days / no visits" icon="🚨" block={VIBRANT.red} />
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:8, marginBottom:'var(--space-4)', flexWrap:'wrap' }}>
        {FILTERS.map(f => {
          const isActive = filter === f.id
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{
                display:'flex', alignItems:'center', gap:8, padding:'8px 16px', height:38,
                background: isActive ? 'rgba(79,168,255,0.12)' : 'transparent',
                border: `1px solid ${isActive ? '#4fa8ff' : 'var(--border2)'}`,
                borderRadius:8, color: isActive ? '#4fa8ff' : 'var(--text2)',
                fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap',
              }}>
              {f.label}
            </button>
          )
        })}
      </div>

      <Card style={{ padding:0, overflow:'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--muted)' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontStyle:'italic' }}>
              {rows.length === 0 ? 'No active members yet' : 'Nobody in this bucket — nice.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
            <table style={{ width:'100%', minWidth:640, borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr>
                  {['Health','Player','Parent','Package','Last visit',''].map(h => (
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', color:'var(--text3)', fontFamily:'var(--font-display)', fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', borderBottom:'1px solid var(--border)', fontWeight:700, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const hc = HEALTH[r.bucket].color
                  const pColor = pkgColor(r.pkg)
                  const initials = (r.kidName||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)
                  const href = contactHref(r)
                  const showContact = r.bucket !== 'healthy'
                  const lastLabel = r.daysSince == null ? 'No recent visits'
                    : r.daysSince === 0 ? 'Today'
                    : r.daysSince === 1 ? 'Yesterday'
                    : `${r.daysSince} days ago`
                  return (
                    <tr key={r.id} style={{ borderBottom:'1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(13,27,42,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:7 }}>
                          <span style={{ width:10, height:10, borderRadius:'50%', background:hc, boxShadow:`0 0 0 3px ${hc}22`, flexShrink:0 }} />
                          <span style={{ color:hc, fontWeight:700, fontFamily:'var(--font-display)', fontSize:11, letterSpacing:'0.04em', textTransform:'uppercase' }}>{HEALTH[r.bucket].label}</span>
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <Avatar initials={initials} size={28} color={pColor} />
                          <span style={{ fontWeight:600 }}>{r.kidName}</span>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px', color:'var(--text2)', fontSize:12 }}>{r.parent}</td>
                      <td style={{ padding:'12px 16px' }}>{r.pkg ? <Pill color={pColor}>{r.pkg}</Pill> : '—'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span className="num" style={{ color: r.bucket==='healthy' ? 'var(--text)' : hc, fontSize:13 }}>{lastLabel}</span>
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'right' }}>
                        {showContact && href && (
                          <a href={href} target="_blank" rel="noopener noreferrer"
                            style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8,
                              background:`${hc}1f`, color:hc, border:`1px solid ${hc}55`,
                              fontFamily:'var(--font-display)', fontWeight:700, fontSize:12, letterSpacing:'0.04em', textTransform:'uppercase', textDecoration:'none', whiteSpace:'nowrap' }}>
                            <MessageCircle size={13} /> Contact
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
