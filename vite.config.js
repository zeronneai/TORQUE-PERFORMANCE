import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const PACKAGE_SESSIONS = {
  // PAQUETE A
  'price_1TLqDdAPTWbxe0YytEOlF7ZH': { sessions: 4,   name: 'Paquete A' },
  'price_1TLqDmAPTWbxe0YyqbHEcuFr': { sessions: 24,  name: 'Paquete A' },
  'price_1TLqDmAPTWbxe0YysigUumPn': { sessions: 48,  name: 'Paquete A' },
  'price_1TLqDlAPTWbxe0YyljY5WD6Y': { sessions: 48,  name: 'Paquete A' },
  // PAQUETE AA
  'price_1TLqDgAPTWbxe0Yy7yaP3VX3': { sessions: 8,   name: 'Paquete AA' },
  'price_1TLqDkAPTWbxe0YyZu4hFrI3': { sessions: 48,  name: 'Paquete AA' },
  'price_1TLqDjAPTWbxe0YyTsqaUdt5': { sessions: 96,  name: 'Paquete AA' },
  'price_1TLqDkAPTWbxe0YykcsrB50f': { sessions: 96,  name: 'Paquete AA' },
  // PAQUETE AAA
  'price_1TLqDhAPTWbxe0YyXXJQZrh7': { sessions: 12,  name: 'Paquete AAA' },
  'price_1TLqDkAPTWbxe0YydXEB3YqT': { sessions: 72,  name: 'Paquete AAA' },
  'price_1TLqDjAPTWbxe0YyuyUujCu4': { sessions: 144, name: 'Paquete AAA' },
  'price_1TLqDkAPTWbxe0Yy8UHtMvEJ': { sessions: 144, name: 'Paquete AAA' },
  // PAQUETE MLB
  'price_1TLqDdAPTWbxe0YydO64XMLw': { sessions: 20,  name: 'Paquete MLB' },
  'price_1TLqDlAPTWbxe0YyEIZi7YR5': { sessions: 120, name: 'Paquete MLB' },
  'price_1TLqDjAPTWbxe0YyVQxRaHFs': { sessions: 240, name: 'Paquete MLB' },
  'price_1TLqDjAPTWbxe0Yy6fRLwlFM': { sessions: 240, name: 'Paquete MLB' },
}

const STRIPE_LINKS = {
  A: {
    monthly: { link: 'https://buy.stripe.com/test_dRmbJ04Jtgweb8A61YfrW00', price: 'price_1TLqDdAPTWbxe0YytEOlF7ZH' },
    m6:      { link: 'https://buy.stripe.com/test_4gM14mdfZ3Js4KcaiefrW01', price: 'price_1TLqDmAPTWbxe0YyqbHEcuFr' },
    m12:     { link: 'https://buy.stripe.com/test_7sY00i2Bl7ZI0tW8a6frW02', price: 'price_1TLqDmAPTWbxe0YysigUumPn' },
    annual:  { link: 'https://buy.stripe.com/test_cNifZgb7Reo6ccE9eafrW04', price: 'price_1TLqDlAPTWbxe0YyljY5WD6Y' },
  },
  AA: {
    monthly: { link: 'https://buy.stripe.com/test_28EaEW4Jt7ZIa4w1LIfrW05', price: 'price_1TLqDgAPTWbxe0Yy7yaP3VX3' },
    m6:      { link: 'https://buy.stripe.com/test_6oUaEW2Bl5RA90scqmfrW06', price: 'price_1TLqDkAPTWbxe0YyZu4hFrI3' },
    m12:     { link: 'https://buy.stripe.com/test_fZu9ASdfZ93MdgI4XUfrW07', price: 'price_1TLqDjAPTWbxe0YyTsqaUdt5' },
    annual:  { link: 'https://buy.stripe.com/test_4gM9ASa3N93Mb8A0HEfrW08', price: 'price_1TLqDkAPTWbxe0YykcsrB50f' },
  },
  AAA: {
    monthly: { link: 'https://buy.stripe.com/test_bJeaEW2Bl5RA6SkduqfrW09', price: 'price_1TLqDhAPTWbxe0YyXXJQZrh7' },
    m6:      { link: 'https://buy.stripe.com/test_aFa7sKb7Rgwe4Kc762frW0a', price: 'price_1TLqDkAPTWbxe0YydXEB3YqT' },
    m12:     { link: 'https://buy.stripe.com/test_cNi8wOa3N3JsccEeyufrW0b', price: 'price_1TLqDjAPTWbxe0YyuyUujCu4' },
    annual:  { link: 'https://buy.stripe.com/test_7sYfZg4JtbbUccE0HEfrW0c', price: 'price_1TLqDkAPTWbxe0Yy8UHtMvEJ' },
  },
  MLB: {
    monthly: { link: 'https://buy.stripe.com/test_4gM3cu5Nx1Bk3G8eyufrW0d', price: 'price_1TLqDdAPTWbxe0YydO64XMLw' },
    m6:      { link: 'https://buy.stripe.com/test_14A9ASb7R4Nw0tW762frW0e', price: 'price_1TLqDlAPTWbxe0YyEIZi7YR5' },
    m12:     { link: 'https://buy.stripe.com/test_dRm00i1xhcfY7Wo0HEfrW0f', price: 'price_1TLqDjAPTWbxe0YyVQxRaHFs' },
    annual:  { link: 'https://buy.stripe.com/test_fZu8wO1xh1Bk7Wo2PMfrW0g', price: 'price_1TLqDjAPTWbxe0Yy6fRLwlFM' },
  },
}

