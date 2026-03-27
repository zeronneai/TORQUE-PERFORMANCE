import React, { useState, useEffect } from 'react'
import { 
  Home, BookOpen, Calendar, CreditCard, Megaphone, 
  Plus, LogOut, Percent 
} from 'lucide-react'
import { Card, Avatar, Btn, Modal, ProgressBar, Label } from '../../components/UI'
import { useUser, useClerk } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient" 

// ── CONFIGURACIÓN DE PAQUETES CON TUS LINKS DE STRIPE ───────────────────────
const PACKS = [
  { 
    id: 'a', name: 'PAQUETE A', sessions: 4, price: 260, tag: 'Basic Training',
    links: {
      stand: 'https://buy.stripe.com/test_dRmbJ04Jtgweb8A61YfrW00',
      m6: 'https://buy.stripe.com/test_4gM14mdfZ3Js4KcaiefrW01',
      m12: 'https://buy.stripe.com/test_28E8wO6RB7ZIb8AduqfrW03',
      annual: 'https://buy.stripe.com/test_28E8wO6RB7ZIb8AduqfrW03'
    }
  },
  { 
    id: 'aa', name: 'PAQUETE AA', sessions: 8, price: 360, tag: 'Advanced Growth',
    links: {
      stand: 'https://buy.stripe.com/test_28EaEW4Jt7ZIa4w1LIfrW05',
      m6: 'https://buy.stripe.com/test_6oUaEW2Bl5RA90scqmfrW06',
      m12: 'https://buy.stripe.com/test_fZu9ASdfZ93MdgI4XUfrW07',
      annual: 'https://buy.stripe.com/test_4gM9ASa3N93Mb8A0HEfrW08'
    }
  },
  { 
    id: 'aaa', name: 'PAQUETE AAA', sessions: 12, price: 440, tag: 'Elite Prospect',
    links: {
      stand: 'https://buy.stripe.com/test_bJeaEW2Bl5RA6SkduqfrW09',
      m6: 'https://buy.stripe.com/test_aFa7sKb7Rgwe4Kc762frW0a',
      m12: 'https://buy.stripe.com/test_cNi8wOa3N3JsccEeyufrW0b',
      annual: 'https://buy.stripe.com/test_7sYfZg4JtbbUccE0HEfrW0c'
    }
  },
  { 
    id: 'mlb', name: 'PAQUETE MLB', sessions: 20, price: 600, tag: 'Unlimited Access',
    links: {
      stand: 'https://buy.stripe.com/test_4gM3cu5Nx1Bk3G8eyufrW0d',
      m6: 'https://buy.stripe.com/test_14A9ASb7R4Nw0tW762frW0e',
      m12: 'https://buy.stripe.com/test_dRm00i1xhcfY7Wo0HEfrW0f',
      annual: 'https://buy.stripe.com/test_dRm00i1xhcfY7Wo0HEfrW0f'
    }
  },
];

