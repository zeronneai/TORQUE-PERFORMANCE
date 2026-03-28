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
  { id: 'a', name: 'PAQUETE A', sessions: 4, price: 260, tag: 'Basic Training', links: { stand: 'https://buy.stripe.com/test_dRmbJ04Jtgweb8A61YfrW00', m6: 'https://buy.stripe.com/test_4gM14mdfZ3Js4KcaiefrW01', m12: 'https://buy.stripe.com/test_7sY00i2Bl7ZI0tW8a6frW02', annual: 'https://buy.stripe.com/test_cNifZgb7Reo6ccE9eafrW04' } },
  { id: 'aa', name: 'PAQUETE AA', sessions: 8, price: 360, tag: 'Advanced Growth', links: { stand: 'https://buy.stripe.com/test_28EaEW4Jt7ZIa4w1LIfrW05', m6: 'https://buy.stripe.com/test_6oUaEW2Bl5RA90scqmfrW06', m12: 'https://buy.stripe.com/test_fZu9ASdfZ93MdgI4XUfrW07', annual: 'https://buy.stripe.com/test_4gM9ASa3N93Mb8A0HEfrW08' } },
  { id: 'aaa', name: 'PAQUETE AAA', sessions: 12, price: 440, tag: 'Elite Prospect', links: { stand: 'https://buy.stripe.com/test_bJeaEW2Bl5RA6SkduqfrW09', m6: 'https://buy.stripe.com/test_aFa7sKb7Rgwe4Kc762frW0a', m12: 'https://buy.stripe.com/test_cNi8wOa3N3JsccEeyufrW0b', annual: 'https://buy.stripe.com/test_7sYfZg4JtbbUccE0HEfrW0c' } },
  { id: 'mlb', name: 'PAQUETE MLB', sessions: 20, price: 600, tag: 'Unlimited Access', links: { stand: 'https://buy.stripe.com/test_4gM3cu5Nx1Bk3G8eyufrW0d', m6: 'https://buy.stripe.com/test_14A9ASb7R4Nw0tW762frW0e', m12: 'https://buy.stripe.com/test_dRm00i1xhcfY7Wo0HEfrW0f', annual: 'https://buy.stripe.com/test_fZu8wO1xh1Bk7Wo2PMfrW0g' } },
];

