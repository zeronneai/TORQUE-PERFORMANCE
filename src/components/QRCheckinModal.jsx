import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { CheckCircle, AlertCircle, Clock, Camera, X } from 'lucide-react'

const ACADEMY_QR_URL = 'https://torque-performance.vercel.app/checkin'
const SCANNER_ID = 'qr-scanner-view'
const GREEN = '#22C56E'
const AMBER = '#f39c12'
const RED   = '#ff3355'

export default function QRCheckinModal({ open, onClose, player, parentId }) {
  const [step, setStep]       = useState('idle')
  const [result, setResult]   = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const scannerRef  = useRef(null)
  const scannedRef  = useRef(false)

  // Reset every time the modal opens
  useEffect(() => {
    if (open) {
      setStep('scanning')
      setResult(null)
      setErrorMsg('')
      scannedRef.current = false
    } else {
      setStep('idle')
    }
  }, [open])

  async function performCheckin() {
    try {
      const { data: mems } = await supabase
        .from('player_memberships').select('*')
        .eq('parent_id', parentId).eq('kid_name', player.kid_name)
        .eq('status', 'active').order('purchased_at', { ascending: false }).limit(1)

      const membership = mems?.[0]
      if (!membership) { setStep('no-sessions'); return }

      const remaining = (membership.sessions_total || 0) - (membership.sessions_used || 0)
      if (remaining <= 0) { setStep('no-sessions'); return }

      const today    = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      const { data: existing } = await supabase.from('checkins').select('id')
        .eq('parent_id', parentId).eq('kid_name', player.kid_name)
        .gte('checked_in_at', today + 'T00:00:00.000Z')
        .lt('checked_in_at', tomorrow + 'T00:00:00.000Z')
        .maybeSingle()

      if (existing) { setStep('already'); return }

      const remainingAfter = remaining - 1
      const { error: ciErr } = await supabase.from('checkins').insert({
        parent_id: parentId, kid_name: player.kid_name,
        membership_id: membership.id, sessions_remaining_after: remainingAfter,
      })
      if (ciErr) throw ciErr

      await supabase.from('player_memberships')
        .update({ sessions_used: membership.sessions_used + 1 }).eq('id', membership.id)

      const nextPayment = membership.purchased_at
        ? new Date(new Date(membership.purchased_at).getTime() + 30 * 24 * 60 * 60 * 1000)
            .toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
        : null

      setResult({ remaining: remainingAfter, nextPayment, packageName: membership.package_name, kidName: player.kid_name })
      setStep('success')
    } catch (err) {
      setErrorMsg(err.message || String(err))
      setStep('error')
    }
  }

  async function handleFallback() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    setStep('processing')
    await performCheckin()
  }

  // Camera scanner lifecycle
  useEffect(() => {
    if (!open || step !== 'scanning') return

    let cancelled = false
    scannedRef.current = false

    const timer = setTimeout(async () => {
      if (cancelled) return
      if (!document.getElementById(SCANNER_ID)) return

      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return

        const scanner = new Html5Qrcode(SCANNER_ID)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decodedText) => {
            if (scannedRef.current || cancelled) return
            scannedRef.current = true
            try { await scanner.stop() } catch {}
            scannerRef.current = null

            if (!decodedText.startsWith(ACADEMY_QR_URL)) {
              setStep('wrong-qr')
              return
            }
            setStep('processing')
            await performCheckin()
          },
          () => {} // per-frame decode errors are normal
        )
      } catch (err) {
        if (cancelled) return
        const msg = String(err)
        if (msg.includes('NotAllowed') || msg.includes('Permission') || msg.includes('permission')) {
          setStep('no-permission')
        } else {
          setErrorMsg(msg)
          setStep('error')
        }
      }
    }, 150)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [open, step]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !player) return null

  const kidName = player.kid_name

  const CloseBtn = () => (
    <button onClick={onClose} style={{ padding: '12px 28px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
      Cerrar
    </button>
  )

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#060d18', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, letterSpacing: '0.08em', color: '#fff', lineHeight: 1 }}>TORQUE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>PERFORMANCE</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', padding: 8, display: 'flex', alignItems: 'center' }}>
          <X size={22} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 24px 48px' }}>

        {/* ── SCANNING ── */}
        {step === 'scanning' && (
          <>
            <div style={{ marginBottom: 22, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                Escanear QR
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                Apunta al código QR de la academia
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>
                Registrando entrada para <strong style={{ color: '#fff' }}>{kidName}</strong>
              </div>
            </div>

            {/* Camera viewport */}
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <div style={{ width: 280, height: 280, borderRadius: 14, overflow: 'hidden', background: '#0a1420', position: 'relative' }}>
                <div id={SCANNER_ID} style={{ width: '100%', height: '100%' }} />
              </div>
              {/* Corner frame */}
              {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v, h]) => (
                <div key={v+h} style={{
                  position: 'absolute', width: 26, height: 26,
                  top: v === 'top' ? -2 : 'auto', bottom: v === 'bottom' ? -2 : 'auto',
                  left: h === 'left' ? -2 : 'auto', right: h === 'right' ? -2 : 'auto',
                  borderTop:    v === 'top'    ? '3px solid rgba(255,255,255,0.8)' : 'none',
                  borderBottom: v === 'bottom' ? '3px solid rgba(255,255,255,0.8)' : 'none',
                  borderLeft:   h === 'left'   ? '3px solid rgba(255,255,255,0.8)' : 'none',
                  borderRight:  h === 'right'  ? '3px solid rgba(255,255,255,0.8)' : 'none',
                  borderRadius: v === 'top' && h === 'left' ? '6px 0 0 0' : v === 'top' ? '0 6px 0 0' : h === 'left' ? '0 0 0 6px' : '0 0 6px 0',
                }} />
              ))}
            </div>

            <button onClick={handleFallback} style={{ padding: '12px 28px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Registrar sin QR
            </button>
          </>
        )}

        {/* ── PROCESSING ── */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
              Registrando…
            </div>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === 'success' && result && (
          <div style={{ textAlign: 'center', width: '100%', maxWidth: 360 }}>
            <CheckCircle size={76} color={GREEN} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto 22px' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 6 }}>
              Entrada Registrada ✅
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: GREEN, marginBottom: 24 }}>
              {result.kidName}
            </div>
            <div style={{ background: 'rgba(34,197,110,0.08)', border: '1px solid rgba(34,197,110,0.18)', borderRadius: 14, padding: '22px 24px', marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-display)', marginBottom: 4 }}>
                Sesiones restantes
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 900, color: result.remaining <= 2 ? AMBER : GREEN, lineHeight: 1 }}>
                {result.remaining}
              </div>
              {result.nextPayment && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  Próximo pago: <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{result.nextPayment}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ padding: '14px 40px', borderRadius: 10, background: '#fff', color: '#060d18', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        )}

        {/* ── ALREADY CHECKED IN ── */}
        {step === 'already' && (
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            <Clock size={68} color={AMBER} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto 22px' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 800, color: '#fff', marginBottom: 10 }}>
              Ya registraste entrada hoy
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28, lineHeight: 1.6 }}>
              Solo se permite un check-in por día para <strong style={{ color: '#fff' }}>{kidName}</strong>.
            </div>
            <CloseBtn />
          </div>
        )}

        {/* ── NO SESSIONS ── */}
        {step === 'no-sessions' && (
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            <AlertCircle size={68} color={RED} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto 22px' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 800, color: '#fff', marginBottom: 10 }}>
              No tienes sesiones disponibles
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28, lineHeight: 1.6 }}>
              Contacta a <strong style={{ color: '#fff' }}>Torque Performance</strong> para renovar tu membresía.
            </div>
            <CloseBtn />
          </div>
        )}

        {/* ── WRONG QR ── */}
        {step === 'wrong-qr' && (
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            <AlertCircle size={68} color={AMBER} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto 22px' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 800, color: '#fff', marginBottom: 10 }}>
              QR no válido
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28, lineHeight: 1.6 }}>
              No se detectó un QR válido de Torque. Asegúrate de escanear el código en la entrada de la academia.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setStep('scanning')} style={{ padding: '12px 24px', borderRadius: 10, background: '#fff', color: '#060d18', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Reintentar
              </button>
              <button onClick={handleFallback} style={{ padding: '12px 24px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Sin QR
              </button>
            </div>
          </div>
        )}

        {/* ── NO PERMISSION ── */}
        {step === 'no-permission' && (
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            <Camera size={68} color={AMBER} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto 22px' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 800, color: '#fff', marginBottom: 10 }}>
              Cámara no disponible
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28, lineHeight: 1.6 }}>
              No se pudo acceder a la cámara. Puedes registrar tu entrada directamente.
            </div>
            <button onClick={handleFallback} style={{ padding: '14px 32px', borderRadius: 10, background: '#fff', color: '#060d18', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Registrar sin QR
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            <AlertCircle size={68} color={RED} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto 22px' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 5vw, 24px)', fontWeight: 800, color: '#fff', marginBottom: 10 }}>
              Error
            </div>
            {errorMsg && (
              <div style={{ fontSize: 12, color: 'rgba(255,100,100,0.7)', fontFamily: 'var(--font-mono)', marginBottom: 24, wordBreak: 'break-all' }}>
                {errorMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setStep('scanning')} style={{ padding: '12px 24px', borderRadius: 10, background: '#fff', color: '#060d18', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Reintentar
              </button>
              <CloseBtn />
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  )
}
