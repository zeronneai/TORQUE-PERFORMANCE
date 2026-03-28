import React, { useState, useEffect } from 'react'
import { Plus, LogOut, ChevronRight, Menu, X } from 'lucide-react'
import { Card, Avatar, Btn, Modal, ProgressBar, Label } from '../../components/UI'
import { useUser, useClerk } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient"

// ── PAQUETES ─────────────────────────────────────────────────────────────────
const PACKS = [
  { id: 'a', name: 'PAQUETE A', sessions: 4, price: 260, tag: 'Basic Training',
    links: { stand: 'https://buy.stripe.com/test_dRmbJ04Jtgweb8A61YfrW00', m6: 'https://buy.stripe.com/test_4gM14mdfZ3Js4KcaiefrW01', m12: 'https://buy.stripe.com/test_7sY00i2Bl7ZI0tW8a6frW02', annual: 'https://buy.stripe.com/test_cNifZgb7Reo6ccE9eafrW04' }},
  { id: 'aa', name: 'PAQUETE AA', sessions: 8, price: 360, tag: 'Advanced Growth',
    links: { stand: 'https://buy.stripe.com/test_28EaEW4Jt7ZIa4w1LIfrW05', m6: 'https://buy.stripe.com/test_6oUaEW2Bl5RA90scqmfrW06', m12: 'https://buy.stripe.com/test_fZu9ASdfZ93MdgI4XUfrW07', annual: 'https://buy.stripe.com/test_4gM9ASa3N93Mb8A0HEfrW08' }},
  { id: 'aaa', name: 'PAQUETE AAA', sessions: 12, price: 440, tag: 'Elite Prospect',
    links: { stand: 'https://buy.stripe.com/test_bJeaEW2Bl5RA6SkduqfrW09', m6: 'https://buy.stripe.com/test_aFa7sKb7Rgwe4Kc762frW0a', m12: 'https://buy.stripe.com/test_cNi8wOa3N3JsccEeyufrW0b', annual: 'https://buy.stripe.com/test_7sYfZg4JtbbUccE0HEfrW0c' }},
  { id: 'mlb', name: 'PAQUETE MLB', sessions: 20, price: 600, tag: 'Unlimited Access',
    links: { stand: 'https://buy.stripe.com/test_4gM3cu5Nx1Bk3G8eyufrW0d', m6: 'https://buy.stripe.com/test_14A9ASb7R4Nw0tW762frW0e', m12: 'https://buy.stripe.com/test_dRm00i1xhcfY7Wo0HEfrW0f', annual: 'https://buy.stripe.com/test_fZu8wO1xh1Bk7Wo2PMfrW0g' }},
]

const NAV_ITEMS = [
  { id: 'home',     label: 'Dashboard' },
  { id: 'sessions', label: 'Sessions'  },
  { id: 'schedule', label: 'Schedule'  },
  { id: 'billing',  label: 'Billing'   },
]

