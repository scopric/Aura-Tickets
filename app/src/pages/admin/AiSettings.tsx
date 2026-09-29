import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2, PlugZap, Info, Search, Gift, Save } from 'lucide-react'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import { PLANS, type PlanId } from '../../lib/plans'
import { Switch } from '../../components/ui/switch'

// Tela do Evo (agente de IA). Contrato: docs/sql/20260929_agente_evo.sql + supabase/functions/agent.
// A chave do Gemini nunca volta ao navegador: só o status (últimos 4) via ai_key_status.

type Nivel = 'simples' | 'complexo' | 'imagem'
type Preco = { in: number; out: number }

interface Settings {
  enabled: boolean
  model_router: string
  model_simple: string
  model_complex: string
  model_vision: string
  prices: Record<string, Preco>
  usd_brl: number
  daily_cap_brl: number
  hourly_limit: number
  quotas: Record<PlanId, number>
  credit_cost: Record<Nivel, number>
  max_steps: number
  max_output_tokens: number
}
type Form = Omit<Settings, 'enabled'>

interface KeyStatus { configurada: boolean; final_4: string | null; atualizada_em: string | null }

interface Resumo {
  totais: { usd: number; brl: number; perguntas: number; chamadas: number; custo_medio_brl: number }
  por_dia: { dia: string; usd: number; perguntas: number }[]
  por_produtor: { user_id: string; nome: string | null; email: string | null; usd: number; perguntas: number; creditos: number }[]
  por_modelo: { model: string | null; usd: number; perguntas: number; tokens_in: number; tokens_out: number }[]
  por_modo: { mode: string; usd: number; perguntas: number }[]
  historico: { id: string; created_at: string; nome: string | null; email: string | null; mode: string; tier: string; model: string | null; tokens_in: number; tokens_out: number; cost_usd: number; credits: number; status: string }[]
}

interface Produtor { id: string; email: string; full_name: string | null }

const MODELOS: [keyof Form, string][] = [
  ['model_router', 'Roteador (classifica a pergunta)'],
  ['model_simple', 'Pergunta simples'],
  ['model_complex', 'Pergunta complexa'],
  ['model_vision', 'Imagem'],
]
const NIVEIS: [Nivel, string][] = [['simples', 'Simples'], ['complexo', 'Complexo'], ['imagem', 'Imagem']]
const PERIODOS = [['hoje', 'Hoje'], ['7d', '7 dias'], ['mes', 'Mês'], ['90d', '90 dias']] as const
type Periodo = typeof PERIODOS[number][0]
const DIA_MS = 24 * 60 * 60 * 1000

const erroDe = (e: unknown) => (e as { message?: string } | null)?.message || 'erro desconhecido'
// função/tabela inexistente: PostgREST (PGRST202/205) ou Postgres (42883/42P01)
const naoInstalado = (e: unknown) => ['PGRST202', 'PGRST205', '42883', '42P01'].includes((e as { code?: string } | null)?.code || '')
const msgErro = (e: unknown) =>
  naoInstalado(e) ? 'Configuração de IA ainda não instalada no banco (falta aplicar docs/sql/20260929_agente_evo.sql).' : erroDe(e)
const usd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const numInput = (v: number) => (Number.isNaN(v) ? '' : String(v))
const lerNum = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')))
const inteiroEntre = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max

function inicioDe(p: Periodo): Date {
  const agora = new Date()
  if (p === 'hoje') return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  if (p === 'mes') return new Date(agora.getFullYear(), agora.getMonth(), 1)
  return new Date(agora.getTime() - (p === '7d' ? 7 : 90) * DIA_MS)
}

