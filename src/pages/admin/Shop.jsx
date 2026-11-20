import React, { useState, useEffect, useMemo } from 'react'
import { useSession } from '@clerk/clerk-react'
import { Plus, Trash2, ImagePlus, ExternalLink, Package, ShoppingBag, Settings as Gear, X, Store, CreditCard, Truck, Receipt } from 'lucide-react'
import { Card, StatCard, Pill, PageHeader, Modal, Btn, Label } from '../../components/UI'
import { API_BASE } from '../../lib/apiBase'

// Admin > Shop. Coaches add merch (photos, sizes, stock, price), choose how parents
// pay (card online with GoDaddy and/or pay at pickup) and work the orders.
// Parents buy at torquebaseball.us/shop. All writes go through api/admin.js (action "shop").
const STORE_URL = 'https://torquebaseball.us/shop'
const money = (c) => `$${((c || 0) / 100).toFixed(2)}`
const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'
const STATUS = { new: ['New', '#219EBC'], ready: ['Ready for pickup', '#FFB703'], picked_up: ['Picked up', '#06D6A0'], shipped: ['Shipped', '#06D6A0'], canceled: ['Canceled', '#5A6B84'] }
const PAY = { paid: ['Paid', '#06D6A0'], unpaid: ['Pay at pickup', '#FFB703'], failed: ['Card declined', '#E63946'], refunded: ['Refunded', '#5A6B84'] }
const SIZE_PRESETS = { 'Youth sizes': ['YS', 'YM', 'YL', 'YXL'], 'Adult sizes': ['S', 'M', 'L', 'XL', '2XL'], 'One size': ['One size'] }
const input = { width: '100%', padding: '10px 12px', background: 'var(--navy4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }
const hint = { fontSize: 12, color: 'var(--text2)', marginTop: 2, lineHeight: 1.45 }

// On/off switch. Native checkboxes inherit width:100% from index.css, so we draw our own.
function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} onClick={() => onChange(!on)}
      style={{ width: 44, height: 26, borderRadius: 999, flexShrink: 0, position: 'relative', transition: 'background .15s',
        background: on ? 'var(--ink)' : 'var(--navy4)', border: '1px solid var(--border)' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .15s' }} />
    </button>
  )
}

// One settings line: title + help on the left, switch on the right, always aligned.
function Row({ title, help, on, onChange, children }) {
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{title}</div>
          {help && <div style={hint}>{help}</div>}
        </div>
        {onChange && <Switch on={on} onChange={onChange} label={title} />}
      </div>
      {children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <Card style={{ padding: 20, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon size={16} color="var(--text2)" />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text)' }}>{title}</div>
      </div>
      {children}
    </Card>
  )
}

// Shrinks a photo to max 1600px JPEG so uploads stay small.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = URL.createObjectURL(file)
  })
}

const blankProduct = () => ({ name: '', description: '', price: '', photos: [], variants: [], track_stock: false, active: true, sort: 0 })

