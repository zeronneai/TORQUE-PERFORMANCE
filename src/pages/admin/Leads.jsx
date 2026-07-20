import React, { useState, useEffect, useMemo } from 'react'
import { Search, Download, MessageCircle, Mail } from 'lucide-react'
import { Card, StatCard, Pill, PageHeader } from '../../components/UI'
import { supabase } from '../../supabaseClient'
import { VIBRANT } from '../../hooks/useAdminData'

const STATUS_ORDER = ['new', 'contacted', 'converted', 'lost']
const STATUS_COLOR = { new: '#118AB2', contacted: '#FFB703', converted: '#06D6A0', lost: '#E63946' }
const STATUS_LABEL = { new: 'New', contacted: 'Contacted', converted: 'Converted', lost: 'Lost' }
const SOURCE_COLOR = { 'main-landing-trial': '#118AB2', 'tournament-landing': '#7C3AED' }
const sourceColor = (s) => SOURCE_COLOR[s] || '#5A6B84'

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [noteDraft, setNoteDraft] = useState({})   // id -> text being edited
  const [savingId, setSavingId] = useState(null)
  const [exporting, setExporting] = useState(false)

  async function load() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }
  useEffect(() => { load().catch(() => setLoading(false)) }, [])

  async function updateStatus(lead, status) {
    const prev = lead.status
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status } : l))  // optimistic
    const { error } = await supabase.from('leads').update({ status }).eq('id', lead.id)
    if (error) { setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: prev } : l)); alert('Could not update status: ' + error.message) }
  }

  async function saveNote(lead) {
    const text = noteDraft[lead.id]
    if (text === undefined || text === (lead.notes || '')) return
    setSavingId(lead.id)
    const { error } = await supabase.from('leads').update({ notes: text }).eq('id', lead.id)
    setSavingId(null)
    if (error) { alert('Could not save note: ' + error.message); return }
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, notes: text } : l))
  }

  function contactHref(lead, kind) {
    const msg = `Hi ${lead.parent_name || 'there'}! Thanks for your interest in Torque Performance — let's get ${lead.player_name || 'your player'} booked for a trial session. 💪`
    if (kind === 'wa') {
      const digits = (lead.phone || '').replace(/\D/g, '')
      return digits.length >= 10 ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : null
    }
    return lead.email ? `mailto:${lead.email}?subject=${encodeURIComponent('Torque Performance — free trial')}&body=${encodeURIComponent(msg)}` : null
  }

  const counts = useMemo(() => {
    const c = { new: 0, contacted: 0, converted: 0, lost: 0 }
    leads.forEach(l => { if (c[l.status] != null) c[l.status]++ })
    return c
  }, [leads])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads
      .filter(l => filter === 'all' || l.status === filter)
      .filter(l => {
        if (!q) return true
        return [l.parent_name, l.player_name, l.phone, l.email].some(v => (v || '').toLowerCase().includes(q))
      })
  }, [leads, filter, search])

  function handleExportCsv() {
    setExporting(true)
    try {
      const headers = ['created_at', 'parent_name', 'phone', 'email', 'player_name', 'player_age', 'preferred_day', 'source', 'status', 'notes']
      const lines = filtered.map(l => [
        l.created_at ? new Date(l.created_at).toISOString() : '',
        l.parent_name, l.phone, l.email, l.player_name, l.player_age, l.preferred_day,
        l.source, STATUS_LABEL[l.status] || l.status, l.notes,
      ].map(csvEscape).join(','))
      const csv = '\uFEFF' + headers.join(',') + '\n' + lines.join('\n') + '\n'
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const d = new Date()
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const a = document.createElement('a')
      a.href = url; a.download = `torque-leads-${stamp}.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[Leads] export failed:', err); alert('Export failed: ' + (err?.message || err))
    } finally { setExporting(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--muted)' }}>Loading leads…</div>
    </div>
  )

  const FILTERS = [
    { id: 'all', label: `All (${leads.length})` },
    { id: 'new', label: `New (${counts.new})` },
    { id: 'contacted', label: `Contacted (${counts.contacted})` },
    { id: 'converted', label: `Converted (${counts.converted})` },
    { id: 'lost', label: `Lost (${counts.lost})` },
  ]

  const fmtDate = (s) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Pipeline" title="Leads" subtitle="Trial-form leads from the landing pages — contact, convert, track" />

      {/* KPI blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <StatCard label="New"       value={counts.new}       sub="not yet contacted" icon="✨" block={VIBRANT.blue} />
        <StatCard label="Contacted" value={counts.contacted} sub="in progress"       icon="📞" block={VIBRANT.amber} />
        <StatCard label="Converted" value={counts.converted} sub="became members"    icon="✅" block={VIBRANT.green} />
        <StatCard label="Lost"      value={counts.lost}      sub="didn't convert"    icon="🚫" block={VIBRANT.red} />
      </div>

      {/* Search + export */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by parent, player, phone or email..." style={{ paddingLeft: 40, width: '100%' }} />
        </div>
        <button onClick={handleExportCsv} disabled={exporting || filtered.length === 0} title="Export the currently filtered leads to CSV"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 42, background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: (exporting || filtered.length === 0) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0, opacity: (exporting || filtered.length === 0) ? 0.6 : 1 }}>
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const active = filter === f.id
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ padding: '8px 16px', height: 38, background: active ? 'rgba(79,168,255,0.12)' : 'transparent', border: `1px solid ${active ? '#4fa8ff' : 'var(--border2)'}`, borderRadius: 8, color: active ? '#4fa8ff' : 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {f.label}
            </button>
          )
        })}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📨</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic' }}>
              {leads.length === 0 ? 'No leads yet' : search.trim() ? 'No matches for your search' : 'No leads in this status'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Date', 'Parent', 'Player', 'Preferred', 'Source', 'Status', 'Notes', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text3)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const sc = STATUS_COLOR[l.status] || '#5A6B84'
                  const wa = contactHref(l, 'wa')
                  const em = contactHref(l, 'email')
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><span className="num" style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(l.created_at)}</span></td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{l.parent_name || '—'}</div>
                        {l.phone && <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{l.phone}</div>}
                        {l.email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l.email}</div>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div>{l.player_name || '—'}</div>
                        {l.player_age && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l.player_age} yrs</div>}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{l.preferred_day || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>{l.source ? <Pill color={sourceColor(l.source)}>{l.source.replace(/-/g, ' ')}</Pill> : '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <select value={l.status} onChange={e => updateStatus(l, e.target.value)}
                          style={{ margin: 0, width: 'auto', minWidth: 120, padding: '6px 10px', fontSize: 12, fontWeight: 700, color: sc, border: `1px solid ${sc}55`, background: `${sc}14`, borderRadius: 8, fontFamily: 'var(--font-display)', cursor: 'pointer' }}>
                          {STATUS_ORDER.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 14px', minWidth: 180 }}>
                        <textarea
                          value={noteDraft[l.id] !== undefined ? noteDraft[l.id] : (l.notes || '')}
                          onChange={e => setNoteDraft(d => ({ ...d, [l.id]: e.target.value }))}
                          onBlur={() => saveNote(l)}
                          placeholder="Add a note…"
                          style={{ width: '100%', minHeight: 40, fontSize: 12, padding: '8px 10px', resize: 'vertical' }} />
                        {savingId === l.id && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Saving…</div>}
                      </td>
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
}
