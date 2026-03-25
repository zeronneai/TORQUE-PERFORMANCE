import React, { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { Card, Badge, Avatar, PageHeader, Btn, Modal, Label, StatCard, ProgressBar } from '../../components/UI'
import { useApp } from '../../context/AppContext'
import { SLOTS, SESSION_TYPES, PACKAGES, EVENTS, FAMILIES } from '../../data/mockData'

// ── SCHEDULE PAGE ────────────────────────────────────────────────────────────
export function Schedule() {
  const { bookings, families } = useApp()
  const allPlayers = families.flatMap(f => f.players.map(p => ({ ...p, family: f })))
  const [selectedSlot, setSelectedSlot] = useState(null)

  const getSlotBookings = (slotId) => {
    const date = '2025-03-24'
    return bookings
      .filter(b => b.slotId === slotId && b.date === date && b.status !== 'cancelled')
      .map(b => ({ ...b, player: allPlayers.find(p => p.id === b.playerId) }))
      .filter(b => b.player)
  }

  const DAYS_ORDER = ['Monday', 'Wednesday', 'Friday', 'Saturday']
  const byDay = DAYS_ORDER.map(day => ({
    day,
    slots: SLOTS.filter(s => s.day === day).sort((a, b) => a.time.localeCompare(b.time)),
  }))

  const sType = id => SESSION_TYPES.find(s => s.id === id)

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Academy" title="Weekly Schedule" subtitle="Session slots and current bookings" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {byDay.map(({ day, slots }) => (
          <div key={day}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, marginBottom: 12, color: 'var(--text2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{day}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {slots.map(slot => {
                const bkgs = getSlotBookings(slot.id)
                const st = sType(slot.type)
                const pct = (bkgs.length / slot.capacity) * 100
                return (
                  <Card key={slot.id} onClick={() => setSelectedSlot({ slot, bookings: bkgs })} style={{ padding: 14, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15 }}>{slot.time}</div>
                      <span style={{ fontSize: 16 }}>{st?.icon}</span>
                    </div>
                    <div style={{ fontSize: 12, color: st?.color, fontWeight: 600, marginBottom: 6 }}>{st?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>{bkgs.length}/{slot.capacity} booked</div>
                    <ProgressBar value={bkgs.length} max={slot.capacity} color={pct >= 100 ? 'var(--red)' : pct >= 75 ? 'var(--amber)' : 'var(--green)'} height={4} />
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!selectedSlot} onClose={() => setSelectedSlot(null)} title="Slot Details" width={420}>
        {selectedSlot && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800 }}>{selectedSlot.slot.day} — {selectedSlot.slot.time}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{SESSION_TYPES.find(s => s.id === selectedSlot.slot.type)?.name} · Capacity: {selectedSlot.slot.capacity}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedSlot.bookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>No bookings yet</div>
              ) : selectedSlot.bookings.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--navy3)', borderRadius: 8 }}>
                  <Avatar initials={b.player.name.split(' ').map(n => n[0]).join('')} size={30} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{b.player.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.player.family.parent.firstName} {b.player.family.parent.lastName}</div>
                  </div>
                  <Badge color="green">confirmed</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── PAYMENTS PAGE ────────────────────────────────────────────────────────────
