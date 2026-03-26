import React, { useState, useEffect } from 'react'
import { Calendar, RotateCcw, X, ChevronRight, Home, BookOpen, CreditCard, Megaphone, User, Plus } from 'lucide-react'
import { Card, Badge, Avatar, Btn, Modal, SessionBubble, ProgressBar, Label } from '../../components/UI'
import { useUser } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient" 

export default function ParentPortal({ onBack }) {
  const { user, isLoaded } = useUser();
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [players, setPlayers] = useState([]);

  // 1. Cargar datos de Supabase
  useEffect(() => {
    async function fetchTorqueData() {
      if (!user) return;
      try {
        setLoading(true);
        const { data: prof } = await supabase
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
        console.error("Error cargando DB:", err);
      } finally {
        setLoading(false);
      }
    }

    if (isLoaded && user) {
      fetchTorqueData();
    } else if (isLoaded && !user) {
      setLoading(false);
    }
  }, [isLoaded, user]);

  // 2. Navegación
  const NAV = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'sessions', label: 'Sessions', icon: BookOpen },
    { id: 'schedule', label: 'Book', icon: Calendar },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  // 3. Manejo de Registro
  const handleRegister = async (formData) => {
    setLoading(true);
    try {
      await supabase.from('profiles').insert([{ 
        id: user.id, 
        full_name: user.fullName, 
        email: user.primaryEmailAddress.emailAddress, 
        phone: formData.phone, 
        role: 'parent' 
      }]);

      await supabase.from('players').insert([{ 
        parent_id: user.id, 
        kid_name: formData.kidName, 
        age: parseInt(formData.kidAge), 
        birthdate: formData.kidBirthdate 
      }]);

      window.location.reload(); // Recargamos para limpiar estados
    } catch (err) {
      alert("Error: " + err.message);
      setLoading(false);
    }
  };

  // --- RENDERIZADO DE SEGURIDAD ---
  if (!isLoaded || loading) {
    return (
      <div style={{ background: '#080f18', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ce9f42' }}>
        <div className="pulse">ESTABLISHING CONNECTION...</div>
      </div>
    );
  }

  // SI NO HAY PERFIL: Pantalla de Bienvenida
  if (!profile) {
    return <OnboardingScreen onRegister={handleRegister} />;
  }

  // SI HAY PERFIL: Dashboard Real
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080f18' }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'white' }}>TORQUE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--red)' }}>PERFORMANCE</div>
        </div>
        <nav style={{ padding: '12px 10px' }}>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
              background: page === id ? 'rgba(212,160,23,0.1)' : 'transparent',
              color: page === id ? 'var(--gold)' : 'var(--text2)', border: 'none', cursor: 'pointer', textAlign: 'left'
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
      </aside>

      <main style={{ flex: 1, marginLeft: 220, padding: '40px' }}>
        {page === 'home' ? (
          <ParentHome profile={profile} players={players} />
        ) : (
          <div style={{ color: 'white' }}>Section {page} coming soon...</div>
        )}
      </main>
    </div>
  );
}

// ── COMPONENTES INTERNOS ──────────────────────────────────────────────────────

function OnboardingScreen({ onRegister }) {
  const [form, setForm] = useState({ phone: '', kidName: '', kidAge: '', kidBirthdate: '' });
  return (
    <div style={{ background: '#080f18', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Card style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--gold)', marginBottom: 20 }}>WELCOME TO TORQUE</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Your Phone" onChange={e => setForm({...form, phone: e.target.value})} style={inputStyle} />
          <input placeholder="Player Name" onChange={e => setForm({...form, kidName: e.target.value})} style={inputStyle} />
          <input placeholder="Age" type="number" onChange={e => setForm({...form, kidAge: e.target.value})} style={inputStyle} />
          <input type="date" onChange={e => setForm({...form, kidBirthdate: e.target.value})} style={inputStyle} />
          <Btn onClick={() => onRegister(form)} style={{ marginTop: 10 }}>Create Profile</Btn>
        </div>
      </Card>
    </div>
  );
}

function ParentHome({ profile, players }) {
  return (
    <div>
      <h1 style={{ color: 'white', marginBottom: 20 }}>Hey, {profile.full_name.split(' ')[0]}! 👋</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {players.map(p => (
          <Card key={p.id}>
            <div style={{ fontWeight: 800, color: 'white', fontSize: 18 }}>{p.kid_name}</div>
            <div style={{ color: 'var(--text3)', fontSize: 12 }}>Age {p.age} · Active</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const sidebarStyle = { width: 220, background: '#080f18', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, left: 0, bottom: 0, display: 'flex', flexDirection: 'column' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: 6, border: '1px solid var(--border)', background: '#111926', color: 'white' };
