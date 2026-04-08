import React, { useState, useEffect, useMemo } from 'react'
import { Plus, LogOut, ChevronRight, Menu, X } from 'lucide-react'
import { Card, Avatar, Btn, Modal, ProgressBar, Label } from '../../components/UI'
import { useUser, useClerk } from "@clerk/clerk-react"
import { supabase } from "../../supabaseClient"

// ── PAQUETES ──────────────────────────────────────────────────────────────────
const PACKS = [
  { id: 'a',   name: 'PAQUETE A',   sessions: 4,  price: 260, tag: 'Basic Training',
    links: { stand: 'https://buy.stripe.com/test_dRmbJ04Jtgweb8A61YfrW00', m6: 'https://buy.stripe.com/test_4gM14mdfZ3Js4KcaiefrW01', m12: 'https://buy.stripe.com/test_7sY00i2Bl7ZI0tW8a6frW02', annual: 'https://buy.stripe.com/test_cNifZgb7Reo6ccE9eafrW04' },
    prices: { stand: 'price_1TFiVSAaoJKjkq1OgPOYmeX7', m6: 'price_1TFiVSAaoJKjkq1OvDzbHwbd', m12: 'price_1TFiWHAaoJKjkq1OaioJwHRp', annual: 'price_1TFiWHAaoJKjkq1Oge43FYOo' }},
  { id: 'aa',  name: 'PAQUETE AA',  sessions: 8,  price: 360, tag: 'Advanced Growth',
    links: { stand: 'https://buy.stripe.com/test_28EaEW4Jt7ZIa4w1LIfrW05', m6: 'https://buy.stripe.com/test_6oUaEW2Bl5RA90scqmfrW06', m12: 'https://buy.stripe.com/test_fZu9ASdfZ93MdgI4XUfrW07', annual: 'https://buy.stripe.com/test_4gM9ASa3N93Mb8A0HEfrW08' },
    prices: { stand: 'price_1TFiX7AaoJKjkq1OLnC5HLaS', m6: 'price_1TFiYpAaoJKjkq1OxvBFuzPJ', m12: 'price_1TFiYpAaoJKjkq1O8oFYz5VK', annual: 'price_1TFiYpAaoJKjkq1OBHUagz9Y' }},
  { id: 'aaa', name: 'PAQUETE AAA', sessions: 12, price: 440, tag: 'Elite Prospect',
    links: { stand: 'https://buy.stripe.com/test_bJeaEW2Bl5RA6SkduqfrW09', m6: 'https://buy.stripe.com/test_aFa7sKb7Rgwe4Kc762frW0a', m12: 'https://buy.stripe.com/test_cNi8wOa3N3JsccEeyufrW0b', annual: 'https://buy.stripe.com/test_7sYfZg4JtbbUccE0HEfrW0c' },
    prices: { stand: 'price_1TFia1AaoJKjkq1O9XQZ5YbZ', m6: 'price_1TFiaXAaoJKjkq1OTrt1aWsR', m12: 'price_1TFiaXAaoJKjkq1OObbQEbnX', annual: 'price_1TFiaXAaoJKjkq1OW0sZ5nOP' }},
  { id: 'mlb', name: 'PAQUETE MLB', sessions: 20, price: 600, tag: 'Unlimited Access',
    links: { stand: 'https://buy.stripe.com/test_4gM3cu5Nx1Bk3G8eyufrW0d', m6: 'https://buy.stripe.com/test_14A9ASb7R4Nw0tW762frW0e', m12: 'https://buy.stripe.com/test_dRm00i1xhcfY7Wo0HEfrW0f', annual: 'https://buy.stripe.com/test_fZu8wO1xh1Bk7Wo2PMfrW0g' },
    prices: { stand: 'price_1TFibiAaoJKjkq1Oi9ZGJwyy', m6: 'price_1TFicFAaoJKjkq1OK0b6zjq5', m12: 'price_1TFicFAaoJKjkq1OBV6hiqhS', annual: 'price_1TFicFAaoJKjkq1O0GJqz9Th' }},
]

const NAV_ITEMS = [
  { id: 'home',     label: 'Dashboard' },
  { id: 'sessions', label: 'Sessions'  },
  { id: 'schedule', label: 'Schedule'  },
  { id: 'billing',  label: 'Billing'   },
]

