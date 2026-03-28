import React, { useState, useEffect } from 'react'
import { 
  Home, BookOpen, Calendar, CreditCard, 
  Plus, LogOut, Percent, ChevronRight, Edit2, 
  MessageCircle, Mail, HelpCircle, CheckCircle2 
} from 'lucide-react'
import { Card, Avatar, Btn, Modal, ProgressBar, Label } from '../../components/UI'
import { useUser, useClerk } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient" 

const PACKS = [
  { 
    id: 'a', name: 'PAQUETE A', sessions: 4, price: 260, tag: 'Basic Training',
    links: {
      stand: 'https://buy.stripe.com/test_dRmbJ04Jtgweb8A61YfrW00',
      m6: 'https://buy.stripe.com/test_4gM14mdfZ3Js4KcaiefrW01',
      m12: 'https://buy.stripe.com/test_7sY00i2Bl7ZI0tW8a6frW02',
      annual: 'https://buy.stripe.com/test_cNifZgb7Reo6ccE9eafrW04'
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
      annual: 'https://buy.stripe.com/test_fZu8wO1xh1Bk7Wo2PMfrW0g'
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
  const [successMsg, setSuccessMsg] = useState('');

  // Modals Toggle
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showEditPlayer, setShowEditPlayer] = useState(false);
  const [showBuyPack, setShowBuyPack] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  // Data States
  const [newPlayerData, setNewPlayerData] = useState({ name: '', age: '', birthdate: '' });
  const [editPlayerData, setEditPlayerData] = useState({ id: '', name: '', age: '', birthdate: '' });
  const [onboardingData, setOnboardingData] = useState({ phone: '', kidName: '', kidAge: '', kidBirthdate: '' });

  useEffect(() => { if (user) fetchTorqueData(); }, [user]);

  // Manejador automático para ocultar mensajes de éxito
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

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

  const handleCheckout = (stripeUrl) => {
    if (!selectedPlayer) return;
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
    if (!error) { 
      setShowAddPlayer(false); 
      setNewPlayerData({ name: '', age: '', birthdate: '' }); 
      setSuccessMsg('Player registered successfully!');
      await fetchTorqueData(); 
    }
    setLoading(false);
  }

  async function handleUpdatePlayer(e) {
    e.preventDefault();
    
    // --- LA ARMADURA: Validación de ID ---
    if (!editPlayerData.id || editPlayerData.id === 'undefined') {
      console.error("Critical Error: Missing Player ID in state.");
      alert("System Error: Could not identify the player. Please refresh the page.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('players')
      .update({ 
        kid_name: editPlayerData.name, 
        age: parseInt(editPlayerData.age), 
        birthdate: editPlayerData.birthdate 
      })
      .eq('id', editPlayerData.id);

    if (!error) { 
      setShowEditPlayer(false); 
      setSuccessMsg('Changes saved successfully!');
      await fetchTorqueData(); 
    } else {
      console.error("Supabase Update Error:", error);
      alert("Error: " + error.message);
    }
    setLoading(false);
  }

  if (loading && !profile) return <div style={{ padding: 40, color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>LOADING TORQUE...</div>;

  if (!profile) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', padding: 30, background: 'var(--navy2)', borderRadius: 16, border: '1px solid var(--border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', marginBottom: 20 }}>WELCOME TO TORQUE</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          await supabase.from('profiles').insert([{ id: user.id, full_name: user.fullName, email: user.primaryEmailAddress.emailAddress, phone: onboardingData.phone, role: 'parent' }]);
          await supabase.from('players').insert([{ parent_id: user.id, kid_name: onboardingData.kidName, age: parseInt(onboardingData.kidAge), birthdate: onboardingData.kidBirthdate }]);
          fetchTorqueData();
        }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Label>Parent Phone</Label>
          <input required style={inputStyle} placeholder="(555) 000-0000" onChange={e => setOnboardingData({...onboardingData, phone: e.target.value})} />
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
    home: <ParentHome 
            players={players} 
            onAdd={() => setShowAddPlayer(true)} 
            onBuy={(p) => { setSelectedPlayer(p); setShowBuyPack(true); }} 
            onEdit={(p) => { 
              // Aseguramos que el ID se pase correctamente al estado
              setEditPlayerData({ id: p.id, name: p.kid_name, age: p.age, birthdate: p.birthdate });
              setShowEditPlayer(true); 
            }}
          />,
    sessions: <div style={{color:'white', padding: 20}}>Session History Coming Soon...</div>,
    schedule: <div style={{color:'white', padding: 20}}>Booking Calendar Coming Soon...</div>,
    billing: <div style={{color:'white', padding: 20}}>Billing & Invoices Coming Soon...</div>,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* SIDEBAR */}
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>TORQUE</div>
          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 800 }}>PERFORMANCE</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {['home', 'sessions', 'schedule', 'billing'].map(id => (
            <button key={id} onClick={() => setPage(id)} style={navBtnStyle(page === id)}>{id.toUpperCase()}</button>
          ))}
          
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 5, paddingBottom: 20 }}>
            <button onClick={() => setShowSupport(true)} style={navBtnStyle(false)}>
              <HelpCircle size={14} /> SUPPORT
            </button>
            <button onClick={() => signOut()} style={{ color: '#ff4d4d', background: 'none', border: 'none', padding: 12, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <LogOut size={14} /> LOGOUT
            </button>
          </div>
        </nav>
      </aside>

      <main style={{ flex: 1, marginLeft: 220, padding: '36px 40px', position: 'relative' }}>
        {/* SUCCESS NOTIFICATION */}
        {successMsg && (
          <div style={successToastStyle}>
            <CheckCircle2 size={18} /> {successMsg}
          </div>
        )}

        {PAGE_MAP[page]}
      </main>

      {/* SUPPORT MODAL */}
      <Modal open={showSupport} onClose={() => setShowSupport(false)} title="Torque Support Center" width={400}>
        <div style={{ textAlign: 'center', marginBottom: 20, color: 'var(--text2)', fontSize: 14 }}>
          Need help? Contact us directly.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Btn onClick={() => window.open('https://wa.me/19152343655', '_blank')} style={{ background: '#25D366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <MessageCircle size={18} /> WhatsApp Support
          </Btn>
          <Btn onClick={() => window.location.href = 'mailto:txtorq@gmail.com'} variant="outline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Mail size={18} /> Email Support
          </Btn>
        </div>
      </Modal>

      {/* PURCHASE MODAL */}
      <Modal open={showBuyPack} onClose={() => setShowBuyPack(false)} title={`Plans for ${selectedPlayer?.kid_name}`} width={750}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          {PACKS.map(pack => (
              <div key={pack.id} style={{ padding: '24px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--navy3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 22, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{pack.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{pack.tag}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>${pack.price}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <button onClick={() => handleCheckout(pack.links.stand)} style={optionBtnStyle}>STANDARD</button>
                  <button onClick={() => handleCheckout(pack.links.m6)} style={optionBtnStyle}>6 MONTHS</button>
                  <button onClick={() => handleCheckout(pack.links.m12)} style={optionBtnStyle}>12 MONTHS</button>
                  <button onClick={() => handleCheckout(pack.links.annual)} style={{ ...optionBtnStyle, borderColor: 'var(--green)' }}>ANNUAL</button>
                </div>
              </div>
          ))}
        </div>
      </Modal>

      {/* EDIT MODAL */}
      <Modal open={showEditPlayer} onClose={() => setShowEditPlayer(false)} title="Edit Player Details">
        <form onSubmit={handleUpdatePlayer} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <Label>Player Name</Label>
          <input required style={inputStyle} value={editPlayerData.name} onChange={e => setEditPlayerData({...editPlayerData, name: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <div>
              <Label>Age</Label>
              <input required type="number" style={inputStyle} value={editPlayerData.age} onChange={e => setEditPlayerData({...editPlayerData, age: e.target.value})} />
            </div>
            <div>
              <Label>Birthdate</Label>
              <input required type="date" style={inputStyle} value={editPlayerData.birthdate} onChange={e => setEditPlayerData({...editPlayerData, birthdate: e.target.value})} />
            </div>
          </div>
          <Btn type="submit" style={{ marginTop: 10, padding: 16 }}>{loading ? 'SAVING...' : 'SAVE CHANGES'}</Btn>
        </form>
      </Modal>

      {/* ADD MODAL */}
      <Modal open={showAddPlayer} onClose={() => setShowAddPlayer(false)} title="Register New Player">
        <form onSubmit={handleAddPlayer} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <Label>Player Name</Label>
          <input required style={inputStyle} value={newPlayerData.name} onChange={e => setNewPlayerData({...newPlayerData, name: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <div><Label>Age</Label><input required type="number" style={inputStyle} value={newPlayerData.age} onChange={e => setNewPlayerData({...newPlayerData, age: e.target.value})} /></div>
            <div><Label>Birthdate</Label><input required type="date" style={inputStyle} value={newPlayerData.birthdate} onChange={e => setNewPlayerData({...newPlayerData, birthdate: e.target.value})} /></div>
          </div>
          <Btn type="submit" style={{ marginTop: 10, padding: 16 }}>{loading ? 'REGISTERING...' : 'REGISTER PLAYER'}</Btn>
        </form>
      </Modal>
    </div>
  )
}

function ParentHome({ players, onAdd, onBuy, onEdit }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginBottom: 24 }}>My Players</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {players.map((player) => {
          const m = player.active_membership;
          return (
            <Card key={player.id} style={{ position: 'relative' }}>
              <button onClick={() => onEdit(player)} style={{ position: 'absolute', top: 15, right: 15, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'var(--text3)' }}>
                <Edit2 size={14} />
              </button>
              <div style={{ display: 'flex', gap: 15, alignItems: 'center', marginBottom: 20 }}>
                <Avatar initials={player.kid_name ? player.kid_name[0] : '?'} size={50} color="var(--red)" />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>{player.kid_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{m ? `Plan ${m.package_name}` : 'Membership Inactive'}</div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 800 }}>SESSIONS LEFT</span>
                  {m ? <span style={{ fontWeight: 900, color: 'var(--green)', fontSize: 18 }}>{m.total_sessions - m.sessions_used}</span> : <Btn variant="gold" size="sm" onClick={() => onBuy(player)}>+ Get Plan</Btn>}
                </div>
                <ProgressBar value={m ? (m.total_sessions - m.sessions_used) : 0} max={m ? m.total_sessions : 1} color="var(--green)" />
              </div>
            </Card>
          )
        })}
        <Card onClick={onAdd} style={{ borderStyle: 'dashed', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 160, opacity: 0.7 }}>
            <Plus size={28} color="var(--text3)" />
            <div style={{ fontSize: 12, fontWeight: 800, marginTop: 10, color: 'var(--text3)' }}>ADD PLAYER</div>
        </Card>
      </div>
    </div>
  )
}

// ESTILOS
const sidebarStyle = { width: 220, background: '#080f18', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, left: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 100 };
const inputStyle = { width: '100%', padding: '14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--navy3)', color: 'white', marginTop: 6, fontSize: 14 };
const navBtnStyle = (active) => ({ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', textAlign: 'left', background: active ? 'rgba(212,160,23,0.1)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text2)', border: 'none', borderLeft: active ? '4px solid var(--gold)' : '4px solid transparent', cursor: 'pointer', fontWeight: 700, fontSize: 14, marginBottom: 4 });
const optionBtnStyle = { padding: '15px 10px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--navy4)', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: 11 };
const successToastStyle = { position: 'absolute', top: 20, right: 40, background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(46, 204, 113, 0.3)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 13, zIndex: 1000, animation: 'fadeIn 0.3s ease' };
