import React, { useState, useEffect } from 'react'
import { 
  Home, BookOpen, Calendar, CreditCard, 
  Plus, LogOut, Edit2, MessageCircle, Mail, HelpCircle, CheckCircle2 
} from 'lucide-react'
import { Card, Avatar, Btn, Modal, ProgressBar, Label } from '../../components/UI'
import { useUser, useClerk } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient" 

const PACKS = [
  { 
    id: 'a', name: 'PAQUETE A', sessions: 4, price: 260, 
    links: { 
      stand: { label: '$260.00 - Standard', url: 'https://buy.stripe.com/test_dRmbJ04Jtgweb8A61YfrW00' },
      m6: { label: '$1,482.00 - 6 Months (-5%)', url: 'https://buy.stripe.com/test_4gM14mdfZ3Js4KcaiefrW01' },
      m12: { label: '$2,808.00 - 12 Months (-10%)', url: 'https://buy.stripe.com/test_7sY00i2Bl7ZI0tW8a6frW02' },
      annual: { label: '$2,652.00 - Annual (-15%)', url: 'https://buy.stripe.com/test_cNifZgb7Reo6ccE9eafrW04' }
    } 
  },
  { 
    id: 'aa', name: 'PAQUETE AA', sessions: 8, price: 360,
    links: { 
      stand: { label: '$360.00 - Standard', url: 'https://buy.stripe.com/test_28EaEW4Jt7ZIa4w1LIfrW05' },
      m6: { label: '$2,052.00 - 6 Months (-5%)', url: 'https://buy.stripe.com/test_6oUaEW2Bl5RA90scqmfrW06' },
      m12: { label: '$3,888.00 - 12 Months (-10%)', url: 'https://buy.stripe.com/test_fZu9ASdfZ93MdgI4XUfrW07' },
      annual: { label: '$3,672.00 - Annual (-15%)', url: 'https://buy.stripe.com/test_4gM9ASa3N93Mb8A0HEfrW08' }
    }
  },
  { 
    id: 'aaa', name: 'PAQUETE AAA', sessions: 12, price: 440,
    links: { 
      stand: { label: '$440.00 - Standard', url: 'https://buy.stripe.com/test_bJeaEW2Bl5RA6SkduqfrW09' },
      m6: { label: '$2,508.00 - 6 Months (-5%)', url: 'https://buy.stripe.com/test_aFa7sKb7Rgwe4Kc762frW0a' },
      m12: { label: '$4,752.00 - 12 Months (-10%)', url: 'https://buy.stripe.com/test_cNi8wOa3N3JsccEeyufrW0b' },
      annual: { label: '$4,488.00 - Annual (-15%)', url: 'https://buy.stripe.com/test_7sYfZg4JtbbUccE0HEfrW0c' }
    }
  },
  { 
    id: 'mlb', name: 'PAQUETE MLB', sessions: 20, price: 600,
    links: { 
      stand: { label: '$600.00 - Standard', url: 'https://buy.stripe.com/test_4gM3cu5Nx1Bk3G8eyufrW0d' },
      m6: { label: '$3,420.00 - 6 Months (-5%)', url: 'https://buy.stripe.com/test_14A9ASb7R4Nw0tW762frW0e' },
      m12: { label: '$6,480.00 - 12 Months (-10%)', url: 'https://buy.stripe.com/test_dRm00i1xhcfY7Wo0HEfrW0f' },
      annual: { label: '$6,120.00 - Annual (-15%)', url: 'https://buy.stripe.com/test_fZu8wO1xh1Bk7Wo2PMfrW0g' }
    }
  },
];

