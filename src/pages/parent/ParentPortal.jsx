import React, { useState, useEffect, useMemo } from 'react'
import { Plus, LogOut, ChevronRight, Menu, X, Pencil } from 'lucide-react'
import { Card, Avatar, Btn, Modal, ProgressBar, Label } from '../../components/UI'
import { useUser, useClerk, useSession } from "@clerk/clerk-react"
import { supabase, getAuthClient } from "../../supabaseClient"
import { API_BASE } from '../../lib/apiBase'
import QRCheckinModal from '../../components/QRCheckinModal'

// ── PAQUETES ──────────────────────────────────────────────────────────────────
const PACKS = [
  { id: 'a',   name: 'PACKAGE A',   sessions: 4,  price: 260, tag: 'Basic Training',
    links: { stand: 'https://buy.stripe.com/aFa00i6ZU9aI03r4uafAc0f', m6: 'https://buy.stripe.com/aFa8wOesm9aI3fD5yefAc0e', m12: 'https://buy.stripe.com/14A7sKdoi0EcaI55yefAc0d', annual: 'https://buy.stripe.com/6oU00i6ZU1Igg2p6CifAc0b' },
    prices: { stand: 'price_1Tk92RAPTWbxe0YyE8zgXLet', m6: 'price_1TLqDmAPTWbxe0YyqbHEcuFr', m12: 'price_1TLqDmAPTWbxe0YysigUumPn', annual: 'price_1TLqDlAPTWbxe0YyljY5WD6Y' }},
  { id: 'aa',  name: 'PACKAGE AA',  sessions: 8,  price: 360, tag: 'Advanced Growth',
    links: { stand: 'https://buy.stripe.com/00weVc2JEev2dUh8KqfAc09', m6: 'https://buy.stripe.com/dRmdR8cke9aIeYl2m2fAc08', m12: 'https://buy.stripe.com/bJe14m4RM5Yw7vTgcSfAc04', annual: 'https://buy.stripe.com/aFafZg6ZU9aIbM90dUfAc07' },
    prices: { stand: 'price_1Tk92RAPTWbxe0Yy4zaPZkvx', m6: 'price_1TLqDkAPTWbxe0YyZu4hFrI3', m12: 'price_1TLqDjAPTWbxe0YyTsqaUdt5', annual: 'price_1TLqDkAPTWbxe0YykcsrB50f' }},
  { id: 'aaa', name: 'PACKAGE AAA', sessions: 12, price: 440, tag: 'Elite Prospect',
    links: { stand: 'https://buy.stripe.com/4gMaEWfwq1Ig2bze4KfAc01', m6: 'https://buy.stripe.com/8x28wO3NI3Qo5nL6CifAc0c', m12: 'https://buy.stripe.com/4gMaEW2JEbiQdUh5yefAc03', annual: 'https://buy.stripe.com/eVq5kC5VQ86E7vTd0GfAc06' },
    prices: { stand: 'price_1Tk92RAPTWbxe0YyM8hl6j9s', m6: 'price_1TLqDkAPTWbxe0YydXEB3YqT', m12: 'price_1TLqDjAPTWbxe0YyuyUujCu4', annual: 'price_1TLqDkAPTWbxe0Yy8UHtMvEJ' }},
  { id: 'mlb', name: 'PACKAGE MLB', sessions: 20, price: 600, tag: 'Unlimited Access',
    links: { stand: 'https://buy.stripe.com/7sYeVc3NIdqYdUh9OufAc0h', m6: 'https://buy.stripe.com/dRmfZgckegDacQd8KqfAc0a', m12: 'https://buy.stripe.com/14A6oG4RM5Yw9E1bWCfAc05', annual: 'https://buy.stripe.com/dRm9ASgAu3QoeYle4KfAc00' },
    prices: { stand: 'price_1Tk92SAPTWbxe0YyRaxsup9N', m6: 'price_1TLqDlAPTWbxe0YyEIZi7YR5', m12: 'price_1TLqDjAPTWbxe0YyVQxRaHFs', annual: 'price_1TLqDjAPTWbxe0Yy6fRLwlFM' }},
]

const NAV_ITEMS = [
  { id: 'home',     label: 'Dashboard' },
  { id: 'sessions', label: 'Sessions'  },
  { id: 'schedule', label: 'Schedule'  },
  { id: 'billing',  label: 'Billing'   },
  { id: 'events',   label: 'Events'    },
]

const WEEKDAY_TIMES  = ['4:00 PM', '5:00 PM', '6:00 PM']
const SATURDAY_TIMES = ['12:00 PM', '1:00 PM', '2:00 PM']
const MAX_CAPACITY = 16

// Días festivos completamente bloqueados para reservar (sin slots disponibles).
// 4 de julio — feriado nacional de EE. UU. (se bloquea cada año).
const isBlockedHoliday = (d) => d.getMonth() === 6 && d.getDate() === 4

function parseSessionDateTime(dateStr, timeStr) {
  const [hm, period] = timeStr.split(' ')
  let [h, m] = hm.split(':').map(Number)
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
}

function canModifyBooking(booking) {
  const dt = parseSessionDateTime(booking.session_date, booking.session_time)
  return dt.getTime() - Date.now() >= 2 * 60 * 60 * 1000
}

