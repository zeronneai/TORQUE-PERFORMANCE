import { createClient } from '@supabase/supabase-js'

// --- NO TOQUES ESTAS LÍNEAS, VERCEL LAS LLENARÁ SOLO ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validación rápida para que no te rompas la cabeza si algo falla
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ ERROR: Faltan las llaves de Supabase en Vercel Settings.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
