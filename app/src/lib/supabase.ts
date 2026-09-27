import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Variáveis de ambiente do Supabase não definidas. Auth e DB estarão indisponíveis localmente. Verifique o seu arquivo .env.local')
}

// Hash do link de e-mail (#access_token=…&type=recovery ou #error=…), lido antes de o
// supabase-js processá-lo e limpá-lo da URL. Usado pela tela de nova senha.
export const initialAuthHash = new URLSearchParams(window.location.hash.slice(1))

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)
