// Admin > Shop: products, settings and orders (NOT an endpoint: `_` prefix).
// Called from api/admin.js, which already checked the user is an admin.
// The public store lives on the website (tx-torque, api/shop.js) and reads the same tables.

const BUCKET = 'shop-photos';
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const STATUSES = ['new', 'ready', 'picked_up', 'shipped', 'canceled'];
const PAY_STATUSES = ['unpaid', 'paid', 'failed', 'refunded'];

const cleanVariants = (v) => (Array.isArray(v) ? v : [])
  .map(x => ({ label: String(x?.label || '').trim().slice(0, 40), stock: x?.stock === '' || x?.stock == null ? null : Math.max(0, parseInt(x.stock, 10) || 0) }))
  .filter(x => x.label);

export async function shopAction(b, userId, res, supabase) {
  switch (b.op) {
    case 'get': {
      const [p, s, o] = await Promise.all([
        supabase.from('shop_products').select('*').order('sort').order('created_at'),
        supabase.from('shop_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('shop_orders').select('*').order('created_at', { ascending: false }).limit(300),
      ]);
      if (p.error) return res.status(503).json({ error: 'The shop is not set up yet (run shop.sql in Supabase).', setup: true });
      return res.status(200).json({ products: p.data || [], settings: s.data || {}, orders: o.data || [] });
    }

    case 'product_save': {
      const x = b.product || {};
      const name = String(x.name || '').trim().slice(0, 120);
      const price = Math.round(Number(x.price) * 100);
      if (!name) return res.status(400).json({ error: 'Give the product a name.' });
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Check the price.' });
      const row = {
        name, description: String(x.description || '').slice(0, 2000), price_cents: price,
        photos: (Array.isArray(x.photos) ? x.photos : []).filter(u => /^https:\/\//.test(u)).slice(0, 8),
        variants: cleanVariants(x.variants), track_stock: !!x.track_stock, active: x.active !== false,
        sort: parseInt(x.sort, 10) || 0, updated_at: new Date().toISOString(),
      };
      const q = x.id ? supabase.from('shop_products').update(row).eq('id', x.id) : supabase.from('shop_products').insert(row);
      const { data, error } = await q.select('*').single();
      if (error) { console.error('[shop] save:', error.message); return res.status(500).json({ error: 'Could not save the product.' }); }
      return res.status(200).json({ product: data });
    }

    case 'product_delete': {
      const { error } = await supabase.from('shop_products').delete().eq('id', String(b.id || ''));
      if (error) return res.status(500).json({ error: 'Could not delete.' });
      return res.status(200).json({ ok: true });
    }

    case 'photo_upload': {
      const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ''));
      if (!m) return res.status(400).json({ error: 'Use a JPG, PNG or WEBP image.' });
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > MAX_PHOTO_BYTES) return res.status(413).json({ error: 'Image too large.' });
      const ext = m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg';
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
      if (error) { console.error('[shop] photo:', error.message); return res.status(500).json({ error: 'Could not upload the photo.' }); }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return res.status(200).json({ url: data.publicUrl });
    }

    case 'settings_save': {
      const s = b.settings || {};
      const row = {
        id: 1, open: s.open !== false, pay_online: !!s.pay_online, pay_pickup: !!s.pay_pickup,
        pickup_enabled: s.pickup_enabled !== false, pickup_note: String(s.pickup_note || '').slice(0, 500),
        shipping_enabled: !!s.shipping_enabled, shipping_cents: Math.max(0, Math.round(Number(s.shipping || 0) * 100)),
        tax_percent: Math.max(0, Math.min(20, Number(s.tax_percent) || 0)),
        notify_email: String(s.notify_email || '').trim().slice(0, 200) || null, updated_at: new Date().toISOString(),
      };
      if (!row.pay_online && !row.pay_pickup) return res.status(400).json({ error: 'Turn on at least one way to pay.' });
      if (!row.pickup_enabled && !row.shipping_enabled) return res.status(400).json({ error: 'Turn on pickup or shipping.' });
      const { data, error } = await supabase.from('shop_settings').upsert(row).select('*').single();
      if (error) return res.status(500).json({ error: 'Could not save settings.' });
      return res.status(200).json({ settings: data });
    }

    case 'order_update': {
      const id = String(b.id || '');
      const { data: order } = await supabase.from('shop_orders').select('*').eq('id', id).maybeSingle();
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      const upd = { updated_at: new Date().toISOString() };
      if (b.status && STATUSES.includes(b.status)) upd.status = b.status;
      if (b.payment_status && PAY_STATUSES.includes(b.payment_status)) upd.payment_status = b.payment_status;
      if (typeof b.notes === 'string') upd.notes = b.notes.slice(0, 1000);
      // Canceling puts the items back in stock (once).
      if (upd.status === 'canceled' && order.status !== 'canceled') await restock(supabase, order.items, +1);
      if (order.status === 'canceled' && upd.status && upd.status !== 'canceled') await restock(supabase, order.items, -1);
      const { data, error } = await supabase.from('shop_orders').update(upd).eq('id', id).select('*').single();
      if (error) return res.status(500).json({ error: 'Could not update the order.' });
      console.log(`[shop] ${userId} order #${order.order_number}:`, JSON.stringify(upd));
      return res.status(200).json({ order: data });
    }

    default:
      return res.status(400).json({ error: 'Unknown shop action.' });
  }
}

// Adds (+1) or removes (-1) the ordered quantities to/from tracked stock.
async function restock(supabase, items, sign) {
  for (const it of items || []) {
    const { data: p } = await supabase.from('shop_products').select('id, track_stock, variants').eq('id', it.product_id).maybeSingle();
    if (!p || !p.track_stock) continue;
    const variants = (p.variants || []).map(v => (v.label === it.variant && v.stock != null) ? { ...v, stock: Math.max(0, v.stock + sign * it.qty) } : v);
    await supabase.from('shop_products').update({ variants, updated_at: new Date().toISOString() }).eq('id', p.id);
  }
}
