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
import { Schedule, Payments, Events } from './pages/admin/AdminPages'
import ParentPortal from './pages/parent/ParentPortal'

// ── CONFIGURACIÓN DE PÁGINAS ADMIN ──────────────────────────────────────────
const ADMIN_PAGES = {
  dashboard: AdminDashboard,
  families:  Families,
  schedule:  Schedule,
  payments:  Payments,
  events:    Events,
}

// ── VISTA ADMIN ──────────────────────────────────────────────────────────────
function AdminShell() {
  const [page, setPage] = useState('dashboard')
  const Page = ADMIN_PAGES[page] || AdminDashboard
  
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--navy)' }}>
      <AdminSidebar active={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 230, padding: '36px 40px', minHeight: '100vh' }}>
        {/* BOTÓN DE PERFIL EN LA ESQUINA */}
        <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
          <UserButton afterSignOutUrl="/" />
        </div>
        <div className="fade-in"><Page /></div>
      </main>
    </div>
  )
}

// ── LÓGICA DE CONTROL DE ACCESO (ADMIN VS PARENT) ──────────────────────────
function MainContent() {
  const { user } = useUser();
  
  // Leemos el "role" desde los metadatos de Clerk
  const role = user?.publicMetadata?.role; 

  if (role === 'admin') {
    return <AdminShell />;
  }

  // Si no es admin, asumimos que es Parent y usamos el UserID de Clerk como FamilyID
  return <ParentPortal familyId={user?.id} paymentSuccess={new URLSearchParams(window.location.search).get('payment') === 'success'} />;
}

// ── APP ROOT (PROTEGIDO GLOBALMENTE) ──────────────────────────────────────────
export default function App() {
  // 1. Links de tus imágenes
  const logoTorque = "https://res.cloudinary.com/dsprn0ew4/image/upload/v1774490841/TORQUE_hauofb.png";
  
  // REEMPLAZA ESTO CON TU ENLACE DE CLOUDINARY PARA EL FONDO:
  const fondoTorque = "https://res.cloudinary.com/dsprn0ew4/image/upload/v1774491833/Captura_de_pantalla_2026-03-25_202312_roa8ei.png"; 

  return (
    <AppProvider>
      {/* 1. SI NO ESTÁ LOGUEADO: Pantalla de Acceso con Fondo y Filtro Azul */}
      <SignedOut>
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          
          // ESTILOS DEL FONDO:
          backgroundImage: `url(${fondoTorque})`, // Ponemos la imagen
          backgroundSize: 'cover', // Que cubra toda la pantalla
          backgroundPosition: 'center', // Centrada
          backgroundRepeat: 'no-repeat',
          position: 'relative', // Necesario para la capa azul
          textAlign: 'center' 
        }}>
          
          {/* CAPA AZUL DE SUPERPOSICIÓN (OVERLAY) */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            // Color azul oscuro con 85% de opacidad (rgba: Red, Green, Blue, Alpha)
            // Ajusta el último número (0.85) para más o menos transparencia
            backgroundColor: 'rgba(0, 10, 40, 0.85)', 
            zIndex: 1 // Capa base
          }} />

          {/* CONTENIDO DEL LOGIN (LOGO, TÍTULO, FORMULARIO) */}
          {/* Usamos zIndex: 2 para que esté POR ENCIMA del filtro azul */}
          <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* LOGO DE TORQUE */}
            <img 
              src={logoTorque} 
              alt="Torque Performance Logo" 
              style={{ width: '180px', marginBottom: '24px', auto: 'height' }} 
            />
            
            <h1 style={{ 
              fontFamily: 'var(--font-display)', 
              color: 'white', 
              marginBottom: '40px',
              fontSize: '2rem',
              letterSpacing: '2px',
              fontWeight: 800,
              textTransform: 'uppercase'
            }}>
              TORQUE PERFORMANCE
            </h1>
            
            <SignIn appearance={{ baseTheme: dark }} />
          </div>
        </div>
      </SignedOut>

      {/* 2. SI ESTÁ LOGUEADO: Decide qué panel mostrar */}
      <SignedIn>
        <MainContent />
      </SignedIn>
    </AppProvider>
  )
}
