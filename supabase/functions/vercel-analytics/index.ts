// Números do Vercel Web Analytics para a aba "Tráfego & Audiência" do Admin → Analytics.
//
// Chamada: POST com o JWT do admin (supabase.functions.invoke('vercel-analytics', { body })).
//   { periodo: '7d' | '30d' | { de, ate: 'AAAA-MM-DD' }, filtros?: [{ campo, valor }] (até 4) }
//   → { ok:true, de, ate, totais, comparacao, semComparacao, porDia, paginas, origens, paises, aparelhos, eventos }
//   campo ∈ pais | aparelho | pagina | origem; `valor` é o `valor` cru que as listas devolvem.
// Recusas voltam 200 com { ok:false, motivo }; 401 só sem login.
// Permissão: gf_admin_can('view_analytics') no banco (mesma regra da rota /admin/analytics),
// chamada com o JWT de quem pede — a função não usa a service role.
// Segredo: VERCEL_ANALYTICS_TOKEN (token da Vercel com escopo só do projeto). Nunca vai
// para a resposta nem para o log; o corpo de erro da Vercel também não.
// API: https://vercel.com/docs/analytics/web-analytics-api — dias agrupados em UTC;
// plano Hobby guarda 1 mês.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const VERCEL_TOKEN = Deno.env.get('VERCEL_ANALYTICS_TOKEN') ?? ''

// IDs do projeto aura-tickets-pypy e do time scoprics-projects: não são segredo.
const PROJETO = 'prj_7ftpPhffwLsJIX34AaGKOxbgRpL1'
const TIME = 'team_Nox6jNrYUnDET3MIXC3tEj2p'
const API = 'https://api.vercel.com/v1/query/web-analytics/visits'
const DIAS: Record<string, number> = { '7d': 7, '30d': 30 }
const DIA = 24 * 60 * 60 * 1000
const JANELA_DIAS = 30 // plano Hobby: a Vercel guarda 1 mês

// Filtros: lista fechada de campos e formato fixo por campo, sem aspa, parêntese, espaço nem
// "%" (nada que vire aspa se a Vercel decodificar) — não há o que escapar. Páginas com "%"
// no endereço ficam sem filtro (a tela não oferece o clique).
const CAMPOS: Record<string, { coluna: string; formato: RegExp }> = {
  pais: { coluna: 'country', formato: /^([A-Z]{2})?$/ },
  aparelho: { coluna: 'deviceType', formato: /^(desktop|mobile|tablet|)$/ },
  pagina: { coluna: 'requestPath', formato: /^\/[\p{L}\p{Nd}._~/-]{0,199}$/u },
  origem: { coluna: 'referrerHostname', formato: /^([a-z0-9.-]{1,253})?$/ },
}

class VercelErro extends Error {
  constructor(public status: number) {
    super(`vercel ${status}`)
  }
}

async function consulta(tipo: 'count' | 'aggregate', params: Record<string, string>) {
  const url = new URL(`${API}/${tipo}`)
  // projeto e time por último: nenhum parâmetro consegue trocá-los
  url.search = new URLSearchParams({ ...params, projectId: PROJETO, teamId: TIME }).toString()
  const r = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } })
  if (!r.ok) {
    await r.body?.cancel()
    throw new VercelErro(r.status)
  }
  return (await r.json()).data
}

type Linha = Record<string, string | number>
// Rótulo, valor cru (o que a API aceita como filtro; null = não filtrável) e os dois números.
// Além do limit, a Vercel junta o resto numa linha "Others", no meio da ordem: vai para o fim.
// O valor só sai filtrável se passar no mesmo formato que o filtro exige (senão o clique viraria erro).
const top = (linhas: Linha[], chave: string) => {
  const formato = Object.values(CAMPOS).find(c => c.coluna === chave)?.formato
  return [...(linhas ?? [])].sort((a, b) => Number(a[chave] === 'Others') - Number(b[chave] === 'Others')).map(l => {
    const cru = String(l[chave] ?? '')
    return {
    nome: l[chave] === 'Others' ? 'Outros' : cru,
    valor: l[chave] === 'Others' || !formato?.test(cru) ? null : cru,
    visitantes: Number(l.visitors ?? 0),
    paginas: Number(l.pageviews ?? 0),
  }
  })
}

