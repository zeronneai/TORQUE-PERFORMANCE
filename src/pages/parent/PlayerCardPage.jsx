import React, { useEffect, useRef, useState } from 'react'
import { useSession } from '@clerk/clerk-react'
import { QRCodeSVG } from 'qrcode.react'
import { API_BASE } from '../../lib/apiBase'
import PlayerCard from '../../components/PlayerCard'

// Player Card: photo upload, trading card with QR, download, and a big QR for the entrance.
export default function PlayerCardPage() {
  const { session } = useSession()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [big, setBig] = useState(null)          // card shown full screen for scanning
  const canvases = useRef({})
  const fileInputs = useRef({})

  async function api(body) {
    const token = session ? await session.getToken() : null
    const r = await fetch(`${API_BASE}/api/player-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || 'Something went wrong.')
    return d
  }

  async function load() {
    try { const d = await api({ action: 'my_cards' }); setCards(d.cards || []); setError(null) }
    catch (e) { setError(e.message) }
    setLoading(false)
  }
  useEffect(() => { if (session) load() }, [session])

  // Shrink the photo in the browser before sending it (max 900px, JPG).
  function resize(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const s = Math.min(1, 900 / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(url)
        resolve(c.toDataURL('image/jpeg', 0.86))
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')) }
      img.src = url
    })
  }

  async function onPhoto(card, file) {
    if (!file) return
    setBusy(card.player_id); setError(null)
    try {
      const image = await resize(file)
      const d = await api({ action: 'photo_upload', playerId: card.player_id, image })
      setCards(cs => cs.map(c => c.player_id === card.player_id ? { ...c, photo_url: d.photo_url } : c))
    } catch (e) { setError(e.message) }
    setBusy(null)
  }

  function download(card) {
    const cv = canvases.current[card.player_id]
    if (!cv) return
    try {
      const a = document.createElement('a')
      a.href = cv.toDataURL('image/png')
      a.download = `${card.kid_name.replace(/\s+/g, '-')}-torque-card.png`
      a.click()
    } catch { setError('Could not create the image. Try again in a moment.') }
  }

  const btn = { padding: '10px 16px', fontSize: 13 }

  return (
    <div className="animate-fade-up">
      <div className="section-eyebrow">Parent Portal</div>
      <h1 className="section-title">PLAYER CARD</h1>
      <div className="section-bar" />
      <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 22, maxWidth: 640, lineHeight: 1.6 }}>
        Each player has a Torque card with a QR code. Show it at the entrance scanner to check in.
        Add a photo to complete the card.
      </div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(224,64,96,0.08)', border: '1px solid rgba(224,64,96,0.3)', color: '#e04060', fontSize: 13, marginBottom: 16 }}>{error}</div>}
      {loading && <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading cards…</div>}
      {!loading && !cards.length && !error && <div style={{ color: 'var(--muted)', fontSize: 14 }}>Add a player first from the Dashboard.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 28 }}>
        {cards.map(card => (
          <div key={card.player_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <PlayerCard info={card} width={300} onCanvas={(cv) => { canvases.current[card.player_id] = cv }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} ref={el => { fileInputs.current[card.player_id] = el }}
                onChange={e => { onPhoto(card, e.target.files?.[0]); e.target.value = '' }} />
              <button className="btn-primary" style={btn} disabled={busy === card.player_id}
                onClick={() => fileInputs.current[card.player_id]?.click()}>
                {busy === card.player_id ? 'Uploading…' : card.photo_url ? 'Change photo' : 'Add photo'}
              </button>
              <button className="btn-primary" style={btn} onClick={() => setBig(card)}>Show QR</button>
              <button onClick={() => download(card)}
                style={{ ...btn, background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>
                Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {big && (
        <div onClick={() => setBig(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 24 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 900, fontSize: 34, color: '#0a1628', textAlign: 'center' }}>{big.kid_name}</div>
          <QRCodeSVG value={big.token} size={Math.min(320, window.innerWidth - 60)} level="M" marginSize={2} />
          <div style={{ fontSize: 14, color: '#5a6b84', textAlign: 'center' }}>Hold the screen up to the scanner. Turn your brightness up.<br />Tap anywhere to close.</div>
        </div>
      )}
    </div>
  )
}
