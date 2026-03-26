import React, { useState, useEffect } from 'react'
import { Calendar, RotateCcw, X, ChevronRight, Home, BookOpen, CreditCard, Megaphone, User, Plus } from 'lucide-react'
import { Card, Badge, Avatar, Btn, Modal, SessionBubble, ProgressBar, Label } from '../../components/UI'
import { useUser } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient" // Asegúrate de que la ruta sea correcta
import { PACKAGES, SLOTS, SESSION_TYPES, EVENTS } from '../../data/mockData'

// ── PARENT PORTAL SHELL ──────────────────────────────────────────────────────
export default function ParentPortal({ onBack }) {
  const { user } = useUser();
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [players, setPlayers] = useState([]);

  // Estado para el formulario de Onboarding
  const [onboardingData, setOnboardingData] = useState({
    phone: '',
    kidName: '',
    kidAge: '',
    kidBirthdate: ''
  });

  useEffect(() => {
    if (user) fetchTorqueData();
  }, [user]);

  async function fetchTorqueData() {
    setLoading(true);
    // 1. Buscar Perfil en Supabase
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (prof) {
      setProfile(prof);
      // 2. Buscar Jugadores (hijos)
      const { data: kids } = await supabase
        .from('players')
        .select('*')
        .eq('parent_id', user.id);
      setPlayers(kids || []);
    }
    setLoading(false);
  }

 async function handleInitialRegister(e) {
  e.preventDefault();
  setLoading(true);
  console.log("Iniciando registro para:", user.id); // Rastro 1

  // 1. Insertar Perfil
  const { data: pData, error: pError } = await supabase.from('profiles').insert([
    { 
      id: user.id, 
      full_name: user.fullName, 
      email: user.primaryEmailAddress.emailAddress, 
      phone: onboardingData.phone, 
      role: 'parent' 
    }
  ]).select();

  if (pError) {
    console.error("Error en Perfil:", pError.message, pError.details); // Rastro 2
    alert(`Error Perfil: ${pError.message}`);
    setLoading(false);
    return;
  }

  // 2. Insertar Hijo
  const { data: kData, error: kError } = await supabase.from('players').insert([
    { 
      parent_id: user.id, 
      kid_name: onboardingData.kidName, 
      age: parseInt(onboardingData.kidAge), 
      birthdate: onboardingData.kidBirthdate 
    }
  ]).select();

  if (kError) {
    console.error("Error en Jugador:", kError.message, kError.details); // Rastro 3
    alert(`Error Jugador: ${kError.message}`);
    setLoading(false);
    return;
  }

  console.log("Registro exitoso:", { pData, kData }); // Rastro 4
  fetchTorqueData();
}
  const NAV = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'sessions', label: 'Sessions', icon: BookOpen },
    { id: 'schedule', label: 'Book', icon: Calendar },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'events', label: 'Events', icon: Megaphone },
    { id: 'profile', label: 'Profile', icon: User },
  ]

  const PAGE_MAP = {
    home: <ParentHome profile={profile} players={players} onNav={setPage} />,
    sessions: <ParentSessions profile={profile} players={players} />,
    schedule: <ParentSchedule profile={profile} players={players} />,
    billing: <ParentBilling profile={profile} players={players} />,
    events: <ParentEvents />,
    profile: <ParentProfile profile={profile} players={players} />,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⚾</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>TORQUE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.15em', color: 'var(--red)' }}>PERFORMANCE</div>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(212,160,23,0.08)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Member</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{profile.full_name}</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = page === id
            return (
              <button key={id} onClick={() => setPage(id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: isActive ? 'rgba(212,160,23,0.1)' : 'transparent',
                color: isActive ? 'var(--gold)' : 'var(--text2)',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                marginBottom: 2, transition: 'all 0.15s', textAlign: 'left', border: 'none',
                borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent', cursor: 'pointer'
              }}>
                <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </button>
            )
          })}
        </nav>
      </aside>
      <main style={{ flex: 1, marginLeft: 220, padding: '36px 40px', minHeight: '100vh' }}>
        <div className="fade-in">{PAGE_MAP[page] || PAGE_MAP.home}</div>
      </main>
    </div>
  )
}

// ── HOME (Dinámico) ──────────────────────────────────────────────────────────
function ParentHome({ profile, players, onNav }) {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800 }}>Hey, {profile.full_name.split(' ')[0]}! 👋</h1>
        <p style={{ color: 'var(--text2)', marginTop: 4 }}>Manage training for your {players.length > 1 ? 'players' : 'player'}.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        {players.map((player, index) => {
          const isSibling = index > 0; // Lógica de Sibling Package automática
          return (
            <Card key={player.id}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <Avatar initials={player.kid_name[0]} size={44} color={isSibling ? 'var(--gold)' : 'var(--red)'} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800 }}>{player.kid_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Age {player.age} · Active Member</div>
                  {isSibling && <Badge color="gold">Sibling Discount Active</Badge>}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text2)' }}>Sessions remaining</span>
                  <span style={{ fontWeight: 700, color: 'var(--green)' }}>- / -</span>
                </div>
                <ProgressBar value={0} max={12} />
              </div>
            </Card>
          )
        })}
        {/* Botón para añadir más hijos */}
        <Card style={{ borderStyle: 'dashed', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
           <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
              <Plus size={24} style={{ marginBottom: 8 }}/>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Add Player</div>
           </div>
        </Card>
      </div>
    </div>
  )
}

// Estilos rápidos y Sub-componentes (Billing, Sessions, etc. deben actualizarse similar a Home)
const sidebarStyle = { width: 220, background: '#080f18', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, left: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 100 };
const inputStyle = { width: '100%', padding: '10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--navy3)', color: 'white', marginTop: 4 };

// Nota: Para las otras páginas (Sessions, Billing, Schedule) se debe seguir el mismo patrón:
// Usar la prop "players" que viene de la base de datos en lugar del objeto "family" falso.
function ParentSessions({ players }) { return <div style={{color:'white'}}>Session tracking for {players.length} players coming soon...</div> }
function ParentSchedule({ players }) { return <div style={{color:'white'}}>Booking system coming soon...</div> }
function ParentBilling({ players }) { return <div style={{color:'white'}}>Billing details coming soon...</div> }
function ParentEvents() { return <div style={{color:'white'}}>Events coming soon...</div> }
function ParentProfile({ profile, players }) { return <div style={{color:'white'}}>Profile settings for {profile.full_name}</div> }
