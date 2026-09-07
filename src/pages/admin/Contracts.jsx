import React, { useState, useEffect, useMemo } from 'react'
import { Search, Download, ShieldCheck, ShieldOff } from 'lucide-react'
import { Card, StatCard, Pill, PageHeader } from '../../components/UI'
import { supabase } from '../../supabaseClient'
import { API_BASE } from '../../lib/apiBase'
import { CONTRACT_VERSION, PLAN_LABELS } from '../../lib/contract'
import { VIBRANT } from '../../hooks/useAdminData'

const csvEscape = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const keyOf = (pid, kid) => `${pid}::${(kid || '').toLowerCase().trim()}`

// Signing status for the current contract version. Buckets:
//   signed        — latest waiver for that kid is CONTRACT_VERSION
//   unsigned      — classifiable plan, but no current-version waiver → still blocked
//   exempt        — parent manually exempted by the owner
//   unclassified  — membership has no billing_type yet → not applicable until classified
export default function Contracts() {
  const [profiles, setProfiles] = useState([])
  const [mems, setMems] = useState([])
  const [waivers, setWaivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('unsigned')   // default: who still needs to sign
  const [busyId, setBusyId] = useState(null)
  const [exporting, setExporting] = useState(false)

  async function load() {
    const [p, m, w] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, phone, contract_exempt'),
      supabase.from('player_memberships').select('parent_id, kid_name, billing_type, package_name').eq('status', 'active'),
      supabase.from('waivers').select('parent_id, kid_name, contract_version, agreed_at').order('agreed_at', { ascending: false }),
    ])
    setProfiles(p.data || []); setMems(m.data || []); setWaivers(w.data || [])
    setLoading(false)
  }
  useEffect(() => { load().catch(() => setLoading(false)) }, [])

  const profById = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])
  const latestByKey = useMemo(() => {
    const map = new Map()
    for (const w of waivers) { const k = keyOf(w.parent_id, w.kid_name); if (!map.has(k)) map.set(k, w.contract_version) }
    return map
  }, [waivers])

  // One row per (parent, kid) active membership.
  const rows = useMemo(() => {
    const seen = new Set(); const out = []
    for (const m of mems) {
      const k = keyOf(m.parent_id, m.kid_name)
      if (seen.has(k)) continue; seen.add(k)
      const prof = profById.get(m.parent_id) || {}
      let status
      if (!m.billing_type) status = 'unclassified'
      else if (prof.contract_exempt) status = 'exempt'
      else if (latestByKey.get(k) === CONTRACT_VERSION) status = 'signed'
      else status = 'unsigned'
      out.push({
        key: k, parent_id: m.parent_id, kid_name: m.kid_name,
        parent_name: prof.full_name || '(no profile)', email: prof.email || '', phone: prof.phone || '',
        billing_type: m.billing_type, plan: m.billing_type ? (PLAN_LABELS[m.billing_type] || m.billing_type) : '—',
        exempt: !!prof.contract_exempt, status,
      })
    }
    return out
  }, [mems, profById, latestByKey])

  const counts = useMemo(() => {
    const c = { signed: 0, unsigned: 0, exempt: 0, unclassified: 0 }
    for (const r of rows) c[r.status]++
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return rows
      .filter(r => filter === 'all' || r.status === filter)
      .filter(r => !q || [r.parent_name, r.kid_name, r.email, r.phone].some(v => (v || '').toLowerCase().includes(q)))
  }, [rows, filter, search])

  async function toggleExempt(parentId, exempt) {
    setBusyId(parentId)
    try {
      const res = await fetch(`${API_BASE}/api/set-contract-exempt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, exempt }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      // optimistic: update every profile row for this parent
      setProfiles(ps => ps.map(p => p.id === parentId ? { ...p, contract_exempt: exempt } : p))
    } catch (e) { alert('Could not update exemption: ' + (e.message || e)) }
    finally { setBusyId(null) }
  }

  function exportCsv() {
    setExporting(true)
    try {
      const headers = ['status', 'parent_name', 'email', 'phone', 'kid_name', 'plan']
      const lines = filtered.map(r => [r.status, r.parent_name, r.email, r.phone, r.kid_name, r.plan].map(csvEscape).join(','))
      const csv = '﻿' + headers.join(',') + '\n' + lines.join('\n') + '\n'
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a'); a.href = url; a.download = `torque-contracts-${CONTRACT_VERSION}.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--muted)' }}>Loading contract status…</div>
    </div>
  )

  const FILTERS = [
    { id: 'unsigned', label: `Not signed (${counts.unsigned})` },
    { id: 'signed', label: `Signed (${counts.signed})` },
    { id: 'exempt', label: `Exempt (${counts.exempt})` },
    { id: 'unclassified', label: `Unclassified (${counts.unclassified})` },
    { id: 'all', label: `All (${rows.length})` },
  ]

  return (
    <div className="fade-in">
      <PageHeader eyebrow={`Contract ${CONTRACT_VERSION}`} title="Contracts" subtitle="Who has signed the current training agreement — by player" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <StatCard label="Signed"       value={counts.signed}       sub={`version ${CONTRACT_VERSION}`}     icon="✅" block={VIBRANT.green} />
        <StatCard label="Not signed"   value={counts.unsigned}     sub="still blocked"                    icon="✍️" block={VIBRANT.red} />
        <StatCard label="Exempt"       value={counts.exempt}       sub="manually unblocked"               icon="🛡️" block={VIBRANT.blue} />
        <StatCard label="Unclassified" value={counts.unclassified} sub="no plan yet — N/A until classified" icon="❓" block={VIBRANT.amber} />
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
            <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic' }}>Nothing in this view</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Status', 'Parent', 'Player', 'Plan', 'Contact', 'Exempt'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text3)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const color = r.status === 'signed' ? '#06D6A0' : r.status === 'unsigned' ? '#E63946' : r.status === 'exempt' ? '#118AB2' : '#FFB703'
                  const label = r.status === 'unclassified' ? 'N/A — unclassified' : r.status.charAt(0).toUpperCase() + r.status.slice(1)
                  return (
                    <tr key={r.key} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px 14px' }}><Pill color={color}>{label}</Pill></td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{r.parent_name}</td>
                      <td style={{ padding: '12px 14px' }}>{r.kid_name}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.plan}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {r.email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.email}</div>}
                        {r.phone && <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.phone}</div>}
                        {!r.email && !r.phone && '—'}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => toggleExempt(r.parent_id, !r.exempt)} disabled={busyId === r.parent_id}
                          title={r.exempt ? 'Remove exemption (re-block this parent)' : 'Exempt this parent from re-signing'}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busyId === r.parent_id ? 'wait' : 'pointer',
                            background: r.exempt ? 'rgba(17,138,178,0.12)' : 'transparent', color: r.exempt ? '#118AB2' : 'var(--text2)', border: `1px solid ${r.exempt ? '#118AB2' : 'var(--border2)'}` }}>
                          {r.exempt ? <><ShieldCheck size={13} /> Exempt</> : <><ShieldOff size={13} /> Exempt</>}
                        </button>
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
