import React, { useState } from 'react'
import { Calendar, RotateCcw, X, ChevronRight, Home, BookOpen, CreditCard, Megaphone, User } from 'lucide-react'
import { Card, Badge, Avatar, Btn, Modal, SessionBubble, ProgressBar, Label } from '../../components/UI'
import { useApp } from '../../context/AppContext'
import { PACKAGES, SLOTS, SESSION_TYPES, EVENTS } from '../../data/mockData'

// ── PARENT PORTAL SHELL ──────────────────────────────────────────────────────
export default function ParentPortal({ familyId, onBack }) {
  const [page, setPage] = useState('home')
  const { getFamily } = useApp()
  const family = getFamily(familyId)
  if (!family) return null

  const NAV = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'sessions', label: 'Sessions', icon: BookOpen },
    { id: 'schedule', label: 'Book', icon: Calendar },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'events', label: 'Events', icon: Megaphone },
    { id: 'profile', label: 'Profile', icon: User },
  ]

  const PAGE_MAP = {
    home: <ParentHome family={family} onNav={setPage} />,
    sessions: <ParentSessions family={family} />,
    schedule: <ParentSchedule family={family} />,
    billing: <ParentBilling family={family} />,
    events: <ParentEvents />,
    profile: <ParentProfile family={family} />,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Parent sidebar */}
      <aside style={{ width: 220, background: '#080f18', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, left: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⚾</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>TORQUE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.15em', color: 'var(--red)' }}>PERFORMANCE</div>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(212,160,23,0.08)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Parent Portal</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{family.parent.firstName} {family.parent.lastName}</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = page === id
            return (
              <button key={id} onClick={() => setPage(id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: isActive ? 'rgba(212,160,23,0.1)' : 'transparent',
                color: isActive ? 'var(--gold)' : 'var(--text2)',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.05em', textTransform: 'uppercase',
                marginBottom: 2, transition: 'all 0.15s', textAlign: 'left',
                borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
              }}>
                <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </button>
            )
          })}
        </nav>
        <div style={{ padding: '14px 10px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onBack} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text3)', textAlign: 'left', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
          >← Back to Admin</button>
        </div>
      </aside>
      <main style={{ flex: 1, marginLeft: 220, padding: '36px 40px', minHeight: '100vh' }}>
        <div className="fade-in">{PAGE_MAP[page] || PAGE_MAP.home}</div>
      </main>
    </div>
  )
}

