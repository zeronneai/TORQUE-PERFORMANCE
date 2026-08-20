import React, { useState, useEffect, useMemo } from 'react'
import { Search, Download, RefreshCw } from 'lucide-react'
import { Card, StatCard, Pill, PageHeader } from '../../components/UI'
import { supabase } from '../../supabaseClient'
import { VIBRANT } from '../../hooks/useAdminData'

const STATUS_COLOR = { paid: '#06D6A0', pending: '#FFB703', expired: '#5A6B84', refunded: '#E63946' }
const STATUS_LABEL = { paid: 'Paid', pending: 'Pending', expired: 'Expired', refunded: 'Refunded' }

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Admin view of paid promo-event registrations (e.g. the Labor Day camp).
// Separate from the free Events calendar. Shows the active event with a live
// X / capacity counter, the registrant list, and CSV export.
export default function Promos() {
  const [event, setEvent] = useState(null)
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('paid')   // default to actual (paid) registrations
  const [exporting, setExporting] = useState(false)

  async function load() {
    // The single active promo (partial-unique index guarantees at most one).
    const { data: ev } = await supabase.from('promo_events').select('*').eq('active', true).maybeSingle()
    setEvent(ev || null)
    if (ev) {
      const { data: rows } = await supabase
        .from('promo_registrations').select('*')
        .eq('promo_event_id', ev.id)
        .order('created_at', { ascending: false })
      setRegs(rows || [])
    } else {
      setRegs([])
    }
    setLoading(false)
  }
  useEffect(() => { load().catch(() => setLoading(false)) }, [])

  const counts = useMemo(() => {
    const c = { paid: 0, pending: 0, expired: 0, refunded: 0 }
    const now = Date.now()
    regs.forEach(r => {
      // Only count pending rows that still hold a spot.
      if (r.status === 'pending' && !(r.reserved_until && Date.parse(r.reserved_until) > now)) return
      if (c[r.status] != null) c[r.status]++
    })
    return c
  }, [regs])

  const capacity  = event?.capacity ?? 0
  const taken     = counts.paid + counts.pending           // held spots
  const remaining = Math.max(0, capacity - taken)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return regs
      .filter(r => filter === 'all' || r.status === filter)
      .filter(r => {
        if (!q) return true
        return [r.parent_name, r.player_name, r.phone, r.email].some(v => (v || '').toLowerCase().includes(q))
      })
  }, [regs, filter, search])

  function handleExportCsv() {
    setExporting(true)
    try {
      const headers = ['created_at', 'paid_at', 'parent_name', 'player_name', 'player_age', 'email', 'phone', 'status', 'amount_cents', 'stripe_payment_id']
      const lines = filtered.map(r => [
        r.created_at ? new Date(r.created_at).toISOString() : '',
        r.paid_at ? new Date(r.paid_at).toISOString() : '',
        r.parent_name, r.player_name, r.player_age, r.email, r.phone,
        STATUS_LABEL[r.status] || r.status, r.amount_cents, r.stripe_payment_id,
      ].map(csvEscape).join(','))
      const csv = '﻿' + headers.join(',') + '\n' + lines.join('\n') + '\n'
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const d = new Date()
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const a = document.createElement('a')
      a.href = url; a.download = `torque-${event?.slug || 'promo'}-${stamp}.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[Promos] export failed:', err); alert('Export failed: ' + (err?.message || err))
    } finally { setExporting(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--muted)' }}>Loading promos…</div>
    </div>
  )

  if (!event) return (
    <div className="fade-in">
      <PageHeader eyebrow="Paid Events" title="Promos" subtitle="Registrations for the active paid event" />
      <Card>
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎟️</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic' }}>No active promo event</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Seed one in <code>promo_events</code> with <code>active = true</code>.</div>
        </div>
      </Card>
    </div>
  )

  const FILTERS = [
    { id: 'paid', label: `Paid (${counts.paid})` },
    { id: 'pending', label: `Pending (${counts.pending})` },
    { id: 'refunded', label: `Refunded (${counts.refunded})` },
    { id: 'expired', label: `Expired (${counts.expired})` },
    { id: 'all', label: `All (${regs.length})` },
  ]
  const fmt = (s) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const soldOut = remaining <= 0

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Paid Events" title={event.title} subtitle={`${event.event_date || ''}${event.event_time ? ` · ${event.event_time}` : ''}${event.age_range ? ` · Ages ${event.age_range}` : ''}`} />

      {/* Live capacity counter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <StatCard label="Paid"      value={`${counts.paid} / ${capacity}`} sub={soldOut ? 'SOLD OUT' : `${remaining} spots left`} icon="✅" block={soldOut ? VIBRANT.red : VIBRANT.green} />
        <StatCard label="Pending"   value={counts.pending}  sub="reserved, unpaid" icon="⏳" block={VIBRANT.amber} />
        <StatCard label="Remaining" value={remaining}       sub={`of ${capacity} cap`} icon="🎟️" block={VIBRANT.blue} />
        <StatCard label="Refunded"  value={counts.refunded} sub="freed a spot"    icon="↩️" block={VIBRANT.red} />
      </div>

      {/* Search + refresh + export */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by parent, player, phone or email..." style={{ paddingLeft: 40, width: '100%' }} />
        </div>
        <button onClick={() => { setLoading(true); load().catch(() => setLoading(false)) }} title="Refresh"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 42, background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <RefreshCw size={15} /> Refresh
        </button>
        <button onClick={handleExportCsv} disabled={exporting || filtered.length === 0} title="Export the currently filtered registrations to CSV"
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
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎟️</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic' }}>
              {regs.length === 0 ? 'No registrations yet' : search.trim() ? 'No matches for your search' : 'None in this status'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Registered', 'Parent', 'Player', 'Age', 'Contact', 'Status', 'Paid'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text3)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const sc = STATUS_COLOR[r.status] || '#5A6B84'
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><span className="num" style={{ fontSize: 12, color: 'var(--text2)' }}>{fmt(r.created_at)}</span></td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{r.parent_name || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>{r.player_name || '—'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.player_age || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {r.email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.email}</div>}
                        {r.phone && <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.phone}</div>}
                        {!r.email && !r.phone && '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}><Pill color={sc}>{STATUS_LABEL[r.status] || r.status}</Pill></td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text2)' }}>{r.paid_at ? fmt(r.paid_at) : '—'}</td>
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
