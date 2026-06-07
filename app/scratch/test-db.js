import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Ler .env.local manualmente para evitar dependências ausentes
let envVars = {}
try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=')
      if (parts.length >= 2) {
        const key = parts[0].trim()
        let val = parts.slice(1).join('=').trim()
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1)
        }
        envVars[key] = val
      }
    }
  })
} catch (e) {
  console.warn('Erro ao ler .env.local:', e.message)
}

const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

console.log('URL:', supabaseUrl)
console.log('Key:', supabaseKey ? 'Definida (começa com ' + supabaseKey.slice(0, 10) + '...)' : 'Não definida')

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: Variáveis do Supabase não encontradas no .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('\n--- Testando tabela: events ---')
  const { data: events, error: errEvents } = await supabase
    .from('events')
    .select('id, title')
    .limit(1)
  
  if (errEvents) {
    console.error('Erro ao buscar events:', errEvents)
  } else {
    console.log('Sucesso ao buscar events. Encontrado:', events)
  }

  console.log('\n--- Testando tabela: seating_maps ---')
  const { data: seatingMaps, error: errSeating } = await supabase
    .from('seating_maps')
    .select('*')
    .limit(1)

  if (errSeating) {
    console.error('Erro ao buscar seating_maps:', errSeating)
  } else {
    console.log('Sucesso ao buscar seating_maps:', seatingMaps)
  }
}

run()
