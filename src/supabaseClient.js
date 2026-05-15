import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ ERROR: Faltan las llaves de Supabase en Vercel Settings.");
}

// Unauthenticated client — used for public reads (events, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Returns a Supabase client that sends the Clerk JWT so auth.uid() works in RLS.
// Usage: const sb = await getAuthClient(session); await sb.from('profiles').insert(...)
export async function getAuthClient(session) {
  if (!session) return supabase
  const token = await session.getToken({ template: 'supabase' })
  if (!token) {
    console.warn('[Supabase] Clerk token is null — falling back to anon client. Check your Clerk JWT template.')
    return supabase
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}
