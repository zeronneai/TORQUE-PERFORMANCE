import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

export function useAdminData() {
  const [state, setState] = useState({
    players: [], memberships: [], bookings: [], profiles: [],
    loading: true, error: null,
  })

  const fetch = useCallback(async () => {
    try {
      const [p, m, b, pr] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('player_memberships').select('*').eq('status', 'active'),
        supabase.from('bookings').select('*').eq('status', 'confirmed'),
        supabase.from('profiles').select('*'),
      ])
      setState({
        players:      p.data  || [],
        memberships:  m.data  || [],
        bookings:     b.data  || [],
        profiles:     pr.data || [],
        loading: false, error: null,
      })
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { ...state, refetch: fetch }
}

// Normaliza fechas de Supabase: "2026-04-14T00:00:00+00:00" → "2026-04-14"
export const normDate = (d) => (d || '').split('T')[0]

// Whole days from today until a date (negative = already past). null when no date.
export const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(normDate(dateStr) + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}

// Color tier for days-to-expiry: >30 green · ≤30 yellow · ≤14 orange · ≤7 (and past) red
export const expiryColor = (days) => {
  if (days == null) return 'var(--muted)'
  if (days <= 7)  return '#ff4466'
  if (days <= 14) return '#f39c12'
  if (days <= 30) return '#facc15'
  return 'var(--green2)'
}

// Human label: "Expired 3d ago" / "Expires today" / "Expires in 5 days"
export const expiryLabel = (days) => {
  if (days == null) return ''
  if (days < 0)   return `Expired ${-days}d ago`
  if (days === 0) return 'Expires today'
  return `Expires in ${days} day${days === 1 ? '' : 's'}`
}

// Paquetes
export const PACK_INFO = {
  'A':   { sessions: 4,  price: 260, color: '#4fa8ff' },
  'AA':  { sessions: 8,  price: 360, color: '#22C56E' },
  'AAA': { sessions: 12, price: 440, color: '#f39c12' },
  'MLB': { sessions: 20, price: 600, color: '#a78bfa' },
}

// Vibrant palette for KPI blocks / charts (light theme). fg = text color that
// meets contrast on that block (dark navy on light-ish blocks, white on dark-enough).
export const VIBRANT = {
  red:    { bg: '#E63946', fg: '#FFFFFF' },
  blue:   { bg: '#118AB2', fg: '#FFFFFF' },
  green:  { bg: '#06D6A0', fg: '#0D1B2A' },
  amber:  { bg: '#FFB703', fg: '#0D1B2A' },
  orange: { bg: '#FB8500', fg: '#0D1B2A' },
  purple: { bg: '#7C3AED', fg: '#FFFFFF' },
}
// Package → vibrant identifier color (A=blue, AA=green, AAA=amber, MLB=purple)
export const PKG_VIBRANT = { A: '#118AB2', AA: '#06D6A0', AAA: '#FFB703', MLB: '#7C3AED' }
// Normalize "Package A" / "A" → "A"
export const pkgKey = (name) => (name || '').replace(/^Package\s+/i, '').trim()
export const pkgColor = (name) => PKG_VIBRANT[pkgKey(name)] || '#5A6B84'

// Status → palette color (green=active/paid, amber=expiring, red=expired/overdue, blue=info)
export const STATUS = {
  active: '#06D6A0', paid: '#06D6A0',
  expiring: '#FFB703',
  expired: '#E63946', overdue: '#E63946', inactive: '#E63946',
  info: '#118AB2',
}

export const TYPE_COLORS = {
  'Speed & Agility':    '#4fa8ff',
  'Fielding / Defense': '#22C56E',
  'Batting':            '#f39c12',
  'General Training':   '#a78bfa',
}

export const parentName = (profile) =>
  profile?.full_name || profile?.name ||
  (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : null) ||
  null