const diaISO = (t: number) => new Date(t).toISOString().slice(0, 10)
const inicioDia = (dia: string) => Date.parse(`${dia}T00:00:00Z`)
const ehDia = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
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
  if (!VERCEL_TOKEN) return json(200, { ok: false, motivo: 'sem_chave' })

  // Janela em dias inteiros UTC. Os dois endpoints tratam o fim de jeitos diferentes (testado
  // em 30/09): o count corta o `until` para 00:00 do dia e não o inclui; o aggregate sobe o
  // `until` para a meia-noite seguinte. Por isso cada um recebe o seu.
  const hoje = new Date()
  hoje.setUTCHours(0, 0, 0, 0)
  const primeiroDia = hoje.getTime() - (JANELA_DIAS - 1) * DIA
  let de: number
  let ate: number
  // hasOwn: '__proto__', 'toString' etc. não podem passar como período
  if (typeof b?.periodo === 'string' && Object.hasOwn(DIAS, b.periodo)) {
    de = hoje.getTime() - (DIAS[b.periodo] - 1) * DIA
    ate = hoje.getTime()
  } else if (ehDia(b?.periodo?.de) && ehDia(b?.periodo?.ate)) {
    de = inicioDia(b.periodo.de)
    ate = inicioDia(b.periodo.ate)
    if (de > ate || ate > hoje.getTime()) return json(200, { ok: false, motivo: 'entrada_invalida' })
    if (de < primeiroDia) return json(200, { ok: false, motivo: 'fora_da_janela' })
  } else {
    return json(200, { ok: false, motivo: 'entrada_invalida' })
  }

  // Filtros combinados com "and"; cada valor já passou pelo formato do seu campo.
  const lista = b?.filtros ?? []
  if (!Array.isArray(lista) || lista.length > 4) return json(200, { ok: false, motivo: 'entrada_invalida' })
  const partes: string[] = []
  for (const f of lista) {
    const campo = typeof f?.campo === 'string' && Object.hasOwn(CAMPOS, f.campo) ? CAMPOS[f.campo] : null
    if (!campo || typeof f.valor !== 'string' || !campo.formato.test(f.valor)) return json(200, { ok: false, motivo: 'entrada_invalida' })
    partes.push(`${campo.coluna} eq '${f.valor}'`)
  }
  const filtro = partes.length ? { filter: partes.join(' and ') } : {}
  // páginas de evento (/event/<id ou slug>) com os mesmos filtros; a tela troca pelo nome do evento
  const filtroEventos = { filter: ["startswith(requestPath,'/event/')", ...partes].join(' and ') }

  const janela = (inicio: number, fim: number) => ({ since: new Date(inicio).toISOString(), fimCount: new Date(fim + DIA).toISOString(), fimAgg: new Date(fim + DIA - 1).toISOString() })
  const j = janela(de, ate)
  const topo = (by: string) => consulta('aggregate', { since: j.since, until: j.fimAgg, by, limit: '8', ...filtro })

  // Comparação com dias completos (sem hoje, que está pela metade): os N dias até ontem
  // (ou até `ate`, se for antes) contra os N dias anteriores. Só se o anterior cabe na janela.
  const fimComp = Math.min(ate, hoje.getTime() - DIA)
  const n = Math.round((fimComp - de) / DIA) + 1
  const inicioAnterior = de - n * DIA
  const comparar = n >= 1 && inicioAnterior >= primeiroDia
  const contagem = (inicio: number, fim: number) => {
    const w = janela(inicio, fim)
    return consulta('count', { since: w.since, until: w.fimCount, ...filtro }).catch(() => null)
  }

  try {
    const [totais, porDia, paginas, origens, paises, aparelhos, compAtual, compAnterior, eventos] = await Promise.all([
      consulta('count', { since: j.since, until: j.fimCount, ...filtro }),
      consulta('aggregate', { since: j.since, until: j.fimAgg, by: 'day', limit: '31', ...filtro }),
      topo('requestPath'),
      topo('referrerHostname'),
      topo('country'),
      topo('deviceType'),
      comparar ? contagem(de, fimComp) : null,
      comparar ? contagem(inicioAnterior, de - DIA) : null,
      // se só os eventos falharem, o painel continua de pé
      consulta('aggregate', { since: j.since, until: j.fimAgg, by: 'requestPath', limit: '50', ...filtroEventos }).catch(() => null),
    ])
    const num = (t: any) => ({ visitantes: Number(t?.visitors ?? 0), paginas: Number(t?.pageviews ?? 0) })
    return json(200, {
      ok: true,
      de: diaISO(de),
      ate: diaISO(ate),
      totais: num(totais),
      comparacao: compAtual && compAnterior ? { atual: num(compAtual), anterior: num(compAnterior), dias: n } : null,
      semComparacao: compAtual && compAnterior ? null : comparar ? 'falha' : 'periodo',
      porDia: (porDia ?? []).map((d: Linha) => ({ dia: String(d.timestamp).slice(0, 10), visitantes: Number(d.visitors ?? 0), paginas: Number(d.pageviews ?? 0) })),
      paginas: top(paginas, 'requestPath'),
      origens: top(origens, 'referrerHostname'),
      paises: top(paises, 'country'),
      aparelhos: top(aparelhos, 'deviceType'),
      eventos: !Array.isArray(eventos) ? null : (eventos as Linha[]).filter(l => l.requestPath !== 'Others').map(l => ({ caminho: String(l.requestPath ?? ''), visitantes: Number(l.visitors ?? 0), paginas: Number(l.pageviews ?? 0) })),
    })
  } catch (e) {
    const status = e instanceof VercelErro ? e.status : 0
    console.error('vercel-analytics: falha na Vercel, status', status)
    const motivo = status === 401 || status === 403 ? 'token_invalido' : status === 429 ? 'limite' : 'vercel_erro'
    return json(200, { ok: false, motivo })
  }
})