// ── GLOBAL STYLES (inyectados una sola vez) ───────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --gold:    #C9A84C;
    --gold2:   #E8C870;
    --red:     #C0392B;
    --green:   #27AE60;
    --navy:    #050C14;
    --navy2:   #071018;
    --navy3:   #0A1520;
    --navy4:   #0D1C28;
    --border:  rgba(201,168,76,0.12);
    --border2: rgba(255,255,255,0.06);
    --text:    #F0EDE6;
    --text2:   #8A9BAE;
    --text3:   #4A5C6A;
    --font-display: 'Bebas Neue', sans-serif;
    --font-body:    'DM Sans', sans-serif;
    --font-mono:    'DM Mono', monospace;
    --sidebar-w: 240px;
  }

  body { background: var(--navy); color: var(--text); font-family: var(--font-body); }

  /* Noise texture overlay */
  body::before {
    content: '';
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    opacity: 0.35;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* Animations */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-12px); }
    to   { opacity: 1; transform: translateX(0);    }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(201,168,76,0.3); }
    70%  { box-shadow: 0 0 0 8px rgba(201,168,76,0);  }
    100% { box-shadow: 0 0 0 0 rgba(201,168,76,0);    }
  }

  .animate-fade-up  { animation: fadeUp  0.45s cubic-bezier(0.16,1,0.3,1) both; }
  .animate-fade-in  { animation: fadeIn  0.3s ease both; }
  .animate-slide-in { animation: slideIn 0.35s cubic-bezier(0.16,1,0.3,1) both; }

  /* Stagger children */
  .stagger > * { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; }
  .stagger > *:nth-child(2) { animation-delay: 0.12s; }
  .stagger > *:nth-child(3) { animation-delay: 0.19s; }
  .stagger > *:nth-child(4) { animation-delay: 0.26s; }
  .stagger > *:nth-child(5) { animation-delay: 0.33s; }

  /* Nav items */
  .nav-item {
    position: relative; width: 100%; display: flex; align-items: center;
    gap: 12px; padding: 11px 20px; text-align: left;
    background: transparent; color: var(--text3);
    border: none; border-left: 2px solid transparent;
    cursor: pointer; font-family: var(--font-body);
    font-weight: 600; font-size: 13px; letter-spacing: 0.04em;
    text-transform: uppercase; transition: all 0.2s ease;
    margin-bottom: 2px;
  }
  .nav-item:hover { color: var(--text2); background: rgba(255,255,255,0.03); }
  .nav-item.active {
    color: var(--gold); background: rgba(201,168,76,0.07);
    border-left-color: var(--gold);
  }
  .nav-item.active::after {
    content: ''; position: absolute; right: 0; top: 50%;
    transform: translateY(-50%);
    width: 3px; height: 60%; border-radius: 2px 0 0 2px;
  }

  /* Player cards */
  .player-card {
    background: var(--navy3);
    border: 1px solid var(--border2);
    border-radius: 16px;
    padding: 28px;
    transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    position: relative; overflow: hidden;
  }
  .player-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
    opacity: 0; transition: opacity 0.3s;
  }
  .player-card:hover { transform: translateY(-3px); box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,168,76,0.15); border-color: rgba(201,168,76,0.2); }
  .player-card:hover::before { opacity: 1; }

  /* Add card */
  .add-card {
    background: transparent;
    border: 1px dashed rgba(255,255,255,0.1);
    border-radius: 16px; padding: 28px;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    cursor: pointer; min-height: 200px;
    transition: all 0.25s ease;
  }
  .add-card:hover { border-color: rgba(201,168,76,0.4); background: rgba(201,168,76,0.03); }
  .add-card:hover .add-icon { color: var(--gold); transform: scale(1.1) rotate(90deg); }
  .add-icon { color: var(--text3); transition: all 0.3s ease; }

  /* Pack option buttons */
  .pack-option {
    display: flex; flex-direction: column; align-items: center;
    padding: 18px 12px; border-radius: 12px;
    border: 1px solid var(--border2);
    background: var(--navy4); color: white;
    cursor: pointer; gap: 6px;
    transition: all 0.2s ease;
    position: relative; overflow: hidden;
  }
  .pack-option::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(201,168,76,0.05), transparent);
    opacity: 0; transition: opacity 0.2s;
  }
  .pack-option:hover { border-color: rgba(201,168,76,0.35); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
  .pack-option:hover::before { opacity: 1; }
  .pack-option.annual { border-color: rgba(39,174,96,0.3); background: rgba(39,174,96,0.04); }
  .pack-option.annual:hover { border-color: rgba(39,174,96,0.6); box-shadow: 0 8px 24px rgba(39,174,96,0.1); }

  /* Support link buttons */
  .support-btn {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 22px; border-radius: 14px; text-decoration: none;
    transition: all 0.2s ease; position: relative; overflow: hidden;
  }
  .support-btn::after {
    content: ''; position: absolute; inset: 0;
    background: rgba(255,255,255,0.02);
    opacity: 0; transition: opacity 0.2s;
  }
  .support-btn:hover { transform: translateX(4px); }
  .support-btn:hover::after { opacity: 1; }

  /* Input fields */
  .torque-input {
    width: 100%; padding: 14px 16px;
    border-radius: 10px;
    border: 1px solid var(--border2);
    background: rgba(255,255,255,0.04);
    color: var(--text); font-family: var(--font-body);
    font-size: 14px; margin-top: 8px;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
  }
  .torque-input:focus {
    border-color: rgba(201,168,76,0.4);
    box-shadow: 0 0 0 3px rgba(201,168,76,0.08);
  }
  .torque-input::placeholder { color: var(--text3); }

  /* Sessions bar */
  .sessions-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06); overflow: hidden; }
  .sessions-bar-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--green), #2ECC71); transition: width 0.6s cubic-bezier(0.16,1,0.3,1); }

  /* Gold shimmer text */
  .shimmer {
    background: linear-gradient(90deg, var(--gold) 0%, var(--gold2) 40%, var(--gold) 60%, var(--gold2) 100%);
    background-size: 200% auto;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    animation: shimmer 3s linear infinite;
  }

  /* Mobile */
  @media (max-width: 768px) {
    .torque-sidebar-desktop { display: none !important; }
    .torque-topbar { display: flex !important; }
    .torque-main { margin-left: 0 !important; padding: 20px 16px !important; padding-top: 76px !important; }
    .players-grid { grid-template-columns: 1fr !important; }
  }
  @media (min-width: 769px) {
    .torque-topbar { display: none !important; }
    .torque-sidebar-mobile, .torque-overlay { display: none !important; }
  }
