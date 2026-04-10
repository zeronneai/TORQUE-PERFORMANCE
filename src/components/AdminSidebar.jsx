import React from 'react'
import { useClerk } from '@clerk/clerk-react'
import { LayoutDashboard, Users, Calendar, DollarSign, Megaphone, ChevronRight, LogOut, X } from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'families',  label: 'Families',  icon: Users },
  { id: 'schedule',  label: 'Schedule',  icon: Calendar },
  { id: 'payments',  label: 'Payments',  icon: DollarSign },
  { id: 'events',    label: 'Events',    icon: Megaphone },
]

export default function AdminSidebar({ active, onNav, open, onClose }) {
  const { signOut } = useClerk()

  function handleNav(id) {
    onNav(id)
    if (onClose) onClose()
  }

  return (
    <aside className={`admin-sidebar${open ? ' open' : ''}`} style={{
      width: 230, minHeight: '100vh',
      background: '#080f18',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, zIndex: 100,
    }}>
      {/* Logo + close button on mobile */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 28 }}>⚾</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 17, letterSpacing: '0.03em', color: '#ffffff', lineHeight: 1 }}>TORQUE</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.15em', color: 'var(--text2)', lineHeight: 1 }}>PERFORMANCE</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4, display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Role badge */}
      <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text2)', textTransform: 'uppercase' }}>Admin Panel</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px' }}>
        {NAV.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button key={id} onClick={() => handleNav(id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: isActive ? '#fff' : 'var(--text2)',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              marginBottom: 2, transition: 'all 0.15s', textAlign: 'left',
              borderLeft: isActive ? '3px solid #ffffff' : '3px solid transparent',
            }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text)' } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' } }}
            >
              <Icon size={15} strokeWidth={isActive ? 2.5 : 1.8} />
              <span style={{ flex: 1 }}>{label}</span>
              {isActive && <ChevronRight size={12} />}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px 10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => signOut({ redirectUrl: '/' })} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 8,
          color: '#ff3355', border: '1px solid rgba(255,51,85,0.25)',
          background: 'rgba(255,51,85,0.07)',
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,51,85,0.18)'; e.currentTarget.style.borderColor = 'rgba(255,51,85,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,51,85,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,51,85,0.25)' }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
