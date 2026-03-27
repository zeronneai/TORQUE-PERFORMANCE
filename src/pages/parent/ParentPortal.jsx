import React, { useState, useEffect } from 'react'
import { 
  Calendar, RotateCcw, X, ChevronRight, Home, BookOpen, 
  CreditCard, Megaphone, User, Plus, LogOut, Check, Percent 
} from 'lucide-react'
import { Card, Badge, Avatar, Btn, Modal, ProgressBar, Label } from '../../components/UI'
import { useUser, useClerk, UserButton } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient" 
import { PACKAGES, SLOTS, SESSION_TYPES, EVENTS } from '../../data/mockData'

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

  async function fetchTorqueData() {
    try {
      setLoading(true);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id);

      if (prof && prof.length > 0) {
        setProfile(prof[0]);
        const { data: kids } = await supabase
          .from('players')
          .select('*, memberships(package_name, total_sessions, sessions_used, status)')
          .eq('parent_id', user.id);
        
        setPlayers(kids || []);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPlayer(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('players').insert([
      { parent_id: user.id, kid_name: newPlayerData.name, age: parseInt(newPlayerData.age), birthdate: newPlayerData.birthdate }
    ]);
    if (!error) {
      setShowAddPlayer(false);
      setNewPlayerData({ name: '', age: '', birthdate: '' });
      await fetchTorqueData(); 
    }
    setLoading(false);
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
        <p style={{ color: 'var(--text2)', marginBottom: 20, fontSize: 14 }}>Complete your member profile to access the portal.</p>
        <form onSubmit={handleInitialRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Label>Parent Phone</Label>
          <input required style={inputStyle} placeholder="(555) 000-0000" onChange={e => setOnboardingData({...onboardingData, phone: e.target.value})} />
          <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
          <h4 style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase' }}>First Player Details</h4>
          <Label>Player Name</Label>
          <input required style={inputStyle} placeholder="Son/Daughter name" onChange={e => setOnboardingData({...onboardingData, kidName: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Label>Age</Label><input required type="number" style={inputStyle} onChange={e => setOnboardingData({...onboardingData, kidAge: e.target.value})} /></div>
            <div><Label>Birthdate</Label><input required type="date" style={inputStyle} onChange={e => setOnboardingData({...onboardingData, kidBirthdate: e.target.value})} /></div>
          </div>
          <Btn type="submit" style={{ marginTop: 10, justifyContent: 'center' }}>Create Account</Btn>
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
    { id: 'profile', label: 'Profile', icon: User },
  ]

  const PAGE_MAP = {
    home: <ParentHome players={players} profile={profile} onAdd={() => setShowAddPlayer(true)} onBuy={handleOpenBuyPack} />,
    sessions: <ParentSessions players={players} />,
    schedule: <ParentSchedule players={players} />,
    billing: <ParentBilling players={players} />,
    events: <ParentEvents />,
    profile: <ParentProfile profile={profile} players={players} />,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⚾</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>TORQUE</div>
          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 800, letterSpacing: '0.1em' }}>PERFORMANCE</div>
        </div>
        
        <div style={{ padding: '12px 14px', background: 'rgba(212,160,23,0.08)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase' }}>Member</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{profile?.full_name}</div>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>

        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = page === id;
            return (
              <button key={id} onClick={() => setPage(id)} style={navBtnStyle(isActive)}>
                <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </button>
            )
          })}
          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <button onClick={() => signOut()} style={{ color: '#ff4d4d', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </nav>
      </aside>

      <main style={{ flex: 1, marginLeft: 220, padding: '36px 40px', minHeight: '100vh' }}>
        <div className="fade-in">{PAGE_MAP[page]}</div>
      </main>

      {/* MODAL: SELECCIÓN DE PLANES CON DESCUENTOS */}
      <Modal open={showBuyPack} onClose={() => setShowBuyPack(false)} title={`Training Plans for ${selectedPlayer?.kid_name}`} width={750}>
        <div style={{ marginBottom: 25, padding: '15px', background: 'rgba(212,160,23,0.05)', borderRadius: 12, border: '1px solid rgba(212,160,23,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold)', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
            <Percent size={14} /> MEMBERSHIP DISCOUNTS AVAILABLE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>6 Months commitment: <b style={{ color: 'var(--text)' }}>10% OFF/mo</b></div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>12 Months commitment: <b style={{ color: 'var(--text)' }}>15% OFF/mo</b></div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>One-Time Annual Pay: <b style={{ color: 'var(--green)' }}>20% OFF TOTAL</b></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 15 }}>
          {PACKS.map(pack => {
            const price6m = (pack.price * 0.9).toFixed(0);
            const price12m = (pack.price * 0.85).toFixed(0);
            const priceAnnual = (pack.price * 12 * 0.8).toFixed(0);

            return (
              <div key={pack.id} style={{ padding: '20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--navy3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 20, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{pack.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{pack.tag}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      {pack.id === 'mlb' ? 'Unlimited Training*' : `${pack.sessions} Sessions per month`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>${pack.price}</div>
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>USD / MONTHLY BASE</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <button onClick={() => alert('Stripe Link: 6 Months')} style={optionBtnStyle}>
                    <span style={{ fontSize: 10, color: 'var(--gold)' }}>6 MO (10% OFF)</span>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>${price6m}<small>/mo</small></span>
                  </button>
                  <button onClick={() => alert('Stripe Link: 12 Months')} style={optionBtnStyle}>
                    <span style={{ fontSize: 10, color: 'var(--gold)' }}>12 MO (15% OFF)</span>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>${price12m}<small>/mo</small></span>
                  </button>
                  <button onClick={() => alert('Stripe Link: Annual Pay')} style={{ ...optionBtnStyle, borderColor: 'var(--green)', background: 'rgba(46,204,113,0.05)' }}>
                    <span style={{ fontSize: 10, color: 'var(--green)' }}>FULL YEAR (20% OFF)</span>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>${priceAnnual}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* MODAL: ADD PLAYER */}
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

// ── COMPONENTES DE PÁGINA ──────────────────────────────────────────

function ParentHome({ players, profile, onAdd, onBuy }) {
  const firstName = profile?.full_name?.split(' ')[0] || 'Member';
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800 }}>Hey, {firstName}! 👋</h1>
        <p style={{ color: 'var(--text2)', marginTop: 4 }}>Manage training for your players.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {players.map((player, index) => {
          const m = player.memberships?.find(ms => ms.status === 'active');
          const hasSessions = m && m.total_sessions > 0;
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
                  {hasSessions ? (
                    <span style={{ fontWeight: 900, color: 'var(--green)', fontSize: 16 }}>{m.total_sessions - m.sessions_used} / {m.total_sessions}</span>
                  ) : (
                    <Btn variant="gold" size="sm" onClick={() => onBuy(player)}>+ Get Plan</Btn>
                  )}
                </div>
                <ProgressBar value={hasSessions ? (m.total_sessions - m.sessions_used) : 0} max={hasSessions ? m.total_sessions : 1} color="var(--green)" />
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

function ParentSessions({ players }) { return <div style={{color:'white'}}>Sessions content coming soon...</div> }
function ParentSchedule({ players }) { return <div style={{color:'white'}}>Booking content coming soon...</div> }
function ParentBilling({ players }) { return <div style={{color:'white'}}>Billing history content coming soon...</div> }
function ParentEvents() { return <div style={{color:'white'}}>Events coming soon...</div> }
function ParentProfile({ profile }) { return <div style={{color:'white'}}>Profile for {profile?.full_name}</div> }

// ── ESTILOS ────────────────────────────────────────────────────────

const sidebarStyle = { width: 220, background: '#080f18', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, left: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 100 };
const inputStyle = { width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--navy3)', color: 'white', marginTop: 4, fontSize: 14 };
const navBtnStyle = (active) => ({ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', textAlign: 'left', background: active ? 'rgba(212,160,23,0.1)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text2)', border: 'none', borderLeft: active ? '4px solid var(--gold)' : '4px solid transparent', cursor: 'pointer', fontWeight: 700, fontSize: 14, marginBottom: 4, transition: '0.2s' });
const optionBtnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 5px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--navy4)', color: 'white', cursor: 'pointer', transition: '0.2s', gap: 3 };
