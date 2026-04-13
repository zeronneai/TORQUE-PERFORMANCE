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

function apiMiddleware(env) {
  return {
    name: 'torque-api',
    configureServer(server) {
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
    plugins: [react(), apiMiddleware(env)],
  }
})
