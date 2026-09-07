import React, { useState, useEffect, useMemo } from 'react'
import { Search, Download } from 'lucide-react'
import { Card, StatCard, Pill, PageHeader } from '../../components/UI'
import { supabase } from '../../supabaseClient'
import { PLAN_LABELS } from '../../lib/contract'
import { VIBRANT } from '../../hooks/useAdminData'

const csvEscape = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const usd = (c) => (Number(c || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const fmt = (s) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// Member-initiated (and external) cancellations. A row is "scheduled" while access still
// runs to cancel_effective_at (status not yet canceled), and "completed" once the sub was
// deleted (status='canceled'). Shows the fee charged, which contract_version's rule applied,
// and the total fees collected.
export default function Cancellations() {
  const [rows, setRows] = useState([])
  const [profById, setProfById] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [exporting, setExporting] = useState(false)

  async function load() {
    // Any membership with a cancellation signal: a scheduled effective date OR already canceled.
    const { data } = await supabase.from('player_memberships')
      .select('id, kid_name, parent_id, billing_type, package_name, status, cancel_requested_at, cancel_effective_at, canceled_at, cancel_fee_cents, cancel_contract_version')
      .or('cancel_effective_at.not.is.null,status.eq.canceled')
    const list = data || []
    setRows(list)
    const pids = [...new Set(list.map(r => r.parent_id).filter(Boolean))]
    const map = new Map()
    for (let i = 0; i < pids.length; i += 200) {
      const { data: pf } = await supabase.from('profiles').select('id, full_name, email, phone').in('id', pids.slice(i, i + 200))
      for (const p of (pf || [])) map.set(p.id, p)
    }
    setProfById(map)
    setLoading(false)
  }
  useEffect(() => { load().catch(() => setLoading(false)) }, [])

  const enriched = useMemo(() => rows.map(r => {
    const p = profById.get(r.parent_id) || {}
    const completed = r.status === 'canceled'
    return {
      ...r,
      parent_name: p.full_name || '(no profile)', email: p.email || '', phone: p.phone || '',
      plan: r.billing_type ? (PLAN_LABELS[r.billing_type] || r.billing_type) : (r.package_name || '—'),
      state: completed ? 'completed' : 'scheduled',
      _sort: Date.parse(r.canceled_at || r.cancel_requested_at || r.cancel_effective_at || 0) || 0,
    }
  }).sort((a, b) => b._sort - a._sort), [rows, profById])

  const counts = useMemo(() => ({
    scheduled: enriched.filter(r => r.state === 'scheduled').length,
    completed: enriched.filter(r => r.state === 'completed').length,
    fees: enriched.reduce((s, r) => s + (r.cancel_fee_cents || 0), 0),
  }), [enriched])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return enriched
      .filter(r => filter === 'all' || r.state === filter)
      .filter(r => !q || [r.parent_name, r.kid_name, r.email, r.phone].some(v => (v || '').toLowerCase().includes(q)))
  }, [enriched, filter, search])

  function exportCsv() {
    setExporting(true)
    try {
      const headers = ['state', 'kid_name', 'parent_name', 'email', 'phone', 'plan', 'fee_usd', 'rule_version', 'requested_at', 'effective_at', 'canceled_at']
      const lines = filtered.map(r => [
        r.state, r.kid_name, r.parent_name, r.email, r.phone, r.plan,
        r.cancel_fee_cents != null ? usd(r.cancel_fee_cents) : '', r.cancel_contract_version || '',
        r.cancel_requested_at ? new Date(r.cancel_requested_at).toISOString() : '',
        r.cancel_effective_at ? new Date(r.cancel_effective_at).toISOString() : '',
        r.canceled_at ? new Date(r.canceled_at).toISOString() : '',
      ].map(csvEscape).join(','))
      const url = URL.createObjectURL(new Blob(['﻿' + headers.join(',') + '\n' + lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a'); a.href = url; a.download = 'torque-cancellations.csv'
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--muted)' }}>Loading cancellations…</div>
    </div>
  )

  const FILTERS = [
    { id: 'all', label: `All (${enriched.length})` },
    { id: 'scheduled', label: `Scheduled (${counts.scheduled})` },
    { id: 'completed', label: `Completed (${counts.completed})` },
  ]

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Retention" title="Cancellations" subtitle="Scheduled and completed cancellations, fees charged, and rule applied" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <StatCard label="Scheduled"      value={counts.scheduled} sub="access still active" icon="🗓️" block={VIBRANT.amber} />
        <StatCard label="Completed"      value={counts.completed} sub="subscription ended"  icon="🚪" block={VIBRANT.purple} />
        <StatCard label="Fees collected" value={usd(counts.fees)} sub="from cancellations"  icon="💰" block={VIBRANT.green} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by parent, player, phone or email..." style={{ paddingLeft: 40, width: '100%' }} />
        </div>
        <button onClick={exportCsv} disabled={exporting || filtered.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 42, background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: (exporting || filtered.length === 0) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: (exporting || filtered.length === 0) ? 0.6 : 1 }}>
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

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
            <div style={{ fontSize: 32, marginBottom: 12 }}>🚪</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic' }}>No cancellations</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['State', 'Player', 'Parent', 'Plan', 'Fee', 'Rule', 'Requested', 'Effective', 'Contact'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text3)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                    <td style={{ padding: '12px 14px' }}><Pill color={r.state === 'completed' ? '#8B5CF6' : '#FFB703'}>{r.state}</Pill></td>
                    <td style={{ padding: '12px 14px' }}>{r.kid_name}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{r.parent_name}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.plan}</td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>{r.cancel_fee_cents ? usd(r.cancel_fee_cents) : '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.cancel_contract_version || '—'}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text2)' }}>{fmt(r.cancel_requested_at)}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text2)' }}>{fmt(r.cancel_effective_at)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {r.email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.email}</div>}
                      {r.phone && <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.phone}</div>}
                      {!r.email && !r.phone && '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
