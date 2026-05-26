import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rwaezeqyuhxrssntcxdv.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_d6yhWhXNJnKHbALR-rdD2w_utpG-Kip'

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Variáveis de ambiente não definidas. Usando fallback.')
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseKey,
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
