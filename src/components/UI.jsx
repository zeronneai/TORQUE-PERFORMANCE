import React from 'react'
import { createPortal } from 'react-dom'

export function Card({ children, style = {}, onClick, highlight }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--navy2)',
      border: `1px solid ${highlight ? 'rgba(255,255,255,0.3)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      padding: 20,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.2s, transform 0.15s',
      ...style,
    }}
      onMouseEnter={onClick ? e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.transform = 'translateY(-1px)' } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.borderColor = highlight ? 'rgba(255,255,255,0.3)' : 'var(--border)'; e.currentTarget.style.transform = 'none' } : undefined}
    >
      {children}
    </div>
  )
}

export function Badge({ children, color = 'default', size = 'sm' }) {
  const colors = {
    default: { bg: 'var(--navy3)',      text: 'var(--text2)' },
    red:     { bg: 'var(--red-soft)',   text: '#ff4466' },
    green:   { bg: 'var(--green-soft)', text: 'var(--green)' },
    amber:   { bg: 'var(--amber-soft)', text: 'var(--amber)' },
    blue:    { bg: 'var(--blue-soft)',  text: 'var(--blue-light)' },
    gold:    { bg: 'var(--gold-soft)',  text: 'var(--gold)' },
    white:   { bg: 'rgba(255,255,255,0.08)', text: '#ffffff' },
  }
  const c = colors[color] || colors.default
  return (
    <span style={{
      background: c.bg, color: c.text,
      fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600,
      padding: size === 'sm' ? '3px 9px' : '5px 13px',
      borderRadius: 20,
      letterSpacing: '0.03em',
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
    }}>{children}</span>
  )
}

export function Avatar({ initials, size = 36, color = 'var(--navy4)' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color,
      border: '1px solid rgba(255,255,255,0.12)',
      display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontSize: size * 0.35, fontWeight: 700,
      color: '#fff', flexShrink: 0, letterSpacing: '0.05em',
    }}>{initials}</div>
  )
}

export function StatCard({ label, value, sub, trend, icon }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>{label}</div>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
      {(sub || trend !== undefined) && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {trend !== undefined && <span style={{ color: trend >= 0 ? 'var(--green)' : '#ff4466', fontWeight: 600 }}>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>}
          {sub}
        </div>
      )}
    </Card>
  )
}

export function Btn({ children, variant = 'primary', onClick, style = {}, size = 'md', disabled }) {
  const v = {
    primary: { background: '#FFFFFF', color: 'var(--navy)', border: 'none' },
    ghost:   { background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border)' },
    navy:    { background: 'var(--navy3)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger:  { background: 'var(--red-soft)', color: '#ff4466', border: '1px solid rgba(200,16,46,0.25)' },
    success: { background: 'var(--green-soft)', color: 'var(--green)', border: '1px solid rgba(46,204,113,0.25)' },
    gold:    { background: 'var(--gold-soft)', color: 'var(--gold)', border: '1px solid rgba(212,160,23,0.3)' },
    white:   { background: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' },
  }
  const s = { sm: { padding: '6px 14px', fontSize: 12 }, md: { padding: '9px 18px', fontSize: 13, minHeight: 44 }, lg: { padding: '12px 24px', fontSize: 15, minHeight: 44 } }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.15s, transform 0.1s',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-display)', letterSpacing: '0.03em', textTransform: 'uppercase',
      opacity: disabled ? 0.4 : 1,
      ...v[variant], ...s[size], ...style,
    }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '0.85' }}
      onMouseLeave={e => e.currentTarget.style.opacity = disabled ? '0.4' : '1'}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    >{children}</button>
  )
}

export function PageHeader({ title, subtitle, action, eyebrow }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
      <div>
        {eyebrow && <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 4 }}>{eyebrow}</div>}
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = 500 }) {
  if (!open) return null
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: 'var(--navy2)', border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-lg)', padding: 'clamp(16px, 4vw, 28px)',
        width: '100%', maxWidth: `min(${width}px, 95vw)`, maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--text3)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

export function ProgressBar({ value, max, color, height = 6 }) {
  const pct = Math.min((value / max) * 100, 100)
  const barColor = color || (pct >= 100 ? 'var(--red)' : pct >= 75 ? 'var(--amber)' : 'var(--green)')
  return (
    <div style={{ height, background: 'var(--navy4)', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: height, transition: 'width 0.5s ease' }} />
    </div>
  )
}

export function SessionBubble({ used, total }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: '50%',
          background: i < used ? 'rgba(255,255,255,0.7)' : 'var(--navy4)',
          border: `1px solid ${i < used ? 'rgba(255,255,255,0.4)' : 'var(--navy3)'}`,
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  )
}

export function Label({ children }) {
  return <label style={{ display: 'block', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 6 }}>{children}</label>
}