// ── GLOBAL CSS ────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;1,700;1,800;1,900&family=Barlow:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy:    #0B1423;
    --navy2:   #0E1A2E;
    --navy3:   #111F35;
    --navy4:   #152440;
    --navy5:   #1A2B4A;
    /* Brand accent: blanco */
    --accent:  #FFFFFF;
    --accent2: rgba(255,255,255,0.75);
    /* Kept as aliases so existing var(--red) / var(--red2) still work */
    --red:     #FFFFFF;
    --red2:    rgba(255,255,255,0.75);
    --white:   #FFFFFF;
    --offwhite:#EEF2F7;
    --muted:   #7A8EA8;
    --muted2:  #4A5E78;
    --border:  rgba(255,255,255,0.07);
    --border2: rgba(255,255,255,0.04);
    --green:   #1A9B5A;
    --green2:  #22C56E;
    --font-display: 'Barlow Condensed', sans-serif;
    --font-body:    'Barlow', sans-serif;
    --font-mono:    'DM Mono', monospace;
    --sidebar-w: 240px;
  }

  html, body { background: var(--navy); color: var(--white); font-family: var(--font-body); }

  /* Subtle diagonal stripe texture on body */
  body::before {
    content: '';
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 40px,
      rgba(255,255,255,0.008) 40px,
      rgba(255,255,255,0.008) 41px
    );
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  /* ── Keyframes ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes redPulse {
    0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.3); }
    70%  { box-shadow: 0 0 0 8px rgba(255,255,255,0);  }
    100% { box-shadow: 0 0 0 0 rgba(255,255,255,0);    }
  }
  @keyframes slideRight {
    from { transform: scaleX(0); } to { transform: scaleX(1); }
  }

  .animate-fade-up  { animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
  .animate-fade-in  { animation: fadeIn 0.3s ease both; }

  .stagger > * { animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
  .stagger > *:nth-child(1) { animation-delay: 0.04s; }
  .stagger > *:nth-child(2) { animation-delay: 0.10s; }
  .stagger > *:nth-child(3) { animation-delay: 0.16s; }
  .stagger > *:nth-child(4) { animation-delay: 0.22s; }
  .stagger > *:nth-child(5) { animation-delay: 0.28s; }

  /* ── Nav items ── */
  .nav-item {
    position: relative; width: 100%; display: flex; align-items: center;
    gap: 12px; padding: 12px 22px; text-align: left;
    background: transparent; color: var(--muted);
    border: none; border-left: 3px solid transparent;
    cursor: pointer;
    font-family: var(--font-display); font-weight: 700;
    font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase;
    font-style: italic;
    transition: color 0.18s, background 0.18s, border-color 0.18s;
    margin-bottom: 2px;
  }
  .nav-item:hover { color: var(--offwhite); background: rgba(255,255,255,0.04); }
  .nav-item.active {
    color: var(--white);
    background: rgba(255,255,255,0.05);
    border-left-color: var(--accent);
  }

  /* ── Player cards ── */
  .player-card {
    background: var(--navy3);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 26px;
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
    position: relative; overflow: hidden;
  }
  .player-card::after {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--red), transparent);
    opacity: 0; transition: opacity 0.25s;
  }
  .player-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.15);
  }
  .player-card:hover::after { opacity: 1; }

  /* ── Add card ── */
  .add-card {
    background: transparent;
    border: 1.5px dashed rgba(255,255,255,0.08);
    border-radius: 14px; padding: 26px;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    cursor: pointer; min-height: 220px;
    transition: all 0.22s ease;
  }
  .add-card:hover {
    border-color: rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.03);
  }
  .add-card:hover .add-icon { color: var(--accent); transform: rotate(90deg) scale(1.1); }
  .add-icon { color: var(--muted2); transition: all 0.3s ease; }

  /* ── Pack option buttons ── */
  .pack-option {
    display: flex; flex-direction: column; align-items: center;
    padding: 18px 10px; border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--navy4); color: var(--white);
    cursor: pointer; gap: 5px;
    transition: all 0.18s ease;
    position: relative; overflow: hidden;
  }
  .pack-option:hover {
    border-color: rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.05);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .pack-option.annual {
    border-color: rgba(26,155,90,0.35);
    background: rgba(26,155,90,0.06);
  }
  .pack-option.annual:hover {
    border-color: rgba(34,197,110,0.6);
    box-shadow: 0 8px 24px rgba(26,155,90,0.15);
  }

  /* ── Sessions bar ── */
  .sessions-bar { height: 3px; border-radius: 2px; background: rgba(255,255,255,0.06); overflow: hidden; }
  .sessions-bar-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--green), var(--green2)); transition: width 0.7s cubic-bezier(0.16,1,0.3,1); }

  /* ── Support buttons ── */
  .support-btn {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 22px; border-radius: 12px; text-decoration: none;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }
  .support-btn:hover { transform: translateX(5px); }

  /* ── Form inputs ── */
  .torque-input {
    width: 100%; padding: 13px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.04);
    color: var(--white); font-family: var(--font-body);
    font-size: 14px; margin-top: 8px;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .torque-input:focus {
    border-color: rgba(255,255,255,0.3);
    box-shadow: 0 0 0 3px rgba(255,255,255,0.05);
  }
  .torque-input::placeholder { color: var(--muted2); }

  /* ── Primary button ── */
  .btn-primary {
    padding: 14px 24px; border-radius: 8px;
    background: #FFFFFF; color: #0B1423;
    border: none; cursor: pointer;
    font-family: var(--font-display); font-weight: 800;
    font-style: italic; font-size: 16px;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: background 0.18s, transform 0.15s, box-shadow 0.18s;
    box-shadow: 0 4px 20px rgba(255,255,255,0.12);
  }
  .btn-primary:hover {
    background: rgba(255,255,255,0.88);
    transform: translateY(-1px);
    box-shadow: 0 6px 28px rgba(255,255,255,0.18);
  }
  .btn-primary:active { transform: translateY(0); }

  /* ── Ghost button ── */
  .btn-ghost {
    padding: 8px 16px; border-radius: 6px;
    background: transparent;
    color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.2);
    cursor: pointer; font-family: var(--font-display);
    font-weight: 700; font-style: italic; font-size: 13px;
    letter-spacing: 0.06em; text-transform: uppercase;
    transition: all 0.18s ease;
  }
  .btn-ghost:hover {
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.35);
    color: var(--white);
  }

  /* ── Calendar ── */
  .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
  .cal-day {
    aspect-ratio:1; display:flex; flex-direction:column; align-items:center;
    justify-content:center; border-radius:8px; cursor:default;
    font-family:var(--font-display); font-size:14px; font-weight:700;
    position:relative; transition:background 0.15s;
  }
  .cal-day.has-booking { background:rgba(34,197,110,0.1); cursor:pointer; }
  .cal-day.has-booking:hover { background:rgba(34,197,110,0.18); }
  .cal-day.today { background:rgba(255,255,255,0.08); }
  .cal-day.other-month { opacity:0.25; }
  .cal-dot { width:5px; height:5px; border-radius:50%; background:var(--green2); margin-top:3px; }

  /* ── Booking slots ── */
  .slot-btn {
    padding:12px 14px; border-radius:8px; border:1px solid var(--border);
    background:var(--navy4); color:var(--white); cursor:pointer;
    font-family:var(--font-display); font-size:13px; font-weight:700;
    text-align:center; transition:all 0.15s;
  }
  .slot-btn:hover { border-color:rgba(255,255,255,0.3); background:var(--navy5); }
  .slot-btn.selected { border-color:var(--green2); background:rgba(34,197,110,0.1); color:var(--green2); }

  /* ── Section header ── */
  .section-eyebrow { font-family:var(--font-display); font-style:italic; font-weight:700; font-size:12px; color:var(--muted); letter-spacing:0.25em; text-transform:uppercase; margin-bottom:6px; }
  .section-title { font-family:var(--font-display); font-style:italic; font-weight:900; font-size:48px; letter-spacing:0.06em; color:var(--white); line-height:1; }
  .section-bar { margin-top:10px; width:40px; height:3px; background:rgba(255,255,255,0.3); border-radius:2px; margin-bottom:28px; }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .torque-sidebar-desktop { display: none !important; }
    .torque-topbar { display: flex !important; }
    .torque-main { margin-left: 0 !important; padding: 20px 16px !important; padding-top: 76px !important; }
    .players-grid { grid-template-columns: 1fr !important; }
    .pack-options-grid { grid-template-columns: repeat(2,1fr) !important; }
  }
  @media (min-width: 769px) {
    .torque-topbar { display: none !important; }
    .torque-sidebar-mobile, .torque-overlay { display: none !important; }
  }
