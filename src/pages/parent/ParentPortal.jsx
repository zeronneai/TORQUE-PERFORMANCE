import React, { useState, useEffect } from 'react'
import { 
  Calendar, RotateCcw, X, ChevronRight, Home, BookOpen, 
  CreditCard, Megaphone, User, Plus, LogOut, Check, Percent 
} from 'lucide-react'
import { Card, Badge, Avatar, Btn, Modal, ProgressBar, Label } from '../../components/UI'
import { useUser, useClerk, UserButton } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient" 

// ── CONFIGURACIÓN DE PAQUETES REALES (USD) ──────────────────────────────────
const PACKS = [
  { id: 'a', name: 'PAQUETE A', sessions: 4, price: 260, tag: 'Basic Training' },
  { id: 'aa', name: 'PAQUETE AA', sessions: 8, price: 360, tag: 'Advanced Growth' },
  { id: 'aaa', name: 'PAQUETE AAA', sessions: 12, price: 440, tag: 'Elite Prospect' },
  { id: 'mlb', name: 'PAQUETE MLB', sessions: 20, price: 600, tag: 'Unlimited*', desc: 'Max 5 sessions per week' },
];

export default function ParentPortal() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [players, setPlayers] = useState([]);

  // Modales
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showBuyPack, setShowBuyPack] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  const [newPlayerData, setNewPlayerData] = useState({ name: '', age: '', birthdate: '' });
  const [onboardingData, setOnboardingData] = useState({ phone: '', kidName: '', kidAge: '', kidBirthdate: '' });

  useEffect(() => {
    if (user) fetchTorqueData();
  }, [user]);

  // ── CARGA DE DATOS ROBUSTA ────────────────────────────────────────────────
  async function fetchTorqueData() {
    try {
      setLoading(true);
      // 1. Traer Perfil
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

      if (prof) {
        setProfile(prof);
        
        // 2. Traer Jugadores (Consulta simple para que no falle)
        const { data: kids, error: kError } = await supabase
          .from('players')
          .select('*')
          .eq('parent_id', user.id);
        
        if (kError) throw kError;

        // 3. Buscar membresías de forma independiente para cada hijo
        const kidsWithMemberships = await Promise.all((kids || []).map(async (kid) => {
          const { data: m } = await supabase
            .from('memberships')
            .select('*')
            .eq('player_id', kid.id)
            .eq('status', 'active')
            .maybeSingle();
          
          return { ...kid, active_membership: m || null };
        }));

        setPlayers(kidsWithMemberships);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error crítico:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── AÑADIR JUGADOR ───────────────────────────────────────────────────────
  async function handleAddPlayer(e) {
    e.preventDefault();
    if (!newPlayerData.name) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('players').insert([
        { 
          parent_id: user.id, 
          kid_name: newPlayerData.name, 
          age: parseInt(newPlayerData.age) || 0, 
          birthdate: newPlayerData.birthdate || null 
        }
      ]);

      if (error) {
        alert("Error de Supabase: " + error.message);
      } else {
        setShowAddPlayer(false);
        setNewPlayerData({ name: '', age: '', birthdate: '' });
        await fetchTorqueData(); 
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleInitialRegister(e) {
    e.preventDefault();
    setLoading(true);
    const { error: pError } = await supabase.from('profiles').insert([
      { id: user.id, full_name: user.fullName, email: user.primaryEmailAddress.emailAddress, phone: onboardingData.phone, role: 'parent' }
    ]);
    const { error: kError } = await supabase.from('players').insert([
      { parent_id: user.id, kid_name: onboardingData.kidName, age: parseInt(onboardingData.kidAge), birthdate: onboardingData.kidBirthdate }
    ]);
    if (!pError && !kError) fetchTorqueData();
    else setLoading(false);
  }

  const handleOpenBuyPack = (player) => {
    setSelectedPlayer(player);
    setShowBuyPack(true);
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>LOADING TORQUE...</div>;

  if (!profile) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', padding: 30, background: 'var(--navy2)', borderRadius: 16, border: '1px solid var(--border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', marginBottom: 10 }}>WELCOME TO TORQUE</h2>
        <form onSubmit={handleInitialRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Label>Parent Phone</Label>
          <input required style={inputStyle} placeholder="(555) 000-0000" onChange={e => setOnboardingData({...onboardingData, phone: e.target.value})} />
          <h4 style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>First Player Details</h4>
          <Label>Player Name</Label>
          <input required style={inputStyle} placeholder="Son/Daughter name" onChange={e => setOnboardingData({...onboardingData, kidName: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Label>Age</Label><input required type="number" style={inputStyle} onChange={e => setOnboardingData({...onboardingData, kidAge: e.target.value})} /></div>
            <div><Label>Birthdate</Label><input required type="date" style={inputStyle} onChange={e => setOnboardingData({...onboardingData, kidBirthdate: e.target.value})} /></div>
          </div>
          <Btn type="submit" style={{ marginTop: 10 }}>Create Account</Btn>
        </form>
      </div>
    );
  }

  const NAV = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'sessions', label: 'Sessions', icon: BookOpen },
    { id: 'schedule', label: 'Book', icon: Calendar },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'events', label: 'Events', icon: Megaphone },
  ]

  const PAGE_MAP = {
    home: <ParentHome players={players} profile={profile} onAdd={() => setShowAddPlayer(true)} onBuy={handleOpenBuyPack} />,
    sessions: <div style={{color:'white'}}>Sessions content...</div>,
    schedule: <div style={{color:'white'}}>Booking content...</div>,
    billing: <div style={{color:'white'}}>Billing history...</div>,
    events: <div style={{color:'white'}}>Events...</div>,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>TORQUE</div>
          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 800 }}>PERFORMANCE</div>
        </div>
        
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)} style={navBtnStyle(page === id)}>
              <Icon size={14} /> {label}
            </button>
          ))}
          <button onClick={() => signOut()} style={{ color: '#ff4d4d', background: 'none', border: 'none', padding: 12, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <LogOut size={14} /> Sign Out
          </button>
        </nav>
      </aside>

      <main style={{ flex: 1, marginLeft: 220, padding: '36px 40px' }}>
        <div className="fade-in">{PAGE_MAP[page]}</div>
      </main>

      {/* MODAL SELECCIÓN PLANES */}
      <Modal open={showBuyPack} onClose={() => setShowBuyPack(false)} title={`Training Plans for ${selectedPlayer?.kid_name}`} width={750}>
        <div style={{ marginBottom: 25, padding: '15px', background: 'rgba(212,160,23,0.05)', borderRadius: 12, border: '1px solid rgba(212,160,23,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
            <Percent size={14} /> MEMBERSHIP DISCOUNTS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 11, color: 'var(--text2)' }}>
            <span>6 Mo: <b>10% OFF/mo</b></span>
            <span>12 Mo: <b>15% OFF/mo</b></span>
            <span>Annual: <b style={{ color: 'var(--green)' }}>20% OFF TOTAL</b></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 15 }}>
          {PACKS.map(pack => {
            const p6 = (pack.price * 0.9).toFixed(0);
            const p12 = (pack.price * 0.85).toFixed(0);
            const pAn = (pack.price * 12 * 0.8).toFixed(0);
            return (
              <div key={pack.id} style={{ padding: '20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--navy3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18, fontFamily: 'var(--font-display)' }}>{pack.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{pack.id === 'mlb' ? 'Unlimited*' : `${pack.sessions} Sessions/mo`}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 900, fontSize: 22 }}>${pack.price}<small style={{fontSize:10, opacity:0.5}}>/mo</small></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <button onClick={() => alert('Stripe Link...')} style={optionBtnStyle}>
                    <span style={{fontSize:9, color:'var(--gold)'}}>6 MO</span>
                    <span>${p6}/mo</span>
                  </button>
                  <button onClick={() => alert('Stripe Link...')} style={optionBtnStyle}>
                    <span style={{fontSize:9, color:'var(--gold)'}}>12 MO</span>
                    <span>${p12}/mo</span>
                  </button>
                  <button onClick={() => alert('Stripe Link...')} style={{...optionBtnStyle, borderColor:'var(--green)'}}>
                    <span style={{fontSize:9, color:'var(--green)'}}>ANNUAL</span>
                    <span>${pAn}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* MODAL AÑADIR JUGADOR */}
      <Modal open={showAddPlayer} onClose={() => setShowAddPlayer(false)} title="Add New Player">
        <form onSubmit={handleAddPlayer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Label>Player Name</Label>
          <input required style={inputStyle} value={newPlayerData.name} onChange={e => setNewPlayerData({...newPlayerData, name: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Label>Age</Label><input required type="number" style={inputStyle} onChange={e => setNewPlayerData({...newPlayerData, age: e.target.value})} /></div>
            <div><Label>Birthdate</Label><input required type="date" style={inputStyle} onChange={e => setNewPlayerData({...newPlayerData, birthdate: e.target.value})} /></div>
          </div>
          <Btn type="submit" style={{ marginTop: 10, justifyContent: 'center' }}>Register Player</Btn>
        </form>
      </Modal>
    </div>
  )
}

function ParentHome({ players, profile, onAdd, onBuy }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginBottom: 24 }}>My Players</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {players.map((player, index) => {
          const m = player.active_membership;
          return (
            <Card key={player.id}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
                <Avatar initials={player.kid_name[0]} size={44} color={index > 0 ? 'var(--gold)' : 'var(--red)'} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800 }}>{player.kid_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m ? `Plan ${m.package_name}` : 'No active membership'}</div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 800 }}>SESSIONS AVAILABLE</span>
                  {m ? (
                    <span style={{ fontWeight: 900, color: 'var(--green)', fontSize: 16 }}>{m.total_sessions - m.sessions_used} / {m.total_sessions}</span>
                  ) : (
                    <Btn variant="gold" size="sm" onClick={() => onBuy(player)}>+ Get Plan</Btn>
                  )}
                </div>
                <ProgressBar value={m ? (m.total_sessions - m.sessions_used) : 0} max={m ? m.total_sessions : 1} color="var(--green)" />
              </div>
            </Card>
          )
        })}
        <Card onClick={onAdd} style={{ borderStyle: 'dashed', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 150 }}>
            <Plus size={24} color="var(--text3)" />
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 8, color: 'var(--text3)' }}>ADD PLAYER</div>
        </Card>
      </div>
    </div>
  )
}

const sidebarStyle = { width: 220, background: '#080f18', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, left: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 100 };
const inputStyle = { width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--navy3)', color: 'white', marginTop: 4, fontSize: 14 };
const navBtnStyle = (active) => ({ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', textAlign: 'left', background: active ? 'rgba(212,160,23,0.1)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text2)', border: 'none', borderLeft: active ? '4px solid var(--gold)' : '4px solid transparent', cursor: 'pointer', fontWeight: 700, fontSize: 14, marginBottom: 4 });
const optionBtnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 5px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--navy4)', color: 'white', cursor: 'pointer', transition: '0.2s', gap: 3 };
