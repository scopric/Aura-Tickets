// Números do Vercel Web Analytics para a aba "Tráfego & Audiência" do Admin → Analytics.
//
// Chamada: POST com o JWT do admin (supabase.functions.invoke('vercel-analytics', { body })).
//   { periodo: '7d' | '30d' } → { ok:true, totais, porDia, paginas, origens, paises, aparelhos }
// Recusas voltam 200 com { ok:false, motivo }; 401 só sem login.
// Permissão: gf_admin_can('view_analytics') no banco (mesma regra da rota /admin/analytics),
// chamada com o JWT de quem pede — a função não usa a service role.
// Segredo: VERCEL_ANALYTICS_TOKEN (token da Vercel com escopo só do projeto). Nunca vai
// para a resposta nem para o log; o corpo de erro da Vercel também não.
// API: https://vercel.com/docs/analytics/web-analytics-api — dias agrupados em UTC;
// plano Hobby guarda 1 mês.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const VERCEL_TOKEN = Deno.env.get('VERCEL_ANALYTICS_TOKEN') ?? ''

// IDs do projeto aura-tickets-pypy e do time scoprics-projects: não são segredo.
const PROJETO = 'prj_7ftpPhffwLsJIX34AaGKOxbgRpL1'
const TIME = 'team_Nox6jNrYUnDET3MIXC3tEj2p'
const API = 'https://api.vercel.com/v1/query/web-analytics/visits'
const DIAS: Record<string, number> = { '7d': 7, '30d': 30 }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

class VercelErro extends Error {
  constructor(public status: number) {
    super(`vercel ${status}`)
  }
}

async function consulta(tipo: 'count' | 'aggregate', params: Record<string, string>) {
  const url = new URL(`${API}/${tipo}`)
  url.search = new URLSearchParams({ projectId: PROJETO, teamId: TIME, ...params }).toString()
  const r = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } })
  if (!r.ok) {
    await r.body?.cancel()
    throw new VercelErro(r.status)
  }
  return (await r.json()).data
}

type Linha = Record<string, string | number>
// Só o rótulo e os dois números: o resto da linha não vai para o navegador.
// Além do limit, a Vercel junta o resto numa linha "Others", no meio da ordem: vai para o fim.
const top = (linhas: Linha[], chave: string) =>
  [...(linhas ?? [])].sort((a, b) => Number(a[chave] === 'Others') - Number(b[chave] === 'Others')).map(l => ({ nome: l[chave] === 'Others' ? 'Outros' : String(l[chave] ?? ''), visitantes: Number(l.visitors ?? 0), paginas: Number(l.pageviews ?? 0) }))

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
  // hasOwn: '__proto__', 'toString' etc. não podem passar como período
  const dias = Object.hasOwn(DIAS, b?.periodo) ? DIAS[b.periodo] : 0
  if (!dias) return json(200, { ok: false, motivo: 'entrada_invalida' })
  if (!VERCEL_TOKEN) return json(200, { ok: false, motivo: 'sem_chave' })

  // Janela em dias inteiros UTC, hoje incluído. Os dois endpoints tratam o fim de jeitos
  // diferentes (testado em 30/09): o count corta o `until` para 00:00 do dia e não o inclui;
  // o aggregate sobe o `until` para a meia-noite seguinte. Por isso cada um recebe o seu.
  const DIA = 24 * 60 * 60 * 1000
  const hoje = new Date()
  hoje.setUTCHours(0, 0, 0, 0)
  const since = new Date(hoje.getTime() - (dias - 1) * DIA).toISOString()
  const fimCount = new Date(hoje.getTime() + DIA).toISOString() // amanhã 00:00, exclusivo
  const fimAggregate = new Date(hoje.getTime() + DIA - 1).toISOString() // hoje 23:59:59.999
  const topo = (by: string) => consulta('aggregate', { since, until: fimAggregate, by, limit: '8' })

  try {
    const [totais, porDia, paginas, origens, paises, aparelhos] = await Promise.all([
      consulta('count', { since, until: fimCount }),
      consulta('aggregate', { since, until: fimAggregate, by: 'day', limit: '31' }),
      topo('requestPath'),
      topo('referrerHostname'),
      topo('country'),
      topo('deviceType'),
    ])
    return json(200, {
      ok: true,
      totais: { visitantes: Number(totais?.visitors ?? 0), paginas: Number(totais?.pageviews ?? 0) },
      porDia: (porDia ?? []).map((d: Linha) => ({ dia: String(d.timestamp).slice(0, 10), visitantes: Number(d.visitors ?? 0), paginas: Number(d.pageviews ?? 0) })),
      paginas: top(paginas, 'requestPath'),
      origens: top(origens, 'referrerHostname'),
      paises: top(paises, 'country'),
      aparelhos: top(aparelhos, 'deviceType'),
    })
  } catch (e) {
    const status = e instanceof VercelErro ? e.status : 0
    console.error('vercel-analytics: falha na Vercel, status', status)
    const motivo = status === 401 || status === 403 ? 'token_invalido' : status === 429 ? 'limite' : 'vercel_erro'
    return json(200, { ok: false, motivo })
  }
})