`

// ── COMPONENT ─────────────────────────────────────────────────────────────────
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
  const [paymentBanner, setPaymentBanner] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [bookings, setBookings] = useState([])
  const [showBookModal, setShowBookModal] = useState(false)
  const [bookingPlayer, setBookingPlayer] = useState(null)
  const [bookingForm, setBookingForm] = useState({ date: '', time: '', type: 'Training' })
  const [bookingLoading, setBookingLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchTorqueData()
      fetchBookings()

      const params = new URLSearchParams(window.location.search)
      const sessionId = params.get('session_id')
      const paymentOk = params.get('payment') === 'success'

      if (sessionId || paymentOk) {
        setPaymentBanner(true)
        window.history.replaceState({}, '', window.location.pathname)

        // Si viene el session_id, verificamos el pago directamente con Stripe
        if (sessionId) {
          verifyAndRecord(sessionId)
        } else {
          // Fallback: polling simple (webhook externo)
          startPolling()
        }
      }
    }
  }, [user])

  async function verifyAndRecord(sessionId) {
    try {
      console.log('[Torque] Verificando pago:', sessionId)
      const res = await fetch(`/api/verify-payment?session_id=${encodeURIComponent(sessionId)}`)
      const data = await res.json()
      console.log('[Torque] verify-payment response:', data)
      if (data.ok) {
        // Refresca inmediatamente y luego 2 veces más por si hay delay
        await fetchTorqueData()
        setTimeout(() => fetchTorqueData(), 2000)
      } else {
        console.warn('[Torque] verify-payment no-ok:', data)
        startPolling()
      }
    } catch (err) {
      console.error('[Torque] verify-payment error:', err)
      startPolling()
    }
  }

  function startPolling() {
    let attempt = 0
    const interval = setInterval(async () => {
      attempt++
      await fetchTorqueData()
      if (attempt >= 8) clearInterval(interval)
    }, 2000)
  }

  const navigateTo = (id) => { setPage(id); setSidebarOpen(false) }

  async function manualRefresh() {
    setRefreshing(true)
    await Promise.all([fetchTorqueData(), fetchBookings()])
    setRefreshing(false)
  }

  async function fetchBookings() {
    const { data } = await supabase.from('bookings').select('*')
      .eq('parent_id', user.id).order('session_date', { ascending: true })
    setBookings(data || [])
  }

  // Refresca datos sin mostrar la pantalla de loading completa
  async function quietRefresh() {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    const cacheKey = `torque_profile_${user.id}`
    const effectiveProfile = prof || (() => { try { return JSON.parse(localStorage.getItem(cacheKey) || 'null') } catch { return null } })()
    if (!effectiveProfile) return
    if (prof) localStorage.setItem(cacheKey, JSON.stringify(prof))

    const { data: kids } = await supabase.from('players').select('*').eq('parent_id', user.id)
    const playersKey = `torque_players_${user.id}`
    const effectiveKids = (kids && kids.length > 0) ? kids : (() => { try { return JSON.parse(localStorage.getItem(playersKey) || '[]') } catch { return [] } })()
    if (kids && kids.length > 0) localStorage.setItem(playersKey, JSON.stringify(kids))

    const { data: allMemberships } = await supabase
      .from('player_memberships').select('*')
      .eq('parent_id', user.id).eq('status', 'active')

    setPlayers((effectiveKids || []).map(kid => ({
      ...kid,
      active_membership: (allMemberships || []).find(
        m => m.kid_name?.toLowerCase().trim() === kid.kid_name?.toLowerCase().trim()
      ) || null
    })))

    const { data: bks } = await supabase.from('bookings').select('*')
      .eq('parent_id', user.id).order('session_date', { ascending: true })
    setBookings(bks || [])
  }

  async function handleBookSession() {
    if (!bookingPlayer || !bookingForm.date || !bookingForm.time) return
    setBookingLoading(true)
    try {
      // 1. Insertar booking
      const { error: bookErr } = await supabase.from('bookings').insert([{
        parent_id: user.id,
        kid_name: bookingPlayer.kid_name,
        membership_id: bookingPlayer.active_membership?.id || null,
        session_date: bookingForm.date,
        session_time: bookingForm.time,
        session_type: bookingForm.type,
        status: 'confirmed'
      }])
      if (bookErr) { console.error('[Torque] booking insert error:', bookErr); return }

      // 2. Descontar sesión — usar parent_id + kid_name (no depende de id local)
      const m = bookingPlayer.active_membership
      const newUsed = (m?.sessions_used || 0) + 1
      const { error: updErr } = await supabase.from('player_memberships')
        .update({ sessions_used: newUsed })
        .eq('parent_id', user.id)
        .eq('kid_name', bookingPlayer.kid_name)
        .eq('status', 'active')
      if (updErr) console.error('[Torque] sessions_used update error:', updErr)

      setShowBookModal(false)
      setBookingForm({ date: '', time: '', type: 'Training' })

      // 3. Refrescar silenciosamente (sin pantalla de loading)
      await quietRefresh()
    } finally {
      setBookingLoading(false)
    }
  }

  async function fetchTorqueData() {
    try {
      setLoading(true)
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()

      // Si RLS bloquea el SELECT, usamos el cache local
      const cacheKey = `torque_profile_${user.id}`
      const effectiveProfile = prof || (() => {
        try { return JSON.parse(localStorage.getItem(cacheKey) || 'null') } catch { return null }
      })()
      if (prof) localStorage.setItem(cacheKey, JSON.stringify(prof))

      if (effectiveProfile) {
        setProfile(effectiveProfile)
        const { data: kids } = await supabase.from('players').select('*').eq('parent_id', user.id)
        const playersKey = `torque_players_${user.id}`
        const effectiveKids = (kids && kids.length > 0) ? kids : (() => {
          try { return JSON.parse(localStorage.getItem(playersKey) || '[]') } catch { return [] }
        })()
        if (kids && kids.length > 0) localStorage.setItem(playersKey, JSON.stringify(kids))

        const { data: allMemberships } = await supabase
          .from('player_memberships').select('*')
          .eq('parent_id', user.id).eq('status', 'active')

        setPlayers((effectiveKids || []).map(kid => ({
          ...kid,
          active_membership: (allMemberships || []).find(
            m => m.kid_name?.toLowerCase().trim() === kid.kid_name?.toLowerCase().trim()
          ) || null
        })))
      } else {
        setProfile(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCheckout = (stripeUrl, priceId) => {
    if (!selectedPlayer) return
    const ref = encodeURIComponent(`${user.id}__${selectedPlayer.kid_name}__${priceId}`)
    window.open(`${stripeUrl}?client_reference_id=${ref}`, '_blank')
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

  // ── LOADING ──
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--navy)', flexDirection:'column', gap:20 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:56, letterSpacing:'0.1em', color:'var(--white)' }}>
        TORQUE
      </div>
      <div style={{ width:48, height:3, background:'var(--navy4)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:'45%', background:'rgba(255,255,255,0.6)', borderRadius:2, animation:'slideRight 0.8s ease infinite alternate' }} />
      </div>
      <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.25em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic' }}>Loading your portal...</div>
    </div>
  )

  // ── ONBOARDING ──
  if (!profile) return (
    <div style={{ minHeight:'100vh', background:'var(--navy)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width:'100%', maxWidth:460 }} className="animate-fade-up">
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:60, letterSpacing:'0.1em', lineHeight:1 }}>
            TORQUE
          </div>
          <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.3em', marginTop:6, textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic' }}>Performance Training</div>
        </div>

        <div style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:36, position:'relative', overflow:'hidden' }}>
          {/* Top accent */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg, rgba(255,255,255,0.35), transparent)' }} />

          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:22, letterSpacing:'0.08em', color:'var(--white)', marginBottom:24, textTransform:'uppercase' }}>
            New Account Setup
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault()
            setLoading(true)
            try {
              const profileData = {
                id: user.id,
                full_name: user.fullName,
                email: user.primaryEmailAddress?.emailAddress,
                phone: onboardingData.phone,
                role: 'parent'
              }
              // Sin id — Supabase lo genera automáticamente
              const playerInsert = {
                parent_id: user.id,
                kid_name: onboardingData.kidName,
                age: parseInt(onboardingData.kidAge),
                birthdate: onboardingData.kidBirthdate
              }

              await supabase.from('profiles').insert([profileData])
              await supabase.from('players').insert([playerInsert])

              // Cache local: el perfil y el player (con kid_name para hacer match de memberships)
              localStorage.setItem(`torque_profile_${user.id}`, JSON.stringify(profileData))
              localStorage.setItem(`torque_players_${user.id}`, JSON.stringify([{ ...playerInsert, id: 'local' }]))
            } catch (err) {
              console.error('[Torque] onboarding error:', err)
            }
            await fetchTorqueData()
          }} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <Label>Parent Phone</Label>
              <input className="torque-input" required placeholder="(555) 000-0000" onChange={e => setOnboardingData({...onboardingData, phone: e.target.value})} />
            </div>
            <div>
              <Label>First Player Name</Label>
              <input className="torque-input" required onChange={e => setOnboardingData({...onboardingData, kidName: e.target.value})} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <input className="torque-input" required type="number" placeholder="Age" style={{ marginTop:0 }} onChange={e => setOnboardingData({...onboardingData, kidAge: e.target.value})} />
              <input className="torque-input" required type="date" style={{ marginTop:0 }} onChange={e => setOnboardingData({...onboardingData, kidBirthdate: e.target.value})} />
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop:8 }}>Complete Registration</button>
          </form>
        </div>
      </div>
    </div>
  )

  const PAGE_MAP = {
    home:     <ParentHome players={players} onAdd={() => setShowAddPlayer(true)} onBuy={(p) => { setSelectedPlayer(p); setShowBuyPack(true) }} />,
    sessions: <SessionsPage players={players} bookings={bookings} onBook={(p) => { setBookingPlayer(p); setBookingForm({ date:'', time:'', type:'Training' }); setShowBookModal(true) }} />,
    schedule: <SchedulePage bookings={bookings} />,
    billing:  <BillingPage players={players} />,
  }

  // ── SIDEBAR CONTENT ──
  const SidebarContent = () => (
    <>
      {/* Logo area */}
      <div style={{ padding:'28px 22px 0', position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:30, letterSpacing:'0.1em', lineHeight:1 }}>
            TOR<span style={{ color:'var(--red)' }}>QUE</span>
          </div>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:4, display:'flex' }}>
              <X size={18} />
            </button>
          )}
        </div>
        {/* Underline */}
        <div style={{ height:2, background:'linear-gradient(90deg, rgba(255,255,255,0.4) 40%, transparent)', marginBottom:0 }} />
      </div>

      {/* User badge */}
      <div style={{ margin:'16px 14px', padding:'11px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid var(--border2)' }}>
        <div style={{ fontSize:9, color:'var(--muted2)', letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic', marginBottom:3 }}>Signed in as</div>
        <div style={{ fontSize:12, color:'var(--offwhite)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.primaryEmailAddress?.emailAddress}</div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'6px 10px', display:'flex', flexDirection:'column' }}>
        {NAV_ITEMS.map(({ id, label }) => (
          <button key={id} onClick={() => navigateTo(id)} className={`nav-item${page === id ? ' active' : ''}`}>
            {/* Red indicator dot */}
            <span style={{ width:5, height:5, borderRadius:'50%', flexShrink:0, transition:'all 0.2s', background: page === id ? 'var(--red)' : 'transparent', border: page === id ? 'none' : '1px solid var(--muted2)' }} />
            {label}
          </button>
        ))}

        <div style={{ flex:1 }} />

        {/* Divider */}
        <div style={{ margin:'10px 12px', height:1, background:'var(--border2)' }} />

        {/* Support */}
        <button onClick={() => { setShowSupport(true); setSidebarOpen(false) }} className="nav-item" style={{ fontStyle:'italic' }}>
          <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:16, height:16, borderRadius:'50%', border:'1.5px solid var(--muted2)', fontSize:9, fontWeight:800, flexShrink:0, fontStyle:'normal' }}>?</span>
          Support
        </button>

        {/* Logout */}
        <button onClick={() => signOut()} className="nav-item" style={{ color:'#E05555', marginBottom:14 }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:'rgba(224,85,85,0.5)', flexShrink:0 }} />
          Logout
        </button>
      </nav>
    </>
  )

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div style={{ display:'flex', minHeight:'100vh', position:'relative', zIndex:1 }}>

        {/* Sidebar Desktop */}
        <aside className="torque-sidebar-desktop" style={sidebarStyle}>
          <SidebarContent />
        </aside>

        {/* Topbar Mobile */}
        <div className="torque-topbar" style={{
          position:'fixed', top:0, left:0, right:0, height:60,
          background:'rgba(11,20,35,0.97)', backdropFilter:'blur(12px)',
          borderBottom:'1px solid rgba(255,255,255,0.1)',
          alignItems:'center', justifyContent:'space-between',
          padding:'0 20px', zIndex:200, display:'none'
        }}>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:26, letterSpacing:'0.1em', lineHeight:1 }}>
            TOR<span style={{ color:'var(--red)' }}>QUE</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--white)', padding:6 }}>
            <Menu size={22} />
          </button>
        </div>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div className="torque-overlay" onClick={() => setSidebarOpen(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:299, backdropFilter:'blur(4px)' }} />
        )}

        {/* Sidebar Mobile */}
        <aside className="torque-sidebar-mobile" style={{
          ...sidebarStyle, zIndex:300, display:'flex',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition:'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <SidebarContent />
        </aside>

        {/* Main content */}
        <main className="torque-main" style={{ flex:1, marginLeft:240, padding:'44px 48px', minHeight:'100vh' }}>
          {/* Payment detected banner */}
          {paymentBanner && (
            <div style={{ marginBottom:24, padding:'14px 20px', borderRadius:10, background:'rgba(34,197,110,0.07)', border:'1px solid rgba(34,197,110,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--green2)', boxShadow:'0 0 8px var(--green2)', flexShrink:0 }} />
                <div>
                  <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:14, color:'var(--green2)', letterSpacing:'0.06em', textTransform:'uppercase' }}>Pago recibido</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:1 }}>Cargando tus sesiones... Si no aparecen en unos segundos, presiona el botón.</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <button onClick={manualRefresh} disabled={refreshing} className="btn-ghost" style={{ fontSize:12 }}>
                  {refreshing ? 'Buscando...' : '↺ Buscar sesiones'}
                </button>
                <button onClick={() => setPaymentBanner(false)} style={{ background:'none', border:'none', color:'var(--muted2)', cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 4px' }}>✕</button>
              </div>
            </div>
          )}
          {PAGE_MAP[page]}
        </main>
      </div>

      {/* ── MODAL: BUY PACK ── */}
      <Modal open={showBuyPack} onClose={() => setShowBuyPack(false)} title={`Training Plans · ${selectedPlayer?.kid_name}`} width={800}>
        {/* Discount strip */}
        <div style={{ marginBottom:22, padding:'12px 18px', background:'rgba(255,255,255,0.04)', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:13, color:'rgba(255,255,255,0.75)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Membership Discounts</div>
          <div style={{ display:'flex', gap:20, fontSize:12, color:'var(--muted)', fontFamily:'var(--font-body)' }}>
            <span>6 Mo <b style={{ color:'var(--offwhite)' }}>–10%</b></span>
            <span>12 Mo <b style={{ color:'var(--offwhite)' }}>–15%</b></span>
            <span>Annual <b style={{ color:'var(--green2)' }}>–20% total</b></span>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14 }} className="stagger">
          {PACKS.map(pack => {
            const p6  = (pack.price * 0.90).toFixed(0)
            const p12 = (pack.price * 0.85).toFixed(0)
            const pAn = (pack.price * 12 * 0.80).toFixed(0)
            return (
              <div key={pack.id} style={{ padding:'20px 22px', borderRadius:12, border:'1px solid var(--border)', background:'var(--navy3)', position:'relative', overflow:'hidden' }}>
                {/* Left accent bar */}
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'rgba(255,255,255,0.25)' }} />

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, paddingLeft:8 }}>
                  <div>
                    <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:28, letterSpacing:'0.06em', color:'var(--white)', lineHeight:1 }}>{pack.name}</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', fontWeight:600, marginTop:3, letterSpacing:'0.05em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic' }}>{pack.tag}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:2, fontFamily:'var(--font-mono)' }}>{pack.sessions} sessions / month</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:36, color:'var(--white)', letterSpacing:'0.02em', lineHeight:1 }}>${pack.price}</div>
                    <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.2em', textTransform:'uppercase', marginTop:2 }}>base / month</div>
                  </div>
                </div>

                {/* ── CAMBIO 2 y 3: botones ahora pasan pack.prices.X como segundo argumento ── */}
                <div className="pack-options-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, paddingLeft:8 }}>
                  <button onClick={() => handleCheckout(pack.links.stand, pack.prices.stand)} className="pack-option">
                    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', color:'var(--muted)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>STANDARD</span>
                    <span style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22 }}>${pack.price}</span>
                    <span style={{ fontSize:9, color:'var(--muted2)', fontFamily:'var(--font-mono)' }}>no commit</span>
                  </button>
                  <button onClick={() => handleCheckout(pack.links.m6, pack.prices.m6)} className="pack-option">
                    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', color:'rgba(255,255,255,0.6)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>6 MONTHS</span>
                    <span style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22 }}>${p6}</span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', fontFamily:'var(--font-mono)' }}>–10% /mo</span>
                  </button>
                  <button onClick={() => handleCheckout(pack.links.m12, pack.prices.m12)} className="pack-option">
                    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', color:'rgba(255,255,255,0.6)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>12 MONTHS</span>
                    <span style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22 }}>${p12}</span>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', fontFamily:'var(--font-mono)' }}>–15% /mo</span>
                  </button>
                  <button onClick={() => handleCheckout(pack.links.annual, pack.prices.annual)} className="pack-option annual">
                    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', color:'var(--green2)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>ANNUAL</span>
                    <span style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22, color:'var(--green2)' }}>${pAn}</span>
                    <span style={{ fontSize:9, color:'var(--green2)', fontFamily:'var(--font-mono)' }}>best value</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* ── MODAL: ADD PLAYER ── */}
      <Modal open={showAddPlayer} onClose={() => setShowAddPlayer(false)} title="Register New Player">
        <form onSubmit={handleAddPlayer} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <Label>Player Name</Label>
            <input className="torque-input" required value={newPlayerData.name} onChange={e => setNewPlayerData({...newPlayerData, name: e.target.value})} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <input className="torque-input" required type="number" placeholder="Age" style={{ marginTop:0 }} onChange={e => setNewPlayerData({...newPlayerData, age: e.target.value})} />
            <input className="torque-input" required type="date" style={{ marginTop:0 }} onChange={e => setNewPlayerData({...newPlayerData, birthdate: e.target.value})} />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop:8 }}>Register Player</button>
        </form>
      </Modal>

      {/* ── MODAL: BOOK SESSION ── */}
      <Modal open={showBookModal} onClose={() => setShowBookModal(false)} title={`Agendar Sesión · ${bookingPlayer?.kid_name}`} width={520}>
        {bookingPlayer && (() => {
          const m = bookingPlayer.active_membership
          const remaining = m ? m.sessions_total - m.sessions_used : 0
          // Available days: Mon=1, Wed=3, Fri=5, Sat=6
          const AVAILABLE_DAYS = [1, 3, 5, 6]
          const TIMES = ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM']
          const TYPES = ['Speed & Agility', 'Fielding / Defense', 'Batting', 'General Training']
          // Build next 21 days that match available days
          const availableDates = []
          const today = new Date(); today.setHours(0,0,0,0)
          for (let i = 1; availableDates.length < 12; i++) {
            const d = new Date(today); d.setDate(today.getDate() + i)
            if (AVAILABLE_DAYS.includes(d.getDay())) {
              availableDates.push(d.toISOString().split('T')[0])
            }
          }
          const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
          const fmt = (iso) => { const d = new Date(iso+'T12:00:00'); return `${DAY_NAMES[d.getDay()]} ${d.getDate()}` }
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              {remaining <= 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--muted)' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>⚠️</div>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16 }}>Sin sesiones disponibles</div>
                  <div style={{ fontSize:13, marginTop:6 }}>Adquiere un plan para agendar sesiones.</div>
                </div>
              ) : (
                <>
                  <div style={{ padding:'10px 16px', background:'rgba(34,197,110,0.07)', border:'1px solid rgba(34,197,110,0.2)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13, color:'var(--muted)' }}>Sesiones disponibles</span>
                    <span style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:22, color:'var(--green2)' }}>{remaining}</span>
                  </div>
                  <div>
                    <Label>Fecha</Label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginTop:8 }}>
                      {availableDates.map(d => (
                        <button key={d} onClick={() => setBookingForm(f => ({...f, date:d}))}
                          className={`slot-btn${bookingForm.date === d ? ' selected' : ''}`}>
                          {fmt(d)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Horario</Label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginTop:8 }}>
                      {TIMES.map(t => (
                        <button key={t} onClick={() => setBookingForm(f => ({...f, time:t}))}
                          className={`slot-btn${bookingForm.time === t ? ' selected' : ''}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Tipo de sesión</Label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
                      {TYPES.map(tp => (
                        <button key={tp} onClick={() => setBookingForm(f => ({...f, type:tp}))}
                          className={`slot-btn${bookingForm.type === tp ? ' selected' : ''}`}
                          style={{ fontSize:12 }}>
                          {tp}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleBookSession} disabled={!bookingForm.date || !bookingForm.time || bookingLoading}
                    className="btn-primary" style={{ marginTop:4 }}>
                    {bookingLoading ? 'Agendando...' : `Confirmar sesión`}
                  </button>
                </>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* ── MODAL: SUPPORT ── */}
      <Modal open={showSupport} onClose={() => setShowSupport(false)} title="Help & Support">
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <p style={{ fontSize:14, color:'var(--muted)', lineHeight:1.75, padding:'14px 18px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid var(--border)' }}>
            Need help with your account, sessions, or billing? Our team is ready to assist you.
            Reach out via WhatsApp for a fast response, or send us an email and we'll get back to you shortly.
          </p>
          <a href="https://wa.me/19152343655" target="_blank" rel="noopener noreferrer"
            className="support-btn"
            style={{ border:'1px solid rgba(34,197,110,0.25)', background:'rgba(34,197,110,0.05)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ color:'var(--green2)', flexShrink:0 }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:16, color:'var(--white)', letterSpacing:'0.05em', textTransform:'uppercase' }}>WhatsApp</div>
                <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'var(--font-mono)', marginTop:2 }}>+1 (915) 234-3655 · fastest response</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--green2)" />
          </a>
          <a href="mailto:txtorq@gmail.com"
            className="support-btn"
            style={{ border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:'rgba(255,255,255,0.5)', flexShrink:0 }}>
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:16, color:'var(--white)', letterSpacing:'0.05em', textTransform:'uppercase' }}>Email</div>
                <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'var(--font-mono)', marginTop:2 }}>txtorq@gmail.com · reply within 24h</div>
              </div>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
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
      <div style={{ marginBottom:36 }} className="animate-fade-up">
        <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, fontSize:12, color:'var(--muted)', letterSpacing:'0.25em', textTransform:'uppercase', marginBottom:6 }}>Parent Portal</div>
        <h1 style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:52, letterSpacing:'0.06em', color:'var(--white)', lineHeight:1 }}>
          MY PLAYERS
        </h1>
        {/* Red underbar */}
        <div style={{ marginTop:12, width:48, height:3, background:'rgba(255,255,255,0.3)', borderRadius:2 }} />
      </div>

      <div className="players-grid stagger" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {players.map((player) => {
          const m = player.active_membership
          const used = m ? m.sessions_used : 0
          const total = m ? m.sessions_total : 0
          const remaining = total - used
          const pct = total > 0 ? (remaining / total) * 100 : 0
          const lowSessions = pct < 30

          return (
            <div key={player.id} className="player-card">
              {/* Background initial watermark */}
              <div style={{ position:'absolute', right:16, top:10, fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:90, color:'rgba(255,255,255,0.025)', lineHeight:1, userSelect:'none', pointerEvents:'none' }}>
                {player.kid_name[0]}
              </div>

              {/* Avatar + name */}
              <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:22, position:'relative' }}>
                <div style={{ width:54, height:54, borderRadius:12, background:'linear-gradient(135deg, var(--navy4) 0%, var(--navy5) 100%)', border:'1px solid rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:26, color:'white', flexShrink:0, boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
                  {player.kid_name[0]}
                </div>
                <div>
                  <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:26, letterSpacing:'0.05em', color:'var(--white)', lineHeight:1 }}>{player.kid_name}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:5 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background: m ? 'var(--green2)' : 'var(--muted2)', boxShadow: m ? '0 0 6px var(--green2)' : 'none' }} />
                    <div style={{ fontSize:11, color: m ? 'var(--green2)' : 'var(--muted)', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic' }}>
                      {m ? m.package_name : 'No active plan'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sessions block */}
              <div style={{ background:'rgba(0,0,0,0.25)', borderRadius:10, padding:'16px 18px', border:'1px solid var(--border2)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ fontSize:10, color:'var(--muted2)', fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic' }}>Sessions</span>
                  {m ? (
                    <span style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:24, letterSpacing:'0.04em', color: lowSessions ? '#E8A020' : 'var(--green2)' }}>
                      {remaining}<span style={{ fontSize:13, color:'var(--muted)', fontWeight:400, marginLeft:3 }}>/ {total}</span>
                    </span>
                  ) : (
                    <button className="btn-ghost" onClick={() => onBuy(player)}>+ Get Plan</button>
                  )}
                </div>
                <div className="sessions-bar">
                  <div className="sessions-bar-fill" style={{ width:`${pct}%`, background: lowSessions ? 'linear-gradient(90deg, #E8A020, #F0C040)' : undefined }} />
                </div>
                {m && (
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:10, color:'var(--muted2)', fontFamily:'var(--font-mono)' }}>
                    <span>{used} used</span>
                    <span>{remaining} remaining</span>
                  </div>
                )}
              </div>

              {m && (
                <button className="btn-ghost" onClick={() => onBuy(player)} style={{ width:'100%', marginTop:14, justifyContent:'center', display:'flex', padding:'10px 16px' }}>
                  Upgrade Plan
                </button>
              )}
            </div>
          )
        })}

        {/* Add card */}
        <div className="add-card" onClick={onAdd}>
          <div className="add-icon"><Plus size={34} strokeWidth={1.5} /></div>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:14, color:'var(--muted2)', letterSpacing:'0.2em', textTransform:'uppercase', marginTop:10 }}>Add Player</div>
        </div>
      </div>
    </div>
  )
}

