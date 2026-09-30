// Números do Google Analytics 4 para a aba "Tráfego & Audiência" do Admin → Analytics.
//
// Chamada: POST com o JWT do admin (supabase.functions.invoke('ga4-analytics', { body })).
//   { periodo: '7d' | '30d' | 'all' } → { ok:true, totais, porDia, paginas, origens, paises, aparelhos, agora }
// Mesmo formato da vercel-analytics, para a tela reaproveitar; aqui "visitantes" = activeUsers.
// Recusas voltam 200 com { ok:false, motivo }; 401 só sem login.
// Permissão: gf_admin_can('view_analytics'), com o JWT de quem pede (sem service role).
// Segredo: GA4_SERVICE_ACCOUNT_B64 = JSON da conta de serviço em base64 (papel Leitor só na
// propriedade). A chave privada assina o JWT aqui mesmo (crypto.subtle); nada do Google
// (token, corpo de erro) vai para a resposta ou para o log.
// API: https://developers.google.com/analytics/devguides/reporting/data/v1 — o GA4 só conta
// quem aceitou cookies; a dimensão date vem no fuso da propriedade (Brasília).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const CONTA_B64 = Deno.env.get('GA4_SERVICE_ACCOUNT_B64') ?? ''

// ID numérico da propriedade GA4 "Evokaa" (não é segredo; não é o G-JJ5JP5DH2L).
const PROPRIEDADE = '556155830'
const API = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPRIEDADE}`
// GA4 entrou no ar em 27/09/2026: "Todo período" começa aí.
const INICIO_GA4 = '2026-09-27'
const DIAS: Record<string, number> = { '7d': 7, '30d': 30, all: 0 }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

class GoogleErro extends Error {
  constructor(public status: number, public etapa: 'token' | 'api') {
    super(`google ${etapa} ${status}`)
  }
}

const b64url = (dados: string | ArrayBuffer) => {
  const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : new Uint8Array(dados)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Fluxo de conta de serviço sem biblioteca: JWT RS256 trocado por access token (vale 1 h).
async function tokenGoogle(conta: { client_email: string; private_key: string }) {
  const pem = conta.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  let chave: CryptoKey
  try {
    chave = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  } catch {
    throw new GoogleErro(0, 'token') // PEM quebrado no segredo
  }
  const agora = Math.floor(Date.now() / 1000)
  const corpo = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: conta.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  }))}`
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(corpo))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${corpo}.${b64url(assinatura)}` }),
  })
  if (!r.ok) {
    await r.body?.cancel()
    throw new GoogleErro(r.status, 'token')
  }
  return (await r.json()).access_token as string
}

async function google(token: string, metodo: string, corpo: unknown) {
  const r = await fetch(`${API}:${metodo}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  if (!r.ok) {
    await r.body?.cancel()
    throw new GoogleErro(r.status, 'api')
  }
  return await r.json()
}

type Relatorio = { rows?: { dimensionValues?: { value: string }[]; metricValues: { value: string }[] }[] }
const num = (v?: { value: string }) => Number(v?.value ?? 0)
// Linhas "(not set)" e "(direct)" do GA4 viram rótulos que a tela já traduz.
const lista = (rel: Relatorio, nome: (v: string) => string) =>
  (rel.rows ?? []).map(l => ({ nome: nome(l.dimensionValues?.[0]?.value ?? ''), visitantes: num(l.metricValues[0]), paginas: num(l.metricValues[1]) }))
const semNotSet = (v: string) => (v === '(not set)' ? '' : v)

