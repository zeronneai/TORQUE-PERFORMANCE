import React, { useEffect, useRef, useState } from 'react'
import { useSession } from '@clerk/clerk-react'
import { Send, Download, Sparkles, RotateCcw, BookOpen, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/UI'
import { API_BASE } from '../../lib/apiBase'

// Admin > Ask Torque: ask Claude anything about members, payments, attendance, leads.
// Claude only READS a snapshot of the data (built on the server); it cannot change anything.

const SUGGESTIONS = [
  'How many families actually paid in the last 31 days?',
  'Give me the 10 longest-time members who canceled, with phone numbers.',
  'Who is active in the app but has not paid this month?',
  'Which paying players have not booked or checked in during the last 2 weeks?',
  'How much did we collect each month this year?',
  'List the families whose package expires in the next 7 days.',
]

// ── tiny markdown: tables, lists, bold, headings ──
function inline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>)
}
function parseTable(lines) {
  const rows = lines.filter(l => !/^\s*\|?\s*:?-{2,}/.test(l)).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
  return { head: rows[0] || [], body: rows.slice(1) }
}
function toCsv(t) {
  const esc = (v) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  return [t.head, ...t.body].map(r => r.map(c => esc(c.replace(/\*\*/g, ''))).join(',')).join('\n')
}
function downloadCsv(t, i) {
  const blob = new Blob(['﻿' + toCsv(t) + '\n'], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `ask-torque-${new Date().toISOString().slice(0, 10)}-${i + 1}.csv`; a.click()
}
function Markdown({ text }) {
  const lines = String(text || '').split('\n')
  const out = []
  let i = 0, tableN = 0
  while (i < lines.length) {
    const l = lines[i]
    if (/^\s*\|/.test(l)) {
      const block = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) block.push(lines[i++])
      const t = parseTable(block); const n = tableN++
      out.push(
        <div key={`t${i}`} style={{ margin: '10px 0' }}>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{t.head.map((h, k) => <th key={k} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{inline(h)}</th>)}</tr></thead>
              <tbody>{t.body.map((r, ri) => <tr key={ri} style={{ borderBottom: '1px solid var(--border)' }}>{r.map((c, ci) => <td key={ci} style={{ padding: '7px 10px', verticalAlign: 'top' }}>{inline(c)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <button onClick={() => downloadCsv(t, n)} style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            <Download size={13} /> Download CSV
          </button>
        </div>
      )
      continue
    }
    if (/^\s*[-*•]\s+/.test(l)) {
      const items = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''))
      out.push(<ul key={`u${i}`} style={{ margin: '6px 0', paddingLeft: 20 }}>{items.map((it, k) => <li key={k} style={{ margin: '3px 0' }}>{inline(it)}</li>)}</ul>)
      continue
    }
    if (/^\s*\d+\.\s+/.test(l)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''))
      out.push(<ol key={`o${i}`} style={{ margin: '6px 0', paddingLeft: 22 }}>{items.map((it, k) => <li key={k} style={{ margin: '3px 0' }}>{inline(it)}</li>)}</ol>)
      continue
    }
    if (/^#{1,4}\s+/.test(l)) { out.push(<div key={`h${i}`} style={{ fontWeight: 800, fontSize: 15, margin: '12px 0 4px' }}>{inline(l.replace(/^#{1,4}\s+/, ''))}</div>); i++; continue }
    if (l.trim()) out.push(<p key={`p${i}`} style={{ margin: '6px 0', lineHeight: 1.55 }}>{inline(l)}</p>)
    i++
  }
  return <>{out}</>
}

// Academy-wide rules the coaches write (member_notes with no family). Claude always follows them.
function Rules({ call }) {
  const [open, setOpen] = useState(false)
  const [rules, setRules] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  useEffect(() => {
    if (!open || rules) return
    call({ action: 'notes_list' }).then(d => setRules(d.notes || [])).catch(e => { setErr(e.message); setRules([]) })
  }, [open])
  async function add() {
    if (!text.trim()) return
    setBusy(true)
    try { const d = await call({ action: 'note_add', note: text.trim() }); setRules(r => [d.note, ...(r || [])]); setText('') }
    catch (e) { setErr(e.message) }
    setBusy(false)
  }
  async function del(id) {
    if (!confirm('Delete this rule?')) return
    try { await call({ action: 'note_delete', noteId: id }); setRules(r => r.filter(x => x.id !== id)) } catch (e) { setErr(e.message) }
  }
  return (
    <div style={{ marginBottom: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--navy2, var(--navy3))' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'none', border: 'none', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
        <BookOpen size={15} /> Academy rules Ask Torque follows {rules ? `(${rules.length})` : ''}
        <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontWeight: 600 }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>How Torque works that the data does not show. Notes about one family go in Families &gt; Manage.</div>
          {(rules || []).map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ flex: 1 }}>{r.note}</span>
              <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><Trash2 size={14} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Torque Team is charged on the 5th of every month." maxLength={2000}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              style={{ flex: 1, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--navy3)', color: 'var(--text)', fontSize: 13, margin: 0 }} />
            <button onClick={add} disabled={busy || !text.trim()} style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: '#1a56a0', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: busy || !text.trim() ? 0.5 : 1 }}>Add</button>
          </div>
          {err && <div style={{ color: '#E63946', fontSize: 12, marginTop: 6 }}>{err}</div>}
        </div>
      )}
    </div>
  )
}

