import React, { useState } from 'react'
import { Check, X, Clock } from 'lucide-react'
import { Card, Badge, Avatar, PageHeader, Btn } from '../../components/UI'
import { useApp } from '../../context/AppContext'
import { SLOTS, SESSION_TYPES } from '../../data/mockData'

const DAYS = ['Monday', 'Wednesday', 'Friday', 'Saturday']

export default function Attendance() {
  const { families, bookings, attendance, markAttendance } = useApp()
  const [selectedDate, setSelectedDate] = useState('2025-03-24')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [notify, setNotify] = useState(null)

  const allPlayers = families.flatMap(f => f.players.map(p => ({ ...p, family: f })))

  const getAttendanceForSlot = (date, slotId) => attendance.find(a => a.date === date && a.slotId === slotId)

  const getBookingsForSlot = (date, slotId) =>
    bookings.filter(b => b.date === date && b.slotId === slotId && b.status !== 'cancelled')

  const handleMark = (playerId, attended) => {
    markAttendance(selectedDate, selectedSlot.id, playerId, attended)
    setNotify({ name: allPlayers.find(p => p.id === playerId)?.name, attended })
    setTimeout(() => setNotify(null), 2500)
  }

  const todaySlots = SLOTS
  const sessionType = id => SESSION_TYPES.find(s => s.id === id)

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Academy" title="Attendance" subtitle="Mark and review session attendance" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {/* Left: Slot selector */}
        <div>
          <div style={{ marginBottom: 14 }}>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SLOTS.map(slot => {
              const sType = sessionType(slot.type)
              const slotBookings = getBookingsForSlot(selectedDate, slot.id)
              const att = getAttendanceForSlot(selectedDate, slot.id)
              const isSelected = selectedSlot?.id === slot.id
              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot)}
                  style={{
                    padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${isSelected ? sType?.color : 'var(--border)'}`,
                    background: isSelected ? `${sType?.color}14` : 'var(--navy2)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: isSelected ? sType?.color : 'var(--text)' }}>
                      {slot.day} {slot.time}
                    </div>
                    <span style={{ fontSize: 14 }}>{sType?.icon}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sType?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                    {slotBookings.length} booked · {att ? `${att.attended.length} marked` : 'not marked'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Attendance sheet */}
        <div>
          {selectedSlot ? (() => {
            const sType = sessionType(selectedSlot.type)
            const slotBookings = getBookingsForSlot(selectedDate, selectedSlot.id)
            const att = getAttendanceForSlot(selectedDate, selectedSlot.id)

            const bookedPlayers = slotBookings.map(b => ({
              booking: b,
              player: allPlayers.find(p => p.id === b.playerId),
            })).filter(x => x.player)

            const notBooked = allPlayers.filter(p =>
              !slotBookings.some(b => b.playerId === p.id)
            )

            return (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(15px, 4vw, 20px)', fontWeight: 800 }}>
                      {selectedSlot.day} — {selectedSlot.time}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
                      <Badge color={selectedSlot.type === 'speed' ? 'red' : 'blue'}>{sType?.name}</Badge>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{selectedDate}</span>
                    </div>
                  </div>
                  {att && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: 800, color: 'var(--green)' }}>{att.attended.length}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>attended</div>
                    </div>
                  )}
                </div>

                {/* Booked players */}
                {bookedPlayers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 14 }}>
                    No bookings for this slot on {selectedDate}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Booked ({bookedPlayers.length})
                    </div>
                    {bookedPlayers.map(({ player, booking }) => {
                      const attended = att?.attended.includes(player.id)
                      const absent = att?.absent.includes(player.id)
                      return (
                        <div key={player.id} style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '12px 16px', borderRadius: 8,
                          background: attended ? 'var(--green-soft)' : absent ? 'var(--red-soft)' : 'var(--navy3)',
                          border: `1px solid ${attended ? 'rgba(46,204,113,0.2)' : absent ? 'rgba(200,16,46,0.2)' : 'var(--border)'}`,
                          transition: 'all 0.2s',
                        }}>
                          <Avatar
                            initials={player.name.split(' ').map(n => n[0]).join('')}
                            size={36}
                            color={attended ? 'var(--green)' : absent ? 'var(--red)' : 'var(--navy4)'}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>{player.name}
                              {player.isSibling && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gold)' }}>sibling</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                              {player.sessionsTotal - player.sessionsUsed} sessions left · {player.family.parent.firstName} {player.family.parent.lastName}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => handleMark(player.id, true)}
                              style={{
                                width: 36, height: 36, borderRadius: 8, border: 'none',
                                background: attended ? 'var(--green)' : 'var(--navy4)',
                                color: attended ? '#fff' : 'var(--text3)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}
                            ><Check size={16} /></button>
                            <button
                              onClick={() => handleMark(player.id, false)}
                              style={{
                                width: 36, height: 36, borderRadius: 8, border: 'none',
                                background: absent ? 'var(--red)' : 'var(--navy4)',
                                color: absent ? '#fff' : 'var(--text3)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}
                            ><X size={16} /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })() : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text3)', fontSize: 14 }}>
              ← Select a session slot to take attendance
            </div>
          )}
        </div>
      </div>

      {/* Toast notification */}
      {notify && (
        <div className="fade-in" style={{
          position: 'fixed', bottom: 24, right: 24,
          background: notify.attended ? 'var(--green)' : 'var(--red)',
          color: '#fff', borderRadius: 10, padding: '12px 20px',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 10, zIndex: 999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {notify.attended ? <Check size={16} /> : <X size={16} />}
          {notify.name} marked as {notify.attended ? 'attended' : 'absent'}
        </div>
      )}
    </div>
  )
}