export default function Shop() {
  const { session } = useSession()
  const [tab, setTab] = useState(null)
  const [data, setData] = useState({ products: [], settings: {}, orders: [] })
  const [loading, setLoading] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [edit, setEdit] = useState(null)       // product being edited
  const [order, setOrder] = useState(null)     // order opened
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [filter, setFilter] = useState('open')

  async function call(body) {
    const token = await session?.getToken()
    const res = await fetch(`${API_BASE}/api/admin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'shop', ...body }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { const e = new Error(d.error || 'Request failed'); e.setup = d.setup; throw e }
    return d
  }
  async function load() {
    try { setData(await call({ op: 'get' })); setSetupNeeded(false) }
    catch (e) { if (e.setup) setSetupNeeded(true); else setMsg(e.message) }
    setLoading(false)
  }
  useEffect(() => { if (session) load() }, [session])

  const orders = data.orders
  const openOrders = orders.filter(o => !['picked_up', 'shipped', 'canceled'].includes(o.status))
  // First visit: open orders if there are any, otherwise the products.
  const current = tab || (openOrders.length ? 'orders' : 'products')
  const visibleOrders = filter === 'open' ? openOrders : orders
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const salesMonth = orders.filter(o => o.payment_status === 'paid' && new Date(o.created_at) >= monthStart).reduce((a, o) => a + o.total_cents, 0)
  const toCollect = openOrders.filter(o => o.payment_status === 'unpaid').reduce((a, o) => a + o.total_cents, 0)
  const newProduct = () => { setMsg(null); setEdit(blankProduct()) }

  async function saveProduct() {
    setBusy(true); setMsg(null)
    try { await call({ op: 'product_save', product: edit }); setEdit(null); setTab('products'); await load() }
    catch (e) { setMsg(e.message) }
    setBusy(false)
  }
  async function deleteProduct() {
    if (!edit?.id || !window.confirm(`Delete "${edit.name}"? Turning off "Visible in the store" keeps it for later.`)) return
    setBusy(true)
    try { await call({ op: 'product_delete', id: edit.id }); setEdit(null); await load() } catch (e) { setMsg(e.message) }
    setBusy(false)
  }
  async function addPhotos(files) {
    setBusy(true); setMsg(null)
    try {
      const urls = []
      for (const f of Array.from(files).slice(0, 8 - (edit.photos?.length || 0))) {
        const { url } = await call({ op: 'photo_upload', image: await shrink(f) })
        urls.push(url)
      }
      setEdit(p => ({ ...p, photos: [...(p.photos || []), ...urls] }))
    } catch (e) { setMsg(e.message) }
    setBusy(false)
  }
  async function updateOrder(patch) {
    setBusy(true); setMsg(null)
    try { const { order: o } = await call({ op: 'order_update', id: order.id, ...patch }); setOrder(o); await load() }
    catch (e) { setMsg(e.message) }
    setBusy(false)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text2)' }}>Loading shop...</div>
  if (setupNeeded) return (
    <div>
      <PageHeader eyebrow="Merch" title="Shop" />
      <Card><div style={{ color: 'var(--text2)', lineHeight: 1.6 }}>The shop tables are not in the database yet. Run <b>shop.sql</b> in the Supabase SQL editor, then reload this page.</div></Card>
    </div>
  )

  const tabs = [['products', 'Products', Package, data.products.length], ['orders', 'Orders', ShoppingBag, openOrders.length], ['settings', 'Settings', Gear, null]]

  return (
    <div>
      <PageHeader eyebrow="Merch" title="Shop" subtitle="Add your merch, parents order at torquebaseball.us/shop."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={STORE_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><Btn variant="ghost"><ExternalLink size={14} /> View store</Btn></a>
            <Btn onClick={newProduct}><Plus size={16} /> Add product</Btn>
          </div>
        } />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Open orders" value={openOrders.length} />
        <StatCard label="Paid online this month" value={money(salesMonth)} />
        <StatCard label="To collect at pickup" value={money(toCollect)} />
        <StatCard label="Products live" value={data.products.filter(p => p.active).length} />
      </div>

      {!data.settings.open && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--gold-soft)', color: 'var(--gold)', fontSize: 13 }}>The store is closed. Parents see "coming soon". Turn on "Store open" in Settings.</div>}
      {msg && !edit && !order && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--red-soft)', color: '#ff4466', fontSize: 13 }}>{msg}</div>}

      {/* Tabs as a segmented control */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--navy4)', marginBottom: 18, maxWidth: 420 }}>
        {tabs.map(([id, label, Icon, n]) => {
          const on = current === id
          return (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, justifyContent: 'center', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 6px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              background: on ? 'var(--navy2, #fff)' : 'transparent', color: on ? 'var(--text)' : 'var(--text2)', boxShadow: on ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
              <Icon size={14} /> {label}
              {n ? <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, background: id === 'orders' ? '#E63946' : 'var(--border)', color: id === 'orders' ? '#fff' : 'var(--text2)' }}>{n}</span> : null}
            </button>
          )
        })}
      </div>

      {current === 'products' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
          <button onClick={newProduct} style={{ minHeight: 250, borderRadius: 12, border: '2px dashed var(--border2, var(--border))', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text2)' }}>
            <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={22} /></span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>Add product</span>
            <span style={{ fontSize: 12, padding: '0 16px', textAlign: 'center' }}>{data.products.length ? 'Name, price, photos and sizes' : 'Start with your first item: a hoodie, a hat, a shirt'}</span>
          </button>
          {data.products.map(p => {
            const stock = p.track_stock ? (p.variants || []).reduce((a, v) => a + (v.stock || 0), 0) : null
            const note = !p.active ? 'Hidden' : stock == null ? `${(p.variants || []).length || 'No'} option${(p.variants || []).length === 1 ? '' : 's'}` : stock === 0 ? 'Sold out' : `${stock} in stock`
            return (
              <Card key={p.id} onClick={() => { setMsg(null); setEdit({ ...p, price: (p.price_cents / 100).toFixed(2) }) }} style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', opacity: p.active ? 1 : 0.55 }}>
                <div style={{ aspectRatio: '1', background: 'var(--navy4)', backgroundImage: p.photos?.[0] ? `url(${p.photos[0]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
                  {!p.photos?.[0] && <ImagePlus size={26} />}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{money(p.price_cents)}</span>
                    <span style={{ color: stock === 0 && p.active ? '#E63946' : 'var(--text2)' }}>{note}</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {current === 'orders' && (
        <Card>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[['open', `Open (${openOrders.length})`], ['all', `All (${orders.length})`]].map(([id, l]) => <Btn key={id} size="sm" variant={filter === id ? 'primary' : 'ghost'} onClick={() => setFilter(id)}>{l}</Btn>)}
          </div>
          {!visibleOrders.length && <div style={{ color: 'var(--text2)', padding: 28, textAlign: 'center' }}>{filter === 'open' ? 'No open orders. New orders from the website show up here.' : 'No orders yet.'}</div>}
          {visibleOrders.map(o => (
            <div key={o.id} onClick={() => { setMsg(null); setOrder(o) }} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', padding: '12px 4px', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
              <div style={{ fontWeight: 700, width: 56 }}>#{o.order_number}</div>
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <div style={{ fontWeight: 600 }}>{o.customer_name} </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{fmt(o.created_at)}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(o.items || []).map(i => `${i.qty}x ${i.name}${i.variant ? ` (${i.variant})` : ''}`).join(', ')}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
                <b style={{ marginRight: 4 }}>{money(o.total_cents)}</b>
                <Pill color={PAY[o.payment_status]?.[1]}>{PAY[o.payment_status]?.[0] || o.payment_status}</Pill>
                <Pill color={STATUS[o.status]?.[1]} solid={o.status === 'new'}>{STATUS[o.status]?.[0] || o.status}</Pill>
              </div>
            </div>
          ))}
        </Card>
      )}

      {current === 'settings' && <SettingsForm settings={data.settings} onSave={async (s) => { setMsg(null); try { await call({ op: 'settings_save', settings: s }); await load(); return true } catch (e) { setMsg(e.message); return false } }} />}

      {/* Product editor */}
      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? 'Edit product' : 'Add product'} width={580}>
        {edit && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <Label>Photos</Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(edit.photos || []).map((u, i) => (
                  <div key={u} style={{ position: 'relative', width: 84, height: 84, borderRadius: 10, background: `url(${u}) center/cover`, border: i === 0 ? '2px solid var(--ink)' : '1px solid var(--border)' }}>
                    <button onClick={() => setEdit({ ...edit, photos: edit.photos.filter(x => x !== u) })} aria-label="Remove photo" style={{ position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: '50%', background: '#E63946', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
                    {i === 0
                      ? <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, fontWeight: 700, borderRadius: 4, background: 'var(--ink)', color: '#fff', padding: '2px 5px' }}>COVER</span>
                      : <button onClick={() => setEdit({ ...edit, photos: [u, ...edit.photos.filter(x => x !== u)] })} style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, borderRadius: 4, background: 'rgba(0,0,0,.6)', color: '#fff', padding: '2px 5px' }}>Make cover</button>}
                  </div>
                ))}
                {(edit.photos?.length || 0) < 8 && (
                  <label style={{ width: 84, height: 84, borderRadius: 10, border: '2px dashed var(--border2, var(--border))', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', cursor: busy ? 'wait' : 'pointer', color: 'var(--text2)', fontSize: 11 }}>
                    <ImagePlus size={20} /> {busy ? 'Uploading' : 'Add photo'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
                  </label>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px', gap: 12 }}>
              <div><Label>Name</Label><input style={input} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="Torque Hoodie" autoFocus={!edit.id} /></div>
              <div><Label>Price (USD)</Label><input style={input} inputMode="decimal" value={edit.price} onChange={e => setEdit({ ...edit, price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="45.00" /></div>
            </div>
            <div><Label>Description (optional)</Label><textarea style={{ ...input, minHeight: 64, resize: 'vertical' }} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} placeholder="Heavyweight cotton, embroidered logo." /></div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <Label>Sizes or options</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {Object.entries(SIZE_PRESETS).map(([k, list]) => (
                  <Btn key={k} size="sm" variant="ghost" onClick={() => setEdit({ ...edit, variants: [...edit.variants, ...list.filter(l => !edit.variants.some(v => v.label === l)).map(label => ({ label, stock: edit.track_stock ? 0 : null }))] })}>+ {k}</Btn>
                ))}
                <Btn size="sm" variant="ghost" onClick={() => setEdit({ ...edit, variants: [...edit.variants, { label: '', stock: edit.track_stock ? 0 : null }] })}>+ Custom</Btn>
              </div>
              {!edit.variants.length && <div style={hint}>No options: parents just choose a quantity.</div>}
              {edit.variants.length > 0 && (
                <div style={{ display: 'grid', gap: 6 }}>
                  {edit.track_stock && <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 28px', gap: 8, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em' }}><span>Option</span><span>In stock</span><span /></div>}
                  {edit.variants.map((v, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: edit.track_stock ? '1fr 90px 28px' : '1fr 28px', gap: 8, alignItems: 'center' }}>
                      <input style={input} value={v.label} placeholder="Size or color" onChange={e => setEdit({ ...edit, variants: edit.variants.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                      {edit.track_stock && <input style={input} inputMode="numeric" value={v.stock ?? 0} onChange={e => setEdit({ ...edit, variants: edit.variants.map((x, j) => j === i ? { ...x, stock: e.target.value.replace(/\D/g, '') } : x) })} />}
                      <button onClick={() => setEdit({ ...edit, variants: edit.variants.filter((_, j) => j !== i) })} aria-label="Remove option" style={{ color: 'var(--text2)', display: 'flex', justifyContent: 'center' }}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Row title="Track stock" help={edit.variants.length ? 'Sold out options cannot be ordered.' : 'Add an option (for example "One size") to set the stock.'}
                on={edit.track_stock} onChange={(v) => setEdit({ ...edit, track_stock: v, variants: edit.variants.map(x => ({ ...x, stock: v ? (x.stock ?? 0) : null })) })} />
              <Row title="Visible in the store" help="Turn off to hide it without deleting it." on={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
            </div>

            {msg && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--red-soft)', color: '#ff4466', fontSize: 13 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              {edit.id ? <Btn variant="danger" size="sm" onClick={deleteProduct} disabled={busy}><Trash2 size={14} /> Delete</Btn> : <Btn variant="ghost" size="sm" onClick={() => setEdit(null)}>Cancel</Btn>}
              <Btn onClick={saveProduct} disabled={busy || !edit.name || edit.price === ''}>{busy ? 'Saving...' : edit.id ? 'Save changes' : 'Add to store'}</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Order detail */}
      <Modal open={!!order} onClose={() => !busy && setOrder(null)} title={order ? `Order #${order.order_number}` : ''} width={520}>
        {order && (
          <div style={{ display: 'grid', gap: 14, fontSize: 14 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{order.customer_name}</div>
              <div style={{ color: 'var(--text2)', fontSize: 13 }}>
                <a href={`mailto:${order.email}`} style={{ color: 'inherit' }}>{order.email}</a>{order.phone ? <> · <a href={`tel:${order.phone}`} style={{ color: 'inherit' }}>{order.phone}</a></> : null}
              </div>
              <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>{fmt(order.created_at)} · {order.fulfillment === 'ship' ? 'Ship' : 'Pickup'}</div>
              {order.fulfillment === 'ship' && order.ship_address && <div style={{ fontSize: 13, marginTop: 6 }}>{[order.ship_address.line1, order.ship_address.line2, `${order.ship_address.city || ''}, ${order.ship_address.state || ''} ${order.ship_address.zip || ''}`].filter(Boolean).join(', ')}</div>}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              {(order.items || []).map((i, k) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>{i.qty}x {i.name}{i.variant ? ` (${i.variant})` : ''}</span><span>{money(i.unit_cents * i.qty)}</span>
                </div>
              ))}
              {order.tax_cents > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>Tax</span><span>{money(order.tax_cents)}</span></div>}
              {order.shipping_cents > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}><span>Shipping</span><span>{money(order.shipping_cents)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6 }}><span>Total</span><span>{money(order.total_cents)}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill color={PAY[order.payment_status]?.[1]}>{PAY[order.payment_status]?.[0]}</Pill>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{order.payment_method === 'online' ? `Card online${order.transaction_id ? ` · GoDaddy ${order.transaction_id.slice(0, 13)}` : ''}` : 'Pays at pickup'}</span>
            </div>
            {order.payment_status === 'unpaid' && order.status !== 'canceled' && (
              <Btn variant="success" disabled={busy} onClick={() => updateOrder({ payment_status: 'paid' })}>Mark as paid (charged on the terminal)</Btn>
            )}
            <div>
              <Label>Status</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(order.fulfillment === 'ship' ? ['new', 'shipped', 'canceled'] : ['new', 'ready', 'picked_up', 'canceled']).map(s => (
                  <Btn key={s} size="sm" disabled={busy} variant={order.status === s ? 'primary' : 'ghost'}
                    onClick={() => { if (s === 'canceled' && !window.confirm('Cancel this order? Items go back in stock.' + (order.payment_status === 'paid' && order.payment_method === 'online' ? ' Refund the card from the GoDaddy dashboard.' : ''))) return; updateOrder({ status: s }) }}>
                    {STATUS[s][0]}
                  </Btn>
                ))}
              </div>
            </div>
            <NotesBox key={order.id} value={order.notes || ''} onSave={(notes) => updateOrder({ notes })} busy={busy} />
            {msg && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--red-soft)', color: '#ff4466', fontSize: 13 }}>{msg}</div>}
          </div>
        )}
      </Modal>
    </div>
  )
}

function NotesBox({ value, onSave, busy }) {
  const [v, setV] = useState(value)
  return (
    <div>
      <Label>Internal note</Label>
      <textarea style={{ ...input, minHeight: 60 }} value={v} onChange={e => setV(e.target.value)} placeholder="e.g. Swapped to size M" />
      {v !== value && <Btn size="sm" style={{ marginTop: 6 }} disabled={busy} onClick={() => onSave(v)}>Save note</Btn>}
    </div>
  )
}

function SettingsForm({ settings, onSave }) {
  const init = useMemo(() => ({ ...settings, shipping: ((settings.shipping_cents || 0) / 100).toFixed(2) }), [settings])
  const [s, setS] = useState(init)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => setS(init), [init])
  const put = (k, v) => { setS(p => ({ ...p, [k]: v })); setSaved(false) }
  const dirty = JSON.stringify(s) !== JSON.stringify(init)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 14 }}>
        <Section icon={Store} title="Store">
          <Row title="Store open" help='When off, the website shows "coming soon".' on={s.open} onChange={v => put('open', v)} />
        </Section>

        <Section icon={CreditCard} title="How parents pay">
          <Row title="Pay online with card" help="GoDaddy Payments. Shows on the website once the GoDaddy keys are in Vercel." on={s.pay_online} onChange={v => put('pay_online', v)} />
          <Row title="Order online, pay at pickup" help='Charge on the Smart Terminal at pickup, then tap "Mark as paid" on the order.' on={s.pay_pickup} onChange={v => put('pay_pickup', v)} />
        </Section>

        <Section icon={Truck} title="Delivery">
          <Row title="Pickup at the academy" on={s.pickup_enabled} onChange={v => put('pickup_enabled', v)}>
            {s.pickup_enabled && <><Label>Pickup note shown at checkout</Label><input style={input} value={s.pickup_note || ''} onChange={e => put('pickup_note', e.target.value)} /></>}
          </Row>
          <Row title="Shipping" help="Leave off if you only do pickup." on={s.shipping_enabled} onChange={v => put('shipping_enabled', v)}>
            {s.shipping_enabled && <div style={{ maxWidth: 180 }}><Label>Flat shipping fee (USD)</Label><input style={input} inputMode="decimal" value={s.shipping} onChange={e => put('shipping', e.target.value.replace(/[^0-9.]/g, ''))} /></div>}
          </Row>
        </Section>

        <Section icon={Receipt} title="Tax and notifications">
          <Row title="Sales tax %" help="Use 0 if your prices already include tax. El Paso is 8.25.">
            <div style={{ maxWidth: 140 }}><input style={input} inputMode="decimal" value={s.tax_percent ?? 0} onChange={e => put('tax_percent', e.target.value.replace(/[^0-9.]/g, ''))} /></div>
          </Row>
          <Row title="Email for new orders" help="Every new order is also sent here.">
            <input style={input} type="email" value={s.notify_email || ''} onChange={e => put('notify_email', e.target.value)} placeholder="orders@yourdomain.com" />
          </Row>
        </Section>
      </div>

      <div style={{ position: dirty ? 'sticky' : 'static', bottom: 12, zIndex: 5, marginTop: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--navy2)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(13,27,42,.10)' }}>
        {saved && !dirty && <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>Saved</span>}
        {dirty && <span style={{ color: 'var(--text2)', fontSize: 13 }}>Unsaved changes</span>}
        <Btn disabled={!dirty || saving} onClick={async () => { setSaving(true); setSaved(await onSave(s)); setSaving(false) }}>{saving ? 'Saving...' : 'Save settings'}</Btn>
      </div>
    </div>
  )
}
