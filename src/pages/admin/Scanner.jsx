import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from '@clerk/clerk-react'
import { Camera, Maximize, Minimize, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import { PageHeader } from '../../components/UI'
import { API_BASE } from '../../lib/apiBase'

// Entrance scanner. Stays on, reads player cards from the camera OR from a USB /
// Bluetooth QR scanner (those type the code and press Enter, like a keyboard).
//   green  → booked today: attendance confirmed / walk-in: books now and uses 1 session
//   yellow → already checked in today
//   red    → no package, expired, no sessions, or Torque Team payment not processed.
//            Stays on screen until the coach taps "Dismiss" or "Let in anyway".
const READER_ID = 'torque-scanner-reader'
const SAME_CODE_COOLDOWN = 6000
const CLEAR_AFTER = { ok: 4500, warn: 4500, unknown: 4000 }

const COLORS = {
  ok:      { bg: '#06D6A0', fg: '#0a1628', title: 'WELCOME' },
  warn:    { bg: '#FFB703', fg: '#0a1628', title: 'ALREADY IN' },
  blocked: { bg: '#E63946', fg: '#ffffff', title: 'STOP' },
  unknown: { bg: '#5A6B84', fg: '#ffffff', title: 'NOT A TORQUE CARD' },
  override:{ bg: '#118AB2', fg: '#ffffff', title: 'LET IN BY COACH' },
}

function useBeeper() {
  const ctxRef = useRef(null)
  const unlock = () => {
    try { ctxRef.current = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)(); ctxRef.current.resume() } catch { /* no audio */ }
  }
  const tone = (freq, start, dur, type = 'sine') => {
    const ctx = ctxRef.current; if (!ctx) return
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start)
    g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + start + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)
    o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur + 0.05)
  }
  const play = (kind) => {
    if (kind === 'ok' || kind === 'override') { tone(880, 0, 0.12); tone(1320, 0.14, 0.18) }
    else if (kind === 'warn') { tone(660, 0, 0.25) }
    else { tone(180, 0, 0.5, 'square'); tone(150, 0.55, 0.5, 'square') }
  }
  return { unlock, play }
}

