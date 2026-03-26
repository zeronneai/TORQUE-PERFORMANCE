import React, { useState, useEffect } from 'react'
import { Calendar, RotateCcw, X, ChevronRight, Home, BookOpen, CreditCard, Megaphone, User, Plus } from 'lucide-react'
import { Card, Badge, Avatar, Btn, Modal, SessionBubble, ProgressBar, Label } from '../../components/UI'
import { useUser } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient" 

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function ParentPortal({ onBack }) {
  const { user, isLoaded } = useUser();
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (isLoaded && user) {
      fetchTorqueData();
    } else if (isLoaded && !user) {
      setLoading(false);
    }
  }, [isLoaded, user]);

  async function fetchTorqueData() {
    try {
      setLoading(true);
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (prof) {
        setProfile(prof);
        const { data: kids } = await supabase
          .from('players')
          .select('*')
          .eq('parent_id', user.id);
        setPlayers(kids || []);
      }
    } catch (err) {
      console.error("Error crítico:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- NAVEGACIÓN ---
  const NAV = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'sessions', label: 'Sessions', icon: BookOpen },
    { id: 'schedule', label: 'Book', icon: Calendar },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'events', label: 'Events', icon: Megaphone },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const PAGE_MAP = {
    home: <ParentHome profile={profile} players={players} onNav={setPage} />,
    sessions: <ParentSessions profile={profile} players={players} />,
    schedule: <ParentSchedule profile={profile} players={players} />,
    billing: <ParentBilling profile={profile} players={players} />,
    events: <ParentEvents />,
    profile: <ParentProfile profile={profile} players={players} />,
  };

  // --- RENDERIZADO DE SEGURIDAD ---
  if (!isLoaded || loading) {
    return (
      <div style={{ background: '#080f18', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ce9f42', fontFamily: 'var(--font-display)' }}>
        <div className="pulse">ESTABLISHING CONNECTION...</div>
      </div>
    );
  }

  if (!profile) {
    return <OnboardingScreen user={user} onComplete={fetchTorqueData} />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080f18' }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⚾</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'white' }}>TORQUE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.15em', color: 'var(--red)' }}>PERFORMANCE</div>
        </div>
        
        <div style={{ padding: '10px 14px', background: 'rgba(212,160,23,0.08)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Member</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{profile?.full_name}</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = page === id;
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

      <main style={{ flex: 1, marginLeft: 220, padding: '36px 40px', minHeight: '100vh', background: '#080f18' }}>
        <div className="fade-in">{PAGE_MAP[page] || PAGE_MAP.home}</div>
      </main>
    </div>
  );
}

// ── COMPONENTE ONBOARDING ──────────────────────────────────────────────────────
function OnboardingScreen({ user, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ phone: '', kidName: '', kidAge: '', kidBirthdate: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Crear Perfil
      const { error: pError } = await supabase.from('profiles').insert([{ 
        id: user.id, 
        full_name: user.fullName, 
        email: user.primaryEmailAddress.emailAddress, 
        phone: data.phone, 
        role: 'parent' 
      }]);
      if (pError) throw pError;

      // 2. Crear Jugador
      const { error: kError } = await supabase.from('players').insert([{ 
        parent_id: user.id, 
        kid_name: data.kidName, 
        age: parseInt(data.kidAge), 
        birthdate: data.kidBirthdate 
      }]);
      if (kError) throw kError;

      onComplete();
    } catch (err) {
      alert("Error al registrar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#080f18', padding: 20 }}>
      <Card style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: '30px' }}>
        <h2 style={{ color: 'var(--gold)', marginBottom: 10, fontFamily: 'var(--font-display)' }}>WELCOME TO TORQUE</h2>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 25 }}>Complete your player registration</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input placeholder="Your Phone (WhatsApp)" required onChange={e => setData({...data, phone: e.target.value})} style={inputStyle} />
          <input placeholder="Player Full Name" required onChange={e => setData({...data, kidName: e.target.value})} style={inputStyle} />
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder="Age" type="number" required onChange={e => setData({...data, kidAge: e.target.value})} style={inputStyle} />
            <input type="date" required onChange={e => setData({...data, kidBirthdate: e.target.value})} style={inputStyle} />
          </div>
          <Btn type="submit" disabled={loading} style={{ marginTop: 10, width: '100%' }}>
            {loading ? 'CREATING...' : 'START TRAINING'}
          </Btn>
        </form>
      </Card>
    </div>
  );
}

// ── VISTAS DEL DASHBOARD ──────────────────────────────────────────────────────
function ParentHome({ profile, players }) {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: 'white' }}>
          Hey, {profile?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p style={{ color: 'var(--text2)', marginTop: 4 }}>Manage training for your {players.length} players.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {players.map((player, idx) => (
          <Card key={player.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <Avatar initials={player.kid_name[0]} size={44} color={idx > 0 ? 'var(--gold)' : 'var(--red)'} />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'white' }}>{player.kid_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Age {player.age} · Active Member</div>
              </div>
            </div>
            <ProgressBar value={0} max={12} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 8, color: 'var(--text3)' }}>
              <span>Sessions remaining</span>
              <span>0 / 12</span>
            </div>
          </Card>
        ))}
        <Card style={{ borderStyle: 'dashed', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', opacity: 0.5 }}>
            <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
              <Plus size={24} style={{ marginBottom: 8 }}/>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Add Player</div>
            </div>
        </Card>
      </div>
    </div>
  );
}

// Sub-componentes placeholders
function ParentSessions() { return <div style={{color:'white'}}>Sessions content...</div> }
function ParentSchedule() { return <div style={{color:'white'}}>Booking content...</div> }
function ParentBilling() { return <div style={{color:'white'}}>Billing content...</div> }
function ParentEvents() { return <div style={{color:'white'}}>Events content...</div> }
function ParentProfile({ profile }) { return <div style={{color:'white'}}>Profile: {profile?.full_name}</div> }

// Estilos
const sidebarStyle = { width: 220, background: '#080f18', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, left: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 100 };
const inputStyle = { width: '100%', padding: '12px', borderRadius: 6, border: '1px solid var(--border)', background: '#111926', color: 'white', fontSize: '14px' };
