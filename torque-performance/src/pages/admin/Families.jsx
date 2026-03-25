import React, { useState } from 'react'
import { Plus, ChevronDown, ChevronRight, Search, Users } from 'lucide-react'
import { Card, Badge, Avatar, PageHeader, Btn, Modal, Label, SessionBubble, ProgressBar } from '../../components/UI'
import { useApp } from '../../context/AppContext'
import { PACKAGES } from '../../data/mockData'

const statusColor = { active: 'green', expiring: 'amber', inactive: 'red' }
const paymentIcon = { card: '💳', paypal: '🅿️', cash: '💵' }

export default function Families() {
  const { families, addFamily, updatePlayer } = useApp()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [form, setForm] = useState({
    parentFirst: '', parentLast: '', email: '', phone: '',
    playerName: '', playerAge: '', playerDob: '',
    packageId: 'pkg-monthly-8', paymentMethod: 'card', autoRenew: true,
    addSibling: false,
    siblingName: '', siblingAge: '', siblingDob: '',
  })

  const filtered = families.filter(f =>
    `${f.parent.firstName} ${f.parent.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    f.players.some(p => p.name.toLowerCase().includes(search.toLowerCase())) ||
    f.parent.email.includes(search)
  )

  const toggleFamily = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const handleAdd = () => {
    if (!form.parentFirst || !form.playerName) return
    const pkg = PACKAGES.find(p => p.id === form.packageId)
    const players = [{
      id: `p${Date.now()}`, name: form.playerName,
      age: parseInt(form.playerAge) || 10, dob: form.playerDob,
      packageId: form.packageId, sessionsUsed: 0, sessionsTotal: pkg?.sessions || 8,
      nextBilling: form.autoRenew ? '2025-05-01' : null, status: 'active',
    }]
    if (form.addSibling && form.siblingName) {
      players.push({
        id: `p${Date.now() + 1}`, name: form.siblingName,
        age: parseInt(form.siblingAge) || 8, dob: form.siblingDob,
        packageId: form.packageId, sessionsUsed: 0, sessionsTotal: pkg?.sessions || 8,
        nextBilling: form.autoRenew ? '2025-05-01' : null, status: 'active', isSibling: true,
      })
    }
    addFamily({
      parent: { firstName: form.parentFirst, lastName: form.parentLast, email: form.email, phone: form.phone },
      players, paymentMethod: form.paymentMethod, autoRenew: form.autoRenew,
    })
    setShowAdd(false)
    setForm({ parentFirst: '', parentLast: '', email: '', phone: '', playerName: '', playerAge: '', playerDob: '', packageId: 'pkg-monthly-8', paymentMethod: 'card', autoRenew: true, addSibling: false, siblingName: '', siblingAge: '', siblingDob: '' })
  }

  const allPlayers = families.flatMap(f => f.players)
  const activePlayers = allPlayers.filter(p => p.status === 'active' || p.status === 'expiring')

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Academy"
        title="Families & Players"
        subtitle={`${families.length} families · ${activePlayers.length} active players`}
        action={<Btn onClick={() => setShowAdd(true)}><Plus size={14} /> New Family</Btn>}
      />

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by parent name, player name, or email..." style={{ paddingLeft: 40 }} />
      </div>

      {/* Family cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(family => {
          const isOpen = expanded[family.id]
          return (
            <Card key={family.id} style={{ padding: 0, overflow: 'hidden' }}>
              {/* Family header */}
              <div
                onClick={() => toggleFamily(family.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar initials={`${family.parent.firstName[0]}${family.parent.lastName[0]}`} size={42} color="var(--navy4)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800 }}>
                    {family.parent.firstName} {family.parent.lastName}
                    <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text3)', marginLeft: 10 }}>{paymentIcon[family.paymentMethod]}</span>
                    {family.autoRenew && <span style={{ marginLeft: 8 }}><Badge color="green">Auto-Pay</Badge></span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{family.parent.email} · {family.parent.phone}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {family.players.map(p => (
                    <Badge key={p.id} color={statusColor[p.status]}>{p.name.split(' ')[0]}</Badge>
                  ))}
                  <Badge color="default">{family.players.length} {family.players.length === 1 ? 'player' : 'players'}</Badge>
                  {isOpen ? <ChevronDown size={16} color="var(--text3)" /> : <ChevronRight size={16} color="var(--text3)" />}
                </div>
              </div>

              {/* Players detail */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                  {family.players.map((player, idx) => {
                    const pkg = PACKAGES.find(p => p.id === player.packageId)
                    const remaining = player.sessionsTotal - player.sessionsUsed
                    return (
                      <div key={player.id} style={{
                        padding: '16px 24px',
                        borderBottom: idx < family.players.length - 1 ? '1px solid var(--border)' : 'none',
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                        gap: 20, alignItems: 'center',
                      }}>
                        {/* Player info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar initials={player.name.split(' ').map(n => n[0]).join('')} size={36} color={player.isSibling ? 'var(--gold)' : 'var(--red)'} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{player.name}
                              {player.isSibling && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gold)' }}>⭐ 50% off</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Age {player.age} · DOB {player.dob}</div>
                          </div>
                        </div>

                        {/* Package */}
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 3 }}>Package</div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: pkg?.color }}>{pkg?.name}</div>
                          {player.nextBilling && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Next billing: {player.nextBilling}</div>}
                        </div>

                        {/* Sessions */}
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Sessions: {player.sessionsUsed}/{player.sessionsTotal} used · <span style={{ color: remaining <= 2 ? 'var(--amber)' : 'var(--green)' }}>{remaining} left</span></div>
                          <SessionBubble used={player.sessionsUsed} total={player.sessionsTotal} />
                        </div>

                        <Btn size="sm" variant="navy" onClick={() => setSelectedPlayer({ ...player, family })}>View</Btn>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Player detail modal */}
      <Modal open={!!selectedPlayer} onClose={() => setSelectedPlayer(null)} title="Player Profile" width={480}>
        {selectedPlayer && (() => {
          const pkg = PACKAGES.find(p => p.id === selectedPlayer.packageId)
          const remaining = selectedPlayer.sessionsTotal - selectedPlayer.sessionsUsed
          return (
            <div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                <Avatar initials={selectedPlayer.name.split(' ').map(n => n[0]).join('')} size={52} color={selectedPlayer.isSibling ? 'var(--gold)' : 'var(--red)'} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>{selectedPlayer.name}</div>
                  <div style={{ color: 'var(--text2)', fontSize: 13 }}>Parent: {selectedPlayer.family.parent.firstName} {selectedPlayer.family.parent.lastName}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                    <Badge color={statusColor[selectedPlayer.status]}>{selectedPlayer.status}</Badge>
                    {selectedPlayer.isSibling && <Badge color="gold">Sibling 50% off</Badge>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Age', value: `${selectedPlayer.age} years old` },
                  { label: 'Date of Birth', value: selectedPlayer.dob },
                  { label: 'Package', value: pkg?.name, color: pkg?.color },
                  { label: 'Package Price', value: `$${selectedPlayer.isSibling ? pkg?.siblingPrice?.toLocaleString() : pkg?.price?.toLocaleString()}/mo` },
                  { label: 'Sessions Used', value: `${selectedPlayer.sessionsUsed} of ${selectedPlayer.sessionsTotal}` },
                  { label: 'Sessions Left', value: `${remaining}`, color: remaining <= 2 ? 'var(--amber)' : 'var(--green)' },
                  ...(selectedPlayer.nextBilling ? [{ label: 'Next Billing', value: selectedPlayer.nextBilling }] : []),
                  { label: 'Payment Method', value: `${paymentIcon[selectedPlayer.family.paymentMethod]} ${selectedPlayer.family.paymentMethod}` },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'var(--navy3)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: color || 'var(--text)' }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Session Progress</div>
                <ProgressBar value={selectedPlayer.sessionsUsed} max={selectedPlayer.sessionsTotal} />
              </div>
              <Btn variant="ghost" onClick={() => setSelectedPlayer(null)} style={{ width: '100%', justifyContent: 'center' }}>Close</Btn>
            </div>
          )
        })()}
      </Modal>

      {/* Add Family Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Register New Family" width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Parent / Guardian Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Label>First Name *</Label><input value={form.parentFirst} onChange={e => setForm(p => ({ ...p, parentFirst: e.target.value }))} placeholder="Michael" /></div>
              <div><Label>Last Name *</Label><input value={form.parentLast} onChange={e => setForm(p => ({ ...p, parentLast: e.target.value }))} placeholder="Johnson" /></div>
              <div><Label>Email</Label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="michael@email.com" /></div>
              <div><Label>Phone</Label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="614-555-0000" /></div>
            </div>
          </div>

          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Player Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}><Label>Player Full Name *</Label><input value={form.playerName} onChange={e => setForm(p => ({ ...p, playerName: e.target.value }))} placeholder="Tyler Johnson" /></div>
              <div><Label>Age</Label><input type="number" value={form.playerAge} onChange={e => setForm(p => ({ ...p, playerAge: e.target.value }))} placeholder="10" /></div>
              <div style={{ gridColumn: '2/-1' }}><Label>Date of Birth</Label><input type="date" value={form.playerDob} onChange={e => setForm(p => ({ ...p, playerDob: e.target.value }))} /></div>
            </div>
          </div>

          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Package & Payment</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <Label>Package</Label>
                <select value={form.packageId} onChange={e => setForm(p => ({ ...p, packageId: e.target.value }))}>
                  {PACKAGES.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price.toLocaleString()}/mo</option>)}
                </select>
              </div>
              <div><Label>Payment Method</Label>
                <select value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}>
                  <option value="card">💳 Credit/Debit Card</option>
                  <option value="paypal">🅿️ PayPal</option>
                  <option value="cash">💵 Cash</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="autorenew" checked={form.autoRenew} onChange={e => setForm(p => ({ ...p, autoRenew: e.target.checked }))} style={{ width: 'auto' }} />
                <label htmlFor="autorenew" style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>Enable Auto-Pay</label>
              </div>
            </div>
          </div>

          {/* Sibling */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: form.addSibling ? 12 : 0 }}>
              <input type="checkbox" id="sibling" checked={form.addSibling} onChange={e => setForm(p => ({ ...p, addSibling: e.target.checked }))} style={{ width: 'auto' }} />
              <label htmlFor="sibling" style={{ fontSize: 13, cursor: 'pointer' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 600 }}>⭐ Add sibling (50% discount)</span>
              </label>
            </div>
            {form.addSibling && (
              <div style={{ background: 'var(--gold-soft)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div style={{ gridColumn: '1/-1' }}><Label>Sibling Full Name</Label><input value={form.siblingName} onChange={e => setForm(p => ({ ...p, siblingName: e.target.value }))} placeholder="Lucas Johnson" /></div>
                  <div><Label>Age</Label><input type="number" value={form.siblingAge} onChange={e => setForm(p => ({ ...p, siblingAge: e.target.value }))} /></div>
                  <div style={{ gridColumn: '2/-1' }}><Label>Date of Birth</Label><input type="date" value={form.siblingDob} onChange={e => setForm(p => ({ ...p, siblingDob: e.target.value }))} /></div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 8 }}>
                  ⭐ Sibling price: ${PACKAGES.find(p => p.id === form.packageId)?.siblingPrice?.toLocaleString()}/mo (50% off)
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={handleAdd}><Plus size={14} /> Register Family</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
