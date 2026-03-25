import React, { useState } from 'react'
import { 
  SignedIn, 
  SignedOut, 
  SignIn, 
  UserButton, 
  useUser 
} from "@clerk/clerk-react";
import { dark } from '@clerk/themes';

import { AppProvider, useApp } from './context/AppContext'
import AdminSidebar from './components/AdminSidebar'
import AdminDashboard from './pages/admin/AdminDashboard'
import Families from './pages/admin/Families'
import Attendance from './pages/admin/Attendance'
import { Schedule, Payments, Events } from './pages/admin/AdminPages'
import ParentPortal from './pages/parent/ParentPortal'

// ── CONFIGURACIÓN DE PÁGINAS ADMIN ──────────────────────────────────────────
const ADMIN_PAGES = {
  dashboard: AdminDashboard,
  families: Families,
  schedule: Schedule,
  attendance: Attendance,
  payments: Payments,
  events: Events,
}

// ── VISTA ADMIN ──────────────────────────────────────────────────────────────
function AdminShell() {
  const [page, setPage] = useState('dashboard')
  const Page = ADMIN_PAGES[page] || AdminDashboard
  
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--navy)' }}>
      <AdminSidebar active={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 230, padding: '36px 40px', minHeight: '100vh' }}>
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <UserButton afterSignOutUrl="/" />
        </div>
        <div className="fade-in"><Page /></div>
      </main>
    </div>
  )
}

// ── LÓGICA DE CONTROL DE ACCESO ─────────────────────────────────────────────
function MainContent() {
  const { user } = useUser();
  
  // Leemos el "role" desde los metadatos de Clerk
  // Tú configurarás esto en el Dashboard de Clerk > Users > (Usuario) > Metadata
  const role = user?.publicMetadata?.role; 

  if (role === 'admin') {
    return <AdminShell />;
  }

  // Si no es admin, asumimos que es Parent (o puedes ser más específico)
  return <ParentPortal familyId={user?.id} />;
}

// ── APP ROOT (PROTEGIDO) ─────────────────────────────────────────────────────
export default function App() {
  return (
    <AppProvider>
      {/* SI NO ESTÁ LOGUEADO: Pantalla de Acceso */}
      <SignedOut>
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          background: 'var(--navy)',
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⚾</div>
          <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', marginBottom: 24 }}>TORQUE PERFORMANCE</h1>
          
          <SignIn appearance={{ baseTheme: dark }} />
        </div>
      </SignedOut>

      {/* SI ESTÁ LOGUEADO: Decide qué panel mostrar */}
      <SignedIn>
        <MainContent />
      </SignedIn>
    </AppProvider>
  )
}