export function Payments() {
  const { families } = useApp()
  const allPlayers = families.flatMap(f => f.players.map(p => ({ ...p, family: f })))

  const totalMonthly = allPlayers.reduce((acc, p) => {
    const pkg = PACKAGES.find(pk => pk.id === p.packageId)
    return acc + (p.isSibling ? (pkg?.siblingPrice || 0) : (pkg?.price || 0))
  }, 0)

  const autoPayCount = families.filter(f => f.autoRenew).length
  const cashCount = families.filter(f => f.paymentMethod === 'cash').length

  const paymentIcon = { card: '💳', paypal: '🅿️', cash: '💵' }
  const methodLabel = { card: 'Card', paypal: 'PayPal', cash: 'Cash' }
  const statusColor = { active: 'green', expiring: 'amber', inactive: 'red' }

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Finance" title="Payments" subtitle="Billing overview and player accounts" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Monthly Revenue" value={`$${totalMonthly.toLocaleString()}`} sub="all active players" trend={14} icon="💰" />
        <StatCard label="Auto-Pay Active" value={autoPayCount} sub={`of ${families.length} families`} icon="🔄" />
        <StatCard label="Cash Payments" value={cashCount} sub="manual collection" icon="💵" />
        <StatCard label="Sibling Discounts" value={allPlayers.filter(p => p.isSibling).length} sub="50% off applied" icon="⭐" />
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800 }}>Billing Summary</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Player', 'Package', 'Price', 'Method', 'Auto-Pay', 'Next Billing', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text3)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPlayers.map(player => {
              const pkg = PACKAGES.find(p => p.id === player.packageId)
              const price = player.isSibling ? pkg?.siblingPrice : pkg?.price
              return (
                <tr key={player.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar initials={player.name.split(' ').map(n => n[0]).join('')} size={28} color={player.isSibling ? 'var(--gold)' : 'var(--red)'} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{player.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{player.family.parent.firstName} {player.family.parent.lastName}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{pkg?.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)' }}>${price?.toLocaleString()}</span>
                    {player.isSibling && <span style={{ fontSize: 11, color: 'var(--gold)', marginLeft: 4 }}>⭐</span>}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{paymentIcon[player.family.paymentMethod]} {methodLabel[player.family.paymentMethod]}</td>
                  <td style={{ padding: '12px 16px' }}>{player.family.autoRenew ? <Badge color="green">Yes</Badge> : <Badge color="default">No</Badge>}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>{player.nextBilling || '—'}</td>
                  <td style={{ padding: '12px 16px' }}><Badge color={statusColor[player.status]}>{player.status}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ── EVENTS PAGE ──────────────────────────────────────────────────────────────
export function Events() {
  const [events, setEvents] = useState(EVENTS)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', time: '', location: '', description: '', type: 'clinic', spots: 20, image: '⚾' })

  const typeColor = { showcase: 'red', camp: 'gold', clinic: 'blue', social: 'green' }

  const handleAdd = () => {
    if (!form.title || !form.date) return
    setEvents(prev => [...prev, { id: `e${Date.now()}`, ...form, registered: 0 }])
    setShowAdd(false)
    setForm({ title: '', date: '', time: '', location: '', description: '', type: 'clinic', spots: 20, image: '⚾' })
  }

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Academy" title="Events" subtitle="Showcases, camps, and clinics" action={<Btn onClick={() => setShowAdd(true)}><Plus size={14} /> New Event</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {events.map(ev => {
          const pct = (ev.registered / ev.spots) * 100
          const spotsLeft = ev.spots - ev.registered
          return (
            <Card key={ev.id} highlight={ev.type === 'showcase'}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 36, flexShrink: 0, lineHeight: 1 }}>{ev.image}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{ev.title}</div>
                    <Badge color={typeColor[ev.type]}>{ev.type}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--red)', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 4 }}>{ev.date} · {ev.time}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>📍 {ev.location}</div>
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>{ev.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                    <span style={{ color: 'var(--text3)' }}>{ev.registered} registered</span>
                    <span style={{ color: spotsLeft <= 5 ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>{spotsLeft} spots left</span>
                  </div>
                  <ProgressBar value={ev.registered} max={ev.spots} color={pct >= 90 ? 'var(--red)' : pct >= 60 ? 'var(--amber)' : 'var(--green)'} />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Create New Event">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><Label>Event Title *</Label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Spring Showcase 2025" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Label>Date *</Label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div><Label>Time</Label><input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} /></div>
            <div><Label>Type</Label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {['showcase', 'camp', 'clinic', 'social'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>Max Spots</Label><input type="number" value={form.spots} onChange={e => setForm(p => ({ ...p, spots: +e.target.value }))} /></div>
          </div>
          <div><Label>Location</Label><input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Torque Performance Field" /></div>
          <div><Label>Description</Label><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ minHeight: 80 }} /></div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={handleAdd}><Plus size={14} /> Create Event</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