`

export default function ParentPortal() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [page, setPage] = useState('home')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [players, setPlayers] = useState([])
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [showBuyPack, setShowBuyPack] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [newPlayerData, setNewPlayerData] = useState({ name: '', age: '', birthdate: '' })
  const [onboardingData, setOnboardingData] = useState({ phone: '', kidName: '', kidAge: '', kidBirthdate: '' })

  useEffect(() => { if (user) fetchTorqueData() }, [user])

  const navigateTo = (id) => { setPage(id); setSidebarOpen(false) }

  async function fetchTorqueData() {
    try {
      setLoading(true)
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (prof) {
        setProfile(prof)
        const { data: kids } = await supabase.from('players').select('*').eq('parent_id', user.id)
        const kidsWithMemberships = await Promise.all((kids || []).map(async (kid) => {
          const { data: m } = await supabase.from('memberships').select('*').eq('player_id', kid.id).eq('status', 'active').maybeSingle()
          return { ...kid, active_membership: m || null }
        }))
        setPlayers(kidsWithMemberships)
      } else { setProfile(null) }
    } finally { setLoading(false) }
  }

  const handleCheckout = (stripeUrl) => {
    if (!selectedPlayer) return
    window.open(`${stripeUrl}?client_reference_id=${selectedPlayer.id}`, '_blank')
  }

  async function handleAddPlayer(e) {
    e.preventDefault(); setLoading(true)
    const { error } = await supabase.from('players').insert([{
      parent_id: user.id, kid_name: newPlayerData.name,
      age: parseInt(newPlayerData.age), birthdate: newPlayerData.birthdate
    }])
    if (!error) { setShowAddPlayer(false); setNewPlayerData({ name: '', age: '', birthdate: '' }); await fetchTorqueData() }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--navy)', flexDirection: 'column', gap: 16 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, letterSpacing: '0.12em', color: 'var(--gold)' }} className="shimmer">TORQUE</div>
      <div style={{ width: 40, height: 2, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', height: '100%', width: '40%', background: 'var(--gold)', borderRadius: 2, animation: 'shimmer 1s linear infinite', backgroundSize: '200% auto' }} />
      </div>
    </div>
  )

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: '100%', maxWidth: 480 }} className="animate-fade-up">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, letterSpacing: '0.1em', lineHeight: 1 }} className="shimmer">TORQUE</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.3em', marginTop: 6, textTransform: 'uppercase' }}>Performance Training</div>
        </div>
        <div style={{ background: 'var(--navy3)', border: '1px solid var(--border2)', borderRadius: 20, padding: 36, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', opacity: 0.6 }} />
          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24 }}>New Account Setup</div>
          <form onSubmit={async (e) => {
            e.preventDefault(); setLoading(true)
            await supabase.from('profiles').insert([{ id: user.id, full_name: user.fullName, email: user.primaryEmailAddress.emailAddress, phone: onboardingData.phone, role: 'parent' }])
            await supabase.from('players').insert([{ parent_id: user.id, kid_name: onboardingData.kidName, age: parseInt(onboardingData.kidAge), birthdate: onboardingData.kidBirthdate }])
            fetchTorqueData()
          }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Label>Parent Phone</Label>
              <input className="torque-input" required placeholder="(555) 000-0000" onChange={e => setOnboardingData({...onboardingData, phone: e.target.value})} />
            </div>
            <div>
              <Label>First Player Name</Label>
              <input className="torque-input" required onChange={e => setOnboardingData({...onboardingData, kidName: e.target.value})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="torque-input" required type="number" placeholder="Age" style={{ marginTop: 0 }} onChange={e => setOnboardingData({...onboardingData, kidAge: e.target.value})} />
              <input className="torque-input" required type="date" style={{ marginTop: 0 }} onChange={e => setOnboardingData({...onboardingData, kidBirthdate: e.target.value})} />
            </div>
            <button type="submit" style={primaryBtnStyle}>Complete Registration</button>
          </form>
        </div>
      </div>
    </div>
  )

  const PAGE_MAP = {
    home:     <ParentHome players={players} onAdd={() => setShowAddPlayer(true)} onBuy={(p) => { setSelectedPlayer(p); setShowBuyPack(true) }} />,
    sessions: <PlaceholderPage title="Session History" />,
    schedule: <PlaceholderPage title="Training Schedule" />,
    billing:  <PlaceholderPage title="Billing & Invoices" />,
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{ padding: '28px 24px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '0.12em', color: 'var(--text)', lineHeight: 1 }}>TORQUE</div>
            <div style={{ fontSize: 9, color: 'var(--gold)', letterSpacing: '0.3em', marginTop: 3, fontWeight: 600 }}>PERFORMANCE</div>
          </div>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, display: 'flex' }}>
              <X size={18} />
            </button>
          )}
        </div>
        {/* Decorative line */}
        <div style={{ marginTop: 20, height: 1, background: 'linear-gradient(90deg, var(--gold), transparent)', opacity: 0.4 }} />
      </div>

      {/* User badge */}
      <div style={{ margin: '8px 16px 20px', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border2)' }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Signed in as</div>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.primaryEmailAddress?.emailAddress}</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 12px', display: 'flex', flexDirection: 'column' }}>
        {NAV_ITEMS.map(({ id, label }) => (
          <button key={id} onClick={() => navigateTo(id)} className={`nav-item${page === id ? ' active' : ''}`}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: page === id ? 'var(--gold)' : 'var(--border2)', flexShrink: 0, transition: 'all 0.2s' }} />
            {label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Divider */}
        <div style={{ margin: '12px 8px', height: 1, background: 'var(--border2)' }} />

        {/* Support */}
        <button onClick={() => { setShowSupport(true); setSidebarOpen(false) }} className="nav-item" style={{ color: 'var(--text3)' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 16, height: 16, borderRadius: '50%',
            border: '1.5px solid var(--text3)', fontSize: 9, fontWeight: 700, flexShrink: 0, lineHeight: 1
          }}>?</span>
          Support
        </button>

        {/* Logout */}
        <button onClick={() => signOut()} className="nav-item" style={{ color: '#E05555', marginBottom: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(224,85,85,0.4)', flexShrink: 0 }} />
          Logout
        </button>
      </nav>
    </>
  )

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>

        {/* Sidebar Desktop */}
        <aside className="torque-sidebar-desktop" style={sidebarStyle}>
          <SidebarContent />
        </aside>

        {/* Topbar Mobile */}
        <div className="torque-topbar" style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 60,
          background: 'rgba(5,12,20,0.95)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border2)',
          alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', zIndex: 200, display: 'none'
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.1em', color: 'var(--text)', lineHeight: 1 }}>TORQUE</div>
            <div style={{ fontSize: 8, color: 'var(--gold)', letterSpacing: '0.25em', fontWeight: 600 }}>PERFORMANCE</div>
          </div>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 6 }}>
            <Menu size={22} />
          </button>
        </div>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div className="torque-overlay" onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 299, backdropFilter: 'blur(4px)' }} />
        )}

        {/* Sidebar Mobile */}
        <aside className="torque-sidebar-mobile" style={{
          ...sidebarStyle, zIndex: 300, display: 'flex',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <SidebarContent />
        </aside>

        {/* Main */}
        <main className="torque-main" style={{ flex: 1, marginLeft: 240, padding: '44px 48px', minHeight: '100vh', position: 'relative' }}>
          {PAGE_MAP[page]}
        </main>
      </div>

      {/* ── MODAL: BUY PACK ── */}
      <Modal open={showBuyPack} onClose={() => setShowBuyPack(false)} title={`Training Plans · ${selectedPlayer?.kid_name}`} width={780}>
        {/* Discount banner */}
        <div style={{ marginBottom: 24, padding: '14px 18px', background: 'rgba(201,168,76,0.06)', borderRadius: 12, border: '1px solid rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.15em' }}>MEMBERSHIP DISCOUNTS</div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text2)' }}>
            <span>6 Mo <b style={{ color: 'var(--gold)' }}>–10%</b></span>
            <span>12 Mo <b style={{ color: 'var(--gold)' }}>–15%</b></span>
            <span>Annual <b style={{ color: 'var(--green)' }}>–20% total</b></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }} className="stagger">
          {PACKS.map(pack => {
            const p6  = (pack.price * 0.90).toFixed(0)
            const p12 = (pack.price * 0.85).toFixed(0)
            const pAn = (pack.price * 12 * 0.80).toFixed(0)
            return (
              <div key={pack.id} style={{ padding: '22px 24px', borderRadius: 16, border: '1px solid var(--border2)', background: 'var(--navy3)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1 }}>{pack.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, marginTop: 4, letterSpacing: '0.05em' }}>{pack.tag}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{pack.sessions} sessions / month</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--text)', letterSpacing: '0.04em' }}>${pack.price}</div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Base / month</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <button onClick={() => handleCheckout(pack.links.stand)} className="pack-option">
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text3)' }}>STANDARD</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.04em' }}>${pack.price}</span>
                    <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>no commit</span>
                  </button>
                  <button onClick={() => handleCheckout(pack.links.m6)} className="pack-option">
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--gold)' }}>6 MONTHS</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.04em' }}>${p6}</span>
                    <span style={{ fontSize: 9, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>–10% /mo</span>
                  </button>
                  <button onClick={() => handleCheckout(pack.links.m12)} className="pack-option">
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--gold)' }}>12 MONTHS</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.04em' }}>${p12}</span>
                    <span style={{ fontSize: 9, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>–15% /mo</span>
                  </button>
                  <button onClick={() => handleCheckout(pack.links.annual)} className="pack-option annual">
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--green)' }}>ANNUAL</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.04em', color: 'var(--green)' }}>${pAn}</span>
                    <span style={{ fontSize: 9, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>best value</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* ── MODAL: ADD PLAYER ── */}
      <Modal open={showAddPlayer} onClose={() => setShowAddPlayer(false)} title="Register New Player">
        <form onSubmit={handleAddPlayer} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label>Player Name</Label>
            <input className="torque-input" required value={newPlayerData.name} onChange={e => setNewPlayerData({...newPlayerData, name: e.target.value})} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input className="torque-input" required type="number" placeholder="Age" style={{ marginTop: 0 }} onChange={e => setNewPlayerData({...newPlayerData, age: e.target.value})} />
            <input className="torque-input" required type="date" style={{ marginTop: 0 }} onChange={e => setNewPlayerData({...newPlayerData, birthdate: e.target.value})} />
          </div>
          <button type="submit" style={{ ...primaryBtnStyle, marginTop: 8 }}>Register Player</button>
        </form>
      </Modal>

      {/* ── MODAL: SUPPORT ── */}
      <Modal open={showSupport} onClose={() => setShowSupport(false)} title="Help & Support">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, padding: '14px 18px', background: 'rgba(201,168,76,0.04)', borderRadius: 10, border: '1px solid rgba(201,168,76,0.12)' }}>
            Need help with your account, sessions, or billing? Our team is ready to assist you.
            Reach out via WhatsApp for a fast response, or send us an email and we'll get back to you shortly.
          </p>
          <a href="https://wa.me/19152343655" target="_blank" rel="noopener noreferrer"
            className="support-btn"
            style={{ border: '1px solid rgba(39,174,96,0.25)', background: 'rgba(39,174,96,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--green)', flexShrink: 0 }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', letterSpacing: '0.03em' }}>WhatsApp</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>+1 (915) 234-3655 · fastest response</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--green)" />
          </a>
          <a href="mailto:txtorq@gmail.com"
            className="support-btn"
            style={{ border: '1px solid rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold)', flexShrink: 0 }}>
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', letterSpacing: '0.03em' }}>Email</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>txtorq@gmail.com · reply within 24h</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--gold)" />
          </a>
        </div>
      </Modal>
    </>
  )
}

// ── PARENT HOME ───────────────────────────────────────────────────────────────
function ParentHome({ players, onAdd, onBuy }) {
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 36 }} className="animate-fade-up">
        <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 8 }}>Overview</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 44, letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1 }}>My Players</h1>
      </div>

      <div className="players-grid stagger" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {players.map((player) => {
          const m = player.active_membership
          const used = m ? m.sessions_used : 0
          const total = m ? m.total_sessions : 0
          const remaining = total - used
          const pct = total > 0 ? (remaining / total) * 100 : 0

          return (
            <div key={player.id} className="player-card">
              {/* Decorative number watermark */}
              <div style={{ position: 'absolute', top: 16, right: 20, fontFamily: 'var(--font-display)', fontSize: 72, color: 'rgba(255,255,255,0.025)', letterSpacing: '-0.02em', lineHeight: 1, userSelect: 'none' }}>
                {player.kid_name[0]}
              </div>

              {/* Player info */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24, position: 'relative' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, var(--red), #8B0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 24, color: 'white', flexShrink: 0, boxShadow: '0 4px 16px rgba(192,57,43,0.3)' }}>
                  {player.kid_name[0]}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.05em', color: 'var(--text)', lineHeight: 1 }}>{player.kid_name}</div>
                  <div style={{ fontSize: 11, color: m ? 'var(--green)' : 'var(--text3)', marginTop: 5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {m ? `● ${m.package_name}` : '○ No active plan'}
                  </div>
                </div>
              </div>

              {/* Sessions block */}
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '18px 20px', border: '1px solid var(--border2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Available Sessions</span>
                  {m ? (
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: pct > 30 ? 'var(--green)' : '#E8A020', letterSpacing: '0.04em' }}>
                      {remaining}<span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 4 }}>/ {total}</span>
                    </span>
                  ) : (
                    <button onClick={() => onBuy(player)} style={goldBtnStyle}>+ Get Plan</button>
                  )}
                </div>
                {/* Custom progress bar */}
                <div className="sessions-bar">
                  <div className="sessions-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                {m && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    <span>{used} used</span>
                    <span>{remaining} remaining</span>
                  </div>
                )}
              </div>

              {/* CTA if has plan */}
              {m && (
                <button onClick={() => onBuy(player)} style={{ ...goldBtnStyle, width: '100%', marginTop: 14, justifyContent: 'center' }}>
                  Upgrade Plan
                </button>
              )}
            </div>
          )
        })}

        {/* Add player card */}
        <div className="add-card" onClick={onAdd}>
          <div className="add-icon">
            <Plus size={32} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 12, color: 'var(--text3)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Add Player</div>
        </div>
      </div>
    </div>
  )
}

// ── PLACEHOLDER PAGE ──────────────────────────────────────────────────────────
function PlaceholderPage({ title }) {
  return (
    <div className="animate-fade-up">
      <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 8 }}>Coming Soon</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 44, letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1, marginBottom: 24 }}>{title}</h1>
      <div style={{ fontSize: 14, color: 'var(--text3)' }}>This section is under construction.</div>
    </div>
  )
}

// ── ESTILOS CONSTANTES ────────────────────────────────────────────────────────
const sidebarStyle = {
  width: 240, background: 'linear-gradient(180deg, #060D15 0%, #050C14 100%)',
  borderRight: '1px solid rgba(201,168,76,0.08)',
  position: 'fixed', top: 0, left: 0, bottom: 0,
  display: 'flex', flexDirection: 'column', zIndex: 100,
  boxShadow: '4px 0 40px rgba(0,0,0,0.4)',
}

const primaryBtnStyle = {
  padding: '15px 24px', borderRadius: 10,
  background: 'linear-gradient(135deg, var(--gold), #A07A20)',
  color: '#050C14', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 20px rgba(201,168,76,0.25)',
}

const goldBtnStyle = {
  padding: '8px 16px', borderRadius: 8,
  background: 'rgba(201,168,76,0.1)',
  color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.25)',
  cursor: 'pointer', fontFamily: 'var(--font-body)',
  fontWeight: 600, fontSize: 12, letterSpacing: '0.05em',
  display: 'flex', alignItems: 'center', gap: 6,
  transition: 'all 0.2s ease',
}