export default function ParentPortal() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [players, setPlayers] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showEditPlayer, setShowEditPlayer] = useState(false);
  const [showBuyPack, setShowBuyPack] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  const [newPlayerData, setNewPlayerData] = useState({ name: '', age: '', birthdate: '' });
  const [editPlayerData, setEditPlayerData] = useState({ id: '', name: '', age: '', birthdate: '' });

  useEffect(() => { if (user) fetchTorqueData(); }, [user]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  async function fetchTorqueData() {
    try {
      setLoading(true);
      // 1. Obtener perfil
      const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (prof) {
        setProfile(prof);
        
        // 2. Obtener jugadores (Usamos * para no fallar si cambiaste un nombre de columna)
        const { data: kids, error: kidsErr } = await supabase.from('players').select('*').eq('parent_id', user.id);
        
        if (kidsErr) console.error("Error buscando jugadores:", kidsErr);

        // 3. Obtener membresías para cada jugador
        const kidsWithMemberships = await Promise.all((kids || []).map(async (kid) => {
          const { data: m } = await supabase.from('memberships').select('*').eq('player_id', kid.id).eq('status', 'active').maybeSingle();
          return { ...kid, active_membership: m || null };
        }));

        console.log("Jugadores cargados:", kidsWithMemberships); // Revisa esto en la consola
        setPlayers(kidsWithMemberships);
      }
    } catch (err) {
      console.error("Error crítico:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePlayer(e) {
    e.preventDefault();
    if (!editPlayerData.id) {
      alert("Error: Player ID missing.");
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
      setSuccessMsg('Changes saved!');
      fetchTorqueData(); 
    } else {
      alert("Error: " + error.message);
    }
    setLoading(false);
  }

  const PAGE_MAP = {
    home: <ParentHome 
            players={players} 
            onAdd={() => setShowAddPlayer(true)} 
            onBuy={(p) => { setSelectedPlayer(p); setShowBuyPack(true); }} 
            onEdit={(p) => { 
              setEditPlayerData({ id: p.id, name: p.kid_name, age: p.age, birthdate: p.birthdate });
              setShowEditPlayer(true); 
            }}
          />,
    sessions: <div style={{color:'white', padding: 20}}>History...</div>,
    schedule: <div style={{color:'white', padding: 20}}>Booking...</div>,
    billing: <div style={{color:'white', padding: 20}}>Billing...</div>,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--text)' }}>TORQUE</div>
          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 800 }}>PERFORMANCE</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column' }}>
          {['home', 'sessions', 'schedule', 'billing'].map(id => (
            <button key={id} onClick={() => setPage(id)} style={navBtnStyle(page === id)}>{id.toUpperCase()}</button>
          ))}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 5, paddingBottom: 20 }}>
            <button onClick={() => setShowSupport(true)} style={navBtnStyle(false)}>
              <HelpCircle size={14} style={{marginRight: 10}}/> SUPPORT
            </button>
            <button onClick={() => signOut()} style={logoutBtnStyle}>
              <LogOut size={14} style={{marginRight: 10}}/> LOGOUT
            </button>
          </div>
        </nav>
      </aside>

      <main style={{ flex: 1, marginLeft: 220, padding: '36px 40px', position: 'relative' }}>
        {successMsg && <div style={successToastStyle}><CheckCircle2 size={18} /> {successMsg}</div>}
        {PAGE_MAP[page]}
      </main>

      {/* MODAL SOPORTE */}
      <Modal open={showSupport} onClose={() => setShowSupport(false)} title="Support Center">
        <div style={{display:'flex', flexDirection:'column', gap:10, padding:20}}>
            <Btn onClick={() => window.open('https://wa.me/19152343655')}>WhatsApp Support</Btn>
            <Btn variant="outline" onClick={() => window.location.href='mailto:txtorq@gmail.com'}>Email Support</Btn>
        </div>
      </Modal>

      {/* MODAL EDICIÓN */}
      <Modal open={showEditPlayer} onClose={() => setShowEditPlayer(false)} title="Edit Player">
        <form onSubmit={handleUpdatePlayer} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <Label>Name</Label>
          <input required style={inputStyle} value={editPlayerData.name} onChange={e => setEditPlayerData({...editPlayerData, name: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <input required type="number" style={inputStyle} value={editPlayerData.age} onChange={e => setEditPlayerData({...editPlayerData, age: e.target.value})} />
            <input required type="date" style={inputStyle} value={editPlayerData.birthdate} onChange={e => setEditPlayerData({...editPlayerData, birthdate: e.target.value})} />
          </div>
          <Btn type="submit">SAVE CHANGES</Btn>
        </form>
      </Modal>

      {/* MODAL COMPRA */}
      <Modal open={showBuyPack} onClose={() => setShowBuyPack(false)} title="Buy Plan" width={700}>
        <div style={{ display: 'grid', gap: 15 }}>
          {PACKS.map(pack => (
            <div key={pack.id} style={packCardStyle}>
              <div style={{fontWeight:800}}>{pack.name} - ${pack.price}</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10}}>
                <button style={optionBtnStyle} onClick={() => handleCheckout(pack.links.stand)}>STANDARD</button>
                <button style={optionBtnStyle} onClick={() => handleCheckout(pack.links.m6)}>6 MONTHS</button>
                <button style={optionBtnStyle} onClick={() => handleCheckout(pack.links.m12)}>12 MONTHS</button>
                <button style={optionBtnStyle} onClick={() => handleCheckout(pack.links.annual)}>ANNUAL</button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

function ParentHome({ players, onAdd, onBuy, onEdit }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginBottom: 24 }}>My Players</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {players.length > 0 ? players.map((p) => (
          <Card key={p.id} style={{ position: 'relative' }}>
            <button onClick={() => onEdit(p)} style={editBtnStyle}><Edit2 size={14} /></button>
            <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
              <Avatar initials={p.kid_name ? p.kid_name[0] : '?'} size={50} color="var(--red)" />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>{p.kid_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.active_membership ? 'ACTIVE' : 'NO PLAN'}</div>
              </div>
            </div>
            <div style={{marginTop: 15}}>
                {p.active_membership ? (
                    <div style={{fontSize: 10, fontWeight: 800}}>SESSIONS: {p.active_membership.total_sessions - p.active_membership.sessions_used}</div>
                ) : (
                    <Btn size="sm" variant="gold" onClick={() => onBuy(p)}>+ BUY PLAN</Btn>
                )}
            </div>
          </Card>
        )) : (
            <div style={{color:'var(--text3)', padding:20}}>No players found. Click ADD to register.</div>
        )}
        <Card onClick={onAdd} style={addCardStyle}><Plus size={28} /><div style={{fontSize: 11, marginTop: 10}}>ADD PLAYER</div></Card>
      </div>
    </div>
  )
}

// ESTILOS
const sidebarStyle = { width: 220, background: '#080f18', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 100 };
const navBtnStyle = (active) => ({ width: '100%', padding: '14px 20px', textAlign: 'left', background: active ? 'rgba(212,160,23,0.1)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text2)', border: 'none', cursor: 'pointer', fontWeight: 700, display:'flex', alignItems:'center' });
const logoutBtnStyle = { color: '#ff4d4d', background: 'none', border: 'none', padding: '14px 20px', cursor: 'pointer', fontWeight: 700, display:'flex', alignItems:'center' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--navy3)', color: 'white' };
const successToastStyle = { position: 'fixed', top: 20, right: 40, background: '#2ecc71', color: 'white', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, zIndex: 9999 };
const editBtnStyle = { position: 'absolute', top: 15, right: 15, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'var(--text3)' };
const addCardStyle = { borderStyle: 'dashed', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 140, opacity: 0.6 };
const packCardStyle = { padding: 20, background: 'var(--navy3)', borderRadius: 12, border: '1px solid var(--border)' };
const optionBtnStyle = { padding: 8, background: 'var(--navy4)', color: 'white', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 800 };
