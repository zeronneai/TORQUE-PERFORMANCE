import React, { useState, useEffect } from 'react'
import { useUser, UserButton } from '@clerk/clerk-react'
import { CheckCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react'
import { supabase } from '../supabaseClient'

/*
  Requires a 'checkins' table in Supabase:

  CREATE TABLE checkins (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id text NOT NULL,
    kid_name text NOT NULL,
    membership_id uuid REFERENCES player_memberships(id),
    sessions_remaining_after integer NOT NULL,
    checked_in_at timestamptz DEFAULT now() NOT NULL
  );
  CREATE INDEX checkins_lookup ON checkins (parent_id, kid_name, checked_in_at);
*/

const BG    = '#060d18'
const CARD  = '#0d1827'
const BORD  = 'rgba(255,255,255,0.09)'
const RED   = '#ff3355'
const GREEN = '#22C56E'
const AMBER = '#f39c12'

export default function CheckIn() {
  const { user } = useUser()
  const [players, setPlayers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [checking, setChecking] = useState(false)
  const [step, setStep]         = useState('select')
  const [result, setResult]     = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!user?.id) return
    supabase.from('players').select('*').eq('parent_id', user.id).then(({ data, error }) => {
      if (!error) setPlayers(data || [])
      setLoading(false)
    })
  }, [user?.id])

  async function handleConfirm() {
    if (!selected || checking) return
    setChecking(true)
    try {
      const { data: mems } = await supabase
        .from('player_memberships')
        .select('*')
        .eq('parent_id', user.id)
        .eq('kid_name', selected)
        .eq('status', 'active')
        .order('purchased_at', { ascending: false })
        .limit(1)

      const membership = mems?.[0]
      if (!membership) { setStep('no-sessions'); return }

      const remaining = (membership.sessions_total || 0) - (membership.sessions_used || 0)
      if (remaining <= 0) { setStep('no-sessions'); return }

      const today    = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('checkins')
        .select('id')
        .eq('parent_id', user.id)
        .eq('kid_name', selected)
        .gte('checked_in_at', today + 'T00:00:00.000Z')
        .lt('checked_in_at', tomorrow + 'T00:00:00.000Z')
        .maybeSingle()

      if (existing) { setStep('already'); return }

      const remainingAfter = remaining - 1
      const { error: ciErr } = await supabase.from('checkins').insert({
        parent_id: user.id,
        kid_name: selected,
        membership_id: membership.id,
        sessions_remaining_after: remainingAfter,
      })
      if (ciErr) throw ciErr

      const { error: updErr } = await supabase
        .from('player_memberships')
        .update({ sessions_used: membership.sessions_used + 1 })
        .eq('id', membership.id)
      if (updErr) throw updErr

      setResult({ kidName: selected, remaining: remainingAfter, packageName: membership.package_name })
      setStep('success')
    } catch (err) {
      setErrorMsg(err.message || 'Error desconocido')
      setStep('error')
    } finally {
      setChecking(false)
    }
  }

  function reset() {
    setSelected(null)
    setStep('select')
    setResult(null)
    setErrorMsg('')
  }

  return (
    <div style={{
      minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '0 16px 40px',
    }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 0 0',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, letterSpacing: '0.08em', color: '#fff', lineHeight: 1 }}>TORQUE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>PERFORMANCE</div>
        </div>
        <UserButton />
      </div>

      <div style={{ width: '100%', maxWidth: 480, marginTop: 36 }}>

        {/* ── SELECT step ── */}
        {step === 'select' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 6vw, 30px)', fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
                Check In
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
                Selecciona quién va a entrenar hoy
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 14, padding: '48px 0', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                Cargando…
              </div>
            ) : players.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 14, padding: '48px 0' }}>
                No hay jugadores registrados en esta cuenta.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {players.map(p => {
                  const isSelected = selected === p.kid_name
                  const initials = (p.kid_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p.kid_name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 16,
                        padding: '18px 20px', borderRadius: 12,
                        background: isSelected ? 'rgba(255,51,85,0.10)' : CARD,
                        border: `2px solid ${isSelected ? RED : BORD}`,
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: isSelected ? RED : 'rgba(255,255,255,0.07)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#fff',
                        flexShrink: 0, transition: 'background 0.15s',
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)' }}>
                          {p.kid_name}
                        </div>
                        {p.age && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{p.age} años</div>}
                      </div>
                      <ChevronRight size={18} color={isSelected ? RED : 'rgba(255,255,255,0.2)'} />
                    </button>
                  )
                })}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!selected || checking}
              style={{
                width: '100%', padding: '16px 0',
                background: selected ? RED : 'rgba(255,255,255,0.06)',
                border: 'none', borderRadius: 12,
                color: selected ? '#fff' : 'rgba(255,255,255,0.25)',
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                cursor: selected && !checking ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              {checking ? 'Registrando…' : 'Confirmar Entrada'}
            </button>
          </>
        )}

        {/* ── SUCCESS step ── */}
        {step === 'success' && result && (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ marginBottom: 24 }}>
              <CheckCircle size={80} color={GREEN} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto' }} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 7vw, 36px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 8 }}>
              Entrada Registrada ✅
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: GREEN, marginBottom: 24 }}>
              {result.kidName}
            </div>
            <div style={{
              background: 'rgba(34,197,110,0.08)', border: '1px solid rgba(34,197,110,0.2)',
              borderRadius: 12, padding: '20px 24px', marginBottom: 32,
            }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-display)', marginBottom: 4 }}>
                Sesiones restantes
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 900, color: result.remaining <= 2 ? AMBER : GREEN, lineHeight: 1 }}>
                {result.remaining}
              </div>
              {result.packageName && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Paquete {result.packageName}</div>
              )}
            </div>
            <button onClick={reset} style={{
              padding: '14px 32px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${BORD}`,
              borderRadius: 10, color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
            }}>
              Otro jugador
            </button>
          </div>
        )}

        {/* ── ALREADY CHECKED IN step ── */}
        {step === 'already' && (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ marginBottom: 24 }}>
              <Clock size={72} color={AMBER} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto' }} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 12 }}>
              Ya registraste entrada hoy
            </div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.5 }}>
              Ya registraste entrada hoy para <strong style={{ color: '#fff' }}>{selected}</strong>.
              Solo se permite un check-in por día.
            </div>
            <button onClick={reset} style={{
              padding: '14px 32px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${BORD}`,
              borderRadius: 10, color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
            }}>
              Volver
            </button>
          </div>
        )}

        {/* ── NO SESSIONS step ── */}
        {step === 'no-sessions' && (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ marginBottom: 24 }}>
              <AlertCircle size={72} color={RED} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto' }} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 12 }}>
              Sin sesiones disponibles
            </div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.5 }}>
              No tienes sesiones disponibles. Contacta a <strong style={{ color: '#fff' }}>Torque Performance</strong> para renovar tu membresía.
            </div>
            <button onClick={reset} style={{
              padding: '14px 32px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${BORD}`,
              borderRadius: 10, color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
            }}>
              Volver
            </button>
          </div>
        )}

        {/* ── ERROR step ── */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ marginBottom: 24 }}>
              <AlertCircle size={72} color={RED} strokeWidth={1.5} style={{ display: 'block', margin: '0 auto' }} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
              Error
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,100,100,0.8)', marginBottom: 32, fontFamily: 'var(--font-mono)' }}>
              {errorMsg}
            </div>
            <button onClick={reset} style={{
              padding: '14px 32px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${BORD}`,
              borderRadius: 10, color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
            }}>
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