// ── HOME ─────────────────────────────────────────────────────────────────────
function ParentHome({ family, onNav }) {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 4 }}>Welcome back</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800 }}>Hey, {family.parent.firstName}! 👋</h1>
        <p style={{ color: 'var(--text2)', marginTop: 4 }}>Here's the latest for your {family.players.length > 1 ? 'players' : 'player'}.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        {family.players.map(player => {
          const pkg = PACKAGES.find(p => p.id === player.packageId)
          const remaining = player.sessionsTotal - player.sessionsUsed
          const urgency = remaining === 0 ? 'red' : remaining <= 2 ? 'amber' : 'green'
          return (
            <Card key={player.id} style={{ borderColor: remaining === 0 ? 'rgba(200,16,46,0.4)' : 'var(--border)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <Avatar initials={player.name.split(' ').map(n => n[0]).join('')} size={44} color={player.isSibling ? 'var(--gold)' : 'var(--red)'} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800 }}>{player.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Age {player.age} · {pkg?.name}</div>
                  {player.isSibling && <Badge color="gold">Sibling — 50% off</Badge>}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text2)' }}>Sessions this month</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: urgency === 'red' ? 'var(--red)' : urgency === 'amber' ? 'var(--amber)' : 'var(--green)' }}>{remaining} remaining</span>
                </div>
                <SessionBubble used={player.sessionsUsed} total={player.sessionsTotal} />
              </div>
              {remaining === 0 && (
                <div style={{ background: 'var(--red-soft)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#ff4466', marginBottom: 12 }}>
                  ⚠️ All sessions used. Contact us to renew or upgrade your package.
                </div>
              )}
              {player.nextBilling && (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Next charge: <span style={{ color: 'var(--text)' }}>{player.nextBilling}</span></div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Book a Session', icon: '📅', nav: 'schedule', color: 'var(--red)' },
          { label: 'View Sessions', icon: '📊', nav: 'sessions', color: 'var(--gold)' },
          { label: 'Upcoming Events', icon: '⚾', nav: 'events', color: 'var(--blue-light)' },
        ].map(({ label, icon, nav, color }) => (
          <Card key={label} onClick={() => onNav(nav)} style={{ textAlign: 'center', padding: '20px 14px', cursor: 'pointer' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color }}>{label}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── SESSIONS ─────────────────────────────────────────────────────────────────
function ParentSessions({ family }) {
  const { bookings } = useApp()

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Session Tracker</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>Track classes used and remaining for each player.</p>

      {family.players.map(player => {
        const pkg = PACKAGES.find(p => p.id === player.packageId)
        const remaining = player.sessionsTotal - player.sessionsUsed
        const playerBookings = bookings.filter(b => b.playerId === player.id)

        return (
          <Card key={player.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <Avatar initials={player.name.split(' ').map(n => n[0]).join('')} size={44} color={player.isSibling ? 'var(--gold)' : 'var(--red)'} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>{player.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>{pkg?.name} · {pkg?.type === 'monthly' ? 'Resets monthly' : 'Never expires'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: remaining === 0 ? 'var(--red)' : remaining <= 2 ? 'var(--amber)' : 'var(--green)' }}>{remaining}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>sessions left</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Progress ({player.sessionsUsed}/{player.sessionsTotal})</div>
                <SessionBubble used={player.sessionsUsed} total={player.sessionsTotal} />
                <div style={{ marginTop: 10 }}>
                  <ProgressBar value={player.sessionsUsed} max={player.sessionsTotal} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Recent History</div>
                {playerBookings.slice(0, 4).map(b => {
                  const slot = SLOTS.find(s => s.id === b.slotId)
                  const sType = SESSION_TYPES.find(s => s.id === slot?.type)
                  return (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: 'var(--text2)' }}>{sType?.icon} {sType?.name}</span>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text3)' }}>{b.date}</span>
                        <Badge color={b.status === 'attended' ? 'green' : b.status === 'cancelled' ? 'red' : 'blue'} size="sm">{b.status}</Badge>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ── BOOK / RESCHEDULE ────────────────────────────────────────────────────────
function ParentSchedule({ family }) {
  const { bookings, addBooking, cancelBooking } = useApp()
  const [selectedPlayer, setSelectedPlayer] = useState(family.players[0]?.id)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [bookingDate, setBookingDate] = useState('2025-03-26')
  const [success, setSuccess] = useState(null)

  const playerBookings = bookings.filter(b => b.playerId === selectedPlayer && b.status === 'confirmed')
  const sType = id => SESSION_TYPES.find(s => s.id === id)

  const handleBook = () => {
    if (!selectedSlot) return
    addBooking({ playerId: selectedPlayer, slotId: selectedSlot.id, date: bookingDate })
    setSuccess(`Booked ${selectedSlot.day} ${selectedSlot.time}!`)
    setSelectedSlot(null)
    setTimeout(() => setSuccess(null), 3000)
  }

  const DAYS_ORDER = ['Monday', 'Wednesday', 'Friday', 'Saturday']

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Book a Session</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>Choose a slot and date. Reschedule up to 24h before.</p>

      {success && (
        <div className="fade-in" style={{ background: 'var(--green-soft)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--green)', fontWeight: 600, fontSize: 14 }}>
          ✅ {success}
        </div>
      )}

      {/* Select player */}
      {family.players.length > 1 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {family.players.map(p => (
            <button key={p.id} onClick={() => setSelectedPlayer(p.id)} style={{
              padding: '8px 16px', borderRadius: 8, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: selectedPlayer === p.id ? 'var(--red)' : 'var(--navy3)',
              color: selectedPlayer === p.id ? '#fff' : 'var(--text2)',
              border: 'none', transition: 'all 0.15s',
            }}>{p.name.split(' ')[0]}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Slots */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {DAYS_ORDER.map(day => (
              <div key={day}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{day.slice(0, 3)}</div>
                {SLOTS.filter(s => s.day === day).map(slot => {
                  const st = sType(slot.type)
                  const isSelected = selectedSlot?.id === slot.id
                  const alreadyBooked = playerBookings.some(b => b.slotId === slot.id)
                  return (
                    <div key={slot.id} onClick={() => !alreadyBooked && setSelectedSlot(slot)} style={{
                      padding: '10px 12px', borderRadius: 8, marginBottom: 8, cursor: alreadyBooked ? 'default' : 'pointer',
                      border: `1px solid ${isSelected ? st?.color : alreadyBooked ? 'rgba(52,208,113,0.3)' : 'var(--border)'}`,
                      background: isSelected ? `${st?.color}18` : alreadyBooked ? 'var(--green-soft)' : 'var(--navy2)',
                      opacity: alreadyBooked ? 0.7 : 1, transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700 }}>{slot.time}</div>
                      <div style={{ fontSize: 11, color: st?.color, marginTop: 2 }}>{st?.icon} {st?.name}</div>
                      {alreadyBooked && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 3 }}>✓ Booked</div>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Booking panel */}
        <div>
          <Card>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Booking Details</div>
            <div style={{ marginBottom: 14 }}>
              <Label>Date</Label>
              <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
            </div>
            {selectedSlot ? (
              <div style={{ background: 'var(--navy3)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{selectedSlot.day} — {selectedSlot.time}</div>
                <div style={{ fontSize: 12, color: sType(selectedSlot.type)?.color, marginTop: 3 }}>{sType(selectedSlot.type)?.icon} {sType(selectedSlot.type)?.name}</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>← Select a slot</div>
            )}
            <Btn onClick={handleBook} disabled={!selectedSlot} style={{ width: '100%', justifyContent: 'center' }}>
              <Calendar size={14} /> Confirm Booking
            </Btn>
          </Card>

          {/* Upcoming bookings */}
          {playerBookings.length > 0 && (
            <Card style={{ marginTop: 14 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Your Bookings</div>
              {playerBookings.map(b => {
                const slot = SLOTS.find(s => s.id === b.slotId)
                const st = sType(slot?.type)
                return (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{slot?.day} {slot?.time}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.date}</div>
                    </div>
                    <button onClick={() => cancelBooking(b.id)} style={{ color: 'var(--text3)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
                    ><X size={12} /> Cancel</button>
                  </div>
                )
              })}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ── BILLING ──────────────────────────────────────────────────────────────────
function ParentBilling({ family }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Billing & Packages</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>Your current packages and payment details.</p>

      {family.players.map(player => {
        const pkg = PACKAGES.find(p => p.id === player.packageId)
        const price = player.isSibling ? pkg?.siblingPrice : pkg?.price
        return (
          <Card key={player.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <Avatar initials={player.name.split(' ').map(n => n[0]).join('')} size={40} color={player.isSibling ? 'var(--gold)' : 'var(--red)'} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800 }}>{player.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {pkg?.name}
                  {player.isSibling && <span style={{ color: 'var(--gold)', marginLeft: 8 }}>⭐ 50% sibling discount</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>${price?.toLocaleString()}</div>
                {player.isSibling && <div style={{ fontSize: 11, color: 'var(--text3)', textDecoration: 'line-through' }}>${pkg?.price?.toLocaleString()}</div>}
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pkg?.type === 'monthly' ? '/month' : 'one-time'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'Sessions Included', value: `${pkg?.sessions} per ${pkg?.type === 'monthly' ? 'month' : 'pack'}` },
                { label: 'Sessions Left', value: `${player.sessionsTotal - player.sessionsUsed}` },
                { label: 'Auto-Renew', value: family.autoRenew ? '✅ On' : '❌ Off' },
                { label: 'Payment Method', value: family.paymentMethod === 'card' ? '💳 Card' : family.paymentMethod === 'paypal' ? '🅿️ PayPal' : '💵 Cash' },
                ...(player.nextBilling ? [{ label: 'Next Billing Date', value: player.nextBilling }] : [{ label: 'Pack Type', value: 'No expiration' }]),
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--navy3)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>
        )
      })}

      {/* All packages */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 14, marginTop: 28 }}>Available Packages</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {PACKAGES.map(pkg => (
          <Card key={pkg.id} highlight={pkg.popular} style={{ borderColor: pkg.popular ? pkg.color : 'var(--border)' }}>
            {pkg.popular && <div style={{ marginBottom: 10 }}><Badge color="gold">Most Popular</Badge></div>}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{pkg.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>{pkg.description}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: pkg.color }}>${pkg.price.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{pkg.type === 'monthly' ? '/month' : 'one-time'} · Sibling: ${pkg.siblingPrice.toLocaleString()}</div>
            </div>
            {pkg.features.map(f => (
              <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                <span style={{ color: pkg.color }}>✓</span> {f}
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── EVENTS ───────────────────────────────────────────────────────────────────
function ParentEvents() {
  const [registered, setRegistered] = useState([])
  const [events, setEvents] = useState(EVENTS)
  const typeColor = { showcase: 'red', camp: 'gold', clinic: 'blue', social: 'green' }

  const register = (id) => {
    if (registered.includes(id)) return
    setRegistered(prev => [...prev, id])
    setEvents(prev => prev.map(e => e.id === id ? { ...e, registered: e.registered + 1 } : e))
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Upcoming Events</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>Showcases, camps, and clinics at Torque Performance.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {events.map(ev => {
          const isReg = registered.includes(ev.id)
          const full = ev.registered >= ev.spots
          return (
            <Card key={ev.id}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 40, flexShrink: 0, lineHeight: 1 }}>{ev.image}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>{ev.title}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge color={typeColor[ev.type]}>{ev.type}</Badge>
                      {isReg && <Badge color="green">Registered</Badge>}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--red)', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 4 }}>{ev.date} · {ev.time}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>📍 {ev.location}</div>
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>{ev.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {ev.spots - ev.registered} spots available of {ev.spots}
                    </div>
                    <Btn
                      variant={isReg ? 'success' : full ? 'ghost' : 'primary'}
                      size="sm"
                      disabled={full && !isReg}
                      onClick={() => register(ev.id)}
                    >
                      {isReg ? '✓ Registered' : full ? 'Full' : 'Register Now'}
                    </Btn>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── PROFILE ──────────────────────────────────────────────────────────────────
function ParentProfile({ family }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...family.parent })

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Profile</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>Your family account and contact information.</p>

      <Card style={{ maxWidth: 560, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>Parent / Guardian</div>
          <Btn variant="ghost" size="sm" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</Btn>
        </div>
        {editing ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Label>First Name</Label><input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} /></div>
            <div><Label>Last Name</Label><input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1' }}><Label>Email</Label><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1' }}><Label>Phone</Label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={() => setEditing(false)}>Save Changes</Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'First Name', value: form.firstName },
              { label: 'Last Name', value: form.lastName },
              { label: 'Email', value: form.email },
              { label: 'Phone', value: form.phone },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--navy3)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14 }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Players */}
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginBottom: 14 }}>Players</div>
      {family.players.map(player => (
        <Card key={player.id} style={{ maxWidth: 560, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Avatar initials={player.name.split(' ').map(n => n[0]).join('')} size={44} color={player.isSibling ? 'var(--gold)' : 'var(--red)'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800 }}>{player.name}
                {player.isSibling && <span style={{ marginLeft: 8 }}><Badge color="gold">Sibling</Badge></span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Age {player.age} · DOB {player.dob}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
