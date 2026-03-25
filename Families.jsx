import React from 'react'
import { LayoutDashboard, Users, Calendar, ClipboardCheck, DollarSign, Megaphone, ChevronRight, LogOut } from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'families', label: 'Families', icon: Users },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { id: 'payments', label: 'Payments', icon: DollarSign },
  { id: 'events', label: 'Events', icon: Megaphone },
]

export default function AdminSidebar({ active, onNav, onSwitchToParent }) {
  return (
    <aside style={{
      width: 230, minHeight: '100vh',
      background: '#080f18',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 28 }}>⚾</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 17, letterSpacing: '0.03em', color: 'var(--text)', lineHeight: 1 }}>TORQUE</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.15em', color: 'var(--red)', lineHeight: 1 }}>PERFORMANCE</div>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ padding: '10px 20px', background: 'rgba(200,16,46,0.08)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--red)', textTransform: 'uppercase' }}>Admin Panel</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px' }}>
        {NAV.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button key={id} onClick={() => onNav(id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              background: isActive ? 'rgba(200,16,46,0.12)' : 'transparent',
              color: isActive ? '#fff' : 'var(--text2)',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              marginBottom: 2, transition: 'all 0.15s', textAlign: 'left',
              borderLeft: isActive ? '3px solid var(--red)' : '3px solid transparent',
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
      <div style={{ padding: '14px 10px', borderTop: '1px solid var(--border)' }}>
        <button onClick={onSwitchToParent} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 8, color: 'var(--text3)',
          fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
          textTransform: 'uppercase', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
        >
          <LogOut size={14} />
          <span>View as Parent</span>
        </button>
      </div>
    </aside>
  )
}