export default function ParentPortal() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [page, setPage] = useState('home');
  const [players, setPlayers] = useState([]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showBuyPack, setShowBuyPack] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => { if (user) fetchTorqueData(); }, [user]);

  async function fetchTorqueData() {
    const { data: kids } = await supabase.from('players').select('*').eq('parent_id', user.id);
    const kidsWithMemberships = await Promise.all((kids || []).map(async (kid) => {
      const { data: m } = await supabase.from('memberships').select('*').eq('player_id', kid.id).eq('status', 'active').maybeSingle();
      return { ...kid, active_membership: m || null };
    }));
    setPlayers(kidsWithMemberships);
  }

  const handleCheckout = (url) => {
    // Redirige a Stripe inyectando el ID del jugador para el webhook
    window.open(`${url}?client_reference_id=${selectedPlayer.id}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--navy1)' }}>
      {/* SIDEBAR */}
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'white' }}>TORQUE</div>
          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 800 }}>PERFORMANCE</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column' }}>
          <button onClick={() => setPage('home')} style={navBtnStyle(page === 'home')}><Home size={18} style={{marginRight:12}}/> HOME</button>
          <button onClick={() => setPage('sessions')} style={navBtnStyle(false)}><BookOpen size={18} style={{marginRight:12}}/> SESSIONS</button>
          <button onClick={() => setPage('schedule')} style={navBtnStyle(false)}><Calendar size={18} style={{marginRight:12}}/> SCHEDULE</button>
          <button onClick={() => setPage('billing')} style={navBtnStyle(false)}><CreditCard size={18} style={{marginRight:12}}/> BILLING</button>
          <div style={{ marginTop: 'auto' }}>
            <button onClick={() => setShowSupport(true)} style={navBtnStyle(false)}><HelpCircle size={18} style={{marginRight:12}}/> SUPPORT</button>
            <button onClick={() => signOut()} style={logoutBtnStyle}><LogOut size={18} style={{marginRight:12}}/> LOGOUT</button>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, marginLeft: 220, padding: '36px 40px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginBottom: 24, color: 'white' }}>My Players</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
          {players.map((p) => (
            <Card key={p.id}>
              <div style={{ display: 'flex', gap: 15, alignItems: 'center', marginBottom: 20 }}>
                <Avatar initials={p.kid_name[0]} size={50} color="var(--red)" />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'white' }}>{p.kid_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                    {p.active_membership ? `PLAN: ${p.active_membership.package_name}` : 'NO ACTIVE PLAN'}
                  </div>
                </div>
              </div>
              
              <div style={progressBoxStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'white' }}>SESSIONS REMAINING</span>
                  {p.active_membership ? (
                    <span style={{ fontWeight: 900, color: 'var(--green)' }}>{p.active_membership.total_sessions - p.active_membership.sessions_used}</span>
                  ) : (
                    <Btn variant="gold" size="sm" onClick={() => { setSelectedPlayer(p); setShowBuyPack(true); }}>+ BUY PLAN</Btn>
                  )}
                </div>
                <ProgressBar value={p.active_membership ? (p.active_membership.total_sessions - p.active_membership.sessions_used) : 0} max={p.active_membership ? p.active_membership.total_sessions : 1} color="var(--green)" />
              </div>
            </Card>
          ))}

          <Card onClick={() => setShowAddPlayer(true)} style={addCardStyle}>
            <Plus size={28} color="var(--text3)"/>
            <div style={{fontSize: 12, fontWeight: 800, marginTop: 10, color: 'var(--text3)'}}>ADD PLAYER</div>
          </Card>
        </div>
      </main>

      {/* MODAL SUPPORT - CON TEXTO INTRODUCTORIO */}
      <Modal open={showSupport} onClose={() => setShowSupport(false)} title="Support Center" width={420}>
        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20, textAlign: 'center', lineHeight: '1.5' }}>
          ¿Necesitas ayuda con tus sesiones o tienes dudas sobre los pagos? Nuestro equipo está listo para apoyarte.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Btn onClick={() => window.open('https://wa.me/19152343655')} style={{ background: '#25D366', color: 'white', height: 55 }}>
                <MessageCircle size={20} style={{marginRight:10}}/> WhatsApp Direct Support
            </Btn>
            <Btn onClick={() => window.location.href='mailto:txtorq@gmail.com'} variant="outline" style={{ height: 55 }}>
                <Mail size={20} style={{marginRight:10}}/> Email Support
            </Btn>
        </div>
      </Modal>

      {/* MODAL COMPRA - COSTOS DETALLADOS */}
      <Modal open={showBuyPack} onClose={() => setShowBuyPack(false)} title={`Plans for ${selectedPlayer?.kid_name}`} width={800}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {PACKS.map(pack => (
            <div key={pack.id} style={packCardStyle}>
              <div style={{fontWeight: 900, fontSize: 18, color: 'white', marginBottom: 5}}>{pack.name}</div>
              <div style={{fontSize: 12, color: 'var(--gold)', fontWeight: 800, marginBottom: 20}}>{pack.sessions} SESSIONS PACK</div>
              
              <div style={{display:'flex', flexDirection:'column', gap: 10}}>
                <button onClick={() => handleCheckout(pack.links.stand.url)} style={stripeBtnStyle}>
                  {pack.links.stand.label}
                </button>
                <button onClick={() => handleCheckout(pack.links.m6.url)} style={stripeBtnStyle}>
                  {pack.links.m6.label}
                </button>
                <button onClick={() => handleCheckout(pack.links.m12.url)} style={stripeBtnStyle}>
                  {pack.links.m12.label}
                </button>
                <button onClick={() => handleCheckout(pack.links.annual.url)} style={{...stripeBtnStyle, borderColor:'var(--green)', color:'var(--green)'}}>
                  {pack.links.annual.label}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* MODAL ADD PLAYER (Simplicado) */}
      <Modal open={showAddPlayer} onClose={() => setShowAddPlayer(false)} title="New Player">
         <div style={{color:'white', textAlign:'center'}}>Formulario de registro aquí...</div>
      </Modal>
    </div>
  )
}

// ESTILOS
const sidebarStyle = { width: 220, background: '#080f18', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 100 };
const navBtnStyle = (active) => ({ width: '100%', padding: '14px 20px', textAlign: 'left', background: active ? 'rgba(212,160,23,0.1)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text2)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, display:'flex', alignItems:'center', borderLeft: active ? '4px solid var(--gold)' : '4px solid transparent' });
const logoutBtnStyle = { color: '#ff4d4d', background: 'none', border: 'none', padding: '14px 20px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', fontSize: 13, marginTop: 5 };
const progressBoxStyle = { background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' };
const addCardStyle = { borderStyle: 'dashed', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', minHeight: 150, opacity: 0.5 };
const packCardStyle = { padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--navy3)' };
const stripeBtnStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 11, textAlign: 'left', transition: '0.2s' };
