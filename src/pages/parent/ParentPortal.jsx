import React, { useState, useEffect } from 'react'
import { Calendar, RotateCcw, X, ChevronRight, Home, BookOpen, CreditCard, Megaphone, User, Plus } from 'lucide-react'
import { Card, Badge, Avatar, Btn, Modal, SessionBubble, ProgressBar, Label } from '../../components/UI'
import { useUser, SignIn } from "@clerk/clerk-react" // Importamos SignIn por si acaso
import { supabase } from "../../supabaseClient" 

export default function ParentPortal({ onBack }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const [page, setPage] = useState('home');
  const [dbLoading, setDbLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [players, setPlayers] = useState([]);

  // 1. LÓGICA DE DATOS (Corre en silencio)
  useEffect(() => {
    async function loadData() {
      if (isLoaded && isSignedIn && user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (prof) {
          setProfile(prof);
          const { data: kids } = await supabase.from('players').select('*').eq('parent_id', user.id);
          setPlayers(kids || []);
        }
        setDbLoading(false);
      }
    }
    loadData();
  }, [isLoaded, isSignedIn, user]);

  // --- 2. PANTALLA DE CARGA ORIGINAL (Solo si Clerk no ha despertado) ---
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#080f18] flex items-center justify-center">
        <div className="animate-pulse text-[#ce9f42] font-bold">LOADING TORQUE...</div>
      </div>
    );
  }

  // --- 3. PANTALLA DE CLERK ORIGINAL (Si no está logueado, se ve tu fondo y el login) ---
  if (!isSignedIn) {
    return (
      <div style={backgroundStyle}> {/* AQUÍ REGRESA TU IMAGEN DE FONDO */}
        <div style={overlayStyle}>
          <SignIn />
        </div>
      </div>
    );
  }

  // --- 4. SI YA ESTÁ LOGUEADO PERO NO TIENE PERFIL (Onboarding) ---
  if (!dbLoading && !profile) {
    return (
      <div style={backgroundStyle}>
        <div style={overlayStyle}>
          <OnboardingForm user={user} onComplete={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  // --- 5. DASHBOARD FINAL (Tu diseño original con sidebar) ---
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080f18' }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid #1a2433' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>⚾</div>
          <div style={{ fontWeight: 900, color: 'white', letterSpacing: '1px' }}>TORQUE</div>
        </div>
        <nav style={{ padding: '20px 10px' }}>
          {['home', 'sessions', 'schedule', 'billing'].map(item => (
            <button 
              key={item} 
              onClick={() => setPage(item)}
              style={{
                width: '100%', padding: '12px', textAlign: 'left', background: page === item ? '#ce9f4222' : 'transparent',
                color: page === item ? '#ce9f42' : '#94a3b8', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                fontWeight: 600, textTransform: 'uppercase', fontSize: 12
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main style={{ flex: 1, marginLeft: 220, padding: '40px' }}>
        <h1 style={{ color: 'white', fontSize: 32, fontWeight: 800 }}>
          Welcome back, {profile?.full_name?.split(' ')[0] || user?.firstName}!
        </h1>
        {/* Aquí tus tarjetas originales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 30 }}>
            {players.length > 0 ? players.map(p => (
                <Card key={p.id}>
                    <h3 style={{color: 'white'}}>{p.kid_name}</h3>
                    <ProgressBar value={0} max={12} />
                </Card>
            )) : <p style={{color: '#94a3b8'}}>No players registered yet.</p>}
        </div>
      </main>
    </div>
  );
}

// ESTILOS QUE RECUPERAN TU LOOK ORIGINAL
const backgroundStyle = {
  minHeight: '100vh',
  backgroundImage: 'url("/tu-imagen-de-fondo.jpg")', // Pon aquí la ruta de tu imagen
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const overlayStyle = {
  backgroundColor: 'rgba(8, 15, 24, 0.85)', // Oscurece un poco el fondo para que Clerk se vea pro
  width: '100%',
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(8px)' // Ese efecto de desenfoque premium que te gusta
};

const sidebarStyle = { width: 220, background: '#080f18', borderRight: '1px solid #1a2433', position: 'fixed', top: 0, left: 0, bottom: 0 };

function OnboardingForm({ user, onComplete }) {
    // Formulario simplificado para no estorbar el diseño
    return (
        <Card style={{ maxWidth: 400, padding: 30, background: '#111926', border: '1px solid #ce9f42' }}>
            <h2 style={{ color: '#ce9f42', marginBottom: 20 }}>FINAL STEP</h2>
            <p style={{ color: 'white', marginBottom: 20 }}>Welcome {user.firstName}, just a few more details.</p>
            <Btn onClick={async () => {
                // Simulación rápida para que veas el Dashboard
                alert("Please fill in the DB manually or add inputs here");
            }}>CONTINUE TO PORTAL</Btn>
        </Card>
    );
}
