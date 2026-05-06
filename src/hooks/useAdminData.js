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

// Paquetes
export const PACK_INFO = {
  'A':   { sessions: 4,  price: 260, color: '#4fa8ff' },
  'AA':  { sessions: 8,  price: 360, color: '#22C56E' },
  'AAA': { sessions: 12, price: 440, color: '#f39c12' },
  'MLB': { sessions: 20, price: 600, color: '#a78bfa' },
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
