import React, { createContext, useContext, useState } from 'react'
import { FAMILIES, BOOKINGS, ATTENDANCE } from '../data/mockData'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [families, setFamilies] = useState(FAMILIES)
  const [bookings, setBookings] = useState(BOOKINGS)
  const [attendance, setAttendance] = useState(ATTENDANCE)
  const [currentUser, setCurrentUser] = useState(null) // null = admin view, familyId = parent view

  const getFamily = (id) => families.find(f => f.id === id)
  const getPlayer = (id) => families.flatMap(f => f.players).find(p => p.id === id)
  const getAllPlayers = () => families.flatMap(f => f.players.map(p => ({ ...p, family: f })))

  const addBooking = (booking) => setBookings(prev => [...prev, { id: `b${Date.now()}`, ...booking, status: 'confirmed' }])

  const cancelBooking = (id) => setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))

  const markAttendance = (date, slotId, playerId, attended) => {
    setAttendance(prev => {
      const existing = prev.find(a => a.date === date && a.slotId === slotId)
      if (existing) {
        return prev.map(a => {
          if (a.date !== date || a.slotId !== slotId) return a
          if (attended) return { ...a, attended: [...new Set([...a.attended, playerId])], absent: a.absent.filter(id => id !== playerId) }
          return { ...a, absent: [...new Set([...a.absent, playerId])], attended: a.attended.filter(id => id !== playerId) }
        })
      }
      return [...prev, { date, slotId, attended: attended ? [playerId] : [], absent: attended ? [] : [playerId] }]
    })
    // Deduct session
    if (attended) {
      setFamilies(prev => prev.map(f => ({
        ...f,
        players: f.players.map(p => p.id === playerId ? { ...p, sessionsUsed: Math.min(p.sessionsUsed + 1, p.sessionsTotal) } : p)
      })))
    }
  }

  const addFamily = (family) => {
    const id = `f${Date.now()}`
    setFamilies(prev => [...prev, { id, joinDate: new Date().toISOString().split('T')[0], ...family }])
    return id
  }

  const updatePlayer = (playerId, updates) => {
    setFamilies(prev => prev.map(f => ({ ...f, players: f.players.map(p => p.id === playerId ? { ...p, ...updates } : p) })))
  }

  return (
    <AppContext.Provider value={{ families, bookings, attendance, currentUser, setCurrentUser, getFamily, getPlayer, getAllPlayers, addBooking, cancelBooking, markAttendance, addFamily, updatePlayer }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
