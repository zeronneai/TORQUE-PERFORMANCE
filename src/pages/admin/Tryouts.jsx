import React, { useState, useEffect, useMemo } from 'react'
import { Search, Download, MessageCircle, Mail } from 'lucide-react'
import { Card, StatCard, Pill, PageHeader } from '../../components/UI'
import { supabase } from '../../supabaseClient'
import { VIBRANT } from '../../hooks/useAdminData'

// The three tryout slots, in chronological order. Each row's time_slot / age_group
// is derived server-side (api/create-lead.js, type:'tryout'), so these match exactly.
const SLOTS = [
  { time: '9:00 AM',  group: '9U',      sub: 'Ages 9 & under', color: VIBRANT.blue },
  { time: '11:00 AM', group: '11U',     sub: 'Ages 10–11',     color: VIBRANT.green },
  { time: '1:00 PM',  group: '12U/13U', sub: 'Ages 12–13',     color: VIBRANT.amber },
]
const SLOT_COLOR = { '9:00 AM': '#118AB2', '11:00 AM': '#06D6A0', '1:00 PM': '#FFB703' }

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function Tryouts() {
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  async function load() {
    const { data } = await supabase.from('tryout_registrations').select('*').order('created_at', { ascending: false })
    setRegs(data || [])
    setLoading(false)
  }
  useEffect(() => { load().catch(() => setLoading(false)) }, [])

  function contactHref(r, kind) {
    const msg = `Hi ${r.parent_name || 'there'}! Thanks for registering ${r.player_name || 'your player'} for the Torque Youth tryout on Sat Oct 10 at Del Valle HS — your ${r.age_group || ''} group is at ${r.time_slot || ''}. See you there! 💪`
    if (kind === 'wa') {
      const digits = (r.parent_phone || '').replace(/\D/g, '')
      return digits.length >= 10 ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : null
    }
    return r.parent_email ? `mailto:${r.parent_email}?subject=${encodeURIComponent('Torque Youth tryout — Sat Oct 10')}&body=${encodeURIComponent(msg)}` : null
  }

  // Count per slot (over ALL registrations, not the search-filtered view).
  const counts = useMemo(() => {
    const c = {}
    SLOTS.forEach(s => { c[s.time] = 0 })
    regs.forEach(r => { if (c[r.time_slot] != null) c[r.time_slot]++ })
    return c
  }, [regs])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return regs
    return regs.filter(r =>
      [r.player_name, r.parent_name, r.parent_phone, r.parent_email, r.position, r.current_team, r.age_group]
        .some(v => (v || '').toLowerCase().includes(q))
    )
  }, [regs, search])

  function handleExportCsv() {
    setExporting(true)
    try {
      const headers = ['created_at', 'time_slot', 'age_group', 'player_name', 'player_age', 'parent_name', 'parent_phone', 'parent_email', 'position', 'current_team', 'notes', 'status']
      // Export in slot order, then by registration time within a slot.
      const ordered = SLOTS.flatMap(s =>
        filtered.filter(r => r.time_slot === s.time)
      ).concat(filtered.filter(r => !SLOTS.some(s => s.time === r.time_slot)))
      const lines = ordered.map(r => [
        r.created_at ? new Date(r.created_at).toISOString() : '',
        r.time_slot, r.age_group, r.player_name, r.player_age,
        r.parent_name, r.parent_phone, r.parent_email, r.position, r.current_team, r.notes, r.status,
      ].map(csvEscape).join(','))
      const csv = '﻿' + headers.join(',') + '\n' + lines.join('\n') + '\n'
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const d = new Date()
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const a = document.createElement('a')
      a.href = url; a.download = `torque-tryouts-${stamp}.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[Tryouts] export failed:', err); alert('Export failed: ' + (err?.message || err))
    } finally { setExporting(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--muted)' }}>Loading tryouts…</div>
    </div>
  )

  const fmtDate = (s) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Youth Club" title="Tryouts" subtitle="Free Torque Youth tryout — Sat Oct 10, Del Valle HS. Registrations grouped by time slot." />

      {/* Per-slot counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        {SLOTS.map(s => (
          <StatCard key={s.time} label={`${s.time} · ${s.group}`} value={counts[s.time] || 0} sub={s.sub} icon="⚾" block={s.color} />
        ))}
        <StatCard label="Total" value={regs.length} sub="all registrations" icon="📋" block={VIBRANT.purple} />
      </div>

      {/* Search + export */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by player, parent, phone, email, position or team..." style={{ paddingLeft: 40, width: '100%' }} />
        </div>
        <button onClick={handleExportCsv} disabled={exporting || filtered.length === 0} title="Export the currently shown registrations to CSV"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 42, background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: (exporting || filtered.length === 0) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0, opacity: (exporting || filtered.length === 0) ? 0.6 : 1 }}>
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {regs.length === 0 ? (
        <Card style={{ padding: 0 }}>
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚾</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic' }}>No tryout registrations yet</div>
          </div>
        </Card>
      ) : (
        // One section per time slot, in chronological order.
        SLOTS.map(s => {
          const rows = filtered.filter(r => r.time_slot === s.time)
          const sc = SLOT_COLOR[s.time] || '#5A6B84'
          return (
            <div key={s.time} style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 900, fontSize: 20, color: 'var(--text)' }}>{s.time}</span>
                <Pill color={sc}>{s.group}</Pill>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{s.sub}</span>
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: sc }}>{rows.length} {rows.length === 1 ? 'player' : 'players'}</span>
              </div>

              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {rows.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 28, color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>
                    {search.trim() ? 'No matches for your search in this slot' : 'No registrations for this slot yet'}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          {['Player', 'Parent', 'Position', 'Current Team', 'Registered', ''].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text3)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => {
                          const wa = contactHref(r, 'wa')
                          const em = contactHref(r, 'email')
                          return (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ fontWeight: 600 }}>{r.player_name || '—'}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                  {r.player_age != null ? `${r.player_age} yrs` : '—'}{r.age_group ? ` · ${r.age_group}` : ''}
                                </div>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ fontWeight: 600 }}>{r.parent_name || '—'}</div>
                                {r.parent_phone && <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.parent_phone}</div>}
                                {r.parent_email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.parent_email}</div>}
                              </td>
                              <td style={{ padding: '12px 14px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{r.position || '—'}</td>
                              <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.current_team || '—'}</td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><span className="num" style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(r.created_at)}</span></td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                                    style={{ display: 'inline-flex', padding: 7, borderRadius: 8, background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: '1px solid rgba(6,214,160,0.4)' }}><MessageCircle size={14} /></a>}
                                  {em && <a href={em} title="Email"
                                    style={{ display: 'inline-flex', padding: 7, borderRadius: 8, background: 'rgba(17,138,178,0.12)', color: '#118AB2', border: '1px solid rgba(17,138,178,0.4)' }}><Mail size={14} /></a>}
                                </div>
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
        })
      )}
    </div>
  )
}
