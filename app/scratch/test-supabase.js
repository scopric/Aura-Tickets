import fs from 'fs'
import path from 'path'

// Função simples para ler .env.local manualmente
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Arquivo .env.local não encontrado!')
    return {}
  }
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  content.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const index = trimmed.indexOf('=')
    if (index === -1) return
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    // Remover aspas
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    env[key] = value
  })
  return env
}

const env = loadEnv()
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

console.log('Testando conexão HTTP com Supabase...')
console.log('URL:', supabaseUrl)
console.log('Chave (parcial):', supabaseKey ? supabaseKey.slice(0, 15) + '...' : 'Não configurada')

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: Chaves do Supabase não encontradas no .env.local')
  process.exit(1)
}

async function testConnection() {
  // Chamada direta à REST API pública de eventos do Supabase
  const url = `${supabaseUrl}/rest/v1/events?select=id,title&limit=2`
  console.log(`\nEfetuando GET para: ${url}`)
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })
    
    console.log('Status da resposta:', response.status, response.statusText)
    const text = await response.text()
    
    if (response.ok) {
      console.log('Sucesso! Resposta do banco de dados:')
      console.log(text)
    } else {
      console.error('Erro retornado pelo servidor:')
      console.error(text)
    }
  } catch (err) {
    console.error('Erro de rede ou conexão ao tentar conectar ao Supabase:')
    console.error(err)
  }
}

testConnection()
