import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const PACKAGE_SESSIONS = {
  'price_1TFiVSAaoJKjkq1OgPOYmeX7': { sessions: 4,   name: 'Paquete A' },
  'price_1TFiVSAaoJKjkq1OvDzbHwbd': { sessions: 24,  name: 'Paquete A' },
  'price_1TFiWHAaoJKjkq1OaioJwHRp': { sessions: 48,  name: 'Paquete A' },
  'price_1TFiWHAaoJKjkq1Oge43FYOo': { sessions: 48,  name: 'Paquete A' },
  'price_1TFiX7AaoJKjkq1OLnC5HLaS': { sessions: 8,   name: 'Paquete AA' },
  'price_1TFiYpAaoJKjkq1OxvBFuzPJ': { sessions: 48,  name: 'Paquete AA' },
  'price_1TFiYpAaoJKjkq1O8oFYz5VK': { sessions: 96,  name: 'Paquete AA' },
  'price_1TFiYpAaoJKjkq1OBHUagz9Y': { sessions: 96,  name: 'Paquete AA' },
  'price_1TFia1AaoJKjkq1O9XQZ5YbZ': { sessions: 12,  name: 'Paquete AAA' },
  'price_1TFiaXAaoJKjkq1OTrt1aWsR': { sessions: 72,  name: 'Paquete AAA' },
  'price_1TFiaXAaoJKjkq1OObbQEbnX': { sessions: 144, name: 'Paquete AAA' },
  'price_1TFiaXAaoJKjkq1OW0sZ5nOP': { sessions: 144, name: 'Paquete AAA' },
  'price_1TFibiAaoJKjkq1Oi9ZGJwyy': { sessions: 20,  name: 'Paquete MLB' },
  'price_1TFicFAaoJKjkq1OK0b6zjq5': { sessions: 120, name: 'Paquete MLB' },
  'price_1TFicFAaoJKjkq1OBV6hiqhS': { sessions: 240, name: 'Paquete MLB' },
  'price_1TFicFAaoJKjkq1O0GJqz9Th': { sessions: 240, name: 'Paquete MLB' },
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
