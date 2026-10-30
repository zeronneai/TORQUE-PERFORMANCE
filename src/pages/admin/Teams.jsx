import React, { useState, useEffect, useMemo } from 'react'
import { useSession } from '@clerk/clerk-react'
import { Search, Download, MessageCircle } from 'lucide-react'
import { Card, StatCard, Pill, PageHeader, Modal } from '../../components/UI'
import { supabase } from '../../supabaseClient'
import { API_BASE } from '../../lib/apiBase'
import { VIBRANT, parentName, pkgColor } from '../../hooks/useAdminData'
import { TEAM_AGES, TEAM_PRICE, teamLabel, playerAge, packageIsActive, teamStatus } from '../../lib/team'

// Torque Team rosters: one list per team (9U to 13U). Players join from the parent
// portal ($250/month, active session package required). Coaches can move a player
// to another team or cancel the team subscription. Writes go through api/admin.js.
const TEAM_COLORS = { 9: VIBRANT.blue, 10: VIBRANT.green, 11: VIBRANT.amber, 12: VIBRANT.orange, 13: VIBRANT.purple }

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const csvEscape = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export default function Teams() {
  const { session } = useSession()
  const [rows, setRows] = useState([])
  const [players, setPlayers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [mems, setMems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCanceled, setShowCanceled] = useState(false)
  const [manage, setManage] = useState(null)    // team row being managed
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function load() {
    const [t, p, pr, m] = await Promise.all([
      supabase.from('team_memberships').select('*').order('started_at', { ascending: true }),
      supabase.from('players').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('player_memberships').select('*').eq('status', 'active'),
    ])
    setRows(t.data || []); setPlayers(p.data || []); setProfiles(pr.data || []); setMems(m.data || [])
    setLoading(false)
  }
  useEffect(() => { load().catch(() => setLoading(false)) }, [])

  const key = (s) => (s || '').toLowerCase().trim()
  const enriched = useMemo(() => rows.map(r => {
    const prof = profiles.find(x => x.id === r.parent_id)
    const kid = players.find(x => x.parent_id === r.parent_id && key(x.kid_name) === key(r.kid_name))
    const pkg = mems.find(x => x.parent_id === r.parent_id && key(x.kid_name) === key(r.kid_name))
    return { ...r, prof, kid, pkg, pkgOk: packageIsActive(pkg), age: kid ? playerAge(kid) : null, st: teamStatus(r) }
  }), [rows, profiles, players, mems])

  const visible = useMemo(() => {
    const q = key(search)
    return enriched.filter(r =>
      (showCanceled || r.st !== 'canceled') &&
      (!q || [r.kid_name, parentName(r.prof), r.prof?.phone, r.prof?.email].some(v => key(v).includes(q)))
    )
  }, [enriched, search, showCanceled])

  const live = enriched.filter(r => r.st !== 'canceled')
  const noPkg = live.filter(r => !r.pkgOk).length
  const unpaid = live.filter(r => r.st === 'unpaid')
  const STATUS_TEXT = { active: 'Active', ending: 'Canceled by parent', unpaid: 'Payment not processed', canceled: 'Canceled' }
  const STATUS_COLOR = { active: '#06D6A0', ending: '#FFB703', unpaid: '#E63946', canceled: '#5A6B84' }

  async function call(body) {
    setBusy(true); setMsg(null)
    try {
      const token = await session?.getToken()
      const res = await fetch(`${API_BASE}/api/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Request failed')
      await load()
      setManage(null)
    } catch (e) { setMsg(e.message) }
    setBusy(false)
  }

  function exportCsv() {
    const headers = ['team', 'player', 'age', 'parent', 'phone', 'email', 'status', 'package', 'package_active', 'joined', 'paid_through']
    const lines = TEAM_AGES.flatMap(a => visible.filter(r => r.team_age === a)).map(r => [
      teamLabel(r.team_age), r.kid_name, r.age ?? '', parentName(r.prof) || '', r.prof?.phone || '', r.prof?.email || '',
      STATUS_TEXT[r.st], r.pkg?.package_name || '', r.pkgOk ? 'yes' : 'no', fmt(r.started_at), fmt(r.current_period_end),
    ].map(csvEscape).join(','))
    const blob = new Blob(['﻿' + headers.join(',') + '\n' + lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `torque-teams-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  const th = { padding: '10px 14px', textAlign: 'left', color: 'var(--text3)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontWeight: 700, whiteSpace: 'nowrap' }
  const td = { padding: '12px 14px' }

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Torque Team" title="Teams" subtitle={`Team rosters by age, 9U to 13U. $${TEAM_PRICE}/month per player, only for players with an active session package.`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {TEAM_AGES.map(a => (
          <StatCard key={a} label={`Team ${teamLabel(a)}`} value={live.filter(r => r.team_age === a).length} sub="players" icon="⚾" block={TEAM_COLORS[a]} />
        ))}
        <StatCard label="Monthly" value={`$${(live.filter(r => r.st === 'active' || r.st === 'ending').length * TEAM_PRICE).toLocaleString()}`} sub={`${live.length} on teams`} icon="💵" />
      </div>

      {unpaid.length > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.45)', color: '#E63946', fontSize: 13, fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          Payment not processed for {unpaid.length} {unpaid.length === 1 ? 'player' : 'players'} ({unpaid.map(r => r.kid_name).join(', ')}). Their team access is blocked. Contact the parent.
        </div>
      )}

      {noPkg > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.3)', color: '#E63946', fontSize: 13, marginBottom: 'var(--space-4)' }}>
          {noPkg} {noPkg === 1 ? 'player is' : 'players are'} on a team without an active session package. They are marked in red below.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search player, parent, phone or email..." style={{ paddingLeft: 40, width: '100%' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showCanceled} onChange={e => setShowCanceled(e.target.checked)} style={{ width: 'auto', margin: 0 }} /> Show canceled
        </label>
        <button onClick={exportCsv} disabled={!visible.length}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 42, background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: visible.length ? 'pointer' : 'not-allowed', opacity: visible.length ? 1 : 0.6 }}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {loading ? <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div> : TEAM_AGES.map(a => {
        const list = visible.filter(r => r.team_age === a)
        const c = TEAM_COLORS[a].bg
        return (
          <div key={a} style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 900, fontSize: 20, color: 'var(--text)' }}>Team {teamLabel(a)}</span>
              <Pill color={c}>{a} years</Pill>
              <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: c }}>{list.length} {list.length === 1 ? 'player' : 'players'}</span>
            </div>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {list.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>No players on this team yet</div>
              ) : (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>{['Player', 'Parent', 'Session package', 'Team status', 'Joined', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {list.map(r => {
                        const digits = (r.prof?.phone || '').replace(/\D/g, '')
                        const waText = r.st === 'unpaid' ? `?text=${encodeURIComponent(`Hi ${parentName(r.prof) || ''}! This month's Torque Team payment for ${r.kid_name} did not go through. Can you update the card in the app (Torque Team tab)? Thanks!`)}` : ''
                        const wa = digits.length >= 10 ? `https://wa.me/${digits.length === 10 ? '1' + digits : digits}${waText}` : null
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top', opacity: r.st === 'canceled' ? 0.55 : 1, background: r.st === 'unpaid' ? 'rgba(230,57,70,0.06)' : undefined }}>
                            <td style={td}>
                              <div style={{ fontWeight: 600 }}>{r.kid_name}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.age != null ? `${r.age} yrs` : 'age not on file'}</div>
                            </td>
                            <td style={td}>
                              <div style={{ fontWeight: 600 }}>{parentName(r.prof) || '-'}</div>
                              {r.prof?.phone && <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.prof.phone}</div>}
                              {r.prof?.email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.prof.email}</div>}
                            </td>
                            <td style={td}>
                              {r.pkgOk
                                ? <Pill color={pkgColor(r.pkg?.package_name)}>{r.pkg?.package_name}</Pill>
                                : <Pill color="#E63946">No active package</Pill>}
                            </td>
                            <td style={td}>
                              <Pill color={STATUS_COLOR[r.st]}>{STATUS_TEXT[r.st]}</Pill>
                              <div style={{ fontSize: 12, color: r.st === 'unpaid' ? '#E63946' : 'var(--muted)', marginTop: 4, fontWeight: r.st === 'unpaid' ? 600 : 400 }}>
                                {r.st === 'unpaid' ? 'Contact the parent'
                                  : r.st === 'canceled' ? `Canceled ${fmt(r.canceled_at || r.current_period_end)}`
                                  : r.current_period_end ? `${r.st === 'ending' ? 'On team until' : 'Paid through'} ${fmt(r.current_period_end)}` : ''}
                              </div>
                            </td>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}><span className="num" style={{ fontSize: 12, color: 'var(--text2)' }}>{fmt(r.started_at)}</span></td>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                                  style={{ display: 'inline-flex', padding: 7, borderRadius: 8, background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: '1px solid rgba(6,214,160,0.4)' }}><MessageCircle size={14} /></a>}
                                {r.st !== 'canceled' && (
                                  <button onClick={() => { setMsg(null); setManage(r) }}
                                    style={{ padding: '6px 12px', borderRadius: 8, background: '#118AB2', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Manage</button>
                                )}
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
      })}

      <Modal open={!!manage} onClose={() => setManage(null)} title={manage ? `${manage.kid_name} · Team ${teamLabel(manage.team_age)}` : ''}>
        {manage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Move to another team</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TEAM_AGES.map(a => (
                  <button key={a} disabled={busy || a === manage.team_age} onClick={() => call({ action: 'team_move', teamMembershipId: manage.id, teamAge: a })}
                    style={{ padding: '8px 14px', borderRadius: 8, border: `2px solid ${TEAM_COLORS[a].bg}`, background: a === manage.team_age ? TEAM_COLORS[a].bg : 'transparent', color: a === manage.team_age ? TEAM_COLORS[a].fg : 'var(--text)', fontWeight: 800, cursor: a === manage.team_age ? 'default' : 'pointer' }}>
                    {teamLabel(a)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cancel the ${TEAM_PRICE}/month subscription</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button disabled={busy || manage.cancel_at_period_end} onClick={() => call({ action: 'team_cancel', teamMembershipId: manage.id, when: 'period_end' })}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>
                  {manage.cancel_at_period_end ? 'Already ends this period' : 'At end of paid month'}
                </button>
                <button disabled={busy} onClick={() => { if (window.confirm(`Cancel ${manage.kid_name}'s team subscription right now? No refund is issued automatically.`)) call({ action: 'team_cancel', teamMembershipId: manage.id, when: 'now' }) }}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(230,57,70,0.4)', background: 'rgba(230,57,70,0.1)', color: '#E63946', fontWeight: 700, cursor: 'pointer' }}>
                  Cancel now
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>This cancels the charge in Stripe. Refunds, if any, are done in Stripe.</div>
            </div>
            {msg && <div style={{ fontSize: 13, color: '#E63946' }}>{msg}</div>}
          </div>
        )}
      </Modal>
    </div>
  )
}
