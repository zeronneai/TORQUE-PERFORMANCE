import React, { useState, useEffect, useRef } from 'react'
import { useSession } from '@clerk/clerk-react'
import { ShoppingBag, Plus, Minus, X, ImageOff } from 'lucide-react'
import { Card, Btn, Modal, Pill } from '../../components/UI'
import { API_BASE } from '../../lib/apiBase'

// Torque Shop inside the parent portal. Same store, stock and checkout as torquebaseball.us/shop
// (website api/shop.js). Card payments with GoDaddy Payments (Poynt Collect); or pay at pickup.
// "My orders" comes from api/player-card.js (my_orders), matched by the parent's account emails.
const SHOP_API = import.meta.env.VITE_SHOP_API || 'https://www.torquebaseball.us/api/shop'
const money = (c) => `$${((c || 0) / 100).toFixed(2)}`
const CART_KEY = 'torque_app_cart_v1'
const STATUS = { new: ['Received', '#219EBC'], ready: ['Ready for pickup', '#FFB703'], picked_up: ['Picked up', '#06D6A0'], shipped: ['Shipped', '#06D6A0'], canceled: ['Canceled', '#5A6B84'] }
const input = { width: '100%', padding: '11px 12px', background: 'var(--navy4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 15, boxSizing: 'border-box' }
const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text2)', margin: '16px 0 8px' }

const readCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') || [] } catch { return [] } }
const writeCart = (c) => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)) } catch {} }

function loadSdk(src) {
  return new Promise((ok, bad) => {
    if (window.TokenizeJs) return ok()
    const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = () => bad(new Error('sdk'))
    document.head.appendChild(s)
  })
}

