import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import React, { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import AdminSidebar from './components/AdminSidebar'
import AdminDashboard from './pages/admin/AdminDashboard'
import Families from './pages/admin/Families'
import Attendance from './pages/admin/Attendance'
import { Schedule, Payments, Events } from './pages/admin/AdminPages'
import ParentPortal from './pages/parent/ParentPortal'

// ── LOGIN / SELECTOR ─────────────────────────────────────────────────────────
function LoginScreen({ onAdmin, onParent }) {
  const { families } = useApp()
  const [mode, setMode] = useState('select') // select | parent-pick

  if (mode === 'parent-pick') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <button onClick={() => setMode('select')} style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 24, cursor: 'pointer' }}>← Back</button>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>Parent Portal</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 24 }}>Select your account</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {families.map(f => (
              <div key={f.id} onClick={() => onParent(f.id)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 20px', borderRadius: 12,
                background: 'var(--navy2)', border: '1px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'rgba(212,160,23,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--navy2)' }}
              >
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--navy4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--gold)' }}>
                  {f.parent.firstName[0]}{f.parent.lastName[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{f.parent.firstName} {f.parent.lastName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{f.players.length} player{f.players.length > 1 ? 's' : ''}: {f.players.map(p => p.name.split(' ')[0]).join(', ')}</div>
                </div>
                <span style={{ color: 'var(--text3)', fontSize: 18 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 20 }}>
        {/* Logo */}
        <div style={{ fontSize: 64, marginBottom: 16 }}>⚾</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--red)', textTransform: 'uppercase', marginBottom: 8 }}>MLB Prep Academy</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 900, letterSpacing: '-1px', marginBottom: 8, lineHeight: 1 }}>TORQUE<br />PERFORMANCE</h1>
        <p style={{ color: 'var(--text2)', marginBottom: 40, fontSize: 15 }}>Player management platform</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div onClick={onAdmin} style={{
            padding: '28px 20px', borderRadius: 14,
            background: 'var(--navy2)', border: '1px solid var(--border)',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.background = 'rgba(200,16,46,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--navy2)' }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏟️</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--red)', marginBottom: 4 }}>Admin Panel</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Manage families, sessions, attendance & billing</div>
          </div>

          <div onClick={() => setMode('parent-pick')} style={{
            padding: '28px 20px', borderRadius: 14,
            background: 'var(--navy2)', border: '1px solid var(--border)',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'rgba(212,160,23,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--navy2)' }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>👨‍👩‍👦</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--gold)', marginBottom: 4 }}>Parent Portal</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Track sessions, book classes & manage your player</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ADMIN SHELL ──────────────────────────────────────────────────────────────
const ADMIN_PAGES = {
  dashboard: AdminDashboard,
  families: Families,
  schedule: Schedule,
  attendance: Attendance,
  payments: Payments,
  events: Events,
}

function AdminShell({ onLogout, onParent }) {
  const [page, setPage] = useState('dashboard')
  const Page = ADMIN_PAGES[page] || AdminDashboard
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar active={page} onNav={setPage} onSwitchToParent={() => onParent('f1')} />
      <main style={{ flex: 1, marginLeft: 230, padding: '36px 40px', minHeight: '100vh' }}>
        <div className="fade-in"><Page /></div>
      </main>
    </div>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
function Root() {
  const [view, setView] = useState('login') // login | admin | parent
  const [parentId, setParentId] = useState(null)

  if (view === 'admin') return <AdminShell onLogout={() => setView('login')} onParent={id => { setParentId(id); setView('parent') }} />
  if (view === 'parent') return <ParentPortal familyId={parentId} onBack={() => setView('admin')} />
  return <LoginScreen onAdmin={() => setView('admin')} onParent={id => { setParentId(id); setView('parent') }} />
}

export default function App() {
  return <AppProvider><Root /></AppProvider>
}