// ── PLACEHOLDER ───────────────────────────────────────────────────────────────
// ── SESSIONS PAGE ─────────────────────────────────────────────────────────────
function SessionsPage({ players, bookings, onBook }) {
  const playersWithPlan = players.filter(p => p.active_membership)
  const today = new Date().toISOString().split('T')[0]
  const upcoming = bookings.filter(b => b.session_date >= today && b.status === 'confirmed')

  return (
    <div className="animate-fade-up">
      <div className="section-eyebrow">Parent Portal</div>
      <h1 className="section-title">SESSIONS</h1>
      <div className="section-bar" />

      {playersWithPlan.length === 0 ? (
        <div style={{ padding:'48px 0', textAlign:'center', color:'var(--muted)', fontSize:14 }}>
          Ningún jugador tiene un plan activo. Compra un plan desde el Dashboard.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {players.map(player => {
            const m = player.active_membership
            const used = m ? m.sessions_used : 0
            const total = m ? m.sessions_total : 0
            const remaining = total - used
            const pct = total > 0 ? Math.round((remaining / total) * 100) : 0
            const playerBookings = upcoming.filter(b => b.kid_name?.toLowerCase() === player.kid_name?.toLowerCase())

            return (
              <div key={player.id} style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:24, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', right:20, top:16, fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:80, color:'rgba(255,255,255,0.025)', lineHeight:1, userSelect:'none' }}>{player.kid_name[0]}</div>

                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
                  {/* Left: player info */}
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:48, height:48, borderRadius:10, background:'linear-gradient(135deg, var(--navy4), var(--navy5))', border:'1px solid rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22, color:'white', flexShrink:0 }}>
                      {player.kid_name[0]}
                    </div>
                    <div>
                      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22, color:'var(--white)' }}>{player.kid_name}</div>
                      <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'var(--font-display)', fontStyle:'italic', marginTop:2 }}>{m ? m.package_name : 'Sin plan'}</div>
                    </div>
                  </div>

                  {/* Right: big counter */}
                  <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:56, lineHeight:1, color: remaining === 0 ? 'var(--muted2)' : remaining <= 2 ? '#E8A020' : 'var(--green2)' }}>{remaining}</div>
                      <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:'var(--font-display)', marginTop:2 }}>de {total} restantes</div>
                    </div>
                    {m && remaining > 0 && (
                      <button onClick={() => onBook(player)} className="btn-primary" style={{ padding:'12px 20px', fontSize:14 }}>
                        + Agendar
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {m && (
                  <div style={{ marginTop:20 }}>
                    <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:6, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:6, transition:'width 0.6s ease', width:`${pct}%`, background: remaining === 0 ? 'var(--muted2)' : remaining <= 2 ? 'linear-gradient(90deg,#E8A020,#F0C040)' : 'linear-gradient(90deg,var(--green),var(--green2))' }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--muted)', fontFamily:'var(--font-mono)' }}>
                      <span>{used} usadas</span><span>{remaining} disponibles</span>
                    </div>
                  </div>
                )}

                {/* Upcoming bookings for this player */}
                {playerBookings.length > 0 && (
                  <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
                    <div style={{ fontSize:10, color:'var(--muted2)', letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic', marginBottom:10 }}>Próximas sesiones</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {playerBookings.slice(0,3).map(b => (
                        <div key={b.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:'rgba(34,197,110,0.06)', borderRadius:8, border:'1px solid rgba(34,197,110,0.15)' }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--green2)', flexShrink:0 }} />
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--offwhite)' }}>
                            {new Date(b.session_date+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',month:'short',day:'numeric'})} · {b.session_time}
                          </span>
                          <span style={{ marginLeft:'auto', fontSize:11, color:'var(--muted)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>{b.session_type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── SCHEDULE PAGE ─────────────────────────────────────────────────────────────
function SchedulePage({ bookings }) {
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const today = new Date(); today.setHours(0,0,0,0)

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

  // Normalize date: Supabase sometimes returns "2026-04-14T00:00:00+00:00"
  const normDate = (d) => (d || '').split('T')[0]

  // Map bookings by normalized date
  const bookingsByDate = {}
  bookings.forEach(b => {
    const key = normDate(b.session_date)
    if (!key) return
    if (!bookingsByDate[key]) bookingsByDate[key] = []
    bookingsByDate[key].push(b)
  })

  const isoToday = today.toISOString().split('T')[0]
  const upcoming  = bookings
    .filter(b => normDate(b.session_date) >= isoToday && b.status === 'confirmed')
    .sort((a,b) => normDate(a.session_date).localeCompare(normDate(b.session_date)))
    .slice(0, 10)

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const TYPE_COLORS = {
    'Speed & Agility':    '#4fa8ff',
    'Fielding / Defense': '#22C56E',
    'Batting':            '#f39c12',
    'General Training':   '#a78bfa',
  }

  return (
    <div className="animate-fade-up">
      <div className="section-eyebrow">Parent Portal</div>
      <h1 className="section-title">SCHEDULE</h1>
      <div className="section-bar" />

      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:20, alignItems:'start' }}>

        {/* ── CALENDAR ── */}
        <div style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <button onClick={() => { setViewDate(new Date(year,month-1,1)); setSelectedDay(null) }}
              style={{ background:'var(--navy4)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, fontWeight:700 }}>‹</button>
            <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:20, letterSpacing:'0.06em', color:'var(--white)', textTransform:'uppercase' }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <button onClick={() => { setViewDate(new Date(year,month+1,1)); setSelectedDay(null) }}
              style={{ background:'var(--navy4)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, fontWeight:700 }}>›</button>
          </div>

          {/* Day headers */}
          <div className="cal-grid" style={{ marginBottom:6 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign:'center', fontFamily:'var(--font-display)', fontSize:11, fontWeight:700, color:'var(--muted2)', letterSpacing:'0.08em', padding:'4px 0', textTransform:'uppercase' }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="cal-grid" style={{ gap:4 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const iso    = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayBks = bookingsByDate[iso] || []
              const hasB   = dayBks.length > 0
              const isToday    = iso === isoToday
              const isSelected = iso === selectedDay
              return (
                <div key={iso}
                  onClick={() => hasB && setSelectedDay(isSelected ? null : iso)}
                  style={{
                    aspectRatio:'1', display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center', borderRadius:10,
                    cursor: hasB ? 'pointer' : 'default', position:'relative',
                    transition:'all 0.15s',
                    background: isSelected ? 'rgba(34,197,110,0.18)' : hasB ? 'rgba(34,197,110,0.09)' : isToday ? 'rgba(255,255,255,0.07)' : 'transparent',
                    border: isSelected ? '1.5px solid rgba(34,197,110,0.5)' : hasB ? '1px solid rgba(34,197,110,0.2)' : isToday ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                  }}>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight: hasB || isToday ? 800 : 500, fontSize:14,
                    color: isSelected ? 'var(--green2)' : hasB ? 'var(--green2)' : isToday ? 'var(--white)' : 'var(--text2)' }}>
                    {day}
                  </span>
                  {/* Colored dots per booking type */}
                  {hasB && (
                    <div style={{ display:'flex', gap:2, marginTop:3, flexWrap:'wrap', justifyContent:'center' }}>
                      {dayBks.slice(0,3).map((b,bi) => (
                        <div key={bi} style={{ width:5, height:5, borderRadius:'50%', background: TYPE_COLORS[b.session_type] || 'var(--green2)' }} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Selected day detail */}
          {selectedDay && bookingsByDate[selectedDay] && (
            <div style={{ marginTop:16, padding:'14px 16px', background:'rgba(34,197,110,0.06)', border:'1px solid rgba(34,197,110,0.2)', borderRadius:10 }}>
              <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:13, color:'var(--green2)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10 }}>
                {new Date(selectedDay+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}
              </div>
              {bookingsByDate[selectedDay].map((b,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop: i>0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: TYPE_COLORS[b.session_type] || 'var(--green2)', flexShrink:0 }} />
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--offwhite)', fontWeight:600 }}>{b.session_time}</span>
                  <span style={{ fontSize:12, color:'var(--muted)' }}>·</span>
                  <span style={{ fontSize:12, color:'var(--offwhite)' }}>{b.kid_name}</span>
                  <span style={{ marginLeft:'auto', fontSize:11, color:'var(--muted)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>{b.session_type}</span>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:12 }}>
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'var(--muted)' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:color }} />
                {type}
              </div>
            ))}
          </div>
        </div>

        {/* ── UPCOMING LIST ── */}
        <div style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:16, color:'var(--white)', marginBottom:16, letterSpacing:'0.04em' }}>PRÓXIMAS SESIONES</div>
          {upcoming.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted)', fontSize:13, lineHeight:1.7 }}>No hay sesiones agendadas.<br/>Ve a Sessions para agendar.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {upcoming.map(b => {
                const iso = normDate(b.session_date)
                const typeColor = TYPE_COLORS[b.session_type] || 'var(--green2)'
                const isNext = iso === upcoming[0] ? normDate(upcoming[0].session_date) : null
                return (
                  <div key={b.id}
                    onClick={() => { setSelectedDay(iso); setViewDate(new Date(iso+'T12:00:00')) }}
                    style={{ padding:'12px 14px', background:'rgba(255,255,255,0.03)', border:`1px solid ${iso === selectedDay ? 'rgba(34,197,110,0.3)' : 'var(--border)'}`, borderRadius:10, cursor:'pointer', transition:'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:13, color:'var(--white)' }}>
                        {new Date(iso+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',month:'short',day:'numeric'})}
                      </div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:typeColor, fontWeight:600 }}>{b.session_time}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:5 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:typeColor, flexShrink:0 }} />
                      <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>{b.session_type}</span>
                      <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text2)' }}>{b.kid_name}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── BILLING PAGE ──────────────────────────────────────────────────────────────
function BillingPage({ players }) {
  const memberships = players.flatMap(p => p.active_membership ? [{ ...p.active_membership, kid_name: p.kid_name }] : [])

  function nextPayment(purchasedAt, total) {
    if (!purchasedAt) return '—'
    const d = new Date(purchasedAt)
    // Estimate cycle: annual if sessions >= 96, monthly otherwise
    const isAnnual = total >= 96
    if (isAnnual) d.setFullYear(d.getFullYear() + 1)
    else d.setMonth(d.getMonth() + 1)
    return d.toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' })
  }

  function cycleLabel(total) {
    if (total >= 96) return 'Anual'
    if (total >= 48) return '6 Meses'
    if (total >= 24) return '12 Meses'
    return 'Mensual'
  }

  return (
    <div className="animate-fade-up">
      <div className="section-eyebrow">Parent Portal</div>
      <h1 className="section-title">BILLING</h1>
      <div className="section-bar" />

      {memberships.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--muted)', fontSize:14 }}>No hay planes activos.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {memberships.map((m, i) => (
            <div key={m.id || i} style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
                <div>
                  <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22, color:'var(--white)' }}>{m.kid_name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:3, fontFamily:'var(--font-display)', fontStyle:'italic', letterSpacing:'0.06em', textTransform:'uppercase' }}>{m.package_name} · {cycleLabel(m.sessions_total)}</div>
                </div>
                <div style={{ padding:'4px 12px', background:'rgba(34,197,110,0.1)', border:'1px solid rgba(34,197,110,0.25)', borderRadius:20, fontSize:11, fontFamily:'var(--font-display)', fontWeight:700, color:'var(--green2)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Activo</div>
              </div>

              {/* Stats row */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
                {[
                  { label:'Sesiones totales', value: m.sessions_total },
                  { label:'Sesiones usadas',  value: m.sessions_used },
                  { label:'Sesiones restantes', value: m.sessions_total - m.sessions_used },
                ].map(s => (
                  <div key={s.label} style={{ background:'rgba(0,0,0,0.2)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:28, color:'var(--white)' }}>{s.value}</div>
                    <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'var(--font-display)', marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Payment info */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ padding:'12px 16px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:10 }}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', fontFamily:'var(--font-display)', marginBottom:4 }}>Fecha de compra</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--offwhite)' }}>
                    {m.purchased_at ? new Date(m.purchased_at).toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'}) : '—'}
                  </div>
                </div>
                <div style={{ padding:'12px 16px', background:'rgba(34,197,110,0.05)', border:'1px solid rgba(34,197,110,0.15)', borderRadius:10 }}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', fontFamily:'var(--font-display)', marginBottom:4 }}>Próximo pago</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--green2)' }}>{nextPayment(m.purchased_at, m.sessions_total)}</div>
                </div>
              </div>

              {/* Stripe reference */}
              {m.stripe_payment_id && (
                <div style={{ marginTop:12, padding:'8px 14px', background:'rgba(0,0,0,0.2)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'var(--font-display)' }}>Referencia de pago</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text2)' }}>{m.stripe_payment_id?.slice(0,24)}…</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlaceholderPage({ title }) {
  return (
    <div className="animate-fade-up">
      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, fontSize:12, color:'var(--muted)', letterSpacing:'0.25em', textTransform:'uppercase', marginBottom:6 }}>Coming Soon</div>
      <h1 style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:52, letterSpacing:'0.06em', color:'var(--white)', lineHeight:1, marginBottom:14 }}>{title.toUpperCase()}</h1>
      <div style={{ width:48, height:3, background:'rgba(255,255,255,0.3)', borderRadius:2, marginBottom:24 }} />
      <div style={{ fontSize:14, color:'var(--muted)' }}>This section is under construction.</div>
    </div>
  )
}

// ── SIDEBAR STYLE ─────────────────────────────────────────────────────────────
const sidebarStyle = {
  width: 240,
  background: 'linear-gradient(180deg, #0B1525 0%, #0A1220 100%)',
  borderRight: '1px solid rgba(255,255,255,0.07)',
  position: 'fixed', top: 0, left: 0, bottom: 0,
  display: 'flex', flexDirection: 'column', zIndex: 100,
  boxShadow: '4px 0 32px rgba(0,0,0,0.5)',
}