export default function ShopPage({ user, profile }) {
  const { session } = useSession()
  const [D, setD] = useState(null)               // { open, products, settings, poynt }
  const [err, setErr] = useState(null)
  const [cart, setCart] = useState(readCart)
  const [view, setView] = useState(null)         // product open
  const [checkout, setCheckout] = useState(false)
  const [done, setDone] = useState(null)
  const [orders, setOrders] = useState([])

  async function loadStore() {
    try { const r = await fetch(SHOP_API); if (!r.ok) throw new Error(); setD(await r.json()) }
    catch { setErr('The shop could not load. Pull to refresh or try again in a moment.') }
  }
  async function loadOrders() {
    try {
      const token = await session?.getToken()
      const r = await fetch(`${API_BASE}/api/player-card`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'my_orders' }) })
      const d = await r.json(); setOrders(d.orders || [])
    } catch {}
  }
  useEffect(() => { loadStore() }, [])
  useEffect(() => { if (session) loadOrders() }, [session])
  useEffect(() => { writeCart(cart) }, [cart])

  const prod = (id) => D?.products?.find(p => p.id === id)
  const liveCart = D ? cart.filter(l => prod(l.product_id)) : cart
  const count = liveCart.reduce((a, l) => a + l.qty, 0)
  const stockOf = (p, v) => { if (!p.track_stock) return Infinity; const x = (p.variants || []).find(y => y.label === v); return x && x.stock != null ? x.stock : Infinity }
  const inCart = (pid, v) => cart.filter(l => l.product_id === pid && l.variant === v).reduce((a, l) => a + l.qty, 0)
  const soldOut = (p) => p.track_stock && (p.variants || []).length > 0 && p.variants.every(v => v.stock != null && v.stock <= 0)

  function add(p, variant, qty) {
    setCart(c => {
      const ex = c.find(l => l.product_id === p.id && l.variant === variant)
      return ex ? c.map(l => l === ex ? { ...l, qty: Math.min(20, l.qty + qty) } : l) : [...c, { product_id: p.id, variant, qty }]
    })
    setView(null); setCheckout(true)
  }

  if (err && !D) return <div className="animate-fade-up"><Header /><div style={{ color: 'var(--text2)', padding: '40px 0' }}>{err}</div></div>
  if (!D) return <div className="animate-fade-up"><Header /><div style={{ color: 'var(--text2)', padding: '40px 0', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Loading shop...</div></div>

  const openOrders = orders.filter(o => !['picked_up', 'shipped', 'canceled'].includes(o.status))

  return (
    <div className="animate-fade-up" style={{ paddingBottom: 90 }}>
      <Header />

      {openOrders.length > 0 && (
        <Card style={{ marginBottom: 18, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Your orders</div>
          {openOrders.map(o => (
            <div key={o.order_number} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <b style={{ width: 56 }}>#{o.order_number}</b>
              <span style={{ flex: '1 1 160px', fontSize: 13, color: 'var(--text2)' }}>{(o.items || []).map(i => `${i.qty}x ${i.name}${i.variant && i.variant !== 'One size' ? ` (${i.variant})` : ''}`).join(', ')}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{money(o.total_cents)}</span>
              <Pill color={o.payment_status === 'paid' ? '#06D6A0' : '#FFB703'}>{o.payment_status === 'paid' ? 'Paid' : 'Pay at pickup'}</Pill>
              <Pill color={STATUS[o.status]?.[1]} solid={o.status === 'ready'}>{STATUS[o.status]?.[0] || o.status}</Pill>
            </div>
          ))}
        </Card>
      )}

      {!D.open ? (
        <Card><div style={{ textAlign: 'center', padding: 30, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18 }}>The Torque Shop opens soon.</div></Card>
      ) : !D.products.length ? (
        <Card><div style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>New merch is on the way. Check back soon.</div></Card>
      ) : (
        <>
          {D.settings.pickup_enabled && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>{D.settings.pickup_note}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(46%, 210px), 1fr))', gap: 12 }}>
            {D.products.map(p => (
              <button key={p.id} onClick={() => setView(p)} style={{ textAlign: 'left', background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', padding: 0, color: 'inherit' }}>
                <div style={{ aspectRatio: '1', background: 'var(--navy4)', backgroundImage: p.photos?.[0] ? `url(${p.photos[0]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
                  {!p.photos?.[0] && <ImageOff size={22} />}
                  {soldOut(p) && <span style={{ position: 'absolute', top: 8, left: 8, background: '#E63946', color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', padding: '3px 7px', borderRadius: 4 }}>SOLD OUT</span>}
                </div>
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{p.name}</div>
                  <div style={{ marginTop: 3, fontWeight: 600, color: 'var(--text2)' }}>{money(p.price_cents)}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {count > 0 && !checkout && (
        <button onClick={() => setCheckout(true)} style={{ position: 'fixed', right: 18, bottom: 'calc(18px + env(safe-area-inset-bottom))', zIndex: 50, display: 'flex', alignItems: 'center', gap: 8, padding: '13px 18px', borderRadius: 999, background: 'var(--ink)', color: '#fff', fontWeight: 700, boxShadow: '0 10px 30px rgba(13,27,42,.3)' }}>
          <ShoppingBag size={18} /> Cart <span style={{ background: '#fff', color: 'var(--ink)', borderRadius: 999, minWidth: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{count}</span>
        </button>
      )}

      {view && <ProductSheet p={view} onClose={() => setView(null)} onAdd={add} stockOf={stockOf} inCart={inCart} />}
      {checkout && (
        <Checkout D={D} cart={liveCart} setCart={setCart} prod={prod} user={user} profile={profile}
          onClose={() => setCheckout(false)}
          onDone={(o) => { setCart([]); setCheckout(false); setDone(o); loadStore(); loadOrders() }}
          onStale={loadStore} />
      )}
      <Modal open={!!done} onClose={() => setDone(null)} title="Order received" width={420}>
        {done && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontStyle: 'italic', margin: '4px 0 10px' }}>#{done.number}</div>
            <p style={{ marginBottom: 8 }}>{done.payment_status === 'paid' ? `Paid ${money(done.total_cents)}. A receipt is on its way to your email.` : `Total ${money(done.total_cents)}, you pay when you pick up.`}</p>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>We will let you know when it is ready. You can follow it here in Shop.</p>
            <Btn onClick={() => setDone(null)} style={{ width: '100%', justifyContent: 'center' }}>Done</Btn>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Header() {
  return (<><div className="section-eyebrow">Torque Merch</div><h1 className="section-title">SHOP</h1><div className="section-bar" /></>)
}

function ProductSheet({ p, onClose, onAdd, stockOf, inCart }) {
  const vs = p.variants || [], photos = p.photos || []
  const firstOk = vs.find(v => stockOf(p, v.label) - inCart(p.id, v.label) > 0)?.label || null
  const [sel, setSel] = useState(vs.length === 1 ? vs[0].label : firstOk)
  const [qty, setQty] = useState(1)
  const [photo, setPhoto] = useState(0)
  const left = vs.length ? (sel ? stockOf(p, sel) - inCart(p.id, sel) : 0) : stockOf(p, null) - inCart(p.id, null)
  const showSizes = vs.length > 1 || (vs.length === 1 && vs[0].label !== 'One size')
  return (
    <Modal open onClose={onClose} title={p.name} width={520}>
      <div style={{ aspectRatio: '1', maxHeight: 360, width: '100%', borderRadius: 10, background: 'var(--navy4)', backgroundImage: photos[photo] ? `url(${photos[photo]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {photos.map((u, i) => <button key={u} onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`} style={{ width: 48, height: 48, borderRadius: 6, background: `url(${u}) center/cover`, border: i === photo ? '2px solid var(--ink)' : '1px solid var(--border)' }} />)}
        </div>
      )}
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>{money(p.price_cents)}</div>
      {p.description && <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 6, whiteSpace: 'pre-line' }}>{p.description}</p>}
      {showSizes && (
        <>
          <div style={lbl}>Size</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {vs.map(v => {
              const out = stockOf(p, v.label) - inCart(p.id, v.label) <= 0
              const on = sel === v.label
              return <button key={v.label} disabled={out} onClick={() => { setSel(v.label); setQty(1) }} style={{ minWidth: 52, padding: '10px 12px', borderRadius: 8, fontWeight: 700, border: on ? '2px solid var(--ink)' : '1px solid var(--border)', background: on ? 'var(--navy4)' : 'transparent', opacity: out ? .35 : 1, textDecoration: out ? 'line-through' : 'none' }}>{v.label}</button>
            })}
          </div>
        </>
      )}
      <div style={lbl}>Quantity</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8 }}>
          <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Less"><Minus size={16} /></button>
          <span style={{ minWidth: 30, textAlign: 'center', fontWeight: 700 }}>{qty}</span>
          <button onClick={() => setQty(q => Math.min(20, q + 1, left > 0 ? left : 1))} style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="More"><Plus size={16} /></button>
        </div>
        {isFinite(left) && left > 0 && left <= 5 && <span style={{ fontSize: 13, color: 'var(--text2)' }}>Only {left} left</span>}
      </div>
      <Btn disabled={left <= 0 || (vs.length && !sel)} onClick={() => onAdd(p, vs.length ? sel : null, qty)} style={{ width: '100%', justifyContent: 'center', marginTop: 20 }} size="lg">
        {left <= 0 ? 'Sold out' : 'Add to cart'}
      </Btn>
    </Modal>
  )
}

function Checkout({ D, cart, setCart, prod, user, profile, onClose, onDone, onStale }) {
  const S = D.settings
  const [f, setF] = useState({
    name: profile?.full_name || user?.fullName || '',
    email: user?.primaryEmailAddress?.emailAddress || '',
    phone: profile?.phone || user?.primaryPhoneNumber?.phoneNumber || '',
    fulfillment: S.pickup_enabled ? 'pickup' : 'ship',
    payment: S.pay_online ? 'online' : 'pickup',
    line1: '', line2: '', city: '', state: 'TX', zip: '',
  })
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [cardReady, setCardReady] = useState(false)
  const collect = useRef(null)
  const fRef = useRef(f); fRef.current = f
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }))

  const sub = cart.reduce((a, l) => a + (prod(l.product_id)?.price_cents || 0) * l.qty, 0)
  const tax = Math.round(sub * (S.tax_percent || 0) / 100)
  const ship = f.fulfillment === 'ship' ? (S.shipping_cents || 0) : 0
  const total = sub + tax + ship
  const totalRef = useRef(total); totalRef.current = total

  // Mount the GoDaddy card form when "Pay now with card" is chosen.
  useEffect(() => {
    if (f.payment !== 'online' || !D.poynt || !cart.length) return
    let gone = false
    setCardReady(false)
    loadSdk(D.poynt.sdk).then(() => {
      if (gone || !document.getElementById('app-card-element')) return
      const c = new window.TokenizeJs(D.poynt.businessId, D.poynt.applicationId)
      collect.current = c
      c.mount('app-card-element', document, {
        iFrame: { width: '100%', height: '220px', border: '0px', borderRadius: '8px' },
        displayComponents: { labels: true, paymentLabel: false, zipCode: true },
        style: { theme: 'ecommerce' }, locale: 'en-US', inlineErrors: true,
      })
      c.on('ready', () => setCardReady(true))
      c.on('iframe_height_change', (ev) => { const h = ev?.data?.height; const fr = document.querySelector('#app-card-element iframe'); if (h && fr) fr.style.height = h + 'px' })
      c.on('error', (ev) => { setSending(false); setMsg(ev?.data?.error?.message || ev?.data?.message || 'Check the card details.') })
      c.on('nonce', (ev) => submit(ev?.data?.nonce))
    }).catch(() => setMsg('Card payments could not load. Choose pay at pickup or try again.'))
    return () => { gone = true; try { collect.current?.unmount('app-card-element', document) } catch {} collect.current = null }
  }, [f.payment, cart.length])

  async function submit(nonce) {
    const x = fRef.current
    try {
      const r = await fetch(SHOP_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart, customer: { name: x.name, email: x.email, phone: x.phone }, fulfillment: x.fulfillment,
          address: x.fulfillment === 'ship' ? { line1: x.line1, line2: x.line2, city: x.city, state: x.state, zip: x.zip } : null,
          payment: x.payment, nonce, expected_total: totalRef.current,
        }),
      })
      const d = await r.json().catch(() => ({}))
      setSending(false)
      if (!r.ok) { setMsg(d.error || 'Something went wrong.'); if (/sold out|no longer|changed/i.test(d.error || '')) onStale(); return }
      onDone(d.order)
    } catch { setSending(false); setMsg('We could not confirm your order. Check your email for a receipt before trying again.') }
  }

  function place() {
    if (sending) return
    if (!f.name.trim()) return setMsg('Add your name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return setMsg('Add a valid email.')
    if (!f.phone.trim()) return setMsg('Add a phone number so we can reach you.')
    if (f.fulfillment === 'ship' && (!f.line1 || !f.city || !f.state || !f.zip)) return setMsg('Complete the shipping address.')
    setMsg(''); setSending(true)
    if (f.payment === 'online') {
      if (!collect.current || !cardReady) { setSending(false); return setMsg('The card form is still loading. One second.') }
      const parts = f.name.trim().split(/\s+/)
      collect.current.getNonce({ firstName: parts[0], lastName: parts.slice(1).join(' ') || parts[0], emailAddress: f.email.trim(), phone: f.phone.trim() })
    } else submit(null)
  }

  const Opt = ({ k, v, title, sub }) => (
    <button type="button" onClick={() => setF(x => ({ ...x, [k]: v }))} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: 12, borderRadius: 10, marginBottom: 8, border: f[k] === v ? '2px solid var(--ink)' : '1px solid var(--border)', background: f[k] === v ? 'var(--navy4)' : 'transparent' }}>
      <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2, border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f[k] === v && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink)' }} />}</span>
      <span><b style={{ fontSize: 14 }}>{title}</b>{sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{sub}</span>}</span>
    </button>
  )

  return (
    <Modal open onClose={() => !sending && onClose()} title="Your cart" width={520}>
      {!cart.length ? (
        <div><p style={{ color: 'var(--text2)', marginBottom: 14 }}>Your cart is empty.</p><Btn variant="ghost" onClick={onClose}>Keep shopping</Btn></div>
      ) : (
        <div>
          {cart.map((l, i) => {
            const p = prod(l.product_id)
            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 8, flexShrink: 0, background: 'var(--navy4)', backgroundImage: p.photos?.[0] ? `url(${p.photos[0]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}{l.variant && l.variant !== 'One size' ? <span style={{ fontWeight: 400, color: 'var(--text2)' }}> {l.variant}</span> : null}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{l.qty} x {money(p.price_cents)}</div>
                </div>
                <b style={{ fontSize: 14 }}>{money(p.price_cents * l.qty)}</b>
                <button onClick={() => setCart(c => c.filter((_, j) => j !== i))} aria-label="Remove" style={{ color: 'var(--text2)' }}><X size={16} /></button>
              </div>
            )
          })}
          <div style={{ marginTop: 10, fontSize: 14 }}>
            <Line k="Subtotal" v={money(sub)} />
            {tax > 0 && <Line k="Sales tax" v={money(tax)} />}
            {ship > 0 && <Line k="Shipping" v={money(ship)} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 8 }}><span>Total</span><span>{money(total)}</span></div>
          </div>

          <div style={lbl}>Your info</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <input style={input} value={f.name} onChange={set('name')} placeholder="Full name" autoComplete="name" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              <input style={input} type="email" value={f.email} onChange={set('email')} placeholder="Email" autoComplete="email" />
              <input style={input} type="tel" value={f.phone} onChange={set('phone')} placeholder="Phone" autoComplete="tel" />
            </div>
          </div>

          {S.pickup_enabled && S.shipping_enabled ? (
            <><div style={lbl}>Delivery</div><Opt k="fulfillment" v="pickup" title="Pick up at the academy" sub={S.pickup_note} /><Opt k="fulfillment" v="ship" title="Ship to me" sub={`${money(S.shipping_cents)} flat rate`} /></>
          ) : <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 12 }}>{f.fulfillment === 'pickup' ? S.pickup_note : `Shipping ${money(S.shipping_cents)} flat rate.`}</p>}
          {f.fulfillment === 'ship' && (
            <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
              <input style={input} value={f.line1} onChange={set('line1')} placeholder="Street address" autoComplete="address-line1" />
              <input style={input} value={f.line2} onChange={set('line2')} placeholder="Apt, suite (optional)" autoComplete="address-line2" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px', gap: 8 }}>
                <input style={input} value={f.city} onChange={set('city')} placeholder="City" autoComplete="address-level2" />
                <input style={input} value={f.state} onChange={set('state')} placeholder="State" autoComplete="address-level1" />
                <input style={input} value={f.zip} onChange={set('zip')} placeholder="ZIP" inputMode="numeric" autoComplete="postal-code" />
              </div>
            </div>
          )}

          <div style={lbl}>Payment</div>
          {S.pay_online && <Opt k="payment" v="online" title="Pay now with card" sub="Secure payment by GoDaddy Payments." />}
          {S.pay_pickup && <Opt k="payment" v="pickup" title="Pay at pickup" sub={f.fulfillment === 'ship' ? 'We will contact you to collect payment before shipping.' : 'Card or cash at the front desk when you pick up.'} />}
          {f.payment === 'online' && <div id="app-card-element" style={{ marginTop: 6, minHeight: 60, borderRadius: 8, background: '#fff', border: '1px solid var(--border)', padding: 4 }} />}

          {msg && <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--red-soft)', color: '#E63946', fontSize: 13 }}>{msg}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Btn variant="ghost" onClick={onClose} disabled={sending}>Keep shopping</Btn>
            <Btn onClick={place} disabled={sending} style={{ flex: 1, justifyContent: 'center' }}>
              {sending ? 'Processing...' : f.payment === 'online' ? `Pay ${money(total)}` : 'Place order'}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

const Line = ({ k, v }) => <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)', padding: '2px 0' }}><span>{k}</span><span>{v}</span></div>
