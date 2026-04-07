import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'
import { Users, Calendar, DollarSign, TrendingUp } from 'lucide-react'
import { StatCard, Card, Badge, Avatar, PageHeader, SessionBubble, ProgressBar } from '../../components/UI'
import { useApp } from '../../context/AppContext'
import { SLOTS, SESSION_TYPES, PACKAGES } from '../../data/mockData'

const REVENUE_DATA = [
  { month: 'Oct', revenue: 42000 }, { month: 'Nov', revenue: 48000 },
  { month: 'Dec', revenue: 38000 }, { month: 'Jan', revenue: 52000 },
  { month: 'Feb', revenue: 49000 }, { month: 'Mar', revenue: 56000 },
]

const ATTEND_DATA = [
  { day: 'Mon', sessions: 18 }, { day: 'Wed', sessions: 24 },
  { day: 'Fri', sessions: 16 }, { day: 'Sat', sessions: 31 },
]

const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--navy3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {typeof p.value === 'number' && p.name === 'revenue' ? `$${p.value.toLocaleString()}` : p.value}</div>)}
    </div>
  )
}

export default function AdminDashboard() {
  const { families, bookings, getAllPlayers } = useApp()
  const allPlayers = getAllPlayers()
  const activeCount = allPlayers.filter(p => p.status === 'active').length
  const expiringCount = allPlayers.filter(p => p.status === 'expiring').length
  const todayBookings = bookings.filter(b => b.date === '2025-03-24' && b.status === 'confirmed').length
  const siblings = allPlayers.filter(p => p.isSibling).length

  const pkgDist = PACKAGES.map(pkg => ({
    name: pkg.name,
    count: allPlayers.filter(p => p.packageId === pkg.id).length,
    color: pkg.color,
  }))

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Torque Performance" title="Command Center" subtitle="Overview of all academy operations" />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Active Players" value={activeCount} sub="enrolled athletes" trend={12} icon="⚾" />
        <StatCard label="Today's Sessions" value={todayBookings} sub="confirmed bookings" icon="📅" />
        <StatCard label="Monthly Revenue" value="$56,000" sub="vs $49k last month" trend={14} icon="💰" />
        <StatCard label="Expiring Soon" value={expiringCount} sub="need renewal" icon="⚠️" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginBottom: 24 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>Monthly Revenue</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Last 6 months</div>
            </div>
            <Badge color="green">+14% MoM</Badge>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={REVENUE_DATA} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#4a5a70', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4a5a70', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}k`} />
              <Tooltip content={<CT />} />
              <Bar dataKey="revenue" fill="rgba(255,255,255,0.7)" radius={[4, 4, 0, 0]} opacity={0.9} name="revenue" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Weekly Attendance</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Sessions per day average</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={ATTEND_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill: '#4a5a70', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4a5a70', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CT />} />
              <Line type="monotone" dataKey="sessions" stroke="var(--gold)" strokeWidth={2.5} dot={{ fill: 'var(--gold)', r: 4 }} name="sessions" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bottom: Players needing attention + Package breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Players — Session Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {allPlayers.slice(0, 6).map(player => {
              const remaining = player.sessionsTotal - player.sessionsUsed
              return (
                <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar initials={player.name.split(' ').map(n => n[0]).join('')} size={32} color={remaining === 0 ? 'var(--text3)' : remaining <= 2 ? 'var(--amber)' : 'var(--navy4)'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
                      <span style={{ fontSize: 12, color: remaining === 0 ? '#ff4466' : 'var(--text2)', flexShrink: 0, marginLeft: 8 }}>{remaining} left</span>
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <ProgressBar value={player.sessionsUsed} max={player.sessionsTotal} color={remaining === 0 ? 'var(--red)' : remaining <= 2 ? 'var(--amber)' : 'var(--green)'} />
                    </div>
                  </div>
                  {player.isSibling && <Badge color="gold">Sibling</Badge>}
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Package Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pkgDist.map(pkg => (
              <div key={pkg.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text2)' }}>{pkg.name}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: pkg.color }}>{pkg.count} players</span>
                </div>
                <div style={{ height: 6, background: 'var(--navy4)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(pkg.count / allPlayers.length) * 100}%`, background: pkg.color, borderRadius: 6 }} />
                </div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text3)' }}>Sibling discount active</span>
              <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{siblings} players (50% off)</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
