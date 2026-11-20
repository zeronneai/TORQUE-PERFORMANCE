import React, { useState, useEffect, useMemo } from 'react'
import { useSession } from '@clerk/clerk-react'
import { Plus, Trash2, ImagePlus, ExternalLink, Package, ShoppingBag, Settings as Gear, X } from 'lucide-react'
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
const SIZE_PRESETS = { 'Youth': ['YS', 'YM', 'YL', 'YXL'], 'Adult': ['S', 'M', 'L', 'XL', '2XL'], 'One size': ['One size'] }
const input = { width: '100%', padding: '10px 12px', background: 'var(--navy4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }

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
  const [tab, setTab] = useState('orders')
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
  const visibleOrders = filter === 'open' ? openOrders : orders
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const salesMonth = orders.filter(o => o.payment_status === 'paid' && new Date(o.created_at) >= monthStart).reduce((a, o) => a + o.total_cents, 0)
  const toCollect = openOrders.filter(o => o.payment_status === 'unpaid').reduce((a, o) => a + o.total_cents, 0)

  async function saveProduct() {
    setBusy(true); setMsg(null)
    try { await call({ op: 'product_save', product: edit }); setEdit(null); await load() }
    catch (e) { setMsg(e.message) }
    setBusy(false)
  }
  async function deleteProduct() {
    if (!edit?.id || !window.confirm(`Delete "${edit.name}"? Turning it off (Visible: off) keeps it for later.`)) return
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

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading shop...</div>
  if (setupNeeded) return (
    <div>
      <PageHeader eyebrow="Merch" title="Shop" />
      <Card><div style={{ color: 'var(--text2)', lineHeight: 1.6 }}>The shop tables are not in the database yet. Run <b>shop.sql</b> in the Supabase SQL editor, then reload this page.</div></Card>
    </div>
  )

  const tabs = [['orders', `Orders${openOrders.length ? ` (${openOrders.length})` : ''}`, ShoppingBag], ['products', 'Products', Package], ['settings', 'Settings', Gear]]

  return (
    <div>
      <PageHeader eyebrow="Merch" title="Shop" subtitle="Add products, take orders online, pay online or at pickup."
        action={<a href={STORE_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><Btn variant="ghost" size="sm"><ExternalLink size={14} /> View store</Btn></a>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        <StatCard label="Open orders" value={openOrders.length} />
        <StatCard label="Paid online this month" value={money(salesMonth)} />
        <StatCard label="To collect at pickup" value={money(toCollect)} />
        <StatCard label="Products live" value={data.products.filter(p => p.active).length} />
      </div>

      {!data.settings.open && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--gold-soft)', color: 'var(--gold)', fontSize: 13 }}>The store is closed. Parents see "coming soon". Open it in Settings.</div>}
      {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--red-soft)', color: '#ff4466', fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(([id, label, Icon]) => (
          <Btn key={id} size="sm" variant={tab === id ? 'primary' : 'navy'} onClick={() => setTab(id)}><Icon size={14} /> {label}</Btn>
        ))}
      </div>

      {tab === 'orders' && (
        <Card>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[['open', 'Open'], ['all', 'All']].map(([id, l]) => <Btn key={id} size="sm" variant={filter === id ? 'gold' : 'ghost'} onClick={() => setFilter(id)}>{l}</Btn>)}
          </div>
          {!visibleOrders.length && <div style={{ color: 'var(--muted)', padding: 20, textAlign: 'center' }}>No orders yet.</div>}
          {visibleOrders.map(o => (
            <div key={o.id} onClick={() => setOrder(o)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 4px', borderTop: '1px solid var(--border2)', cursor: 'pointer', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, minWidth: 60 }}>#{o.order_number}</div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(o.items || []).map(i => `${i.qty}x ${i.name}${i.variant ? ` (${i.variant})` : ''}`).join(', ')}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', minWidth: 110 }}>{fmt(o.created_at)}</div>
              <div style={{ fontWeight: 700, minWidth: 70 }}>{money(o.total_cents)}</div>
              <Pill color={PAY[o.payment_status]?.[1]}>{PAY[o.payment_status]?.[0] || o.payment_status}</Pill>
              <Pill color={STATUS[o.status]?.[1]} solid={o.status === 'new'}>{STATUS[o.status]?.[0] || o.status}</Pill>
            </div>
          ))}
        </Card>
      )}

      {tab === 'products' && (
        <div>
          <Btn onClick={() => setEdit(blankProduct())} style={{ marginBottom: 14 }}><Plus size={14} /> Add product</Btn>
          {!data.products.length && <Card><div style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>No products yet. Add the first one: name, price, a photo and sizes.</div></Card>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {data.products.map(p => {
              const stock = p.track_stock ? (p.variants || []).reduce((a, v) => a + (v.stock || 0), 0) : null
              return (
                <Card key={p.id} onClick={() => setEdit({ ...p, price: (p.price_cents / 100).toFixed(2) })} style={{ padding: 0, overflow: 'hidden', opacity: p.active ? 1 : 0.5 }}>
                  <div style={{ aspectRatio: '1', background: 'var(--navy4)', backgroundImage: p.photos?.[0] ? `url(${p.photos[0]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13 }}>
                      <span>{money(p.price_cents)}</span>
                      <span style={{ color: stock === 0 ? '#E63946' : 'var(--muted)' }}>{!p.active ? 'Hidden' : stock == null ? '' : stock === 0 ? 'Sold out' : `${stock} in stock`}</span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'settings' && <SettingsForm settings={data.settings} onSave={async (s) => { setMsg(null); try { await call({ op: 'settings_save', settings: s }); await load(); return true } catch (e) { setMsg(e.message); return false } }} />}

      {/* Product editor */}
      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} title={edit?.id ? 'Edit product' : 'New product'} width={560}>
        {edit && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div><Label>Name</Label><input style={input} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="Torque Hoodie" /></div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}><Label>Price (USD)</Label><input style={input} inputMode="decimal" value={edit.price} onChange={e => setEdit({ ...edit, price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="45.00" /></div>
              <div style={{ width: 110 }}><Label>Order</Label><input style={input} inputMode="numeric" value={edit.sort} onChange={e => setEdit({ ...edit, sort: e.target.value })} title="Lower numbers show first" /></div>
            </div>
            <div><Label>Description</Label><textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} placeholder="Heavyweight cotton, embroidered logo." /></div>

            <div>
              <Label>Photos (first one is the cover)</Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(edit.photos || []).map((u, i) => (
                  <div key={u} style={{ position: 'relative', width: 76, height: 76, borderRadius: 8, background: `url(${u}) center/cover`, border: i === 0 ? '2px solid var(--gold)' : '1px solid var(--border)' }}>
                    <button onClick={() => setEdit({ ...edit, photos: edit.photos.filter(x => x !== u) })} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#E63946', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
                    {i > 0 && <button onClick={() => setEdit({ ...edit, photos: [u, ...edit.photos.filter(x => x !== u)] })} style={{ position: 'absolute', bottom: 2, left: 2, fontSize: 9, border: 'none', borderRadius: 4, background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', padding: '2px 4px' }}>Cover</button>}
                  </div>
                ))}
                {(edit.photos?.length || 0) < 8 && (
                  <label style={{ width: 76, height: 76, borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)' }}>
                    <ImagePlus size={20} />
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
                  </label>
                )}
              </div>
            </div>

            <div>
              <Label>Sizes / options</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {Object.entries(SIZE_PRESETS).map(([k, list]) => (
                  <Btn key={k} size="sm" variant="ghost" onClick={() => setEdit({ ...edit, variants: [...edit.variants, ...list.filter(l => !edit.variants.some(v => v.label === l)).map(label => ({ label, stock: edit.track_stock ? 0 : null }))] })}>+ {k}</Btn>
                ))}
                <Btn size="sm" variant="ghost" onClick={() => setEdit({ ...edit, variants: [...edit.variants, { label: '', stock: edit.track_stock ? 0 : null }] })}>+ Custom</Btn>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                <input type="checkbox" checked={edit.track_stock} onChange={e => setEdit({ ...edit, track_stock: e.target.checked, variants: edit.variants.map(v => ({ ...v, stock: e.target.checked ? (v.stock ?? 0) : null })) })} />
                Track stock (sold out options can't be ordered)
              </label>
              {!edit.variants.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No options: parents just pick a quantity.{edit.track_stock ? ' Add "One size" to set the stock.' : ''}</div>}
              {edit.variants.map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <input style={{ ...input, flex: 1 }} value={v.label} placeholder="Size or color" onChange={e => setEdit({ ...edit, variants: edit.variants.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                  {edit.track_stock && <input style={{ ...input, width: 90 }} inputMode="numeric" value={v.stock ?? 0} title="In stock" onChange={e => setEdit({ ...edit, variants: edit.variants.map((x, j) => j === i ? { ...x, stock: e.target.value.replace(/\D/g, '') } : x) })} />}
                  <button onClick={() => setEdit({ ...edit, variants: edit.variants.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text2)' }}>
              <input type="checkbox" checked={edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })} /> Visible in the store
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              {edit.id ? <Btn variant="danger" size="sm" onClick={deleteProduct} disabled={busy}><Trash2 size={14} /> Delete</Btn> : <span />}
              <Btn onClick={saveProduct} disabled={busy || !edit.name || edit.price === ''}>{busy ? 'Saving...' : 'Save product'}</Btn>
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
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                <a href={`mailto:${order.email}`} style={{ color: 'inherit' }}>{order.email}</a>{order.phone ? <> · <a href={`tel:${order.phone}`} style={{ color: 'inherit' }}>{order.phone}</a></> : null}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{fmt(order.created_at)} · {order.fulfillment === 'ship' ? 'Ship' : 'Pickup'}</div>
              {order.fulfillment === 'ship' && order.ship_address && <div style={{ fontSize: 13, marginTop: 6 }}>{[order.ship_address.line1, order.ship_address.line2, `${order.ship_address.city || ''}, ${order.ship_address.state || ''} ${order.ship_address.zip || ''}`].filter(Boolean).join(', ')}</div>}
            </div>
            <div style={{ borderTop: '1px solid var(--border2)', paddingTop: 10 }}>
              {(order.items || []).map((i, k) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>{i.qty}x {i.name}{i.variant ? ` (${i.variant})` : ''}</span><span>{money(i.unit_cents * i.qty)}</span>
                </div>
              ))}
              {order.tax_cents > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>Tax</span><span>{money(order.tax_cents)}</span></div>}
              {order.shipping_cents > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>Shipping</span><span>{money(order.shipping_cents)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6 }}><span>Total</span><span>{money(order.total_cents)}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill color={PAY[order.payment_status]?.[1]}>{PAY[order.payment_status]?.[0]}</Pill>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{order.payment_method === 'online' ? `Card online${order.transaction_id ? ` · GoDaddy ${order.transaction_id.slice(0, 13)}` : ''}` : 'Pays at pickup'}</span>
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
  useEffect(() => setS(init), [init])
  const Toggle = ({ k, children }) => (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!s[k]} onChange={e => { setS({ ...s, [k]: e.target.checked }); setSaved(false) }} style={{ marginTop: 3 }} />
      <span>{children}</span>
    </label>
  )
  const set = (k) => (e) => { setS({ ...s, [k]: e.target.value }); setSaved(false) }
  return (
    <Card>
      <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
        <Toggle k="open"><b>Store open</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>Off shows "coming soon" on the website.</div></Toggle>
        <div style={{ height: 1, background: 'var(--border2)' }} />
        <Toggle k="pay_online"><b>Pay online with card</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>GoDaddy Payments. Needs the GoDaddy keys in Vercel; until then the website hides this option.</div></Toggle>
        <Toggle k="pay_pickup"><b>Order online, pay at pickup</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>Charge on the Smart Terminal when they pick up, then tap "Mark as paid".</div></Toggle>
        <div style={{ height: 1, background: 'var(--border2)' }} />
        <Toggle k="pickup_enabled"><b>Pickup at the academy</b></Toggle>
        {s.pickup_enabled && <div><Label>Pickup note (shown at checkout)</Label><input style={input} value={s.pickup_note || ''} onChange={set('pickup_note')} /></div>}
        <Toggle k="shipping_enabled"><b>Shipping</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>Leave off for now if you only do pickup.</div></Toggle>
        {s.shipping_enabled && <div style={{ maxWidth: 200 }}><Label>Flat shipping fee (USD)</Label><input style={input} inputMode="decimal" value={s.shipping} onChange={set('shipping')} /></div>}
        <div style={{ height: 1, background: 'var(--border2)' }} />
        <div style={{ maxWidth: 200 }}><Label>Sales tax %</Label><input style={input} inputMode="decimal" value={s.tax_percent ?? 0} onChange={set('tax_percent')} /><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>0 if prices already include tax. El Paso is 8.25.</div></div>
        <div><Label>Email for new orders</Label><input style={input} type="email" value={s.notify_email || ''} onChange={set('notify_email')} placeholder="torquebaseball@..." /></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Btn onClick={async () => setSaved(await onSave(s))}>Save settings</Btn>
          {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>Saved</span>}
        </div>
      </div>
    </Card>
  )
}
