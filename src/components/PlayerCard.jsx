import React, { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

// Trading-card style player card drawn on a canvas so it can be downloaded as an image.
// The QR only holds the card token; the scanner looks everything else up live.
export const CARD_W = 750
export const CARD_H = 1050

const NAVY = '#0a1628', BLUE = '#1a56a0', SKY = '#3b82f6'

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function fitText(ctx, text, maxW, size, font) {
  let s = size
  do { ctx.font = font(s); s -= 2 } while (ctx.measureText(text).width > maxW && s > 20)
}

async function draw(canvas, qrCanvas, info) {
  const ctx = canvas.getContext('2d')
  try { await Promise.all([document.fonts.load('italic 72px Anton'), document.fonts.load('700 28px Inter')]) } catch { /* fallback fonts */ }
  const photo = await loadImage(info.photo_url)
  const W = CARD_W, H = CARD_H
  ctx.clearRect(0, 0, W, H)

  // Card body + frame
  roundRect(ctx, 0, 0, W, H, 40); ctx.fillStyle = NAVY; ctx.fill()
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, SKY); g.addColorStop(1, BLUE)
  ctx.lineWidth = 14; ctx.strokeStyle = g; roundRect(ctx, 7, 7, W - 14, H - 14, 34); ctx.stroke()

  // Photo window
  const px = 38, py = 38, pw = W - 76, ph = 610
  ctx.save(); roundRect(ctx, px, py, pw, ph, 22); ctx.clip()
  if (photo) {
    const s = Math.max(pw / photo.width, ph / photo.height)
    const iw = photo.width * s, ih = photo.height * s
    ctx.drawImage(photo, px + (pw - iw) / 2, py + (ph - ih) / 3, iw, ih)
  } else {
    const bg = ctx.createLinearGradient(px, py, px + pw, py + ph); bg.addColorStop(0, '#13284a'); bg.addColorStop(1, '#0d1d36')
    ctx.fillStyle = bg; ctx.fillRect(px, py, pw, ph)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.font = 'italic 420px Anton, Impact, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText((info.kid_name || '?')[0].toUpperCase(), px + pw / 2, py + ph - 110)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 26px Inter, sans-serif'
    ctx.fillText('Add a photo', px + pw / 2, py + ph - 60)
  }
  // dark fade at the bottom of the photo for the name
  const fade = ctx.createLinearGradient(0, py + ph - 220, 0, py + ph); fade.addColorStop(0, 'rgba(10,22,40,0)'); fade.addColorStop(1, 'rgba(10,22,40,0.92)')
  ctx.fillStyle = fade; ctx.fillRect(px, py + ph - 220, pw, 220)
  ctx.restore()

  // Wordmark badge (top left)
  ctx.save(); ctx.fillStyle = 'rgba(10,22,40,0.82)'; roundRect(ctx, px + 18, py + 18, 196, 58, 12); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = 'italic 40px Anton, Impact, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText('TORQUE', px + 36, py + 49); ctx.restore()

  // Team badge (top right)
  if (info.team_age) {
    const cx = px + pw - 62, cy = py + 62
    ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fillStyle = SKY; ctx.fill()
    ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = 'italic 38px Anton, Impact, sans-serif'; ctx.fillText(`${info.team_age}U`, cx, cy + 2)
  }

  // Name banner (slanted)
  const by = py + ph - 120
  ctx.save(); ctx.beginPath()
  ctx.moveTo(0, by + 18); ctx.lineTo(W, by - 14); ctx.lineTo(W, by + 92); ctx.lineTo(0, by + 124); ctx.closePath()
  const bg2 = ctx.createLinearGradient(0, 0, W, 0); bg2.addColorStop(0, BLUE); bg2.addColorStop(1, SKY)
  ctx.fillStyle = bg2; ctx.fill(); ctx.restore()
  const name = (info.kid_name || '').toUpperCase()
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  fitText(ctx, name, W - 110, 84, s => `italic ${s}px Anton, Impact, sans-serif`)
  ctx.fillText(name, 52, by + 54)

  // Stats
  const sx = 52, sy = 700
  const stat = (label, value, x, y) => {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#8fb0dd'; ctx.font = '700 20px Inter, sans-serif'; ctx.fillText(label, x, y)
    ctx.fillStyle = '#fff'; fitText(ctx, value, 200, 46, s => `italic ${s}px Anton, Impact, sans-serif`); ctx.fillText(value, x, y + 50)
  }
  stat('AGE', info.age != null ? String(info.age) : '-', sx, sy)
  stat('PACKAGE', info.package_name ? info.package_name.replace(/^Package\s+/i, '') : 'NONE', sx + 190, sy)
  stat('SESSIONS LEFT', info.sessions_left != null ? `${info.sessions_left} / ${info.sessions_total}` : '-', sx, sy + 110)
  stat('TORQUE TEAM', info.team_age ? `${info.team_age}U` : 'NO', sx + 190, sy + 110)

  // QR
  const qx = W - 38 - 262, qy = 672
  ctx.fillStyle = '#fff'; roundRect(ctx, qx, qy, 262, 262, 18); ctx.fill()
  if (qrCanvas) ctx.drawImage(qrCanvas, qx + 16, qy + 16, 230, 230)

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(52, 958, W - 104, 2)
  ctx.fillStyle = '#9fb3d1'; ctx.font = '600 19px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.fillText('TORQUE BASEBALL ACADEMY  ·  EL PASO, TX', 52, 998)
  ctx.textAlign = 'right'
  ctx.fillText(`Info as of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, W - 52, 998)
}

export default function PlayerCard({ info, width = 320, onCanvas }) {
  const canvasRef = useRef(null)
  const qrRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    const go = async () => {
      if (!canvasRef.current) return
      await draw(canvasRef.current, qrRef.current, info)
      if (alive) { setReady(true); onCanvas?.(canvasRef.current) }
    }
    const t = setTimeout(go, 30)   // let the hidden QR canvas render first
    return () => { alive = false; clearTimeout(t) }
  }, [info.token, info.photo_url, info.kid_name, info.package_name, info.sessions_left, info.team_age, info.age])

  return (
    <div style={{ width, maxWidth: '100%' }}>
      <div style={{ display: 'none' }}>
        {info.token && <QRCodeCanvas ref={qrRef} value={info.token} size={460} level="M" marginSize={1} />}
      </div>
      <canvas ref={canvasRef} width={CARD_W} height={CARD_H}
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 18, boxShadow: '0 18px 48px rgba(10,22,40,0.35)', opacity: ready ? 1 : 0.4, transition: 'opacity .3s' }} />
    </div>
  )
}