export default function ParentPortal() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [players, setPlayers] = useState([]);

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showBuyPack, setShowBuyPack] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  const [newPlayerData, setNewPlayerData] = useState({ name: '', age: '', birthdate: '' });
  const [onboardingData, setOnboardingData] = useState({ phone: '', kidName: '', kidAge: '', kidBirthdate: '' });

  useEffect(() => { if (user) fetchTorqueData(); }, [user]);

  async function fetchTorqueData() {
    try {
      setLoading(true);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (prof) {
        setProfile(prof);
        const { data: kids } = await supabase.from('players').select('*').eq('parent_id', user.id);
        const kidsWithMemberships = await Promise.all((kids || []).map(async (kid) => {
          const { data: m } = await supabase.from('memberships').select('*').eq('player_id', kid.id).eq('status', 'active').maybeSingle();
          return { ...kid, active_membership: m || null };
        }));
        setPlayers(kidsWithMemberships);
      } else { setProfile(null); }
    } finally { setLoading(false); }
  }

  // ── FUNCIÓN MAESTRA DE CHECKOUT ──────────────────────────────────────────
  const handleCheckout = (stripeUrl) => {
    if (!selectedPlayer) return;
    // Inyectamos el ID del niño para que el Webhook sepa a quién cargarle las sesiones
    const finalUrl = `${stripeUrl}?client_reference_id=${selectedPlayer.id}`;
    window.open(finalUrl, '_blank');
  };

  async function handleAddPlayer(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('players').insert([{ 
      parent_id: user.id, kid_name: newPlayerData.name, 
      age: parseInt(newPlayerData.age), birthdate: newPlayerData.birthdate 
    }]);
    if (!error) { setShowAddPlayer(false); setNewPlayerData({ name: '', age: '', birthdate: '' }); await fetchTorqueData(); }
    setLoading(false);
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--gold)' }}>LOADING TORQUE...</div>;

  if (!profile) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', padding: 30, background: 'var(--navy2)', borderRadius: 16, border: '1px solid var(--border)' }}>
        <h2 style={{ color: 'var(--gold)', marginBottom: 20 }}>WELCOME TO TORQUE</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          await supabase.from('profiles').insert([{ id: user.id, full_name: user.fullName, email: user.primaryEmailAddress.emailAddress, phone: onboardingData.phone, role: 'parent' }]);
          await supabase.from('players').insert([{ parent_id: user.id, kid_name: onboardingData.kidName, age: parseInt(onboardingData.kidAge), birthdate: onboardingData.kidBirthdate }]);
          fetchTorqueData();
        }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Label>Parent Phone</Label>
          <input required style={inputStyle} onChange={e => setOnboardingData({...onboardingData, phone: e.target.value})} />
          <Label>First Player Name</Label>
          <input required style={inputStyle} onChange={e => setOnboardingData({...onboardingData, kidName: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input required type="number" placeholder="Age" style={inputStyle} onChange={e => setOnboardingData({...onboardingData, kidAge: e.target.value})} />
            <input required type="date" style={inputStyle} onChange={e => setOnboardingData({...onboardingData, kidBirthdate: e.target.value})} />
          </div>
          <Btn type="submit">Complete Registration</Btn>
        </form>
      </div>
    );
  }

  const PAGE_MAP = {
    home: <ParentHome players={players} onAdd={() => setShowAddPlayer(true)} onBuy={(p) => { setSelectedPlayer(p); setShowBuyPack(true); }} />,
    sessions: <div style={{color:'white'}}>Session History...</div>,
    schedule: <div style={{color:'white'}}>Booking Calendar...</div>,
    billing: <div style={{color:'white'}}>Billing & Invoices...</div>,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 900, color: 'var(--text)' }}>TORQUE</div>
          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 800 }}>PERFORMANCE</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {['home', 'sessions', 'schedule', 'billing'].map(id => (
            <button key={id} onClick={() => setPage(id)} style={navBtnStyle(page === id)}>{id.toUpperCase()}</button>
          ))}
          <button onClick={() => signOut()} style={{ color: '#ff4d4d', background: 'none', border: 'none', padding: 12, cursor: 'pointer', fontWeight: 700, marginTop: 'auto' }}>LOGOUT</button>
        </nav>
      </aside>

      <main style={{ flex: 1, marginLeft: 220, padding: '36px 40px' }}>
        {PAGE_MAP[page]}
      </main>

      {/* MODAL SUSCRIPCIÓN CON LINKS REALES */}
      <Modal open={showBuyPack} onClose={() => setShowBuyPack(false)} title={`Training Plans for ${selectedPlayer?.kid_name}`} width={750}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          {PACKS.map(pack => (
            <div key={pack.id} style={{ padding: '24px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--navy3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>{pack.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{pack.sessions} Sessions/mo</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 900, fontSize: 20 }}>${pack.price}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <button onClick={() => handleCheckout(pack.links.stand)} style={optionBtnStyle}>
                  <span style={spanStyle}>STANDARD</span>
                  <span style={priceStyle}>${pack.price}</span>
                </button>

                <button onClick={() => handleCheckout(pack.links.m6)} style={optionBtnStyle}>
                  <span style={{...spanStyle, color:'var(--gold)'}}>6 MONTHS</span>
                  <span style={priceStyle}>${(pack.price * 0.9).toFixed(0)}<small>/mo</small></span>
                </button>
                
                <button onClick={() => handleCheckout(pack.links.m12)} style={optionBtnStyle}>
                  <span style={{...spanStyle, color:'var(--gold)'}}>12 MONTHS</span>
                  <span style={priceStyle}>${(pack.price * 0.85).toFixed(0)}<small>/mo</small></span>
                </button>

                <button onClick={() => handleCheckout(pack.links.annual)} style={{ ...optionBtnStyle, borderColor: 'var(--green)' }}>
                  <span style={{...spanStyle, color:'var(--green)'}}>FULL ANNUAL</span>
                  <span style={priceStyle}>${(pack.price * 12 * 0.8).toFixed(0)}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* MODAL AÑADIR JUGADOR */}
      <Modal open={showAddPlayer} onClose={() => setShowAddPlayer(false)} title="Register Player">
        <form onSubmit={handleAddPlayer} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <Label>Name</Label>
          <input required style={inputStyle} onChange={e => setNewPlayerData({...newPlayerData, name: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <input required type="number" placeholder="Age" style={inputStyle} onChange={e => setNewPlayerData({...newPlayerData, age: e.target.value})} />
            <input required type="date" style={inputStyle} onChange={e => setNewPlayerData({...newPlayerData, birthdate: e.target.value})} />
          </div>
          <Btn type="submit">Register</Btn>
        </form>
      </Modal>
    </div>
  )
}

function ParentHome({ players, onAdd, onBuy }) {
  return (
    <div>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 24 }}>My Players</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {players.map((player) => {
          const m = player.active_membership;
          return (
            <Card key={player.id}>
              <div style={{ display: 'flex', gap: 15, alignItems: 'center', marginBottom: 20 }}>
                <Avatar initials={player.kid_name[0]} size={50} color="var(--red)" />
                <div><div style={{ fontSize: 20, fontWeight: 800 }}>{player.kid_name}</div></div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>SESSIONS</span>
                  {m ? <span style={{ color: 'var(--green)' }}>{m.total_sessions - m.sessions_used} / {m.total_sessions}</span> : <Btn size="sm" onClick={() => onBuy(player)}>+ Get Plan</Btn>}
                </div>
                <ProgressBar value={m ? (m.total_sessions - m.sessions_used) : 0} max={m ? m.total_sessions : 1} color="var(--green)" />
              </div>
            </Card>
          )
        })}
        <Card onClick={onAdd} style={{ borderStyle: 'dashed', cursor: 'pointer', textAlign: 'center' }}>
          <Plus size={28} /> <div style={{ fontSize: 12, fontWeight: 800, marginTop: 10 }}>ADD PLAYER</div>
        </Card>
      </div>
    </div>
  )
}

// ESTILOS
const sidebarStyle = { width: 220, background: '#080f18', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, left: 0, bottom: 0, display: 'flex', flexDirection: 'column' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--navy3)', color: 'white' };
const navBtnStyle = (active) => ({ width: '100%', padding: '14px 20px', textAlign: 'left', background: active ? 'rgba(212,160,23,0.1)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text2)', border: 'none', cursor: 'pointer', fontWeight: 700 });
const optionBtnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--navy4)', color: 'white', cursor: 'pointer', gap: 4 };
const spanStyle = { fontSize: 9, fontWeight: 800 };
const priceStyle = { fontSize: 16, fontWeight: 800 };