// Datas em AAAA-MM-DD no fuso de Brasília (o da propriedade), nunca no relógio UTC da função.
const hojeBrasilia = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
const somaDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { ok: false, motivo: 'entrada_invalida' })

  const authorization = req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+\S+/i.test(authorization)) return json(401, { ok: false, motivo: 'nao_autorizado' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } } })
  const { data: pode, error: permErro } = await supabase.rpc('gf_admin_can', { p: 'view_analytics' })
  if (permErro || pode !== true) return json(200, { ok: false, motivo: 'nao_autorizado' })

  let b: any = null
  try {
    b = await req.json()
  } catch {
    // corpo inválido cai em entrada_invalida
  }
  if (!Object.hasOwn(DIAS, b?.periodo)) return json(200, { ok: false, motivo: 'entrada_invalida' })
  if (!CONTA_B64) return json(200, { ok: false, motivo: 'sem_chave' })

  let conta: { client_email: string; private_key: string }
  try {
    conta = JSON.parse(atob(CONTA_B64))
    if (!conta?.client_email || !conta?.private_key) throw new Error('incompleta')
  } catch {
    return json(200, { ok: false, motivo: 'sem_chave' })
  }

  const ate = hojeBrasilia()
  const dias = DIAS[b.periodo]
  const desde = dias ? somaDias(ate, -(dias - 1)) : INICIO_GA4
  const dateRanges = [{ startDate: desde, endDate: ate }]
  const pessoasEPaginas = [{ name: 'activeUsers' }, { name: 'screenPageViews' }]
  const top = (dimensao: string, ordem: string) => ({
    dateRanges,
    dimensions: [{ name: dimensao }],
    metrics: pessoasEPaginas,
    orderBys: [{ metric: { metricName: ordem }, desc: true }],
    limit: 8,
  })

  try {
    const token = await tokenGoogle(conta)
    const [a, bb, tempoReal] = await Promise.all([
      google(token, 'batchRunReports', {
        requests: [
          { dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }] },
          // ponytail: 1000 dias cobre "Todo período" até ~2029
          { dateRanges, dimensions: [{ name: 'date' }], metrics: pessoasEPaginas, limit: 1000 },
          top('pagePath', 'screenPageViews'),
          top('sessionSource', 'activeUsers'),
        ],
      }),
      google(token, 'batchRunReports', { requests: [top('countryId', 'activeUsers'), top('deviceCategory', 'activeUsers')] }),
      // cota própria; se falhar, o painel sai sem o "agora"
      google(token, 'runRealtimeReport', { metrics: [{ name: 'activeUsers' }] }).catch(() => null),
    ])
    const [totais, porDiaRel, paginas, origens] = a.reports as Relatorio[]
    const [paises, aparelhos] = bb.reports as Relatorio[]

    // O GA4 omite os dias sem visita: completa com zero. `date` vem como AAAAMMDD.
    const doDia = new Map((porDiaRel.rows ?? []).map(l => {
      const d = l.dimensionValues![0].value
      return [`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, l.metricValues]
    }))
    const porDia = []
    for (let dia = desde; dia <= ate; dia = somaDias(dia, 1)) {
      const m = doDia.get(dia)
      porDia.push({ dia, visitantes: num(m?.[0]), paginas: num(m?.[1]) })
    }

    const t = totais.rows?.[0]?.metricValues
    return json(200, {
      ok: true,
      totais: { visitantes: num(t?.[0]), paginas: num(t?.[1]), sessoes: num(t?.[2]) },
      porDia,
      paginas: lista(paginas, v => (v === '(not set)' ? 'Desconhecido' : v)),
      origens: lista(origens, v => (v === '(direct)' ? '' : v === '(not set)' ? 'Desconhecido' : v)),
      paises: lista(paises, semNotSet),
      aparelhos: lista(aparelhos, semNotSet),
      agora: tempoReal ? num((tempoReal as Relatorio).rows?.[0]?.metricValues[0]) : null,
    })
  } catch (e) {
    const g = e instanceof GoogleErro ? e : null
    console.error('ga4-analytics: falha no Google', g?.etapa ?? 'rede', g?.status ?? 0)
    // 400 na troca do token = chave apagada/errada; 401/403 = sem acesso à propriedade
    const motivo = g && (g.etapa === 'token' || g.status === 401 || g.status === 403)
      ? 'credencial_invalida'
      : g?.status === 429 ? 'limite' : 'google_erro'
    return json(200, { ok: false, motivo })
  }
})