// espelha os CHECKs do banco (max_steps 1–8, max_output_tokens 256–8192) e evita valores sem sentido
function validar(f: Form): string | null {
  const modelos = Object.keys(f.prices)
  for (const [k, rotulo] of MODELOS) if (!modelos.includes(f[k] as string)) return `${rotulo}: escolha um modelo da tabela de preços.`
  for (const [m, p] of Object.entries(f.prices)) {
    if (!(p.in >= 0 && p.in <= 1000) || !(p.out >= 0 && p.out <= 1000)) return `Preço de ${m}: entre 0 e 1000 US$ por 1M de tokens.`
  }
  for (const p of PLANS) if (!inteiroEntre(f.quotas[p.id], 0, 100000)) return `Cota do plano ${p.name}: número inteiro de 0 a 100000.`
  for (const [n, rotulo] of NIVEIS) if (!inteiroEntre(f.credit_cost[n], 0, 1000)) return `Custo em créditos (${rotulo}): inteiro de 0 a 1000.`
  if (!inteiroEntre(f.hourly_limit, 1, 10000)) return 'Limite por hora: inteiro de 1 a 10000.'
  if (!(f.daily_cap_brl >= 0 && f.daily_cap_brl < 100000000)) return 'Teto diário: valor em R$ maior ou igual a zero.'
  if (!(f.usd_brl > 0 && f.usd_brl < 10000)) return 'Cotação do dólar: maior que zero.'
  if (!inteiroEntre(f.max_steps, 1, 8)) return 'Passos máximos: inteiro de 1 a 8.'
  if (!inteiroEntre(f.max_output_tokens, 256, 8192)) return 'Tokens de saída máx.: inteiro de 256 a 8192.'
  return null
}