export default function Scanner() {
  const { session } = useSession()
  const [started, setStarted] = useState(false)
  const [camOn, setCamOn] = useState(true)
  const [facing, setFacing] = useState('user')      // front camera faces the kids on a wall tablet
  const [camError, setCamError] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState([])
  const [sound, setSound] = useState(true)
  const [kiosk, setKiosk] = useState(false)
  const wrapRef = useRef(null)
  const scannerRef = useRef(null)
  const lastRef = useRef({ code: null, at: 0 })
  const busyRef = useRef(false)
  const clearTimer = useRef(null)
  const { unlock, play } = useBeeper()

  const api = useCallback(async (body) => {
    const token = session ? await session.getToken() : null
    const r = await fetch(`${API_BASE}/api/player-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || 'Server error')
    return d
  }, [session])

  const show = useCallback((res, kind) => {
    clearTimeout(clearTimer.current)
    setResult({ ...res, kind })
    if (sound) play(kind)
    setRecent(rs => [{ ...res, kind, at: new Date() }, ...rs].slice(0, 12))
    if (CLEAR_AFTER[kind]) clearTimer.current = setTimeout(() => setResult(null), CLEAR_AFTER[kind])
  }, [sound, play])

  const handleCode = useCallback(async (raw) => {
    const code = String(raw || '').trim()
    if (!code || busyRef.current) return
    const now = Date.now()
    if (lastRef.current.code === code && now - lastRef.current.at < SAME_CODE_COOLDOWN) return
    lastRef.current = { code, at: now }
    busyRef.current = true; setBusy(true)
    try {
      const d = await api({ action: 'scan', code, commit: true })
      show(d, d.verdict)
    } catch (e) {
      show({ verdict: 'unknown', reason: e.message }, 'unknown')
    }
    busyRef.current = false; setBusy(false)
  }, [api, show])

  async function letIn() {
    if (!result?.token) return
    setBusy(true)
    try {
      const d = await api({ action: 'confirm', token: result.token, override: true })
      show({ ...result, sessions_left: d.sessions_left ?? result.sessions_left, reason: d.deducted ? `Let in anyway: 1 session used (was: ${result.reason})` : `Let in anyway (was: ${result.reason})` }, 'override')
    } catch (e) { alert(e.message) }
    setBusy(false)
  }

  // USB / Bluetooth scanners type the code very fast and finish with Enter.
  useEffect(() => {
    if (!started) return
    let buf = '', last = 0
    const onKey = (e) => {
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const now = Date.now()
      if (now - last > 120) buf = ''
      last = now
      if (e.key === 'Enter') { if (buf.length >= 10) handleCode(buf); buf = ''; return }
      if (e.key.length === 1) buf += e.key
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, handleCode])

  // Camera: keeps running; every decoded frame goes to handleCode (cooldown prevents repeats).
  useEffect(() => {
    if (!started || !camOn) return
    let cancelled = false
    setCamError(null)
    const t = setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled || !document.getElementById(READER_ID)) return
        const sc = new Html5Qrcode(READER_ID)
        scannerRef.current = sc
        await sc.start({ facingMode: facing }, { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s } } },
          (text) => handleCodeRef.current(text), () => {})
      } catch (err) {
        if (!cancelled) setCamError(/NotAllowed|ermission/.test(String(err)) ? 'Camera permission was denied. Allow the camera for this site in the browser settings.' : 'Camera not available. You can still use a USB or Bluetooth QR scanner.')
      }
    }, 150)
    return () => {
      cancelled = true; clearTimeout(t)
      const sc = scannerRef.current; scannerRef.current = null
      if (sc) sc.stop().then(() => sc.clear()).catch(() => {})
    }
  }, [started, camOn, facing])

  const handleCodeRef = useRef(handleCode)
  useEffect(() => { handleCodeRef.current = handleCode }, [handleCode])

  // Keep the tablet screen awake while the scanner is on.
  useEffect(() => {
    if (!started || !('wakeLock' in navigator)) return
    let lock = null
    const get = () => navigator.wakeLock.request('screen').then(l => { lock = l }).catch(() => {})
    get()
    const onVis = () => { if (document.visibilityState === 'visible') get() }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}) }
  }, [started])

  useEffect(() => {
    const onFs = () => setKiosk(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  function toggleKiosk() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else wrapRef.current?.requestFullscreen?.().catch(() => {})
  }

  const c = result ? COLORS[result.kind] || COLORS.unknown : null
  const time = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const iconBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }

  return (
    <div className="fade-in">
      {!kiosk && <PageHeader eyebrow="Entrance" title="Scanner" subtitle="Players show their Torque card. Booked: confirmed. Not booked: books now and uses 1 session. Problems show in red." />}

      <div ref={wrapRef} data-theme="dark" style={{ position: 'relative', background: '#0a1628', borderRadius: kiosk ? 0 : 18, overflow: 'hidden', minHeight: kiosk ? '100vh' : 560, color: '#fff', display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 900, fontSize: 22, letterSpacing: '0.04em' }}>TORQUE CHECK-IN</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8, fontSize: 12, color: started ? '#06D6A0' : '#9fb3d1' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: started ? '#06D6A0' : '#5A6B84', boxShadow: started ? '0 0 10px #06D6A0' : 'none' }} />
            {started ? (busy ? 'Checking…' : 'Ready to scan') : 'Off'}
          </div>
          <div style={{ flex: 1 }} />
          {started && <>
            <button style={iconBtn} onClick={() => setCamOn(v => !v)}><Camera size={15} /> {camOn ? 'Camera on' : 'Camera off'}</button>
            {camOn && <button style={iconBtn} onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')}><RefreshCw size={15} /> {facing === 'user' ? 'Front' : 'Back'}</button>}
            <button style={iconBtn} onClick={() => setSound(v => !v)}>{sound ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
          </>}
          <button style={iconBtn} onClick={toggleKiosk}>{kiosk ? <Minimize size={15} /> : <Maximize size={15} />} {kiosk ? 'Exit full screen' : 'Full screen'}</button>
        </div>

        {!started ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 15, color: '#9fb3d1', maxWidth: 460, lineHeight: 1.6 }}>
              Works with the tablet camera or a USB / Bluetooth QR scanner. Leave this screen open at the entrance.
            </div>
            <button onClick={() => { unlock(); setStarted(true) }}
              style={{ padding: '18px 40px', borderRadius: 14, border: 'none', background: '#3b82f6', color: '#fff', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 900, fontSize: 22, letterSpacing: '0.05em', cursor: 'pointer' }}>
              START SCANNER
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', minHeight: 0 }} className="scanner-grid">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 }}>
              {camOn ? (
                <div id={READER_ID} style={{ width: '100%', maxWidth: 520, borderRadius: 16, overflow: 'hidden', background: '#000' }} />
              ) : (
                <div style={{ fontSize: 15, color: '#9fb3d1', textAlign: 'center' }}>Waiting for the QR scanner…</div>
              )}
              {camError && <div style={{ fontSize: 13, color: '#FFB703', textAlign: 'center', maxWidth: 480 }}>{camError}</div>}
              <div style={{ fontSize: 14, color: '#9fb3d1' }}>Hold the player card in front of the camera</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', padding: 14, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#9fb3d1', fontWeight: 700, marginBottom: 10 }}>RECENT</div>
              {!recent.length && <div style={{ fontSize: 13, color: '#5A6B84' }}>No scans yet.</div>}
              {recent.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: (COLORS[r.kind] || COLORS.unknown).bg, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.kid_name || 'Unknown card'}</div>
                    <div style={{ fontSize: 11, color: '#9fb3d1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#5A6B84' }}>{time(r.at)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Result overlay */}
        {result && c && (
          <div style={{ position: 'absolute', inset: 0, background: c.bg, color: c.fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16, textAlign: 'center', zIndex: 5 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 900, fontSize: 'clamp(40px, 7vw, 76px)', letterSpacing: '0.04em', lineHeight: 1 }}>{c.title}</div>
            {result.kid_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 22, background: 'rgba(10,22,40,0.88)', color: '#fff', padding: 18, borderRadius: 20, maxWidth: 680, width: '100%', textAlign: 'left' }}>
                <div style={{ width: 130, height: 150, borderRadius: 14, overflow: 'hidden', background: '#13284a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {result.photo_url
                    ? <img src={result.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 900, fontSize: 64, opacity: 0.4 }}>{result.kid_name[0]}</span>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 900, fontSize: 36, lineHeight: 1.05 }}>{result.kid_name}</div>
                  <div style={{ fontSize: 15, color: '#9fb3d1', marginTop: 6 }}>
                    {[result.age != null ? `${result.age} yrs` : null, result.package_name, result.team_age ? `Team ${result.team_age}U` : null].filter(Boolean).join('  ·  ')}
                  </div>
                  {result.sessions_left != null && result.package_name && (
                    <div style={{ fontSize: 15, marginTop: 6 }}><b style={{ fontSize: 22 }}>{result.sessions_left}</b> sessions left</div>
                  )}
                  {result.kind === 'blocked' && result.parent_name && (
                    <div style={{ fontSize: 13, color: '#9fb3d1', marginTop: 6 }}>Parent: {result.parent_name}{result.parent_phone ? `  ·  ${result.parent_phone}` : ''}</div>
                  )}
                </div>
              </div>
            )}
            <div style={{ fontSize: 'clamp(18px, 2.6vw, 26px)', fontWeight: 800, maxWidth: 680 }}>{result.reason}</div>
            {result.kind === 'blocked' && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => setResult(null)} disabled={busy}
                  style={{ padding: '14px 26px', borderRadius: 12, border: '2px solid #fff', background: 'transparent', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>Dismiss</button>
                <button onClick={letIn} disabled={busy}
                  style={{ padding: '14px 26px', borderRadius: 12, border: 'none', background: '#fff', color: '#E63946', fontWeight: 900, fontSize: 16, cursor: 'pointer' }}>
                  {busy ? 'Saving…' : 'Let in anyway'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@media (max-width: 760px) { .scanner-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