const PRICE_TABLE = {
  A:   { monthly: 260, m6: 234, m12: 221, annual: 2496 },
  AA:  { monthly: 360, m6: 324, m12: 306, annual: 3456 },
  AAA: { monthly: 440, m6: 396, m12: 374, annual: 4224 },
  MLB: { monthly: 600, m6: 540, m12: 510, annual: 5760 },
}

function buildStripeLink(pkg, planType, clerkId, kidName) {
  const info = STRIPE_LINKS[pkg]?.[planType]
  if (!info) return null
  const ref = encodeURIComponent(`${clerkId}__${kidName}__${info.price}`)
  return `${info.link}?client_reference_id=${ref}`
}

function apiMiddleware(env) {
  return {
    name: 'torque-api',
    configureServer(server) {
      // ── POST /api/add-member ──────────────────────────────────
      server.middlewares.use('/api/add-member', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'OPTIONS') { res.writeHead(200); return res.end() }
        if (req.method !== 'POST') { res.writeHead(405); return res.end(JSON.stringify({ error: 'Method not allowed' })) }
        try {
          const body = await new Promise((resolve, reject) => {
            let raw = ''
            req.on('data', c => raw += c)
            req.on('end', () => { try { resolve(JSON.parse(raw)) } catch { reject(new Error('Invalid JSON')) } })
            req.on('error', reject)
          })
          const {
            parentName, email, phone, kidName, package: pkg, startDate,
            planType = 'monthly', kidName2, package2, planType2 = 'monthly',
            paymentMethod = 'manual',
          } = body
          if (!parentName || !email || !kidName || !pkg) {
            res.writeHead(400); return res.end(JSON.stringify({ error: 'Missing required fields' }))
          }
          const { createClerkClient } = await import('@clerk/clerk-sdk-node')
          const { createClient } = await import('@supabase/supabase-js')
          const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
          const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
          const MEMBERSHIP_IDS = { 'A': '93e92b42-7453-46c2-9660-12426eaa51a5', 'AA': 'be63127a-09a3-4320-bfd6-cf18c69b9def', 'AAA': 'd2dd367c-1d1c-490a-8cb3-aafc52690e93', 'MLB': '56f084fd-c4d1-4ed1-a7e3-ae3ed889c87e' }
          const SESSIONS = { 'A': 4, 'AA': 8, 'AAA': 12, 'MLB': 20 }
          const calcSessions = (p, pt) => {
            const base = SESSIONS[p] || 4
            return pt === 'annual' ? base * 12 : base
          }
          const calcExpires = (sd, pt) => { const d = new Date(sd); d.setMonth(d.getMonth() + (pt === 'annual' ? 12 : 1)); return d.toISOString() }
          // 1. Create or find Clerk user
          let clerkUser
          const existing = await clerk.users.getUserList({ emailAddress: [email] })
          if (existing.length > 0) {
            clerkUser = existing[0]
          } else {
            clerkUser = await clerk.users.createUser({
              emailAddress: [email],
              firstName: parentName.split(' ')[0],
              lastName: parentName.split(' ').slice(1).join(' '),
              username: email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Date.now().toString().slice(-4),
              password: 'Torque2026!',
            })
          }
          // 2. Upsert profile
          const { error: pErr } = await supabase.from('profiles').upsert({ id: clerkUser.id, full_name: parentName, phone, email, role: 'parent' }, { onConflict: 'id' })
          if (pErr) throw new Error(`Profile: ${pErr.message}`)
          // 3. Insert player(s)
          const { error: plErr } = await supabase.from('players').insert({ parent_id: clerkUser.id, kid_name: kidName, birthdate: null, age: null })
          if (plErr) throw new Error(`Player: ${plErr.message}`)
          const pkg2 = package2 || pkg
          if (kidName2) {
            const { error: pl2Err } = await supabase.from('players').insert({ parent_id: clerkUser.id, kid_name: kidName2, birthdate: null, age: null })
            if (pl2Err) throw new Error(`Player 2: ${pl2Err.message}`)
          }
          // 4a. Stripe flow — return payment links, do not create memberships yet
          if (paymentMethod === 'stripe') {
            const stripeLink  = buildStripeLink(pkg,  planType,  clerkUser.id, kidName)
            const stripeLink2 = kidName2 ? buildStripeLink(pkg2, planType2, clerkUser.id, kidName2) : null
            console.log(`[add-member] ✅ Stripe — ${parentName} / ${kidName}${kidName2 ? ' + ' + kidName2 : ''}`)
            res.writeHead(200); return res.end(JSON.stringify({ ok: true, clerkId: clerkUser.id, stripeLink, stripeLink2 }))
          }
          // 4b. Manual flow — insert memberships immediately
          if (!startDate) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Start date required for manual payment' })) }
          const { error: mErr } = await supabase.from('player_memberships').insert({ parent_id: clerkUser.id, kid_name: kidName, membership_id: MEMBERSHIP_IDS[pkg], sessions_total: calcSessions(pkg, planType), sessions_used: 0, status: 'active', stripe_payment_id: 'manual', stripe_session_id: 'manual', purchased_at: new Date(startDate).toISOString(), expires_at: calcExpires(startDate, planType), package_name: pkg, monthly_price: PRICE_TABLE[pkg]?.[planType] ?? null })
          if (mErr) throw new Error(`Membership: ${mErr.message}`)
          if (kidName2) {
            const { error: m2Err } = await supabase.from('player_memberships').insert({ parent_id: clerkUser.id, kid_name: kidName2, membership_id: MEMBERSHIP_IDS[pkg2], sessions_total: calcSessions(pkg2, planType2), sessions_used: 0, status: 'active', stripe_payment_id: 'manual', stripe_session_id: 'manual', purchased_at: new Date(startDate).toISOString(), expires_at: calcExpires(startDate, planType2), package_name: pkg2, sibling_discount: true, monthly_price: PRICE_TABLE[pkg2]?.[planType2] != null ? Math.round(PRICE_TABLE[pkg2][planType2] * 0.5) : null })
            if (m2Err) throw new Error(`Membership 2: ${m2Err.message}`)
          }
          console.log(`[add-member] ✅ Manual — ${parentName} / ${kidName}${kidName2 ? ' + ' + kidName2 : ''} — Package ${pkg} / ${planType}`)
          res.writeHead(200); res.end(JSON.stringify({ ok: true, clerkId: clerkUser.id }))
        } catch (err) {
          console.error('[add-member] Error:', err.message)
          res.writeHead(500); res.end(JSON.stringify({ error: err.message }))
        }
      })

      // ── GET /api/verify-payment ───────────────────────────────
      server.middlewares.use('/api/verify-payment', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const urlObj = new URL(req.url, 'http://localhost')
          const sessionId = urlObj.searchParams.get('session_id')
          if (!sessionId) {
            res.writeHead(400)
            return res.end(JSON.stringify({ error: 'Missing session_id' }))
          }

          // Dynamic imports (Node.js context, not bundled)
          const { default: Stripe } = await import('stripe')
          const { createClient } = await import('@supabase/supabase-js')

          const stripe = new Stripe(env.STRIPE_SECRET_KEY)
          const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

          const session = await stripe.checkout.sessions.retrieve(sessionId)
          console.log('[API] Stripe session status:', session.payment_status, '| ref:', session.client_reference_id)

          if (session.payment_status !== 'paid') {
            res.writeHead(402)
            return res.end(JSON.stringify({ error: 'Not paid', status: session.payment_status }))
          }

          // Idempotency check
          const { data: existing } = await supabase
            .from('player_memberships')
            .select('id')
            .eq('stripe_session_id', sessionId)
            .maybeSingle()

          if (existing) {
            res.writeHead(200)
            return res.end(JSON.stringify({ ok: true, message: 'already_processed' }))
          }

          const ref = decodeURIComponent(session.client_reference_id || '')
          const parts = ref.split('__')
          if (parts.length !== 3) {
            res.writeHead(400)
            return res.end(JSON.stringify({ error: 'Invalid client_reference_id', ref }))
          }

          const [parentId, kidName, priceId] = parts
          const pkg = PACKAGE_SESSIONS[priceId]
          if (!pkg) {
            res.writeHead(400)
            return res.end(JSON.stringify({ error: 'Unknown price ID', priceId }))
          }

          const { error: insertErr } = await supabase.from('player_memberships').insert({
            parent_id: parentId,
            kid_name: kidName,
            package_name: pkg.name,
            sessions_total: pkg.sessions,
            sessions_used: 0,
            stripe_payment_id: session.payment_intent,
            stripe_session_id: sessionId,
            status: 'active',
          })

          if (insertErr) {
            console.error('[API] Supabase insert error:', insertErr)
            res.writeHead(500)
            return res.end(JSON.stringify({ error: insertErr.message }))
          }

          console.log(`[API] ✅ Membresía creada: ${kidName} - ${pkg.name} - ${pkg.sessions} sesiones`)
          res.writeHead(200)
          res.end(JSON.stringify({ ok: true, package: pkg.name, sessions: pkg.sessions }))
        } catch (err) {
          console.error('[API] Error:', err.message)
          res.writeHead(500)
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // Native (file://) needs relative paths; web uses absolute
    base: mode === 'capacitor' ? './' : '/',
    plugins: [react(), apiMiddleware(env)],
  }
})