export default function AskTorque() {
  const { session } = useSession()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, busy])

  async function call(body) {
    const token = await session?.getToken()
    const r = await fetch(`${API_BASE}/api/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || 'Something went wrong.')
    return d
  }

  async function ask(q) {
    const question = (q ?? input).trim()
    if (!question || busy) return
    const next = [...messages, { role: 'user', content: question }]
    setMessages(next); setInput(''); setBusy(true); setError(null)
    try {
      const token = await session?.getToken()
      const r = await fetch(`${API_BASE}/api/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'ask', messages: next }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Something went wrong.')
      setMessages([...next, { role: 'assistant', content: d.answer }])
    } catch (e) {
      setError(e.message)
      setMessages(messages)          // let them retry the same question
      setInput(question)
    }
    setBusy(false)
  }

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Powered by Claude" title="Ask Torque"
        subtitle="Ask anything about your members, payments, attendance and leads. Answers come from live app and Stripe data. Read only: it cannot change anything." />

      <Rules call={call} />

      <div style={{ background: 'var(--navy2, var(--navy3))', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 520 }}>
        <div style={{ flex: 1, padding: 18, overflowY: 'auto', maxHeight: '65vh' }}>
          {!messages.length && (
            <div style={{ padding: '10px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, marginBottom: 12, color: 'var(--text)' }}><Sparkles size={16} /> Try one of these</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => ask(s)}
                    style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--navy3)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', maxWidth: 360 }}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', margin: '10px 0' }}>
              <div style={{
                maxWidth: m.role === 'user' ? '75%' : '100%', width: m.role === 'user' ? 'auto' : '100%',
                padding: m.role === 'user' ? '10px 14px' : '4px 2px', borderRadius: 14,
                background: m.role === 'user' ? '#1a56a0' : 'transparent', color: m.role === 'user' ? '#fff' : 'var(--text)', fontSize: 14,
              }}>
                {m.role === 'user' ? m.content : <Markdown text={m.content} />}
              </div>
            </div>
          ))}
          {busy && <div style={{ color: 'var(--muted)', fontSize: 13, padding: '6px 2px' }}>Looking at the data…</div>}
          {error && <div style={{ color: '#E63946', fontSize: 13, padding: '6px 2px' }}>{error}</div>}
          <div ref={endRef} />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', padding: 12, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setError(null) }} title="New conversation"
              style={{ height: 44, width: 44, borderRadius: 10, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <RotateCcw size={16} />
            </button>
          )}
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={1} placeholder="Ask about members, payments, attendance…"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
            style={{ flex: 1, resize: 'none', minHeight: 44, maxHeight: 140, padding: '11px 12px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--navy3)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', margin: 0 }} />
          <button onClick={() => ask()} disabled={busy || !input.trim()}
            style={{ height: 44, padding: '0 16px', borderRadius: 10, border: 'none', background: '#1a56a0', color: '#fff', fontWeight: 700, cursor: busy || !input.trim() ? 'not-allowed' : 'pointer', opacity: busy || !input.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Send size={15} /> Ask
          </button>
        </div>
      </div>
    </div>
  )
}
