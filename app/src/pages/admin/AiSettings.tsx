import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import { PRIVACY_VERSION } from '../../lib/legal'
import { PLANS, type PlanId } from '../../lib/plans'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Spinner } from '../../components/ui/spinner'
import { Switch } from '../../components/ui/switch'
import { Segmented } from '../../components/ui/toggle-group'
import { EmptyState, PageHeader, SectionTitle, Stat, chipAviso, selectNativo } from '../../components/producer/ui'
import { Tabela, alertaAviso, alertaErro, painel, th } from '../../components/admin/ui'
import { cn } from '../../lib/utils'

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

// Aviso da Política de Privacidade por e-mail: supabase/functions/aviso-politica + docs/sql/20260929_aviso_politica.sql
interface AvisoResp { ok: boolean; motivo?: string; destinatarios?: number; enviados?: number; falhas?: number; restantes?: number }
const AVISO_ERROS: Record<string, string> = {
  nao_autorizado: 'Sem permissão: o envio exige super_admin ou manage_settings.',
  sem_resend: 'O envio de e-mails não está configurado (falta o segredo RESEND_API_KEY nas funções do Supabase).',
  entrada_invalida: 'Pedido inválido. Recarregue a página e tente de novo.',
  erro_banco: 'Não foi possível ler os destinatários no banco (falta aplicar docs/sql/20260929_aviso_politica.sql?).',
}
async function chamarAviso(body: { mode: 'contar' | 'enviar'; confirmacao?: string }): Promise<AvisoResp> {
  const { data, error } = await supabase.functions.invoke('aviso-politica', { body })
  if (error) {
    const ctx = (error as { context?: unknown }).context
    if (ctx instanceof Response) {
      if (ctx.status === 404) throw new Error('Função de aviso ainda não publicada.')
      if (ctx.status === 401) throw new Error('Sua sessão expirou. Entre de novo.')
      throw new Error(`A função de aviso respondeu com erro ${ctx.status}.`)
    }
    // sem Response: função não publicada (o preflight dá 404 e o navegador acusa CORS) ou sem conexão;
    // no envio, a resposta pode ter se perdido depois de parte dos e-mails sair
    throw new Error(body.mode === 'enviar'
      ? 'Não houve resposta; parte pode ter sido enviada. Clique em "Contar destinatários" antes de repetir.'
      : 'Função de aviso ainda não publicada (ou sem conexão).')
  }
  const r = data as AvisoResp | null
  if (!r?.ok) throw new Error(AVISO_ERROS[r?.motivo ?? ''] ?? 'Resposta inesperada da função de aviso.')
  return r
}
const pessoas = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`

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
  const [avisoN, setAvisoN] = useState<number | null>(null)
  const [avisoConfirma, setAvisoConfirma] = useState('')

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

  const contarAviso = useMutation({
    mutationFn: () => chamarAviso({ mode: 'contar' }),
    onSuccess: r => setAvisoN(r.destinatarios ?? 0),
    onError: () => setAvisoN(null),
  })
  const enviarAviso = useMutation({
    mutationFn: () => chamarAviso({ mode: 'enviar', confirmacao: 'ENVIAR' }),
    // quem falhou ou ficou para depois continua pendente no banco
    onSuccess: r => setAvisoN((r.falhas ?? 0) + (r.restantes ?? 0)),
    onError: () => setAvisoN(null),
  })
  const podeEnviarAviso = avisoConfirma === 'ENVIAR' && (avisoN ?? 0) > 0 && !enviarAviso.isPending

  const r = resumo.data
  const reais = (v: number) => (cfg ? brl(v * cfg.usd_brl) : '—')
  const cardCls = cn(painel, 'space-y-4 p-4 sm:p-6')
  const vazio = (t: string) => <EmptyState title={t} />
  // tabela de apoio dentro de um cartão: moldura própria, rolagem horizontal da Tabela
  const molde = 'overflow-hidden rounded-[10px] border border-border'
  const corStatus = (s: string) => (s === 'erro' ? 'text-destructive' : s === 'pendente' ? 'text-[var(--ev-warning)]' : 'text-[var(--ev-success)]')

  return (
    <div className="p-6 lg:p-10 max-w-7xl space-y-6">
      <div className="flex items-start gap-3">
        <img src="/evo/evo-avatar.webp" alt="" className="size-12 rounded-full" width={48} height={48} />
        <div className="min-w-0 flex-1 [&>div]:mb-0">
          <PageHeader title="IA / Evo" description="Chave do Google Gemini, modelos, limites, créditos e gasto do assistente Evo." />
        </div>
      </div>

      {cfgQ.isError && (
        <div role="alert" className={alertaErro}>
          Não foi possível carregar a configuração: {msgErro(cfgQ.error)}
        </div>
      )}

      {/* 1. Chave */}
      <section className={cardCls} aria-labelledby="ia-chave">
        <div className="flex items-center gap-2"><I.Chave size={16} className="text-primary" aria-hidden="true" /><SectionTitle id="ia-chave">Chave do Google Gemini</SectionTitle></div>
        <p className="text-sm" aria-live="polite">
          {status.isLoading ? <span className="text-muted-foreground">Verificando…</span>
            : status.isError ? <span className="text-destructive">{msgErro(status.error)}</span>
            : status.data?.configurada ? <span className="text-[var(--ev-success)]">Configurada — termina em ••••{status.data.final_4}{status.data.atualizada_em ? `, atualizada em ${dataBr(status.data.atualizada_em)}` : ''}</span>
            : <span className="text-[var(--ev-warning)]">Não configurada</span>}
        </p>
        <form onSubmit={salvarChave} className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="ia-chave-input" className="sr-only">Nova chave do Gemini</label>
          <Input id="ia-chave-input" ref={chaveRef} type="password" autoComplete="off" spellCheck={false} maxLength={200} placeholder="Cole a nova chave aqui" />
          <Button type="submit" loading={salvandoChave}>Salvar chave</Button>
          <Button type="button" variant="outline" onClick={() => testar.mutate()} loading={testar.isPending}>
            <I.Conectar aria-hidden="true" /> Testar conexão
          </Button>
        </form>
        {testar.data && <p className="text-xs text-[var(--ev-success)]">Conexão ok: {testar.data.model}, {testar.data.latency_ms} ms.</p>}
        {testar.isError && <p className="text-xs text-destructive" role="alert">Teste falhou: {erroDe(testar.error)}</p>}
        <p className="text-xs text-muted-foreground">Crie a chave em aistudio.google.com com faturamento ativo (plano pago). No plano gratuito o Google usa os dados para treinar — não use.</p>
      </section>

      {/* 2. Liga/desliga */}
      <section className={cardCls} aria-labelledby="ia-ligado">
        <div className="flex items-center justify-between gap-4">
          <SectionTitle id="ia-ligado">Evo {cfg?.enabled ? 'ligado' : 'desligado'}</SectionTitle>
          <Switch
            checked={!!cfg?.enabled}
            disabled={!cfg || ligar.isPending}
            onCheckedChange={v => ligar.mutate(v)}
            aria-labelledby="ia-ligado"
          />
        </div>
        <p className={alertaAviso}><I.Info size={16} className="text-[var(--ev-warning)]" aria-hidden="true" /> Ligue só depois da liberação do jurídico (Google como processador de dados fora do Brasil).</p>
      </section>

      {cfgQ.isLoading ? (
        <div className="flex justify-center py-10"><Spinner className="size-8 text-primary" aria-label="Carregando" /></div>
      ) : f ? (
        <form onSubmit={enviar} className="space-y-6">
          {/* 3. Modelos e preços */}
          <section className={cardCls} aria-labelledby="ia-modelos">
            <SectionTitle id="ia-modelos">Modelos por nível</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MODELOS.map(([k, rotulo]) => (
                <label key={k} className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">{rotulo}</span>
                  <select className={selectNativo} value={f[k] as string} onChange={e => set(k, e.target.value)}>
                    {Object.keys(f.prices).map(m => <option key={m} value={m}>{m}{m.includes('preview') ? ' (preview)' : ''}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className={molde}>
              <Tabela label="Preço por modelo">
                <caption className="sr-only">Preço por modelo, em US$ por 1 milhão de tokens</caption>
                <thead className="border-b border-border">
                  <tr><th className={th}>Modelo</th><th className={th}>Entrada (US$/1M)</th><th className={th}>Saída (US$/1M)</th></tr>
                </thead>
                <tbody>
                  {Object.entries(f.prices).map(([m, p]) => (
                    <tr key={m} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-mono text-xs text-foreground">
                        {m} {m.includes('preview') && <Badge variant="secondary" className={cn(chipAviso, 'ml-1 px-1.5 py-0 font-sans')}>preview</Badge>}
                      </td>
                      {(['in', 'out'] as const).map(lado => (
                        <td key={lado} className="px-4 py-2">
                          <Input
                            className="max-w-[8rem]"
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
              </Tabela>
            </div>
            <p className="text-xs text-muted-foreground">Preços oficiais de 29/09/2026; os Gemini 3.x Flash dobram em 01/01/2027.</p>
          </section>

          {/* 4. Limites e créditos */}
          <section className={cardCls} aria-labelledby="ia-limites">
            <SectionTitle id="ia-limites">Limites e créditos</SectionTitle>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-foreground">Créditos por plano</legend>
              <p className="text-xs text-muted-foreground">Todos os planos renovam no dia 1º e não acumulam para o mês seguinte.</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {PLANS.map(p => (
                  <label key={p.id} className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">{p.name} (mês)</span>
                    <Input inputMode="numeric" value={numInput(f.quotas[p.id])} onChange={e => set('quotas', { ...f.quotas, [p.id]: lerNum(e.target.value) })} />
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
                    <Input inputMode="numeric" value={numInput(f.credit_cost[n])} onChange={e => set('credit_cost', { ...f.credit_cost, [n]: lerNum(e.target.value) })} />
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
                  <Input inputMode={modo} value={numInput(f[k])} onChange={e => set(k, lerNum(e.target.value))} />
                </label>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-2">
            {form && <Button type="button" variant="outline" onClick={() => setForm(null)}>Descartar alterações</Button>}
            <Button type="submit" disabled={!form} loading={salvar.isPending}>
              <I.Guardar aria-hidden="true" /> Salvar configurações
            </Button>
          </div>
        </form>
      ) : !cfgQ.isError ? (
        vazio('Configuração de IA não encontrada no banco (linha de ai_settings ausente ou sem permissão).')
      ) : null}

      {/* 5. Painel de gasto */}
      <section className={cardCls} aria-labelledby="ia-gasto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SectionTitle id="ia-gasto">Gasto</SectionTitle>
          <Segmented label="Período" items={PERIODOS.map(([value, label]) => ({ value, label }))} value={periodo} onValueChange={v => setPeriodo(v as Periodo)} className="w-full sm:w-72" />
        </div>

        {resumo.isLoading ? (
          <div className="flex justify-center py-10"><Spinner className="size-8 text-primary" aria-label="Carregando" /></div>
        ) : resumo.isError ? (
          <div role="alert" className={alertaErro}>Não foi possível carregar o gasto: {msgErro(resumo.error)}</div>
        ) : !r ? vazio('Sem dados.') : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Gasto (US$)" value={usd(r.totais.usd)} />
              <Stat label="Gasto (R$)" value={brl(r.totais.brl)} />
              <Stat label="Perguntas" value={String(r.totais.perguntas)} hint={`${r.totais.chamadas} ${r.totais.chamadas === 1 ? 'chamada' : 'chamadas'} à IA (inclui testes e recusas)`} />
              <Stat label="Custo médio por pergunta" value={r.totais.perguntas > 0 ? brl(r.totais.custo_medio_brl) : '—'} />
            </div>

            {r.por_dia.length === 0 ? vazio('Nenhuma pergunta no período.') : (
              <div className="h-64" role="img" aria-label="Gráfico de gasto em US$ por dia">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.por_dia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, color: 'hsl(var(--popover-foreground))' }}
                      labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                      formatter={(v: number, nome: string) => (nome === 'usd' ? [usd(v), 'Gasto'] : [v, nome])}
                    />
                    <Bar dataKey="usd" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <h3 className="text-sm font-semibold text-foreground">Produtores que mais gastaram (top 20)</h3>
            {r.por_produtor.length === 0 ? vazio('Nenhum produtor no período.') : (
              <div className={molde}>
                <Tabela label="Produtores que mais gastaram">
                  <thead className="border-b border-border"><tr>
                    <th className={th}>Produtor</th><th className={th}>Perguntas</th><th className={th}>Créditos</th><th className={th}>Gasto (R$)</th>
                  </tr></thead>
                  <tbody className="text-sm">
                    {r.por_produtor.map(p => (
                      <tr key={p.user_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 text-foreground">{p.nome || '—'}<div className="text-xs text-muted-foreground">{p.email || '—'}</div></td>
                        <td className="px-4 py-2 tabular-nums">{p.perguntas}</td>
                        <td className="px-4 py-2 tabular-nums">{p.creditos}</td>
                        <td className="px-4 py-2 tabular-nums">{reais(p.usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Por modelo</h3>
                {r.por_modelo.length === 0 ? vazio('Sem dados.') : (
                  <div className={molde}>
                    <Tabela label="Gasto por modelo">
                      <thead className="border-b border-border"><tr>
                        <th className={th}>Modelo</th><th className={th}>Perguntas</th><th className={th}>Tokens (entrada/saída)</th><th className={th}>US$</th>
                      </tr></thead>
                      <tbody className="text-sm">
                        {r.por_modelo.map(m => (
                          <tr key={m.model || '-'} className="border-b border-border last:border-0">
                            <td className="px-4 py-2 font-mono text-xs">{m.model || '—'}</td>
                            <td className="px-4 py-2 tabular-nums">{m.perguntas}</td>
                            <td className="px-4 py-2 text-xs tabular-nums">{m.tokens_in.toLocaleString('pt-BR')} / {m.tokens_out.toLocaleString('pt-BR')}</td>
                            <td className="px-4 py-2 tabular-nums">{usd(m.usd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Tabela>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Por modo</h3>
                {r.por_modo.length === 0 ? vazio('Sem dados.') : (
                  <div className={molde}>
                    <Tabela label="Gasto por modo">
                      <thead className="border-b border-border"><tr>
                        <th className={th}>Modo</th><th className={th}>Perguntas</th><th className={th}>US$</th>
                      </tr></thead>
                      <tbody className="text-sm">
                        {r.por_modo.map(m => (
                          <tr key={m.mode} className="border-b border-border last:border-0">
                            <td className="px-4 py-2">{m.mode}</td>
                            <td className="px-4 py-2 tabular-nums">{m.perguntas}</td>
                            <td className="px-4 py-2 tabular-nums">{usd(m.usd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Tabela>
                  </div>
                )}
              </div>
            </div>

            <h3 className="text-sm font-semibold text-foreground">Histórico (últimas 100 do período)</h3>
            {r.historico.length === 0 ? vazio('Nenhuma pergunta no período.') : (
              <div className={molde}>
                <Tabela label="Histórico de perguntas">
                  <thead className="border-b border-border"><tr>
                    <th className={th}>Data</th><th className={th}>Produtor</th><th className={th}>Modo</th><th className={th}>Nível</th>
                    <th className={th}>Modelo</th><th className={th}>Tokens</th><th className={th}>Custo</th><th className={th}>Situação</th>
                  </tr></thead>
                  <tbody>
                    {r.historico.map(h => (
                      <tr key={h.id} className="border-b border-border last:border-0 align-top">
                        <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums">{dataBr(h.created_at)}</td>
                        <td className="px-4 py-2 text-xs">{h.nome || '—'}<div className="text-xs text-muted-foreground">{h.email || '—'}</div></td>
                        <td className="px-4 py-2 text-xs">{h.mode}</td>
                        <td className="px-4 py-2 text-xs">{h.tier}</td>
                        <td className="px-4 py-2 font-mono text-[11px]">{h.model || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums">{h.tokens_in} / {h.tokens_out}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums">{usd(h.cost_usd)}<div className="text-xs text-muted-foreground">{h.credits} crédito(s)</div></td>
                        <td className={`px-4 py-2 text-xs ${corStatus(h.status)}`}>{h.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              </div>
            )}
          </>
        )}
      </section>

      {/* 6. Conceder créditos */}
      <section className={cardCls} aria-labelledby="ia-creditos">
        <div className="flex items-center gap-2"><I.Presente size={16} className="text-primary" aria-hidden="true" /><SectionTitle id="ia-creditos">Conceder créditos</SectionTitle></div>
        <p className="text-xs text-muted-foreground">Créditos extras valem no mês em que forem concedidos.</p>
        <form onSubmit={buscar} className="flex gap-2">
          <label htmlFor="ia-busca" className="sr-only">E-mail do produtor</label>
          <Input id="ia-busca" value={busca} onChange={e => setBusca(e.target.value)} placeholder="E-mail do produtor" maxLength={120} />
          <Button type="submit" variant="outline" loading={buscando}>
            <I.Buscar aria-hidden="true" /> Buscar
          </Button>
        </form>
        {achados && (achados.length === 0 ? vazio('Nenhum produtor com esse e-mail.') : (
          <fieldset className="space-y-1">
            <legend className="text-xs font-semibold text-muted-foreground">Escolha o produtor</legend>
            {achados.map(p => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="radio" name="ia-produtor" className="accent-primary" checked={escolhido?.id === p.id} onChange={() => setEscolhido(p)} />
                {p.full_name || '—'} <span className="text-muted-foreground">({p.email})</span>
              </label>
            ))}
          </fieldset>
        ))}
        {escolhido && (
          <form onSubmit={enviarCredito} className="grid grid-cols-1 sm:grid-cols-[8rem_1fr_auto] gap-2 items-end">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Quantidade (1–10000)</span>
              <Input inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value.replace(/\D/g, ''))} required />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Nota (opcional, até 200)</span>
              <Input value={nota} onChange={e => setNota(e.target.value)} maxLength={200} />
            </label>
            <Button type="submit" loading={conceder.isPending}>Conceder a {escolhido.email}</Button>
          </form>
        )}
      </section>

      {/* 7. Aviso da Política de Privacidade por e-mail */}
      <section className={cardCls} aria-labelledby="ia-aviso">
        <div className="flex items-center gap-2"><I.Email size={16} className="text-primary" aria-hidden="true" /><SectionTitle id="ia-aviso">Aviso da Política de Privacidade ({new Date(`${PRIVACY_VERSION}T12:00:00`).toLocaleDateString('pt-BR')})</SectionTitle></div>
        <p className="text-xs text-muted-foreground">Envio único: quem já recebeu não recebe de novo.</p>
        <Button type="button" variant="outline" onClick={() => contarAviso.mutate()} loading={contarAviso.isPending} className="w-fit">
          Contar destinatários
        </Button>
        <div aria-live="polite" className="text-sm space-y-1">
          {contarAviso.isError && <p className="text-destructive" role="alert">{erroDe(contarAviso.error)}</p>}
          {avisoN !== null && <p className="text-foreground">{pessoas(avisoN)} {avisoN === 1 ? 'vai' : 'vão'} receber</p>}
          {enviarAviso.isError && <p className="text-destructive" role="alert">{erroDe(enviarAviso.error)}</p>}
          {enviarAviso.data && (
            <p className="text-foreground">
              Enviados: {enviarAviso.data.enviados ?? 0} · Falhas: {enviarAviso.data.falhas ?? 0} · Restantes: {enviarAviso.data.restantes ?? 0}
              {(enviarAviso.data.restantes ?? 0) > 0 && <span className="block text-[var(--ev-warning)]">Clique de novo para continuar.</span>}
            </p>
          )}
        </div>
        {avisoN !== null && (
          <form onSubmit={e => { e.preventDefault(); if (podeEnviarAviso) enviarAviso.mutate() }} className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Digite ENVIAR para confirmar</span>
              <Input value={avisoConfirma} onChange={e => setAvisoConfirma(e.target.value)} autoComplete="off" spellCheck={false} maxLength={20} />
            </label>
            <Button type="submit" disabled={!podeEnviarAviso} loading={enviarAviso.isPending}>
              Enviar para {pessoas(avisoN)}
            </Button>
          </form>
        )}
      </section>
    </div>
  )
}
