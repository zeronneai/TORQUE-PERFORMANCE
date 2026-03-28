import React, { useState, useEffect } from 'react'
import { 
  Home, BookOpen, Calendar, CreditCard, 
  Plus, LogOut, Percent, ChevronRight, HeadphonesIcon
} from 'lucide-react'
import { Card, Avatar, Btn, Modal, ProgressBar, Label } from '../../components/UI'
import { useUser, useClerk } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient" 

// ── CONFIGURACIÓN DE PAQUETES CON TUS LINKS REALES ──────────────────────────
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

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showBuyPack, setShowBuyPack] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
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
    if (!error) { setShowAddPlayer(false); setNewPlayerData({ name: '', age: '', birthdate: '' }); await fetchTorqueData(); }
    setLoading(false);
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>LOADING TORQUE...</div>;

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
    home: <ParentHome players={players} onAdd={() => setShowAddPlayer(true)} onBuy={(p) => { setSelectedPlayer(p); setShowBuyPack(true); }} />,
    sessions: <div style={{color:'white'}}>Session History...</div>,
    schedule: <div style={{color:'white'}}>Booking Calendar...</div>,
    billing: <div style={{color:'white'}}>Billing & Invoices...</div>,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>TORQUE</div>
          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 800 }}>PERFORMANCE</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column' }}>
          {['home', 'sessions', 'schedule', 'billing'].map(id => (
            <button key={id} onClick={() => setPage(id)} style={navBtnStyle(page === id)}>{id.toUpperCase()}</button>
          ))}

          {/* ── SUPPORT BUTTON ── */}
          <button onClick={() => setShowSupport(true)} style={navBtnStyle(false)}>
            SUPPORT
          </button>

          <div style={{ marginTop: 'auto' }}>
            <button onClick={() => signOut()} style={{ color: '#ff4d4d', background: 'none', border: 'none', padding: 12, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <LogOut size={14} /> LOGOUT
            </button>
          </div>
        </nav>
      </aside>

      <main style={{ flex: 1, marginLeft: 220, padding: '36px 40px' }}>
        {PAGE_MAP[page]}
      </main>

      {/* MODAL CON LINKS ASIGNADOS CORRECTAMENTE */}
      <Modal open={showBuyPack} onClose={() => setShowBuyPack(false)} title={`Training Plans for ${selectedPlayer?.kid_name}`} width={750}>
        <div style={{ marginBottom: 20, padding: '15px', background: 'rgba(212,160,23,0.05)', borderRadius: 12, border: '1px solid rgba(212,160,23,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontWeight: 800, fontSize: 13, marginBottom: 5 }}>
             MEMBERSHIP DISCOUNTS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 11, color: 'var(--text2)' }}>
            <span>6 Mo: <b>10% OFF/mo</b></span>
            <span>12 Mo: <b>15% OFF/mo</b></span>
            <span>Annual: <b style={{ color: 'var(--green)' }}>20% OFF TOTAL</b></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          {PACKS.map(pack => {
             const p6 = (pack.price * 0.9).toFixed(0);
             const p12 = (pack.price * 0.85).toFixed(0);
             const pAn = (pack.price * 12 * 0.8).toFixed(0);

             return (
              <div key={pack.id} style={{ padding: '24px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--navy3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 22, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{pack.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{pack.tag}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{pack.sessions} Sessions per month</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>${pack.price}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Base Monthly</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <button onClick={() => handleCheckout(pack.links.stand)} style={optionBtnStyle}>
                    <span style={spanStyle}>STANDARD</span>
                    <span style={priceStyle}>${pack.price}<small>/mo</small></span>
                    <span style={descStyle}>No Commitment</span>
                  </button>

                  <button onClick={() => handleCheckout(pack.links.m6)} style={optionBtnStyle}>
                    <span style={{...spanStyle, color: 'var(--gold)'}}>6 MONTHS</span>
                    <span style={priceStyle}>${p6}<small>/mo</small></span>
                    <span style={{...descStyle, color: 'var(--gold)'}}>10% Off Applied</span>
                  </button>
                  
                  <button onClick={() => handleCheckout(pack.links.m12)} style={optionBtnStyle}>
                    <span style={{...spanStyle, color: 'var(--gold)'}}>12 MONTHS</span>
                    <span style={priceStyle}>${p12}<small>/mo</small></span>
                    <span style={{...descStyle, color: 'var(--gold)'}}>15% Off Applied</span>
                  </button>

                  <button onClick={() => handleCheckout(pack.links.annual)} style={{ ...optionBtnStyle, borderColor: 'var(--green)', background: 'rgba(46,204,113,0.05)' }}>
                    <span style={{...spanStyle, color: 'var(--green)'}}>FULL ANNUAL</span>
                    <span style={priceStyle}>${pAn}</span>
                    <span style={{...descStyle, color: 'var(--green)'}}>Best Value 20% Off</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* MODAL AÑADIR JUGADOR */}
      <Modal open={showAddPlayer} onClose={() => setShowAddPlayer(false)} title="Register New Player">
        <form onSubmit={handleAddPlayer} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <Label>Player Name</Label>
          <input required style={inputStyle} value={newPlayerData.name} onChange={e => setNewPlayerData({...newPlayerData, name: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <input required type="number" placeholder="Age" style={inputStyle} onChange={e => setNewPlayerData({...newPlayerData, age: e.target.value})} />
            <input required type="date" style={inputStyle} onChange={e => setNewPlayerData({...newPlayerData, birthdate: e.target.value})} />
          </div>
          <Btn type="submit" style={{ marginTop: 10, padding: 16 }}>Register Player</Btn>
        </form>
      </Modal>

      {/* ── MODAL SUPPORT ── */}
      <Modal open={showSupport} onClose={() => setShowSupport(false)} title="Help & Support">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Texto introductorio */}
          <div style={{ padding: '16px 20px', background: 'rgba(212,160,23,0.05)', borderRadius: 12, border: '1px solid rgba(212,160,23,0.15)' }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
              Need help with your account, sessions, or billing? Our team is ready to assist you. 
              Reach out via WhatsApp for a fast response, or send us an email and we'll get back to you shortly.
            </p>
          </div>

          {/* Botón WhatsApp */}
          <a
            href="https://wa.me/19152343655"
            target="_blank"
            rel="noopener noreferrer"
            style={supportBtnStyle('var(--green)', 'rgba(46,204,113,0.08)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* WhatsApp SVG icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--green)', flexShrink: 0 }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', letterSpacing: '0.03em' }}>WHATSAPP</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>+1 (915) 234-3655 · Fastest response</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--green)" />
          </a>

          {/* Botón Email */}
          <a
            href="mailto:txtorq@gmail.com"
            style={supportBtnStyle('var(--gold)', 'rgba(212,160,23,0.06)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold)', flexShrink: 0 }}>
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', letterSpacing: '0.03em' }}>EMAIL</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>txtorq@gmail.com · We reply within 24h</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--gold)" />
          </a>

        </div>
      </Modal>
    </div>
  )
}

function ParentHome({ players, onAdd, onBuy }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginBottom: 24 }}>My Players</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {players.map((player) => {
          const m = player.active_membership;
          return (
            <Card key={player.id}>
              <div style={{ display: 'flex', gap: 15, alignItems: 'center', marginBottom: 20 }}>
                <Avatar initials={player.kid_name[0]} size={50} color="var(--red)" />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>{player.kid_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{m ? `Plan ${m.package_name}` : 'Membership Inactive'}</div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 800 }}>AVAILABLE SESSIONS</span>
                  {m ? <span style={{ fontWeight: 900, color: 'var(--green)', fontSize: 18 }}>{m.total_sessions - m.sessions_used} / {m.total_sessions}</span> : <Btn variant="gold" size="sm" onClick={() => onBuy(player)}>+ Get Plan</Btn>}
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
const optionBtnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '15px 10px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--navy4)', color: 'white', cursor: 'pointer', gap: 4 };
const spanStyle = { fontSize: 9, fontWeight: 800, letterSpacing: '0.05em' };
const priceStyle = { fontSize: 16, fontWeight: 800 };
const descStyle = { fontSize: 8, opacity: 0.6 };
const supportBtnStyle = (accentColor, bgColor) => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderRadius: 14, border: `1px solid ${accentColor}33`, background: bgColor, cursor: 'pointer', textDecoration: 'none', transition: 'opacity 0.15s' });