// ── GLOBAL CSS ────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  /* Fonts are loaded in index.html; all design tokens live in the unified
     :root in src/index.css (single source of truth). This block no longer
     redefines them so admin and the parent portal stay in sync. */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body { background: var(--navy); color: var(--text); font-family: var(--font-body); }

  /* Subtle diagonal stripe texture on body */
  body::before {
    content: '';
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 40px,
      rgba(13,27,42,0.02) 40px,
      rgba(13,27,42,0.02) 41px
    );
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(13,27,42,0.18); border-radius: 2px; }

  /* ── Keyframes ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes redPulse {
    0%   { box-shadow: 0 0 0 0 rgba(13,27,42,0.28); }
    70%  { box-shadow: 0 0 0 8px rgba(13,27,42,0);  }
    100% { box-shadow: 0 0 0 0 rgba(13,27,42,0);    }
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
  .nav-item:hover { color: var(--text); background: var(--accent-soft); }
  .nav-item.active {
    color: var(--text);
    background: var(--accent-soft);
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
    background: linear-gradient(90deg, var(--accent), transparent);
    opacity: 0; transition: opacity 0.25s;
  }
  .player-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 24px 64px rgba(13,27,42,0.12), 0 0 0 1px rgba(13,27,42,0.10);
    border-color: var(--border2);
  }
  .player-card:hover::after { opacity: 1; }

  /* ── Add card ── */
  .add-card {
    background: transparent;
    border: 1.5px dashed var(--border2);
    border-radius: 14px; padding: 26px;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    cursor: pointer; min-height: 220px;
    transition: all 0.22s ease;
  }
  .add-card:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .add-card:hover .add-icon { color: var(--accent); transform: rotate(90deg) scale(1.1); }
  .add-icon { color: var(--muted2); transition: all 0.3s ease; }

  /* ── Pack option buttons ── */
  .pack-option {
    display: flex; flex-direction: column; align-items: center;
    padding: 18px 10px; border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--navy4); color: var(--text);
    cursor: pointer; gap: 5px;
    transition: all 0.18s ease;
    position: relative; overflow: hidden;
  }
  .pack-option:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(13,27,42,0.12);
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
  .sessions-bar { height: 3px; border-radius: 2px; background: var(--navy4); overflow: hidden; }
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
    background: var(--navy3);
    color: var(--text); font-family: var(--font-body);
    font-size: 14px; margin-top: 8px;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .torque-input:focus {
    border-color: var(--accent2);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .torque-input::placeholder { color: var(--muted2); }

  /* ── Primary button ── */
  .btn-primary {
    padding: 14px 24px; border-radius: 8px;
    background: var(--ink); color: var(--white);
    border: none; cursor: pointer;
    font-family: var(--font-display); font-weight: 800;
    font-style: italic; font-size: 16px;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: background 0.18s, transform 0.15s, box-shadow 0.18s;
    box-shadow: 0 4px 20px rgba(13,27,42,0.15);
  }
  .btn-primary:hover {
    background: var(--accent2);
    transform: translateY(-1px);
    box-shadow: 0 6px 28px rgba(13,27,42,0.22);
  }
  .btn-primary:active { transform: translateY(0); }

  /* ── Ghost button ── */
  .btn-ghost {
    padding: 8px 16px; border-radius: 6px;
    background: transparent;
    color: var(--text2); border: 1px solid var(--border2);
    cursor: pointer; font-family: var(--font-display);
    font-weight: 700; font-style: italic; font-size: 13px;
    letter-spacing: 0.06em; text-transform: uppercase;
    transition: all 0.18s ease;
  }
  .btn-ghost:hover {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--text);
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
  .cal-day.today { background:var(--accent-soft); }
  .cal-day.other-month { opacity:0.25; }
  .cal-dot { width:5px; height:5px; border-radius:50%; background:var(--green2); margin-top:3px; }

  /* ── Booking slots ── */
  .slot-btn {
    padding:12px 14px; border-radius:8px; border:1px solid var(--border);
    background:var(--navy4); color:var(--text); cursor:pointer;
    font-family:var(--font-display); font-size:13px; font-weight:700;
    text-align:center; transition:all 0.15s;
  }
  .slot-btn:hover { border-color:var(--accent); background:var(--navy5); }
  .slot-btn.selected { border-color:var(--green2); background:rgba(34,197,110,0.1); color:var(--green2); }

  /* ── Section header ── */
  .section-eyebrow { font-family:var(--font-display); font-style:italic; font-weight:700; font-size:12px; color:var(--muted); letter-spacing:0.25em; text-transform:uppercase; margin-bottom:6px; }
  .section-title { font-family:var(--font-title); font-weight:400; text-transform:uppercase; transform:skewX(-8deg); transform-origin:left bottom; display:inline-block; padding:0.06em 0.16em 0.06em 0; font-size:52px; letter-spacing:0.01em; color:var(--text); line-height:1; }
  .section-bar { margin-top:10px; width:40px; height:3px; background:var(--accent); border-radius:2px; margin-bottom:28px; }

  /* ── Responsive layout helpers ── */
  .schedule-layout   { display:grid; grid-template-columns:1.2fr 0.8fr; gap:20px; align-items:start; }
  .sessions-layout   { display:flex; flex-direction:column; gap:16px; }
  .billing-stats     { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
  .events-grid       { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .torque-sidebar-desktop { display: none !important; }
    .torque-topbar { display: flex !important; }
    .torque-main { margin-left: 0 !important; padding: 16px 14px !important; padding-top: calc(72px + env(safe-area-inset-top)) !important; }

    /* Typography */
    .section-title  { font-size: 32px !important; }
    .section-bar    { margin-bottom: 18px !important; }

    /* Grids → stack */
    .players-grid      { grid-template-columns: 1fr !important; }
    .pack-options-grid { grid-template-columns: repeat(2,1fr) !important; }
    .schedule-layout   { grid-template-columns: 1fr !important; }
    .billing-stats     { grid-template-columns: repeat(2,1fr) !important; }
    .events-grid       { grid-template-columns: 1fr !important; }

    /* Calendar cells — tighter gap on small screens */
    .cal-grid { gap: 1px !important; }

    /* Slots (fecha/hora picker) → 3 columnas en móvil */
    .slots-grid-4 { grid-template-columns: repeat(3,1fr) !important; }
    .slots-grid-2 { grid-template-columns: repeat(2,1fr) !important; }

    /* Modal ancho completo */
    .torque-modal-inner { width: calc(100vw - 32px) !important; max-width: 100% !important; margin: 16px !important; }
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
  const { session } = useSession()
  const [page, setPage] = useState('home')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [players, setPlayers] = useState([])
  const [checkinStats, setCheckinStats] = useState({}) // kid_name(lower) -> { monthCount, lastVisit }
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [showBuyPack, setShowBuyPack] = useState(false)
  const [waiverData, setWaiverData]     = useState(null)
  const [waiverForm, setWaiverForm]     = useState({ dob: '', phone: '', signedName: '', agreed: false })
  const [waiverSaving, setWaiverSaving] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [newPlayerData, setNewPlayerData] = useState({ name: '', age: '', birthdate: '' })
  const [onboardingData, setOnboardingData] = useState({ name: '', phone: '', kidName: '', kidAge: '', kidBirthdate: '' })
  const [paymentBanner, setPaymentBanner] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [bookings, setBookings] = useState([])
  const [showBookModal, setShowBookModal] = useState(false)
  const [bookingPlayer, setBookingPlayer] = useState(null)
  const [bookingForm, setBookingForm] = useState({ date: '', time: '' })
  const [bookingLoading, setBookingLoading] = useState(false)
  const [slotCounts, setSlotCounts] = useState({})
  const [cancelModal, setCancelModal] = useState({ open: false, booking: null })
  const [cancelLoading, setCancelLoading] = useState(false)
  const [rescheduleBooking, setRescheduleBooking] = useState(null)
  const [showPromo, setShowPromo] = useState(() => !sessionStorage.getItem('promoDismissed'))

  function dismissPromo() {
    sessionStorage.setItem('promoDismissed', '1')
    setShowPromo(false)
  }

  // Announcement popup: soonest upcoming (not-yet-passed) event, once per session per event.
  const [eventAnnounce, setEventAnnounce] = useState(null)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('events').select('*').gte('date', today).order('date', { ascending: true }).limit(1)
      .then(({ data }) => {
        const ev = data && data[0]
        if (!ev) return
        if (sessionStorage.getItem('torque_event_seen') === String(ev.id)) return
        setEventAnnounce(ev)
      })
  }, [])
  function dismissEventAnnounce() {
    if (eventAnnounce) sessionStorage.setItem('torque_event_seen', String(eventAnnounce.id))
    setEventAnnounce(null)
  }

  useEffect(() => {
    if (!bookingForm.date) return
    fetchSlotCounts(bookingForm.date)
    // Reset time if incompatible with newly selected day
    if (bookingForm.time) {
      const dow = new Date(bookingForm.date + 'T12:00:00').getDay()
      const validTimes = dow === 6 ? SATURDAY_TIMES : WEEKDAY_TIMES
      if (!validTimes.includes(bookingForm.time)) setBookingForm(f => ({ ...f, time: '' }))
    }
  }, [bookingForm.date])

  async function fetchSlotCounts(date) {
    const { data } = await supabase.from('bookings')
      .select('session_time')
      .eq('session_date', date)
      .eq('status', 'confirmed')
    const counts = {}
    ;(data || []).forEach(b => { counts[b.session_time] = (counts[b.session_time] || 0) + 1 })
    setSlotCounts(counts)
  }

  // Real check-in stats for this parent's players: count this month + last visit (motivational).
  useEffect(() => {
    if (!user?.id) return
    const since = new Date(Date.now() - 60 * 86400000).toISOString()
    supabase.from('checkins').select('kid_name, checked_in_at').eq('parent_id', user.id).gte('checked_in_at', since)
      .then(({ data, error }) => {
        if (error) return
        const now = new Date()
        const monthTag = `${now.getFullYear()}-${now.getMonth()}`
        const stats = {}
        for (const c of (data || [])) {
          const k = (c.kid_name || '').toLowerCase().trim()
          if (!stats[k]) stats[k] = { monthCount: 0, lastVisit: null }
          const d = new Date(c.checked_in_at)
          if (`${d.getFullYear()}-${d.getMonth()}` === monthTag) stats[k].monthCount++
          if (!stats[k].lastVisit || d > stats[k].lastVisit) stats[k].lastVisit = d
        }
        setCheckinStats(stats)
      })
  }, [user?.id])

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
      const res = await fetch(`${API_BASE}/api/verify-payment?session_id=${encodeURIComponent(sessionId)}`)
      const data = await res.json()
      console.log('[Torque] verify-payment response:', data)

      if (data.ok) {
        // Poll Supabase directly until expires_at > now, max 10 seconds (5 attempts × 2s)
        const now = new Date()
        let confirmed = false
        for (let attempt = 1; attempt <= 5; attempt++) {
          await new Promise(r => setTimeout(r, 2000))
          const { data: rows } = await supabase
            .from('player_memberships')
            .select('expires_at, sessions_total')
            .eq('parent_id', user.id)
            .gt('expires_at', now.toISOString())
            .gt('sessions_total', 0)
            .limit(1)
          console.log(`[Torque] membership poll attempt ${attempt}:`, rows)
          if (rows && rows.length > 0) {
            confirmed = true
            break
          }
        }
        if (!confirmed) {
          console.warn('[Torque] expires_at not updated after 10s — forcing refresh anyway')
        }
        await fetchTorqueData()
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
  // Cada query tiene timeout de 8s para que nunca cuelgue la UI
  async function quietRefresh() {
    const withTimeout = (promise, ms = 8000) =>
      Promise.race([promise, new Promise(res => setTimeout(() => res({ data: null }), ms))])

    try {
      const { data: prof } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      )
      const cacheKey = `torque_profile_${user.id}`
      const effectiveProfile = prof || (() => { try { return JSON.parse(localStorage.getItem(cacheKey) || 'null') } catch { return null } })()
      if (!effectiveProfile) return
      if (prof) localStorage.setItem(cacheKey, JSON.stringify(prof))

      const [kidsRes, membershipsRes, bksRes] = await Promise.all([
        withTimeout(supabase.from('players').select('*').eq('parent_id', user.id)),
        withTimeout(supabase.from('player_memberships').select('*').eq('parent_id', user.id)),
        withTimeout(supabase.from('bookings').select('*').eq('parent_id', user.id).order('session_date', { ascending: true })),
      ])

      const kids = kidsRes.data
      const allMemberships = (membershipsRes.data || []).filter(m => m.status?.toLowerCase() === 'active')
      const bks = bksRes.data

      const playersKey = `torque_players_${user.id}`
      const effectiveKids = (kids && kids.length > 0) ? kids : (() => { try { return JSON.parse(localStorage.getItem(playersKey) || '[]') } catch { return [] } })()
      if (kids && kids.length > 0) localStorage.setItem(playersKey, JSON.stringify(kids))

      setPlayers((effectiveKids || []).map(kid => ({
        ...kid,
        active_membership: (allMemberships || []).find(
          m => m.kid_name?.toLowerCase().trim() === kid.kid_name?.toLowerCase().trim()
        ) || null
      })))

      if (bks) setBookings(bks)
    } catch(err) {
      console.error('[Torque] quietRefresh error:', err)
    }
  }

  async function handleBookSession() {
    if (!bookingPlayer || !bookingForm.date || !bookingForm.time) return
    // Salvaguarda: bloquear feriados (4 de julio) aunque la fecha llegue por otra vía
    if (isBlockedHoliday(new Date(bookingForm.date + 'T12:00:00'))) {
      alert('July 4th is a holiday — bookings are closed that day. Please choose another date.')
      return
    }
    setBookingLoading(true)
    try {
      // 0. Capacity check
      const { count: slotCount } = await supabase.from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('session_date', bookingForm.date)
        .eq('session_time', bookingForm.time)
        .eq('status', 'confirmed')
      if ((slotCount || 0) >= MAX_CAPACITY) {
        alert('This session is full (maximum 16 players). Please choose another time.')
        setBookingLoading(false)
        return
      }

      const newBookingRow = {
        parent_id:    user.id,
        kid_name:     bookingPlayer.kid_name,
        membership_id: bookingPlayer.active_membership?.id && bookingPlayer.active_membership.id !== 'local'
                        ? bookingPlayer.active_membership.id : null,
        session_date: bookingForm.date,
        session_time: bookingForm.time,
        status:       'confirmed'
      }

      if (rescheduleBooking) {
        // REAGENDAR: eliminar booking anterior, crear uno nuevo, no cambiar sessions_used
        const { error: delErr } = await supabase.from('bookings').delete().eq('id', rescheduleBooking.id)
        if (delErr) {
          alert('Error removing the previous session: ' + delErr.message)
          return
        }
        const { error: insErr } = await supabase.from('bookings').insert([newBookingRow])
        if (insErr) {
          alert('Error rescheduling: ' + insErr.message)
          return
        }
        const optimistic = { id: 'local_' + Date.now(), ...newBookingRow }
        setBookings(prev => [...prev.filter(b => b.id !== rescheduleBooking.id), optimistic])
        setRescheduleBooking(null)
      } else {
        // NUEVA RESERVA: insertar + descontar sesión
        const { error: bookErr } = await supabase.from('bookings').insert([newBookingRow])
        if (bookErr) {
          console.error('[Torque] booking insert error:', bookErr)
          alert('Error booking session: ' + (bookErr.message || JSON.stringify(bookErr)))
          return
        }

        const m = bookingPlayer.active_membership
        const newUsed = (m?.sessions_used || 0) + 1
        await supabase.from('player_memberships')
          .update({ sessions_used: newUsed })
          .eq('parent_id', user.id)
          .eq('kid_name', bookingPlayer.kid_name)
          .eq('status', 'active')

        const optimistic = { id: 'local_' + Date.now(), ...newBookingRow }
        setBookings(prev => [...prev, optimistic])
        setPlayers(prev => prev.map(p =>
          p.kid_name !== bookingPlayer.kid_name ? p
            : { ...p, active_membership: p.active_membership
                  ? { ...p.active_membership, sessions_used: newUsed }
                  : null }
        ))
      }

      setShowBookModal(false)
      setBookingForm({ date: '', time: '' })
      quietRefresh()
    } catch(err) {
      console.error('[Torque] handleBookSession unexpected error:', err)
      alert('Unexpected error. Please check the console.')
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

        const { data: rawMemberships } = await supabase
          .from('player_memberships').select('*')
          .eq('parent_id', user.id)
        const allMemberships = (rawMemberships || []).filter(m => m.status?.toLowerCase() === 'active')

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

  const BILLING_LABELS = {
    stand: 'Month-to-Month',
    m6: '6-Month',
    m12: '12-Month',
    annual: 'Annual (Lump Sum)',
  }

  const openWaiver = (pack, billingType, stripeUrl, priceId, price) => {
    if (!selectedPlayer) return
    setWaiverForm({ dob: '', phone: '', signedName: '', agreed: false })
    setWaiverData({ pack, billingType, billingLabel: BILLING_LABELS[billingType], stripeUrl, priceId, price })
  }

  const handleWaiverSubmit = async () => {
    if (!waiverData || !waiverForm.signedName.trim() || !waiverForm.agreed) return
    setWaiverSaving(true)
    try {
      const { error } = await supabase.from('waivers').insert({
        parent_id:        user.id,
        kid_name:         selectedPlayer.kid_name,
        parent_name:      user.fullName,
        participant_dob:  waiverForm.dob,
        phone:            waiverForm.phone,
        email:            user.primaryEmailAddress?.emailAddress,
        package_name:     waiverData.pack.name,
        billing_type:     waiverData.billingType,
        signed_name:      waiverForm.signedName.trim(),
        contract_version: waiverData.billingLabel,
        agreed_at:        new Date().toISOString(),
      })
      if (error) throw error
      setWaiverData(null)

      // Sibling discount: parent has ≥1 other child with an active membership right now.
      const isSibling = players.some(
        p => p.kid_name !== selectedPlayer.kid_name && p.active_membership
      )

      const checkoutRes = await fetch(`${API_BASE}/api/create-checkout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          userId:      user.id,
          kidName:     selectedPlayer.kid_name,
          priceId:     waiverData.priceId,
          billingType: waiverData.billingType,
          sibling:     isSibling,
        }),
      })
      const checkoutData = await checkoutRes.json()
      if (!checkoutRes.ok) throw new Error(checkoutData.error || 'Checkout session failed')
      window.location.href = checkoutData.url
    } catch (err) {
      console.error('[Waiver] Submit failed:', err)
      alert('Error saving waiver: ' + (err.message || JSON.stringify(err)))
    } finally {
      setWaiverSaving(false)
    }
  }

  async function handleEditPlayerName(player, newName) {
    const trimmed = newName.trim()
    if (!trimmed) return
    const originalName = player.kid_name

    // Use parent_id + original kid_name as identifiers — player.id may be 'local' from localStorage
    const { error } = await supabase
      .from('players')
      .update({ kid_name: trimmed })
      .eq('parent_id', user.id)
      .eq('kid_name', originalName)

    if (error) {
      console.error('[Torque] Edit player name error:', error)
      return
    }

    // Keep player_memberships in sync so the membership match doesn't break
    await supabase
      .from('player_memberships')
      .update({ kid_name: trimmed })
      .eq('parent_id', user.id)
      .eq('kid_name', originalName)

    // Update local state
    setPlayers(prev => prev.map(p =>
      p.kid_name === originalName
        ? { ...p, kid_name: trimmed, active_membership: p.active_membership ? { ...p.active_membership, kid_name: trimmed } : null }
        : p
    ))

    // Update localStorage cache
    try {
      const key = `torque_players_${user.id}`
      const cached = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify(cached.map(p => p.kid_name === originalName ? { ...p, kid_name: trimmed } : p)))
    } catch {}
  }

  async function handleCancelSession() {
    const booking = cancelModal.booking
    if (!booking) return
    setCancelLoading(true)
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', booking.id)
      if (error) throw error

      const player = players.find(p => p.kid_name?.toLowerCase() === booking.kid_name?.toLowerCase())
      if (player?.active_membership) {
        const newUsed = Math.max(0, (player.active_membership.sessions_used || 0) - 1)
        await supabase.from('player_memberships')
          .update({ sessions_used: newUsed })
          .eq('id', player.active_membership.id)
      }

      setBookings(prev => prev.filter(b => b.id !== booking.id))
      setPlayers(prev => prev.map(p => {
        if (p.kid_name?.toLowerCase() !== booking.kid_name?.toLowerCase() || !p.active_membership) return p
        return { ...p, active_membership: { ...p.active_membership, sessions_used: Math.max(0, (p.active_membership.sessions_used || 0) - 1) } }
      }))
      setCancelModal({ open: false, booking: null })
      quietRefresh()
    } catch(err) {
      alert('Error canceling: ' + (err.message || JSON.stringify(err)))
    } finally {
      setCancelLoading(false)
    }
  }

  function openReschedule(booking) {
    const player = players.find(p => p.kid_name?.toLowerCase() === booking.kid_name?.toLowerCase())
    if (!player) return
    setRescheduleBooking(booking)
    setBookingPlayer(player)
    setBookingForm({ date: '', time: '' })
    setSlotCounts({})
    setShowBookModal(true)
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
      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:'clamp(36px, 10vw, 56px)', letterSpacing:'0.1em', color:'var(--text)' }}>
        TORQUE
      </div>
      <div style={{ width:48, height:3, background:'var(--navy4)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:'45%', background:'rgba(13,27,42,0.6)', borderRadius:2, animation:'slideRight 0.8s ease infinite alternate' }} />
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
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:'clamp(36px, 12vw, 60px)', letterSpacing:'0.1em', lineHeight:1 }}>
            TORQUE
          </div>
          <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.3em', marginTop:6, textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic' }}>Performance Training</div>
        </div>

        <div style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:'clamp(20px, 5vw, 36px)', position:'relative', overflow:'hidden' }}>
          {/* Top accent */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg, rgba(13,27,42,0.35), transparent)' }} />

          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:22, letterSpacing:'0.08em', color:'var(--text)', marginBottom:24, textTransform:'uppercase' }}>
            New Account Setup
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault()
            setLoading(true)
            try {
              const sb = await getAuthClient(session)

              const profileData = {
                id: user.id,
                full_name: onboardingData.name.trim() || user.fullName || '',
                email: user.primaryEmailAddress?.emailAddress,
                phone: onboardingData.phone,
                role: 'parent'
              }
              const playerInsert = {
                parent_id: user.id,
                kid_name: onboardingData.kidName,
                age: parseInt(onboardingData.kidAge),
                birthdate: onboardingData.kidBirthdate
              }

              const { error: profileErr } = await sb.from('profiles').insert([profileData])
              if (profileErr) {
                console.error('[Torque] onboarding — profiles insert failed:', profileErr)
                alert(`Registration failed (profiles): ${profileErr.message}\n\nCode: ${profileErr.code}`)
                setLoading(false)
                return
              }

              const { error: playerErr } = await sb.from('players').insert([playerInsert])
              if (playerErr) {
                console.error('[Torque] onboarding — players insert failed:', playerErr)
                alert(`Registration failed (players): ${playerErr.message}\n\nCode: ${playerErr.code}`)
                setLoading(false)
                return
              }

              // Cache local so the portal loads instantly on next visit
              localStorage.setItem(`torque_profile_${user.id}`, JSON.stringify(profileData))
              localStorage.setItem(`torque_players_${user.id}`, JSON.stringify([{ ...playerInsert, id: 'local' }]))
            } catch (err) {
              console.error('[Torque] onboarding error:', err)
              alert(`Unexpected error: ${err.message}`)
              setLoading(false)
              return
            }
            await fetchTorqueData()
          }} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <Label>Parent Full Name</Label>
              <input className="torque-input" required placeholder="First Last" onChange={e => setOnboardingData({...onboardingData, name: e.target.value})} />
            </div>
            <div>
              <Label>Parent Phone</Label>
              <input className="torque-input" required placeholder="(555) 000-0000" onChange={e => setOnboardingData({...onboardingData, phone: e.target.value})} />
            </div>
            <div>
              <Label>First Player Name</Label>
              <input className="torque-input" required onChange={e => setOnboardingData({...onboardingData, kidName: e.target.value})} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:12 }}>
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
    home:     <ParentHome players={players} onAdd={() => setShowAddPlayer(true)} onBuy={(p) => { setSelectedPlayer(p); setShowBuyPack(true) }} onEditSave={handleEditPlayerName} parentId={user?.id} checkinStats={checkinStats} onBook={(p) => { setBookingPlayer(p); setBookingForm({ date:'', time:'' }); setSlotCounts({}); setShowBookModal(true) }} />,
    sessions: <SessionsPage players={players} bookings={bookings} onBook={(p) => { setBookingPlayer(p); setBookingForm({ date:'', time:'' }); setSlotCounts({}); setShowBookModal(true) }} onCancel={(b) => setCancelModal({ open: true, booking: b })} onReschedule={openReschedule} />,
    schedule: <SchedulePage bookings={bookings} onCancel={(b) => setCancelModal({ open: true, booking: b })} onReschedule={openReschedule} />,
    billing:  <BillingPage players={players} />,
    events:   <EventsPage user={user} players={players} parentDisplayName={profile?.full_name || user?.fullName || ''} />,
  }

  // ── SIDEBAR CONTENT ──
  const SidebarContent = () => (
    <>
      {/* Logo area */}
      <div style={{ padding:'28px 22px 0', position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:30, letterSpacing:'0.1em', lineHeight:1 }}>
            TOR<span style={{ color:'var(--white)' }}>QUE</span>
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
            <span style={{ width:5, height:5, borderRadius:'50%', flexShrink:0, transition:'all 0.2s', background: page === id ? 'var(--white)' : 'transparent', border: page === id ? 'none' : '1px solid var(--muted2)' }} />
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

      {/* ── SUMMER PROMO MODAL ── */}
      {showPromo && (
        <div onClick={dismissPromo} style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(0,0,0,0.72)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
        }}>
          <div data-theme="dark" onClick={e => e.stopPropagation()} style={{
            background:'linear-gradient(145deg, #0E1A2E 0%, #152440 100%)',
            border:'1px solid rgba(255,255,255,0.12)',
            borderRadius:20, padding:'36px 32px 32px',
            maxWidth:440, width:'100%', position:'relative',
            boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
          }}>
            {/* Close */}
            <button onClick={dismissPromo} style={{
              position:'absolute', top:16, right:16,
              background:'rgba(255,255,255,0.07)', border:'none', borderRadius:8,
              width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', color:'rgba(255,255,255,0.5)',
            }}>
              <X size={16} />
            </button>

            {/* Badge */}
            <div style={{
              display:'inline-flex', alignItems:'center', gap:6,
              background:'rgba(34,197,110,0.12)', border:'1px solid rgba(34,197,110,0.3)',
              borderRadius:20, padding:'4px 12px', marginBottom:16,
              fontSize:11, fontFamily:'var(--font-display)', fontWeight:700,
              letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--green2)',
            }}>
              Limited Time
            </div>

            {/* Title */}
            <div style={{
              fontFamily:'var(--font-display)', fontWeight:900, lineHeight:1.05,
              fontSize:'clamp(28px,6vw,38px)', color:'var(--white)',
              letterSpacing:'0.03em', textTransform:'uppercase', marginBottom:12,
            }}>
              ⚾ Summer Special
            </div>

            {/* Body */}
            <p style={{ fontSize:15, color:'rgba(255,255,255,0.7)', lineHeight:1.6, marginBottom:20 }}>
              Get the <strong style={{ color:'var(--white)' }}>MLB Package</strong> — 20 sessions/month — for just{' '}
              <strong style={{ color:'var(--green2)' }}>$400/month</strong>.
              Save $200 every month this summer!
            </p>

            {/* Promo code chip */}
            <div style={{
              background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:10, padding:'10px 16px', marginBottom:24,
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.45)', fontFamily:'var(--font-display)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Promo code</span>
              <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:15, color:'var(--green2)', letterSpacing:'0.1em' }}>MLBSUMMER</span>
            </div>

            {/* CTA — routes through in-app package selection so client_reference_id is attached */}
            <button
              onClick={() => {
                dismissPromo()
                setSelectedPlayer(players[0] ?? null)
                setShowBuyPack(true)
              }}
              style={{
                display:'block', width:'100%', padding:'15px 0',
                background:'var(--white)', color:'var(--navy)',
                borderRadius:12, border:'none', textDecoration:'none',
                fontFamily:'var(--font-display)', fontWeight:900, fontSize:17,
                letterSpacing:'0.06em', textTransform:'uppercase', textAlign:'center',
                cursor:'pointer', marginBottom:12,
              }}
            >
              Get the Deal →
            </button>

            <button onClick={dismissPromo} style={{
              display:'block', width:'100%', padding:'10px 0',
              background:'transparent', border:'none', cursor:'pointer',
              color:'rgba(255,255,255,0.3)', fontSize:12,
              fontFamily:'var(--font-body)',
            }}>
              No thanks, maybe later
            </button>
          </div>
        </div>
      )}

      {/* ── EVENT ANNOUNCEMENT POPUP (soonest upcoming event, once per session) ── */}
      {eventAnnounce && !showPromo && (
        <div onClick={dismissEventAnnounce} style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(13,27,42,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'var(--navy2)', border:'1px solid var(--border2)', borderRadius:20, padding:'32px 28px', maxWidth:420, width:'100%', position:'relative', boxShadow:'0 24px 80px rgba(13,27,42,0.25)' }}>
            <button onClick={dismissEventAnnounce} style={{ position:'absolute', top:14, right:14, background:'var(--accent-soft)', border:'none', borderRadius:8, width:30, height:30, cursor:'pointer', color:'var(--muted)', fontSize:16 }}>✕</button>
            <div style={{ fontSize:44, lineHeight:1, marginBottom:12 }}>{eventAnnounce.image || '📣'}</div>
            <div style={{ fontSize:11, fontFamily:'var(--font-display)', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'#06D6A0', marginBottom:6 }}>Upcoming Event</div>
            <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:26, lineHeight:1.15, color:'var(--text)', marginBottom:8 }}>{eventAnnounce.title}</div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:14, color:'var(--accent)', marginBottom:4 }}>{eventAnnounce.date}{eventAnnounce.time ? ` · ${eventAnnounce.time}` : ''}</div>
            {eventAnnounce.location && <div style={{ fontSize:13, color:'var(--muted)', marginBottom:12 }}>📍 {eventAnnounce.location}</div>}
            {eventAnnounce.description && <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6, marginBottom:20 }}>{eventAnnounce.description}</p>}
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button onClick={() => { dismissEventAnnounce(); setPage('events') }} className="btn-primary" style={{ flex:1 }}>Join In →</button>
              <button onClick={dismissEventAnnounce} className="btn-ghost" style={{ padding:'0 18px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', minHeight:'100vh', position:'relative', zIndex:1 }}>

        {/* Sidebar Desktop */}
        <aside data-theme="dark" className="torque-sidebar-desktop" style={sidebarStyle}>
          <SidebarContent />
        </aside>

        {/* Topbar Mobile */}
        <div className="torque-topbar" style={{
          position:'fixed', top:0, left:0, right:0,
          height:'calc(60px + env(safe-area-inset-top))',
          background:'rgba(11,20,35,0.97)', backdropFilter:'blur(12px)',
          borderBottom:'1px solid rgba(255,255,255,0.1)',
          alignItems:'flex-end', justifyContent:'space-between',
          padding:'0 20px 12px', paddingTop:'env(safe-area-inset-top)',
          zIndex:200, display:'none'
        }}>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:26, letterSpacing:'0.1em', lineHeight:1 }}>
            TOR<span style={{ color:'var(--white)' }}>QUE</span>
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
        <aside data-theme="dark" className="torque-sidebar-mobile" style={{
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
                  <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:14, color:'var(--green2)', letterSpacing:'0.06em', textTransform:'uppercase' }}>Payment received</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:1 }}>Loading your sessions... If they don't appear in a few seconds, press the button.</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <button onClick={manualRefresh} disabled={refreshing} className="btn-ghost" style={{ fontSize:12 }}>
                  {refreshing ? 'Searching...' : '↺ Refresh sessions'}
                </button>
                <button onClick={() => setPaymentBanner(false)} style={{ background:'none', border:'none', color:'var(--muted2)', cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 4px' }}>✕</button>
              </div>
            </div>
          )}

          {/* Expired membership banner */}
          {players.some(p => {
            const m = p.active_membership
            if (!m) return false
            const expired = m.expires_at && new Date(m.expires_at) < new Date()
            const noSessions = (m.sessions_total || 0) === 0
            return expired || noSessions
          }) && (
            <div style={{ marginBottom:24, padding:'16px 20px', borderRadius:10, background:'rgba(255,68,102,0.07)', border:'1px solid rgba(255,68,102,0.25)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ fontSize:22, flexShrink:0 }}>⚠️</div>
                <div>
                  <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:14, color:'#ff4466', letterSpacing:'0.06em', textTransform:'uppercase' }}>Your membership has expired</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>Renew your plan to continue accessing your sessions.</div>
                </div>
              </div>
              <button onClick={() => {
                  const expired = players.find(p => {
                    const m = p.active_membership
                    if (!m) return false
                    return (m.expires_at && new Date(m.expires_at) < new Date()) || (m.sessions_total || 0) === 0
                  })
                  setSelectedPlayer(expired || players[0])
                  setShowBuyPack(true)
                }} className="btn-primary" style={{ fontSize:12, padding:'8px 18px', flexShrink:0 }}>
                Renew Plan
              </button>
            </div>
          )}

          {PAGE_MAP[page]}
        </main>
      </div>

      {/* ── MODAL: BUY PACK ── */}
      <Modal open={showBuyPack} onClose={() => setShowBuyPack(false)} title={`Training Plans · ${selectedPlayer?.kid_name}`} width={800}>
        {/* Discount strip */}
        <div style={{ marginBottom:22, padding:'12px 18px', background:'rgba(13,27,42,0.04)', borderRadius:8, border:'1px solid rgba(13,27,42,0.1)', display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:13, color:'rgba(13,27,42,0.75)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Membership Discounts</div>
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
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'rgba(13,27,42,0.25)' }} />

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, paddingLeft:8 }}>
                  <div>
                    <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:'clamp(18px, 4vw, 28px)', letterSpacing:'0.06em', color:'var(--text)', lineHeight:1 }}>{pack.name}</div>
                    <div style={{ fontSize:12, color:'rgba(13,27,42,0.55)', fontWeight:600, marginTop:3, letterSpacing:'0.05em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic' }}>{pack.tag}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:2, fontFamily:'var(--font-mono)' }}>{pack.sessions} sessions / month</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:'clamp(22px, 5vw, 36px)', color:'var(--text)', letterSpacing:'0.02em', lineHeight:1 }}>${pack.price}</div>
                    <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.2em', textTransform:'uppercase', marginTop:2 }}>base / month</div>
                  </div>
                </div>

                {/* ── CAMBIO 2 y 3: botones ahora pasan pack.prices.X como segundo argumento ── */}
                <div className="pack-options-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, paddingLeft:8 }}>
                  <button onClick={() => openWaiver(pack, 'stand', pack.links.stand, pack.prices.stand, pack.price)} className="pack-option">
                    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', color:'var(--muted)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>STANDARD</span>
                    <span style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22 }}>${pack.price}</span>
                    <span style={{ fontSize:9, color:'var(--muted2)', fontFamily:'var(--font-mono)' }}>no commit</span>
                  </button>
                  <button onClick={() => openWaiver(pack, 'm6', pack.links.m6, pack.prices.m6, p6)} className="pack-option">
                    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', color:'rgba(13,27,42,0.6)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>6 MONTHS</span>
                    <span style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22 }}>${p6}</span>
                    <span style={{ fontSize:9, color:'rgba(13,27,42,0.5)', fontFamily:'var(--font-mono)' }}>–10% /mo</span>
                  </button>
                  <button onClick={() => openWaiver(pack, 'm12', pack.links.m12, pack.prices.m12, p12)} className="pack-option">
                    <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', color:'rgba(13,27,42,0.6)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>12 MONTHS</span>
                    <span style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22 }}>${p12}</span>
                    <span style={{ fontSize:9, color:'rgba(13,27,42,0.5)', fontFamily:'var(--font-mono)' }}>–15% /mo</span>
                  </button>
                  <button onClick={() => openWaiver(pack, 'annual', pack.links.annual, pack.prices.annual, pAn)} className="pack-option annual">
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

      {/* ── MODAL: WAIVER / CONTRACT ── */}
      <Modal open={!!waiverData} onClose={() => !waiverSaving && setWaiverData(null)} title="Training Agreement & Waiver" width={680}>
        {waiverData && (
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

            {/* Pre-filled info strip */}
            <div style={{ padding:'12px 16px', background:'rgba(13,27,42,0.04)', borderRadius:8, border:'1px solid rgba(13,27,42,0.08)', marginBottom:20, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'8px 16px', fontSize:12 }}>
              <div><span style={{ color:'var(--muted)' }}>Participant: </span><span style={{ fontWeight:600 }}>{selectedPlayer?.kid_name}</span></div>
              <div><span style={{ color:'var(--muted)' }}>Package: </span><span style={{ fontWeight:600 }}>{waiverData.pack.name}</span></div>
              <div><span style={{ color:'var(--muted)' }}>Parent/Guardian: </span><span style={{ fontWeight:600 }}>{user?.fullName}</span></div>
              <div><span style={{ color:'var(--muted)' }}>Billing: </span><span style={{ fontWeight:600 }}>{waiverData.billingLabel}</span></div>
              <div><span style={{ color:'var(--muted)' }}>Email: </span><span style={{ fontWeight:600 }}>{user?.primaryEmailAddress?.emailAddress}</span></div>
              <div><span style={{ color:'var(--muted)' }}>Date: </span><span style={{ fontWeight:600 }}>{new Date().toLocaleDateString('en-US')}</span></div>
            </div>

            {/* Contract text scroll box */}
            <div style={{ maxHeight:280, overflowY:'auto', padding:'16px', background:'rgba(0,0,0,0.3)', borderRadius:8, border:'1px solid var(--border)', fontSize:11.5, lineHeight:1.7, color:'var(--text2)', marginBottom:20 }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:13, color:'var(--text)', marginBottom:12, textAlign:'center' }}>
                TORQUE PERFORMANCE LLC — TRAINING SERVICES CONTRACT<br/>
                <span style={{ fontSize:11, fontWeight:400, color:'var(--muted)' }}>({waiverData.billingLabel} Agreement)</span>
              </div>

              <p>This Training Services Contract ("Agreement") is entered into by and between Torque Performance LLC ("Torque") and the undersigned parent/guardian or adult participant ("Client").</p>

              {waiverData.billingType === 'stand' && (
                <p><b>TERM:</b> This Agreement is effective upon signing and continues on a month-to-month basis until terminated. Client must provide written notice at least 30 days in advance to cancel. One additional billing cycle will be charged after notice is received.</p>
              )}
              {waiverData.billingType === 'm6' && (
                <p><b>TERM:</b> This Agreement is for a six (6) month commitment, billed monthly. Early cancellation requires written notice at least 30 days in advance AND payment of one (1) additional monthly billing cycle following notice. No refunds for services rendered or unused sessions.</p>
              )}
              {waiverData.billingType === 'm12' && (
                <p><b>TERM:</b> This Agreement is for a twelve (12) month commitment, billed monthly. Early termination requires payment of the remaining balance OR a two (2) month cancellation fee, whichever is less. No refunds for services rendered or unused sessions.</p>
              )}
              {waiverData.billingType === 'annual' && (
                <p><b>TERM:</b> This Agreement is for a twelve (12) month term, paid in full at enrollment. All payments are NON-REFUNDABLE under any circumstances. No prorated refunds, credits, or partial reimbursements will be issued for any reason.</p>
              )}

              <p><b>PAYMENT:</b> All fees are due in advance. Sessions must be used within the billing period and do not roll over. Missed sessions are forfeited and non-refundable. Rescheduling requires a minimum of 12-hour notice.</p>
              <p><b>CHARGEBACK PROTECTION:</b> Client agrees not to dispute or initiate chargebacks for valid charges. Any chargeback will result in immediate termination of services and Client agrees to reimburse Torque for all associated fees.</p>
              <p><b>ASSUMPTION OF RISK:</b> Client acknowledges that participation involves inherent risks including being struck by baseballs, bats, or training equipment; use of pitching machines, weights, and training devices; physical exertion, collisions, and facility-related hazards. Client voluntarily assumes all risks, whether known or unknown.</p>
              <p><b>RELEASE OF LIABILITY:</b> To the fullest extent permitted by Texas law, Client releases and holds harmless Torque Performance LLC, its owners, members, managers, employees, coaches, and affiliates from any and all claims arising from negligence related to participation or use of facilities.</p>
              <p><b>INDEMNIFICATION:</b> Client agrees to indemnify and hold harmless Torque from any claims, damages, liabilities, or expenses (including attorney fees) arising out of participation or breach of this Agreement.</p>
              <p><b>MINOR RESPONSIBILITY:</b> If the participant is a minor, the parent/guardian assumes full responsibility for the minor's participation, behavior, and any injuries or damages caused.</p>
              <p><b>MEDICAL AUTHORIZATION:</b> Client certifies participant is physically capable of participation and authorizes emergency medical treatment if necessary. Client accepts full financial responsibility for all medical expenses. Torque does not provide medical insurance.</p>
              <p><b>MEDIA RELEASE:</b> Client grants permission for Torque to use photographs and/or video for marketing and promotional purposes without compensation.</p>
              <p><b>NON-TRANSFERABILITY:</b> Memberships are non-transferable and may not be shared or used by any other individual.</p>
              <p><b>GOVERNING LAW:</b> This Agreement shall be governed by the laws of the State of Texas.</p>
            </div>

            {/* Fields the parent fills in */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:16 }}>
              <div>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:600, display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Participant Date of Birth</label>
                <input type="date" value={waiverForm.dob} onChange={e => setWaiverForm(f => ({ ...f, dob: e.target.value }))}
                  style={{ width:'100%', margin:0 }} />
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:600, display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Phone Number</label>
                <input type="tel" value={waiverForm.phone} onChange={e => setWaiverForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(915) 000-0000" style={{ width:'100%', margin:0 }} />
              </div>
            </div>

            {/* Signature */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:'var(--muted)', fontWeight:600, display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Electronic Signature — Type your full name</label>
              <input value={waiverForm.signedName} onChange={e => setWaiverForm(f => ({ ...f, signedName: e.target.value }))}
                placeholder="Full legal name" style={{ width:'100%', margin:0, fontFamily:'cursive', fontSize:16 }} />
            </div>

            {/* Agree checkbox */}
            <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', marginBottom:20, fontSize:12, color:'var(--text2)', lineHeight:1.5 }}>
              <input type="checkbox" checked={waiverForm.agreed} onChange={e => setWaiverForm(f => ({ ...f, agreed: e.target.checked }))}
                style={{ marginTop:2, flexShrink:0, width:16, height:16 }} />
              I have read and fully understand this Agreement and Waiver. I voluntarily agree to all terms and acknowledge I am giving up substantial legal rights by signing.
            </label>

            {/* Submit */}
            <button
              onClick={handleWaiverSubmit}
              disabled={waiverSaving || !waiverForm.signedName.trim() || !waiverForm.agreed}
              style={{ width:'100%', padding:'14px', background:(!waiverForm.signedName.trim() || !waiverForm.agreed) ? 'rgba(13,27,42,0.1)' : '#4fa8ff', border:'none', borderRadius:10, color:'var(--text)', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:16, letterSpacing:'0.05em', cursor:(!waiverForm.signedName.trim() || !waiverForm.agreed) ? 'not-allowed' : 'pointer', transition:'background 0.2s' }}>
              {waiverSaving ? 'Saving…' : '✦ Sign & Proceed to Payment'}
            </button>

          </div>
        )}
      </Modal>

      {/* ── MODAL: ADD PLAYER ── */}
      <Modal open={showAddPlayer} onClose={() => setShowAddPlayer(false)} title="Register New Player">
        <form onSubmit={handleAddPlayer} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <Label>Player Name</Label>
            <input className="torque-input" required value={newPlayerData.name} onChange={e => setNewPlayerData({...newPlayerData, name: e.target.value})} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:12 }}>
            <input className="torque-input" required type="number" placeholder="Age" style={{ marginTop:0 }} onChange={e => setNewPlayerData({...newPlayerData, age: e.target.value})} />
            <input className="torque-input" required type="date" style={{ marginTop:0 }} onChange={e => setNewPlayerData({...newPlayerData, birthdate: e.target.value})} />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop:8 }}>Register Player</button>
        </form>
      </Modal>

      {/* ── MODAL: BOOK / RESCHEDULE SESSION ── */}
      <Modal open={showBookModal} onClose={() => { setShowBookModal(false); setRescheduleBooking(null) }} title={rescheduleBooking ? `Reschedule Session · ${bookingPlayer?.kid_name}` : `Book Session · ${bookingPlayer?.kid_name}`} width={520}>
        {bookingPlayer && (() => {
          const m = bookingPlayer.active_membership
          const remaining = m ? m.sessions_total - m.sessions_used : 0
          const membershipExpired = m?.expires_at && new Date(m.expires_at) < new Date()
          // Available days: Mon=1, Wed=3, Fri=5, Sat=6
          // Mon–Fri (1–5) + Sat (6); Sun (0) closed
          const AVAILABLE_DAYS = [1, 2, 3, 4, 5, 6]
          // Times depend on day of week
          const selectedDow = bookingForm.date ? new Date(bookingForm.date + 'T12:00:00').getDay() : null
          const TIMES = selectedDow === 6 ? SATURDAY_TIMES : WEEKDAY_TIMES
          // Build next 30 days that match available days
          const availableDates = []
          const today = new Date(); today.setHours(0,0,0,0)
          for (let i = 0; availableDates.length < 30; i++) {
            const d = new Date(today); d.setDate(today.getDate() + i)
            if (AVAILABLE_DAYS.includes(d.getDay()) && !isBlockedHoliday(d)) {
              const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
              availableDates.push(iso)
            }
          }
          const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
          const fmt = (iso) => { const d = new Date(iso+'T12:00:00'); return `${DAY_NAMES[d.getDay()]} ${d.getDate()}` }
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              {(remaining <= 0 || membershipExpired) ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--muted)' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>⚠️</div>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16 }}>
                    {membershipExpired ? 'Membership expired' : 'No sessions available'}
                  </div>
                  <div style={{ fontSize:13, marginTop:6 }}>
                    {membershipExpired ? 'Your membership has expired. Renew your plan to book sessions.' : 'Purchase a plan to book sessions.'}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ padding:'10px 16px', background:'rgba(34,197,110,0.07)', border:'1px solid rgba(34,197,110,0.2)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13, color:'var(--muted)' }}>Available sessions</span>
                    <span style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:22, color:'var(--green2)' }}>{remaining}</span>
                  </div>
                  <div>
                    <Label>Date</Label>
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
                    <Label>Time Slot {!bookingForm.date && <span style={{ fontWeight:400, color:'var(--muted)', fontSize:11 }}>(select a date first)</span>}</Label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginTop:8 }}>
                      {TIMES.map(t => {
                        const count = slotCounts[t] || 0
                        const isFull = count >= MAX_CAPACITY
                        return (
                          <button key={t}
                            onClick={() => !isFull && setBookingForm(f => ({...f, time:t}))}
                            disabled={isFull}
                            className={`slot-btn${bookingForm.time === t ? ' selected' : ''}`}
                            style={isFull ? { opacity:0.5, cursor:'not-allowed', position:'relative' } : {}}>
                            {t}
                            {isFull && <div style={{ fontSize:9, color:'#ff5555', fontWeight:700, letterSpacing:'0.05em' }}>FULL</div>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <button onClick={handleBookSession} disabled={!bookingForm.date || !bookingForm.time || bookingLoading}
                    className="btn-primary" style={{ marginTop:4 }}>
                    {bookingLoading ? (rescheduleBooking ? 'Rescheduling...' : 'Booking...') : rescheduleBooking ? 'Confirm Reschedule' : 'Confirm Session'}
                  </button>
                </>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* ── MODAL: CANCEL SESSION ── */}
      <Modal open={cancelModal.open} onClose={() => !cancelLoading && setCancelModal({ open: false, booking: null })} title="Cancel Session" width={420}>
        {cancelModal.booking && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ padding:'16px 18px', background:'rgba(255,68,102,0.07)', border:'1px solid rgba(255,68,102,0.25)', borderRadius:10 }}>
              <div style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>Session to cancel:</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:14, color:'var(--text)', fontWeight:600 }}>
                {new Date(cancelModal.booking.session_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} · {cancelModal.booking.session_time}
              </div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{cancelModal.booking.kid_name}</div>
            </div>
            <div style={{ fontSize:13, color:'var(--muted)', padding:'10px 14px', background:'rgba(34,197,110,0.06)', border:'1px solid rgba(34,197,110,0.15)', borderRadius:8 }}>
              ✓ 1 session will be returned to your plan.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn-ghost" onClick={() => setCancelModal({ open: false, booking: null })} disabled={cancelLoading}>Go Back</button>
              <button onClick={handleCancelSession} disabled={cancelLoading}
                style={{ padding:'12px 24px', borderRadius:8, background:'#e04060', border:'none', color:'var(--text)', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:15, letterSpacing:'0.06em', cursor: cancelLoading ? 'not-allowed' : 'pointer', opacity: cancelLoading ? 0.7 : 1 }}>
                {cancelLoading ? 'Canceling...' : 'Cancel Session'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: SUPPORT ── */}
      <Modal open={showSupport} onClose={() => setShowSupport(false)} title="Help & Support">
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <p style={{ fontSize:14, color:'var(--muted)', lineHeight:1.75, padding:'14px 18px', background:'rgba(13,27,42,0.03)', borderRadius:8, border:'1px solid var(--border)' }}>
            Need help with your account, sessions, or billing? Our team is ready to assist you.
            Reach out via WhatsApp for a fast response, or send us an email and we'll get back to you shortly.
          </p>
          <a href="https://wa.me/19152423456" target="_blank" rel="noopener noreferrer"
            className="support-btn"
            style={{ border:'1px solid rgba(34,197,110,0.25)', background:'rgba(34,197,110,0.05)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ color:'var(--green2)', flexShrink:0 }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:16, color:'var(--text)', letterSpacing:'0.05em', textTransform:'uppercase' }}>WhatsApp</div>
                <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'var(--font-mono)', marginTop:2 }}>+1 (915) 242-3456 · fastest response</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--green2)" />
          </a>
          <a href="mailto:txtorq@gmail.com"
            className="support-btn"
            style={{ border:'1px solid rgba(13,27,42,0.1)', background:'rgba(13,27,42,0.03)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:'rgba(13,27,42,0.5)', flexShrink:0 }}>
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:16, color:'var(--text)', letterSpacing:'0.05em', textTransform:'uppercase' }}>Email</div>
                <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'var(--font-mono)', marginTop:2 }}>txtorq@gmail.com · reply within 24h</div>
              </div>
            </div>
            <ChevronRight size={16} color="rgba(13,27,42,0.35)" />
          </a>
        </div>
      </Modal>
    </>
  )
}

// ── PARENT HOME ───────────────────────────────────────────────────────────────
function ParentHome({ players, onAdd, onBuy, onEditSave, parentId, checkinStats = {}, onBook }) {
  const [editModal, setEditModal] = useState({ open: false, player: null, name: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [attendanceModal, setAttendanceModal] = useState({ open: false, kidName: null, checkins: [], loading: false })
  const [qrModal, setQrModal] = useState({ open: false, player: null })

  async function loadCheckins(kidName) {
    setAttendanceModal({ open: true, kidName, checkins: [], loading: true })
    const { data } = await supabase
      .from('checkins').select('*')
      .eq('parent_id', parentId).eq('kid_name', kidName)
      .order('checked_in_at', { ascending: false }).limit(10)
    setAttendanceModal(prev => ({ ...prev, checkins: data || [], loading: false }))
  }

  async function submitEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    await onEditSave(editModal.player, editModal.name)
    setEditSaving(false)
    setEditModal({ open: false, player: null, name: '' })
  }

  return (
    <div>
      <div style={{ marginBottom:36 }} className="animate-fade-up">
        <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, fontSize:12, color:'var(--muted)', letterSpacing:'0.25em', textTransform:'uppercase', marginBottom:6 }}>Parent Portal</div>
        <h1 style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:52, letterSpacing:'0.06em', color:'var(--text)', lineHeight:1 }}>
          MY PLAYERS
        </h1>
        {/* Red underbar */}
        <div style={{ marginTop:12, width:48, height:3, background:'rgba(13,27,42,0.3)', borderRadius:2 }} />
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
              <div style={{ position:'absolute', right:16, top:10, fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:90, color:'rgba(13,27,42,0.025)', lineHeight:1, userSelect:'none', pointerEvents:'none' }}>
                {player.kid_name[0]}
              </div>

              {/* Avatar + name */}
              <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:22, position:'relative' }}>
                <div style={{ width:54, height:54, borderRadius:12, background:'linear-gradient(135deg, var(--navy4) 0%, var(--navy5) 100%)', border:'1px solid rgba(13,27,42,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:26, color:'var(--text)', flexShrink:0, boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
                  {player.kid_name[0]}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:26, letterSpacing:'0.05em', color:'var(--text)', lineHeight:1 }}>{player.kid_name}</div>
                    <button onClick={() => setEditModal({ open:true, player, name: player.kid_name })} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:4, display:'flex', alignItems:'center', flexShrink:0 }} title="Edit name">
                      <Pencil size={14} />
                    </button>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:5 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background: m ? 'var(--green2)' : 'var(--muted2)', boxShadow: m ? '0 0 6px var(--green2)' : 'none' }} />
                    <div style={{ fontSize:11, color: m ? 'var(--green2)' : 'var(--muted)', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic' }}>
                      {m ? m.package_name : 'No active plan'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sessions block — Whoop-style radial ring (real data: remaining / total) */}
              <div style={{ display:'flex', alignItems:'center', gap:16, background:'var(--navy)', borderRadius:12, padding:'16px 18px', border:'1px solid var(--border)' }}>
                {m ? (
                  <>
                    {(() => {
                      const R = 32, CIRC = 2 * Math.PI * R
                      const prog = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
                      const ringColor = lowSessions ? '#FB8500' : '#06D6A0'
                      return (
                        <svg width="82" height="82" viewBox="0 0 82 82" style={{ flexShrink:0 }}>
                          <circle cx="41" cy="41" r={R} fill="none" stroke="#E9ECF1" strokeWidth="7" />
                          <circle cx="41" cy="41" r={R} fill="none" stroke={ringColor} strokeWidth="7" strokeLinecap="round"
                            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - prog)} transform="rotate(-90 41 41)"
                            style={{ transition:'stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1)' }} />
                          <text x="41" y="40" textAnchor="middle" style={{ fontFamily:'var(--font-body)', fontSize:'22px', fontWeight:700, fill:'#0D1B2A', fontVariantNumeric:'tabular-nums' }}>{remaining}</text>
                          <text x="41" y="55" textAnchor="middle" style={{ fontFamily:'var(--font-body)', fontSize:'10px', fill:'#66748A' }}>of {total}</text>
                        </svg>
                      )
                    })()}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10, color:'var(--muted2)', fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic', marginBottom:8 }}>Sessions Remaining</div>
                      <div style={{ display:'flex', gap:16, fontSize:11, color:'var(--muted)', fontFamily:'var(--font-mono)' }}>
                        <span>{used} used</span>
                        <span style={{ color: lowSessions ? '#FB8500' : 'var(--green2)', fontWeight:600 }}>{remaining} left</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%' }}>
                    <span style={{ fontSize:10, color:'var(--muted2)', fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic' }}>Sessions</span>
                    <button className="btn-ghost" onClick={() => onBuy(player)}>+ Get Plan</button>
                  </div>
                )}
              </div>

              {/* Motivational: check-ins this month + gentle positive nudge (real data) */}
              {m && (() => {
                const stat = checkinStats[player.kid_name?.toLowerCase().trim()] || { monthCount: 0, lastVisit: null }
                const daysSince = stat.lastVisit ? Math.floor((Date.now() - stat.lastVisit.getTime()) / 86400000) : null
                const needsNudge = daysSince == null || daysSince >= 8
                return (
                  <div style={{ marginTop:14 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'var(--muted)' }}>
                      <span className="num" style={{ color:'var(--green2)', fontSize:15 }}>{stat.monthCount}</span>
                      <span>check-in{stat.monthCount === 1 ? '' : 's'} this month</span>
                    </div>
                    {needsNudge && (
                      <div onClick={() => onBook && onBook(player)}
                        style={{ marginTop:8, padding:'10px 12px', borderRadius:8, background:'rgba(6,214,160,0.08)', border:'1px solid rgba(6,214,160,0.22)', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:16, flexShrink:0 }}>💪</span>
                        <span style={{ fontSize:12, color:'var(--text)', fontWeight:600, lineHeight:1.35 }}>Time to get back at it — <span style={{ color:'#06D6A0' }}>book your next session →</span></span>
                      </div>
                    )}
                  </div>
                )
              })()}

              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:14 }}>
                <button
                  onClick={() => setQrModal({ open: true, player })}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 16px', background:'rgba(13,27,42,0.07)', border:'1px solid rgba(13,27,42,0.15)', borderRadius:8, color:'var(--text)', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, fontSize:13, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer' }}
                >
                  📷 Scan QR
                </button>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn-ghost" onClick={() => loadCheckins(player.kid_name)} style={{ flex:1, justifyContent:'center', display:'flex', padding:'8px 10px', fontSize:12 }}>
                    View Attendance
                  </button>
                  {m && (
                    <button className="btn-ghost" onClick={() => onBuy(player)} style={{ flex:1, justifyContent:'center', display:'flex', padding:'8px 10px', fontSize:12 }}>
                      Upgrade
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Add card */}
        <div className="add-card" onClick={onAdd}>
          <div className="add-icon"><Plus size={34} strokeWidth={1.5} /></div>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:14, color:'var(--muted2)', letterSpacing:'0.2em', textTransform:'uppercase', marginTop:10 }}>Add Player</div>
        </div>
      </div>

      {/* QR Check-in modal */}
      <QRCheckinModal
        open={qrModal.open}
        onClose={() => setQrModal({ open: false, player: null })}
        player={qrModal.player}
        parentId={parentId}
      />

      {/* Attendance modal */}
      <Modal open={attendanceModal.open} onClose={() => setAttendanceModal({ open:false, kidName:null, checkins:[], loading:false })} title={`Attendance · ${attendanceModal.kidName || ''}`} width={460}>
        {attendanceModal.loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)', fontFamily:'var(--font-display)', fontStyle:'italic' }}>Loading…</div>
        ) : attendanceModal.checkins.length === 0 ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)', fontSize:14 }}>No attendance records found.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {attendanceModal.checkins.map((c, i) => {
              const dt = new Date(c.checked_in_at)
              const date = dt.toLocaleDateString('en-US', { weekday:'short', day:'numeric', month:'short', year:'numeric' })
              const time = dt.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })
              const rem = c.sessions_remaining_after
              return (
                <div key={c.id || i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(13,27,42,0.03)', border:'1px solid var(--border)', borderRadius:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', textTransform:'capitalize' }}>{date}</div>
                    <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'var(--font-mono)', marginTop:2 }}>{time}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:24, color: rem <= 2 ? '#E8A020' : 'var(--green2)', lineHeight:1 }}>{rem}</div>
                    <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:2 }}>sessions remaining</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      {/* Edit player name modal */}
      <Modal open={editModal.open} onClose={() => setEditModal({ open:false, player:null, name:'' })} title="Edit Player Name" width={380}>
        <form onSubmit={submitEdit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <input
            className="torque-input"
            value={editModal.name}
            onChange={e => setEditModal(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Player name"
            autoFocus
            style={{ marginTop:0 }}
          />
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={() => setEditModal({ open:false, player:null, name:'' })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── PLACEHOLDER ───────────────────────────────────────────────────────────────
// ── SESSIONS PAGE ─────────────────────────────────────────────────────────────
function SessionsPage({ players, bookings, onBook, onCancel, onReschedule }) {
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
          No players have an active plan. Get a plan from the Dashboard.
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
                <div style={{ position:'absolute', right:20, top:16, fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:80, color:'rgba(13,27,42,0.025)', lineHeight:1, userSelect:'none' }}>{player.kid_name[0]}</div>

                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
                  {/* Left: player info */}
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:48, height:48, borderRadius:10, background:'linear-gradient(135deg, var(--navy4), var(--navy5))', border:'1px solid rgba(13,27,42,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22, color:'var(--text)', flexShrink:0 }}>
                      {player.kid_name[0]}
                    </div>
                    <div>
                      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22, color:'var(--text)' }}>{player.kid_name}</div>
                      <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'var(--font-display)', fontStyle:'italic', marginTop:2 }}>{m ? m.package_name : 'No plan'}</div>
                    </div>
                  </div>

                  {/* Right: big counter */}
                  <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                    <div style={{ textAlign:'center' }}>
                      <div className="num" style={{ fontSize:56, lineHeight:1, color: remaining === 0 ? 'var(--muted2)' : remaining <= 2 ? '#FB8500' : 'var(--green2)' }}>{remaining}</div>
                      <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:'var(--font-display)', marginTop:2 }}>of {total} remaining</div>
                    </div>
                    {m && remaining > 0 && !(m.expires_at && new Date(m.expires_at) < new Date()) && (
                      <button onClick={() => onBook(player)} className="btn-primary" style={{ padding:'12px 20px', fontSize:14 }}>
                        + Book
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {m && (
                  <div style={{ marginTop:20 }}>
                    <div style={{ height:6, background:'rgba(13,27,42,0.06)', borderRadius:6, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:6, transition:'width 0.6s ease', width:`${pct}%`, background: remaining === 0 ? 'var(--muted2)' : remaining <= 2 ? 'linear-gradient(90deg,#E8A020,#F0C040)' : 'linear-gradient(90deg,var(--green),var(--green2))' }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--muted)', fontFamily:'var(--font-mono)' }}>
                      <span>{used} used</span><span>{remaining} left</span>
                    </div>
                  </div>
                )}

                {/* Upcoming bookings for this player */}
                {playerBookings.length > 0 && (
                  <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
                    <div style={{ fontSize:10, color:'var(--muted2)', letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic', marginBottom:10 }}>Upcoming sessions</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {playerBookings.slice(0,3).map(b => {
                        const canMod = canModifyBooking(b)
                        return (
                          <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'rgba(34,197,110,0.06)', borderRadius:8, border:'1px solid rgba(34,197,110,0.15)', flexWrap:'wrap' }}>
                            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--green2)', flexShrink:0 }} />
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--offwhite)', flex:1 }}>
                              {new Date(b.session_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · {b.session_time}
                            </span>
                            {canMod ? (
                              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                                <button onClick={() => onReschedule(b)}
                                  style={{ padding:'4px 10px', borderRadius:6, background:'rgba(79,168,255,0.12)', border:'1px solid rgba(79,168,255,0.3)', color:'#4fa8ff', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, fontSize:11, cursor:'pointer', letterSpacing:'0.05em' }}>
                                  ↺ Reschedule
                                </button>
                                <button onClick={() => onCancel(b)}
                                  style={{ padding:'4px 10px', borderRadius:6, background:'rgba(224,64,96,0.12)', border:'1px solid rgba(224,64,96,0.3)', color:'#e04060', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, fontSize:11, cursor:'pointer', letterSpacing:'0.05em' }}>
                                  ✕ Cancel
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize:10, color:'var(--muted2)', fontFamily:'var(--font-mono)' }}>no changes allowed</span>
                            )}
                          </div>
                        )
                      })}
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
function SchedulePage({ bookings, onCancel, onReschedule }) {
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const today = new Date(); today.setHours(0,0,0,0)

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

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


  return (
    <div className="animate-fade-up">
      <div className="section-eyebrow">Parent Portal</div>
      <h1 className="section-title">SCHEDULE</h1>
      <div className="section-bar" />

      <div className="schedule-layout">

        {/* ── CALENDAR ── */}
        <div style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <button onClick={() => { setViewDate(new Date(year,month-1,1)); setSelectedDay(null) }}
              style={{ background:'var(--navy4)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:18, fontWeight:700 }}>‹</button>
            <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:20, letterSpacing:'0.06em', color:'var(--text)', textTransform:'uppercase' }}>
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
                    alignItems:'center', justifyContent:'center', borderRadius:8,
                    cursor: hasB ? 'pointer' : 'default', overflow:'hidden',
                    transition:'all 0.15s', minWidth:0,
                    background: isSelected ? 'rgba(34,197,110,0.18)' : hasB ? 'rgba(34,197,110,0.09)' : isToday ? 'rgba(13,27,42,0.07)' : 'transparent',
                    border: isSelected ? '1.5px solid rgba(34,197,110,0.5)' : hasB ? '1px solid rgba(34,197,110,0.2)' : isToday ? '1px solid rgba(13,27,42,0.15)' : '1px solid transparent',
                  }}>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight: hasB || isToday ? 800 : 500, fontSize:13, lineHeight:1,
                    color: isSelected ? 'var(--green2)' : hasB ? 'var(--green2)' : isToday ? 'var(--text)' : 'var(--text2)' }}>
                    {day}
                  </span>
                  {/* Booking count dot */}
                  {hasB && (
                    <div style={{ display:'flex', gap:2, marginTop:2, justifyContent:'center' }}>
                      <div style={{ width:4, height:4, borderRadius:'50%', background:'var(--green2)' }} />
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
                {new Date(selectedDay+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'})}
              </div>
              {bookingsByDate[selectedDay].map((b,i) => {
                const canMod = canModifyBooking(b)
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderTop: i>0 ? '1px solid rgba(13,27,42,0.05)' : 'none', flexWrap:'wrap' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--green2)', flexShrink:0 }} />
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--offwhite)', fontWeight:600 }}>{b.session_time}</span>
                    <span style={{ fontSize:12, color:'var(--muted)' }}>·</span>
                    <span style={{ fontSize:12, color:'var(--offwhite)', flex:1 }}>{b.kid_name}</span>
                    {canMod && (
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => onReschedule(b)}
                          style={{ padding:'3px 8px', borderRadius:5, background:'rgba(79,168,255,0.12)', border:'1px solid rgba(79,168,255,0.3)', color:'#4fa8ff', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, fontSize:10, cursor:'pointer' }}>
                          ↺
                        </button>
                        <button onClick={() => onCancel(b)}
                          style={{ padding:'3px 8px', borderRadius:5, background:'rgba(224,64,96,0.12)', border:'1px solid rgba(224,64,96,0.3)', color:'#e04060', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, fontSize:10, cursor:'pointer' }}>
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>

        {/* ── UPCOMING LIST ── */}
        <div style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:16, letterSpacing:'0.04em' }}>UPCOMING SESSIONS</div>
          {upcoming.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted)', fontSize:13, lineHeight:1.7 }}>No sessions scheduled.<br/>Go to Sessions to book.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {upcoming.map(b => {
                const iso = normDate(b.session_date)
                const canMod = canModifyBooking(b)
                return (
                  <div key={b.id}
                    style={{ padding:'12px 14px', background: iso === selectedDay ? 'rgba(34,197,110,0.06)' : 'rgba(13,27,42,0.03)', border:`1px solid ${iso === selectedDay ? 'rgba(34,197,110,0.3)' : 'var(--border)'}`, borderRadius:10, transition:'all 0.15s' }}>
                    <div onClick={() => { setSelectedDay(iso); setViewDate(new Date(iso+'T12:00:00')) }}
                      style={{ cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.opacity='0.8'}
                      onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:13, color:'var(--text)' }}>
                          {new Date(iso+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                        </div>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--green2)', fontWeight:600 }}>{b.session_time}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:5 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--green2)', flexShrink:0 }} />
                        <span style={{ fontSize:11, color:'var(--text2)' }}>{b.kid_name}</span>
                      </div>
                    </div>
                    {canMod && (
                      <div style={{ display:'flex', gap:6, marginTop:10, paddingTop:10, borderTop:'1px solid rgba(13,27,42,0.05)' }}>
                        <button onClick={() => onReschedule(b)}
                          style={{ flex:1, padding:'6px 0', borderRadius:6, background:'rgba(79,168,255,0.1)', border:'1px solid rgba(79,168,255,0.25)', color:'#4fa8ff', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, fontSize:12, cursor:'pointer', letterSpacing:'0.04em' }}>
                          ↺ Reschedule
                        </button>
                        <button onClick={() => onCancel(b)}
                          style={{ flex:1, padding:'6px 0', borderRadius:6, background:'rgba(224,64,96,0.1)', border:'1px solid rgba(224,64,96,0.25)', color:'#e04060', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:700, fontSize:12, cursor:'pointer', letterSpacing:'0.04em' }}>
                          ✕ Cancel
                        </button>
                      </div>
                    )}
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
    return d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
  }

  function cycleLabel(total) {
    if (total >= 96) return 'Annual'
    if (total >= 48) return '6 Months'
    if (total >= 24) return '12 Months'
    return 'Monthly'
  }

  return (
    <div className="animate-fade-up">
      <div className="section-eyebrow">Parent Portal</div>
      <h1 className="section-title">BILLING</h1>
      <div className="section-bar" />

      {memberships.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--muted)', fontSize:14 }}>No active plans.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {memberships.map((m, i) => (
            <div key={m.id || i} style={{ background:'var(--navy3)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
                <div>
                  <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:22, color:'var(--text)' }}>{m.kid_name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:3, fontFamily:'var(--font-display)', fontStyle:'italic', letterSpacing:'0.06em', textTransform:'uppercase' }}>{m.package_name} · {cycleLabel(m.sessions_total)}</div>
                </div>
                <div style={{ padding:'4px 12px', background:'rgba(34,197,110,0.1)', border:'1px solid rgba(34,197,110,0.25)', borderRadius:20, fontSize:11, fontFamily:'var(--font-display)', fontWeight:700, color:'var(--green2)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Active</div>
              </div>

              {/* Stats row */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
                {[
                  { label:'Total sessions',     value: m.sessions_total },
                  { label:'Sessions used',      value: m.sessions_used },
                  { label:'Sessions remaining', value: m.sessions_total - m.sessions_used },
                ].map(s => (
                  <div key={s.label} style={{ background:'rgba(0,0,0,0.2)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:28, color:'var(--text)' }}>{s.value}</div>
                    <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'var(--font-display)', marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Payment info */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ padding:'12px 16px', background:'rgba(13,27,42,0.03)', border:'1px solid var(--border)', borderRadius:10 }}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', fontFamily:'var(--font-display)', marginBottom:4 }}>Purchase date</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--offwhite)' }}>
                    {m.purchased_at ? new Date(m.purchased_at).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : '—'}
                  </div>
                </div>
                <div style={{ padding:'12px 16px', background:'rgba(34,197,110,0.05)', border:'1px solid rgba(34,197,110,0.15)', borderRadius:10 }}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', fontFamily:'var(--font-display)', marginBottom:4 }}>Next payment</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--green2)' }}>{nextPayment(m.purchased_at, m.sessions_total)}</div>
                </div>
              </div>

              {/* Stripe reference */}
              {m.stripe_payment_id && (
                <div style={{ marginTop:12, padding:'8px 14px', background:'rgba(0,0,0,0.2)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'var(--font-display)' }}>Payment reference</span>
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
      <h1 style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:52, letterSpacing:'0.06em', color:'var(--text)', lineHeight:1, marginBottom:14 }}>{title.toUpperCase()}</h1>
      <div style={{ width:48, height:3, background:'rgba(13,27,42,0.3)', borderRadius:2, marginBottom:24 }} />
      <div style={{ fontSize:14, color:'var(--muted)' }}>This section is under construction.</div>
    </div>
  )
}

// ── EVENTS PAGE (view + RSVP) ─────────────────────────────────────────────────
function EventsPage({ user, players = [], parentDisplayName }) {
  const [events, setEvents] = useState([])
  const [regs, setRegs] = useState([])   // registrations for the visible events
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)  // `${eventId}:${kid}` while toggling

  const today = new Date().toISOString().split('T')[0]

  async function load() {
    // Parents only see events that haven't passed yet.
    const { data: evs } = await supabase.from('events').select('*').gte('date', today).order('date', { ascending: true })
    const list = evs || []
    setEvents(list)
    if (list.length) {
      const { data: rs } = await supabase.from('event_registrations').select('*').in('event_id', list.map(e => e.id))
      setRegs(rs || [])
    } else {
      setRegs([])
    }
    setLoading(false)
  }
  useEffect(() => { load().catch(() => setLoading(false)) }, [user?.id])

  async function toggle(ev, kidName, joined) {
    const key = `${ev.id}:${kidName}`
    setBusy(key)
    try {
      if (joined) {
        await supabase.from('event_registrations').delete()
          .eq('event_id', ev.id).eq('parent_id', user.id).eq('kid_name', kidName)
        setRegs(prev => prev.filter(r => !(r.event_id === ev.id && r.parent_id === user.id && r.kid_name === kidName)))
      } else {
        const { data, error } = await supabase.from('event_registrations')
          .insert({ event_id: ev.id, parent_id: user.id, kid_name: kidName, parent_name: parentDisplayName || '' })
          .select().single()
        if (!error && data) setRegs(prev => [...prev, data])
        else if (error && !/duplicate|unique/i.test(error.message)) alert('Could not join: ' + error.message)
      }
    } finally {
      setBusy(null)
    }
  }

  const typeColor = { showcase:'#ff4466', camp:'#f39c12', clinic:'#4fa8ff', social:'#22C56E' }
  const typeLabel = { showcase:'Showcase', camp:'Camp', clinic:'Clinic', social:'Social' }

  if (loading) return (
    <div className="animate-fade-up" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:18, color:'var(--muted)' }}>Loading events…</div>
    </div>
  )

  return (
    <div className="animate-fade-up">
      <div className="section-eyebrow">Parent Portal</div>
      <h1 className="section-title">EVENTS</h1>
      <div className="section-bar" />

      {events.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--muted)' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📅</div>
          <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:18 }}>No upcoming events</div>
          <div style={{ fontSize:13, marginTop:8 }}>Coaches will publish events soon.</div>
        </div>
      ) : (
        <div className="events-grid">
          {events.map(ev => {
            const evRegs = regs.filter(r => r.event_id === ev.id)
            const count = evRegs.length
            const spotsLeft = ev.spots ? Math.max(0, ev.spots - count) : null
            const full = ev.spots ? count >= ev.spots : false
            const myKids = new Set(evRegs.filter(r => r.parent_id === user?.id).map(r => r.kid_name))
            const iAmIn = myKids.size > 0
            const pct = ev.spots ? (count / ev.spots) * 100 : 0
            const tColor = typeColor[ev.type] || 'var(--muted)'
            return (
              <div key={ev.id} style={{ background:'var(--navy2)', border:`1px solid ${iAmIn ? 'rgba(6,214,160,0.4)' : 'var(--border)'}`, borderRadius:16, padding:20, display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                  <div style={{ fontSize:40, lineHeight:1, flexShrink:0 }}>{ev.image || '⚾'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:900, fontSize:17, color:'var(--text)', lineHeight:1.2 }}>{ev.title}</span>
                      <span style={{ fontSize:10, fontFamily:'var(--font-display)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:tColor, background:`${tColor}18`, padding:'2px 8px', borderRadius:6, border:`1px solid ${tColor}40` }}>{typeLabel[ev.type] || ev.type}</span>
                      {iAmIn && <span style={{ fontSize:10, fontFamily:'var(--font-display)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#06D6A0', background:'rgba(6,214,160,0.14)', padding:'2px 8px', borderRadius:6 }}>You're in! ✅</span>}
                    </div>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:13, color:'var(--accent)', letterSpacing:'0.03em' }}>
                      {ev.date}{ev.time ? ` · ${ev.time}` : ''}
                    </div>
                    {ev.location && <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>📍 {ev.location}</div>}
                  </div>
                </div>

                {ev.description && <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.7, margin:0 }}>{ev.description}</p>}

                {/* Capacity */}
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                    <span style={{ color:'var(--muted)' }}><span className="num" style={{ fontSize:12, color:'var(--text)' }}>{count}</span> registered</span>
                    {ev.spots ? <span style={{ color: full?'var(--muted)':spotsLeft<=5?'var(--amber)':'var(--green2)', fontWeight:600 }}>{full ? 'Event full' : `${spotsLeft} spots available`}</span> : null}
                  </div>
                  <div style={{ height:5, background:'var(--navy4)', borderRadius:5, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:5, width:`${Math.min(pct,100)}%`, background: pct>=90?'var(--red)':pct>=60?'var(--amber)':'var(--green2)', transition:'width 0.3s' }} />
                  </div>
                </div>

                {/* RSVP — one toggle chip per player */}
                {players.length > 0 ? (
                  <div>
                    <div style={{ fontSize:10, color:'var(--muted2)', fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', fontFamily:'var(--font-display)', fontStyle:'italic', marginBottom:8 }}>Join In</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {players.map(p => {
                        const joined = myKids.has(p.kid_name)
                        const key = `${ev.id}:${p.kid_name}`
                        const disabled = busy === key || (!joined && full)
                        return (
                          <button key={p.kid_name} onClick={() => toggle(ev, p.kid_name, joined)} disabled={disabled}
                            style={{
                              display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:20,
                              fontFamily:'var(--font-display)', fontWeight:700, fontSize:12, letterSpacing:'0.03em',
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              background: joined ? 'rgba(6,214,160,0.14)' : 'var(--accent-soft)',
                              color: joined ? '#06D6A0' : 'var(--text)',
                              border: `1px solid ${joined ? 'rgba(6,214,160,0.45)' : 'var(--border2)'}`,
                              opacity: (!joined && full) ? 0.5 : 1,
                            }}>
                            {joined ? '✓' : '+'} {(p.kid_name||'').split(' ')[0]}
                          </button>
                        )
                      })}
                    </div>
                    {full && !iAmIn && <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>This event is full.</div>}
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:'var(--muted)' }}>Add a player to RSVP.</div>
                )}
              </div>
            )
          })}
        </div>
      )}
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