export default function AdminAiSettings() {
  const queryClient = useQueryClient()
  const chaveRef = useRef<HTMLInputElement>(null) // a chave fica só no campo, nunca em estado do React
  const [salvandoChave, setSalvandoChave] = useState(false)
  const [form, setForm] = useState<Form | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('7d')
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<Produtor[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [escolhido, setEscolhido] = useState<Produtor | null>(null)
  const [qtd, setQtd] = useState('')
  const [nota, setNota] = useState('')

  const status = useQuery<KeyStatus>({
    queryKey: ['ai-key-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ai_key_status' as never)
      if (error) throw error
      return data as unknown as KeyStatus
    },
    retry: false,
  })

  const cfgQ = useQuery<Settings | null>({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_settings' as never).select('*').eq('id', 1).maybeSingle()
      if (error) throw error
      return data as unknown as Settings | null
    },
    retry: false,
  })
  const cfg = cfgQ.data ?? null
  // formulário só existe enquanto há edição; sem edição, mostra o que está no banco
  const f: Form | null = form ?? cfg
  const set = <K extends keyof Form>(k: K, v: Form[K]) => f && setForm({ ...f, [k]: v })

  const resumo = useQuery<Resumo>({
    queryKey: ['ai-admin-resumo', periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ai_admin_resumo' as never, { p_de: inicioDe(periodo).toISOString(), p_ate: new Date().toISOString() } as never)
      if (error) throw error
      return data as unknown as Resumo
    },
    retry: false,
  })

  const salvarChave = async (e: React.FormEvent) => {
    e.preventDefault()
    const campo = chaveRef.current
    if (!campo) return
    const tam = campo.value.trim().length
    if (tam < 20 || tam > 200) { toast.error('A chave deve ter de 20 a 200 caracteres.'); return }
    setSalvandoChave(true)
    const { error } = await supabase.rpc('ai_set_gemini_key' as never, { p_key: campo.value.trim() } as never)
    setSalvandoChave(false)
    if (error) { toast.error('Não foi possível salvar a chave: ' + msgErro(error)); return }
    campo.value = ''
    toast.success('Chave salva no cofre do banco.')
    queryClient.invalidateQueries({ queryKey: ['ai-key-status'] })
  }

  const testar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('agent', { body: { mode: 'ping' } })
      if (error) {
        // resposta não-2xx: tenta ler a mensagem do corpo
        const ctx = (error as { context?: Response }).context
        const corpo = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
        throw new Error((corpo as { message?: string } | null)?.message || erroDe(error))
      }
      const r = data as { ok: boolean; model?: string; latency_ms?: number; message?: string }
      if (!r?.ok) throw new Error(r?.message || 'resposta inesperada da função')
      return r
    },
    onSuccess: r => toast.success(`Conexão ok: ${r.model} em ${r.latency_ms} ms.`),
    onError: e => toast.error('Teste falhou: ' + erroDe(e)),
  })

  const ligar = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data, error } = await supabase.from('ai_settings' as never).update({ enabled, updated_at: new Date().toISOString() } as never).eq('id', 1).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Nada foi gravado (sem permissão ou configuração inexistente).')
    },
    onSuccess: (_, enabled) => {
      toast.success(enabled ? 'Evo ligado.' : 'Evo desligado.')
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
    },
    onError: e => toast.error('Não foi possível alterar: ' + msgErro(e)),
  })

  const salvar = useMutation({
    mutationFn: async (v: Form) => {
      const payload = {
        model_router: v.model_router,
        model_simple: v.model_simple,
        model_complex: v.model_complex,
        model_vision: v.model_vision,
        prices: v.prices,
        usd_brl: v.usd_brl,
        daily_cap_brl: v.daily_cap_brl,
        hourly_limit: v.hourly_limit,
        quotas: v.quotas,
        credit_cost: v.credit_cost,
        max_steps: v.max_steps,
        max_output_tokens: v.max_output_tokens,
        updated_at: new Date().toISOString(),
      }
      // `.select('id')`: sem ele, uma gravação barrada pelo RLS volta "sucesso" com zero linhas
      const { data, error } = await supabase.from('ai_settings' as never).update(payload as never).eq('id', 1).select('id')
      if (error) {
        if (error.code === '23514') throw new Error('O banco recusou: confira passos (1–8) e tokens de saída (256–8192).')
        throw error
      }
      if (!data?.length) throw new Error('Nada foi gravado (sem permissão ou configuração inexistente).')
    },
    onSuccess: () => {
      toast.success('Configurações salvas.')
      setForm(null)
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
    },
    onError: e => toast.error('Não foi possível salvar: ' + msgErro(e)),
  })

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f) return
    const msg = validar(f)
    if (msg) { toast.error(msg); return }
    salvar.mutate(f)
  }

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault()
    const termo = busca.trim()
    if (termo.length < 3) { toast.error('Digite pelo menos 3 letras do e-mail.'); return }
    setBuscando(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'producer')
      .ilike('email', `%${termo.replace(/[%_\\]/g, '\\$&')}%`)
      .order('email')
      .limit(10)
    setBuscando(false)
    if (error) { toast.error('Não foi possível buscar: ' + erroDe(error)); return }
    setAchados((data || []) as Produtor[])
    setEscolhido(null)
  }

  const conceder = useMutation({
    mutationFn: async (v: { p: Produtor; amount: number; note: string }) => {
      const { error } = await supabase.rpc('ai_grant_credits' as never, { p_user: v.p.id, p_amount: v.amount, p_note: v.note || null } as never)
      if (error) throw error
    },
    onSuccess: (_, v) => {
      toast.success(`${v.amount} crédito(s) concedido(s) a ${v.p.email}.`)
      setQtd('')
      setNota('')
      setEscolhido(null)
      queryClient.invalidateQueries({ queryKey: ['ai-admin-resumo'] })
    },
    onError: e => toast.error('Não foi possível conceder: ' + msgErro(e)),
  })

  const enviarCredito = (e: React.FormEvent) => {
    e.preventDefault()
    if (!escolhido) { toast.error('Escolha o produtor.'); return }
    const n = lerNum(qtd)
    if (!inteiroEntre(n, 1, 10000)) { toast.error('Quantidade: inteiro de 1 a 10000.'); return }
    if (nota.trim().length > 200) { toast.error('Nota: até 200 caracteres.'); return }
    conceder.mutate({ p: escolhido, amount: n, note: nota.trim() })
  }

  const r = resumo.data
  const reais = (v: number) => (cfg ? brl(v * cfg.usd_brl) : '—')
  const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary'
  const cardCls = 'p-6 rounded-2xl bg-card border border-border space-y-4'
  const thCls = 'px-3 py-2 text-[11px] uppercase text-muted-foreground font-semibold'
  const vazio = (t: string) => <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">{t}</p>

  return (
    <div className="p-6 lg:p-10 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <img src="/evo/evo-avatar.webp" alt="" className="w-12 h-12 rounded-full" width={48} height={48} />
        <div>
          <h1 className="font-serif text-3xl text-foreground">IA / Evo</h1>
          <p className="text-sm text-muted-foreground mt-1">Chave do Google Gemini, modelos, limites, créditos e gasto do assistente Evo.</p>
        </div>
      </div>

      {cfgQ.isError && (
        <div role="alert" className="p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
          Não foi possível carregar a configuração: {msgErro(cfgQ.error)}
        </div>
      )}

      {/* 1. Chave */}
      <section className={cardCls} aria-labelledby="ia-chave">
        <h2 id="ia-chave" className="text-lg font-semibold text-foreground flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" aria-hidden="true" /> Chave do Google Gemini</h2>
        <p className="text-sm" aria-live="polite">
          {status.isLoading ? <span className="text-muted-foreground">Verificando…</span>
            : status.isError ? <span className="text-red-600">{msgErro(status.error)}</span>
            : status.data?.configurada ? <span className="text-green-700 dark:text-green-400">Configurada — termina em ••••{status.data.final_4}{status.data.atualizada_em ? `, atualizada em ${dataBr(status.data.atualizada_em)}` : ''}</span>
            : <span className="text-amber-700">Não configurada</span>}
        </p>
        <form onSubmit={salvarChave} className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="ia-chave-input" className="sr-only">Nova chave do Gemini</label>
          <input id="ia-chave-input" ref={chaveRef} type="password" autoComplete="off" spellCheck={false} maxLength={200} className={inputCls} placeholder="Cole a nova chave aqui" />
          <button type="submit" disabled={salvandoChave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap">
            {salvandoChave && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Salvar chave
          </button>
          <button type="button" onClick={() => testar.mutate()} disabled={testar.isPending} className="px-4 py-2 rounded-lg border border-border text-sm text-foreground flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap">
            {testar.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <PlugZap className="w-4 h-4" aria-hidden="true" />} Testar conexão
          </button>
        </form>
        {testar.data && <p className="text-xs text-green-700 dark:text-green-400">Conexão ok: {testar.data.model}, {testar.data.latency_ms} ms.</p>}
        {testar.isError && <p className="text-xs text-red-600" role="alert">Teste falhou: {erroDe(testar.error)}</p>}
        <p className="text-xs text-muted-foreground">Crie a chave em aistudio.google.com com faturamento ativo (plano pago). No plano gratuito o Google usa os dados para treinar — não use.</p>
      </section>

      {/* 2. Liga/desliga */}
      <section className={cardCls} aria-labelledby="ia-ligado">
        <div className="flex items-center justify-between gap-4">
          <h2 id="ia-ligado" className="text-lg font-semibold text-foreground">Evo {cfg?.enabled ? 'ligado' : 'desligado'}</h2>
          <Switch
            checked={!!cfg?.enabled}
            disabled={!cfg || ligar.isPending}
            onCheckedChange={v => ligar.mutate(v)}
            aria-labelledby="ia-ligado"
          />
        </div>
        <p className="text-xs text-amber-800 dark:text-amber-300 flex gap-2"><Info className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Ligue só depois da liberação do jurídico (Google como processador de dados fora do Brasil).</p>
      </section>

      {cfgQ.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-primary animate-spin" aria-label="Carregando" /></div>
      ) : f ? (
        <form onSubmit={enviar} className="space-y-6">
          {/* 3. Modelos e preços */}
          <section className={cardCls} aria-labelledby="ia-modelos">
            <h2 id="ia-modelos" className="text-lg font-semibold text-foreground">Modelos por nível</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MODELOS.map(([k, rotulo]) => (
                <label key={k} className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">{rotulo}</span>
                  <select className={inputCls} value={f[k] as string} onChange={e => set(k, e.target.value)}>
                    {Object.keys(f.prices).map(m => <option key={m} value={m}>{m}{m.includes('preview') ? ' (preview)' : ''}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Preço por modelo, em US$ por 1 milhão de tokens</caption>
                <thead className="border-b border-border">
                  <tr><th className={thCls}>Modelo</th><th className={thCls}>Entrada (US$/1M)</th><th className={thCls}>Saída (US$/1M)</th></tr>
                </thead>
                <tbody>
                  {Object.entries(f.prices).map(([m, p]) => (
                    <tr key={m} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-foreground">
                        {m} {m.includes('preview') && <span className="ml-1 px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 font-sans">preview</span>}
                      </td>
                      {(['in', 'out'] as const).map(lado => (
                        <td key={lado} className="px-3 py-2">
                          <input
                            className={`${inputCls} max-w-[8rem]`}
                            inputMode="decimal"
                            aria-label={`${m}: preço de ${lado === 'in' ? 'entrada' : 'saída'} em US$ por 1M de tokens`}
                            value={numInput(p[lado])}
                            onChange={e => set('prices', { ...f.prices, [m]: { ...p, [lado]: lerNum(e.target.value) } })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Preços oficiais de 29/09/2026; os Gemini 3.x Flash dobram em 01/01/2027.</p>
          </section>

          {/* 4. Limites e créditos */}
          <section className={cardCls} aria-labelledby="ia-limites">
            <h2 id="ia-limites" className="text-lg font-semibold text-foreground">Limites e créditos</h2>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-foreground">Créditos por plano</legend>
              <p className="text-xs text-muted-foreground">Todos os planos renovam no dia 1º e não acumulam para o mês seguinte.</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {PLANS.map(p => (
                  <label key={p.id} className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">{p.name}{p.id === 'free' ? ' (total)' : ' (mês)'}</span>
                    <input className={inputCls} inputMode="numeric" value={numInput(f.quotas[p.id])} onChange={e => set('quotas', { ...f.quotas, [p.id]: lerNum(e.target.value) })} />
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-foreground">Custo em créditos por pergunta</legend>
              <div className="grid grid-cols-3 gap-3 sm:w-2/3">
                {NIVEIS.map(([n, rotulo]) => (
                  <label key={n} className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">{rotulo}</span>
                    <input className={inputCls} inputMode="numeric" value={numInput(f.credit_cost[n])} onChange={e => set('credit_cost', { ...f.credit_cost, [n]: lerNum(e.target.value) })} />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {([
                ['hourly_limit', 'Perguntas por hora (por produtor)', 'numeric'],
                ['daily_cap_brl', 'Teto diário da plataforma (R$)', 'decimal'],
                ['usd_brl', 'Cotação do dólar (R$)', 'decimal'],
                ['max_steps', 'Passos máximos (1–8)', 'numeric'],
                ['max_output_tokens', 'Tokens de saída máx. (256–8192)', 'numeric'],
              ] as const).map(([k, rotulo, modo]) => (
                <label key={k} className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">{rotulo}</span>
                  <input className={inputCls} inputMode={modo} value={numInput(f[k])} onChange={e => set(k, lerNum(e.target.value))} />
                </label>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-2">
            {form && <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground">Descartar alterações</button>}
            <button type="submit" disabled={!form || salvar.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              {salvar.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />} Salvar configurações
            </button>
          </div>
        </form>
      ) : !cfgQ.isError ? (
        vazio('Configuração de IA não encontrada no banco (linha de ai_settings ausente ou sem permissão).')
      ) : null}

      {/* 5. Painel de gasto */}
      <section className={cardCls} aria-labelledby="ia-gasto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 id="ia-gasto" className="text-lg font-semibold text-foreground">Gasto</h2>
          <div className="flex bg-background p-1 border border-border rounded-xl w-fit" role="group" aria-label="Período">
            {PERIODOS.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={periodo === v} onClick={() => setPeriodo(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${periodo === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {resumo.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-primary animate-spin" aria-label="Carregando" /></div>
        ) : resumo.isError ? (
          <div role="alert" className="p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">Não foi possível carregar o gasto: {msgErro(resumo.error)}</div>
        ) : !r ? vazio('Sem dados.') : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Gasto (US$)', usd(r.totais.usd)],
                ['Gasto (R$)', brl(r.totais.brl)],
                ['Perguntas', String(r.totais.perguntas), `${r.totais.chamadas} ${r.totais.chamadas === 1 ? 'chamada' : 'chamadas'} à IA (inclui testes e recusas)`],
                ['Custo médio por pergunta', r.totais.perguntas > 0 ? brl(r.totais.custo_medio_brl) : '—'],
              ].map(([l, v, obs]) => (
                <div key={l} className="p-4 rounded-xl bg-muted/40 border border-border">
                  <div className="text-xs text-muted-foreground">{l}</div>
                  <div className="font-serif text-2xl text-foreground mt-1">{v}</div>
                  {obs && <div className="text-xs text-muted-foreground mt-1">{obs}</div>}
                </div>
              ))}
            </div>

            {r.por_dia.length === 0 ? vazio('Nenhuma pergunta no período.') : (
              <div className="h-64" role="img" aria-label="Gráfico de gasto em US$ por dia">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.por_dia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                    <Tooltip formatter={(v: number, nome: string) => (nome === 'usd' ? [usd(v), 'Gasto'] : [v, nome])} />
                    <Bar dataKey="usd" fill="#8f33f5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <h3 className="text-sm font-semibold text-foreground">Produtores que mais gastaram (top 20)</h3>
            {r.por_produtor.length === 0 ? vazio('Nenhum produtor no período.') : (
              <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border"><tr>
                    <th className={thCls}>Produtor</th><th className={thCls}>Perguntas</th><th className={thCls}>Créditos</th><th className={thCls}>Gasto (R$)</th>
                  </tr></thead>
                  <tbody>
                    {r.por_produtor.map(p => (
                      <tr key={p.user_id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-foreground">{p.nome || '—'}<div className="text-[11px] text-muted-foreground">{p.email || '—'}</div></td>
                        <td className="px-3 py-2">{p.perguntas}</td>
                        <td className="px-3 py-2">{p.creditos}</td>
                        <td className="px-3 py-2">{reais(p.usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Por modelo</h3>
                {r.por_modelo.length === 0 ? vazio('Sem dados.') : (
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border"><tr>
                        <th className={thCls}>Modelo</th><th className={thCls}>Perguntas</th><th className={thCls}>Tokens (entrada/saída)</th><th className={thCls}>US$</th>
                      </tr></thead>
                      <tbody>
                        {r.por_modelo.map(m => (
                          <tr key={m.model || '-'} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 font-mono text-xs">{m.model || '—'}</td>
                            <td className="px-3 py-2">{m.perguntas}</td>
                            <td className="px-3 py-2 text-xs">{m.tokens_in.toLocaleString('pt-BR')} / {m.tokens_out.toLocaleString('pt-BR')}</td>
                            <td className="px-3 py-2">{usd(m.usd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Por modo</h3>
                {r.por_modo.length === 0 ? vazio('Sem dados.') : (
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border"><tr>
                        <th className={thCls}>Modo</th><th className={thCls}>Perguntas</th><th className={thCls}>US$</th>
                      </tr></thead>
                      <tbody>
                        {r.por_modo.map(m => (
                          <tr key={m.mode} className="border-b border-border last:border-0">
                            <td className="px-3 py-2">{m.mode}</td>
                            <td className="px-3 py-2">{m.perguntas}</td>
                            <td className="px-3 py-2">{usd(m.usd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <h3 className="text-sm font-semibold text-foreground">Histórico (últimas 100 do período)</h3>
            {r.historico.length === 0 ? vazio('Nenhuma pergunta no período.') : (
              <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border"><tr>
                    <th className={thCls}>Data</th><th className={thCls}>Produtor</th><th className={thCls}>Modo</th><th className={thCls}>Nível</th>
                    <th className={thCls}>Modelo</th><th className={thCls}>Tokens</th><th className={thCls}>Custo</th><th className={thCls}>Situação</th>
                  </tr></thead>
                  <tbody>
                    {r.historico.map(h => (
                      <tr key={h.id} className="border-b border-border last:border-0 align-top">
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{dataBr(h.created_at)}</td>
                        <td className="px-3 py-2 text-xs">{h.nome || '—'}<div className="text-[11px] text-muted-foreground">{h.email || '—'}</div></td>
                        <td className="px-3 py-2 text-xs">{h.mode}</td>
                        <td className="px-3 py-2 text-xs">{h.tier}</td>
                        <td className="px-3 py-2 font-mono text-[11px]">{h.model || '—'}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{h.tokens_in} / {h.tokens_out}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{usd(h.cost_usd)}<div className="text-[11px] text-muted-foreground">{h.credits} crédito(s)</div></td>
                        <td className={`px-3 py-2 text-xs ${h.status === 'erro' ? 'text-red-600' : h.status === 'pendente' ? 'text-amber-700' : 'text-green-700'}`}>{h.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* 6. Conceder créditos */}
      <section className={cardCls} aria-labelledby="ia-creditos">
        <h2 id="ia-creditos" className="text-lg font-semibold text-foreground flex items-center gap-2"><Gift className="w-5 h-5 text-primary" aria-hidden="true" /> Conceder créditos</h2>
        <p className="text-xs text-muted-foreground">Créditos extras valem no mês em que forem concedidos.</p>
        <form onSubmit={buscar} className="flex gap-2">
          <label htmlFor="ia-busca" className="sr-only">E-mail do produtor</label>
          <input id="ia-busca" className={inputCls} value={busca} onChange={e => setBusca(e.target.value)} placeholder="E-mail do produtor" maxLength={120} />
          <button type="submit" disabled={buscando} className="px-4 py-2 rounded-lg border border-border text-sm text-foreground flex items-center gap-2 disabled:opacity-50">
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />} Buscar
          </button>
        </form>
        {achados && (achados.length === 0 ? vazio('Nenhum produtor com esse e-mail.') : (
          <fieldset className="space-y-1">
            <legend className="text-xs font-semibold text-muted-foreground">Escolha o produtor</legend>
            {achados.map(p => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="radio" name="ia-produtor" checked={escolhido?.id === p.id} onChange={() => setEscolhido(p)} />
                {p.full_name || '—'} <span className="text-muted-foreground">({p.email})</span>
              </label>
            ))}
          </fieldset>
        ))}
        {escolhido && (
          <form onSubmit={enviarCredito} className="grid grid-cols-1 sm:grid-cols-[8rem_1fr_auto] gap-2 items-end">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Quantidade (1–10000)</span>
              <input className={inputCls} inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value.replace(/\D/g, ''))} required />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Nota (opcional, até 200)</span>
              <input className={inputCls} value={nota} onChange={e => setNota(e.target.value)} maxLength={200} />
            </label>
            <button type="submit" disabled={conceder.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {conceder.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Conceder a {escolhido.email}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
