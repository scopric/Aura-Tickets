import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TicketPercent, Plus, Pencil, Trash2, Power, Loader2, X, Info, Check, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PLANS, PAID_PLANS, type PlanId } from '../../lib/plans'

// Cupom do admin = cupom dos PLANOS vendidos aos produtores (Decisão 63).
// Três tipos (Decisão 64): plano comum; upgrade (quem está num plano de origem sobe);
// afiliado (o afiliado pede, o admin cria: 5–25%, até 30 dias, uso único por produtor).
// Cupom de evento é do produtor, criado e pago por ele, na área do produtor.

type Plano = Exclude<PlanId, 'free'>
type Audience = 'all' | 'first_subscription' | 'private'
type Duracao = 'once' | 'repeating' | 'forever'
type Tipo = 'plano' | 'upgrade' | 'afiliado'

interface Coupon {
  id: string
  producer_id: string | null
  event_id: string | null
  affiliate_id: string | null
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  valid_from: string | null
  valid_until: string | null
  max_uses: number | null
  max_uses_per_user: number | null
  uses: number
  audience: string
  plans: Plano[] | null
  upgrade_from: string[] | null
  duration: Duracao | null
  duration_months: number | null
  is_active: boolean
  created_at: string
  producer?: { full_name: string | null } | null
  event?: { title: string | null } | null
  affiliate?: { referral_code: string; user?: { full_name: string | null } | null } | null
}

interface AfiliadoOpcao { id: string; referral_code: string; user?: { full_name: string | null; email: string } | null }

interface Pedido {
  id: string
  affiliate_id: string
  discount_percent: number
  valid_days: number
  plans: Plano[] | null
  prospect: string | null
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  affiliate?: { referral_code: string; user?: { full_name: string | null } | null } | null
}

const PLANOS = PAID_PLANS.map(p => ({ id: p.id as Plano, nome: p.name }))
// upgrade: de qualquer plano que não seja o último
const ORIGENS = PLANS.filter(p => p.id !== 'enterprise').map(p => ({ id: p.id as string, nome: p.name }))
const FAIXAS = [5, 10, 15, 20, 25]

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'Qualquer produtor',
  first_subscription: 'Só na primeira assinatura',
  private: 'Código privado (quem recebeu o código)',
}

const DURACAO_LABEL: Record<Duracao, string> = {
  once: 'Só na primeira cobrança',
  repeating: 'Nos primeiros meses',
  forever: 'Enquanto durar a assinatura',
}

const TIPO_LABEL: Record<Tipo, string> = {
  plano: 'Plano',
  upgrade: 'Upgrade',
  afiliado: 'Afiliado',
}

const CODE_RE = /^[A-Z0-9_-]{3,30}$/
const DIA_MS = 24 * 60 * 60 * 1000

const vazio = {
  id: null as string | null,
  tipo: 'plano' as Tipo,
  code: '',
  description: '',
  discount_type: 'percent' as 'percent' | 'fixed',
  discount_value: '',
  valid_from: '',
  valid_until: '',
  valid_days: '30',
  max_uses: '',
  max_uses_per_user: '1',
  audience: 'all' as Audience,
  plans: [] as Plano[],
  upgrade_from: [] as string[],
  affiliate_id: '',
  request_id: null as string | null,
  duration: 'once' as Duracao,
  duration_months: '3',
  is_active: true,
}
type Form = typeof vazio

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const erroDe = (e: unknown) => (e as { message?: string } | null)?.message || 'erro desconhecido'
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
// datetime-local trabalha em hora local, sem fuso
const paraInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const tipoDe = (c: Coupon): Tipo => (c.affiliate_id ? 'afiliado' : c.upgrade_from?.length ? 'upgrade' : 'plano')
const nomeAfiliado = (a?: { referral_code: string; user?: { full_name: string | null } | null } | null) =>
  a ? `${a.user?.full_name || 'Afiliado'} (${a.referral_code})` : 'Afiliado'

function situacao(c: Coupon): { label: string; cls: string } {
  const agora = Date.now()
  if (!c.is_active) return { label: 'Desativado', cls: 'bg-muted text-muted-foreground border-border' }
  if (c.valid_until && new Date(c.valid_until).getTime() < agora) return { label: 'Expirado', cls: 'bg-muted text-muted-foreground border-border' }
  if (c.max_uses != null && c.uses >= c.max_uses) return { label: 'Esgotado', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' }
  if (c.valid_from && new Date(c.valid_from).getTime() > agora) return { label: 'Agendado', cls: 'bg-blue-500/10 text-blue-700 border-blue-500/20' }
  return { label: 'Ativo', cls: 'bg-green-500/10 text-green-700 border-green-500/20' }
}

function validar(f: Form): string | null {
  if (!CODE_RE.test(f.code)) return 'Código: 3 a 30 caracteres, só letras, números, "-" e "_".'
  const v = num(f.discount_value)
  if (v == null || Number.isNaN(v) || !(v > 0)) return 'Informe o valor do desconto (maior que zero).'
  if (f.discount_type === 'percent' && v > 100) return 'Desconto percentual não pode passar de 100%.'
  if (f.tipo === 'afiliado') {
    if (!f.affiliate_id) return 'Escolha o afiliado.'
    if (!FAIXAS.includes(v)) return 'Cupom de afiliado: só 5, 10, 15, 20 ou 25%.'
    const d = num(f.valid_days)
    if (d == null || !Number.isInteger(d) || d < 1 || d > 30) return 'Validade do cupom de afiliado: de 1 a 30 dias.'
  }
  if (f.tipo === 'upgrade' && f.upgrade_from.length === 0) return 'Cupom de upgrade: marque de qual plano o produtor precisa estar vindo.'
  for (const [campo, rotulo] of [['max_uses', 'Limite total de usos'], ['max_uses_per_user', 'Usos por produtor']] as const) {
    const n = num(f[campo])
    if (f[campo].trim() !== '' && (n == null || !Number.isInteger(n) || n < 1)) return `${rotulo}: pelo menos 1, ou vazio para sem limite.`
  }
  if (f.duration === 'repeating') {
    const m = num(f.duration_months)
    if (m == null || !Number.isInteger(m) || m < 1 || m > 36) return 'Número de meses: de 1 a 36.'
  }
  if (f.tipo !== 'afiliado' && f.valid_from && f.valid_until && new Date(f.valid_until) <= new Date(f.valid_from)) return 'O fim da validade precisa ser depois do início.'
  return null
}

export default function AdminCoupons() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [filtro, setFiltro] = useState<'planos' | 'pedidos' | 'eventos'>('planos')
  const [form, setForm] = useState<Form | null>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))

  const { data: cupons = [], isLoading, isError, error } = useQuery<Coupon[]>({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('coupons')
        .select('*, producer:profiles!coupons_producer_id_fkey(full_name), event:events!coupons_event_id_fkey(title), affiliate:platform_affiliates!coupons_affiliate_id_fkey(referral_code, user:profiles!platform_affiliates_user_id_fkey(full_name))')
        .order('created_at', { ascending: false })
        .limit(500)
      if (e) throw e
      return (data || []) as unknown as Coupon[]
    },
  })

  const { data: afiliados = [] } = useQuery<AfiliadoOpcao[]>({
    queryKey: ['admin-coupons-afiliados'],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('platform_affiliates')
        .select('id, referral_code, user:profiles!platform_affiliates_user_id_fkey(full_name, email)')
        .eq('status', 'active')
        .order('referral_code')
      if (e) throw e
      return (data || []) as unknown as AfiliadoOpcao[]
    },
  })

  const { data: pedidos = [] } = useQuery<Pedido[]>({
    queryKey: ['admin-coupon-requests'],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('affiliate_coupon_requests')
        .select('*, affiliate:platform_affiliates!affiliate_coupon_requests_affiliate_id_fkey(referral_code, user:profiles!platform_affiliates_user_id_fkey(full_name))')
        .order('created_at', { ascending: false })
        .limit(200)
      if (e) throw e
      return (data || []) as unknown as Pedido[]
    },
  })
  const pendentes = pedidos.filter(p => p.status === 'pending')

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      let valid_from = f.valid_from ? new Date(f.valid_from).toISOString() : null
      let valid_until = f.valid_until ? new Date(f.valid_until).toISOString() : null
      if (f.tipo === 'afiliado') {
        // validade = início + N dias (N ≤ 30); o banco confere o teto de 720 horas
        const inicio = f.valid_from ? new Date(f.valid_from) : new Date()
        valid_from = inicio.toISOString()
        valid_until = new Date(inicio.getTime() + Number(f.valid_days) * DIA_MS).toISOString()
      }
      const payload = {
        code: f.code,
        description: f.description.trim() || null,
        discount_type: f.tipo === 'afiliado' ? 'percent' : f.discount_type,
        discount_value: num(f.discount_value),
        valid_from,
        valid_until,
        max_uses: num(f.max_uses),
        max_uses_per_user: f.tipo === 'afiliado' ? 1 : num(f.max_uses_per_user),
        audience: f.audience,
        plans: f.plans.length ? f.plans : null,
        upgrade_from: f.tipo === 'upgrade' ? f.upgrade_from : null,
        affiliate_id: f.tipo === 'afiliado' ? f.affiliate_id : null,
        duration: f.duration,
        duration_months: f.duration === 'repeating' ? num(f.duration_months) : null,
        is_active: f.is_active,
        updated_at: new Date().toISOString(),
      }
      // `.select('id')`: sem ele, uma gravação barrada pelo RLS volta "sucesso" com zero linhas
      const q = f.id
        ? supabase.from('coupons').update(payload as never).eq('id', f.id).is('producer_id', null).select('id')
        : supabase.from('coupons').insert({ ...payload, producer_id: null, created_by: user?.id ?? null } as never).select('id')
      const { data, error: e } = await q
      if (e) {
        if (e.code === '23505') throw new Error(`Já existe um cupom com o código ${f.code}.`)
        if (e.code === '23514') throw new Error('O banco recusou: confira as regras do tipo de cupom (faixa, validade, planos).')
        throw e
      }
      const linhas = (data || []) as { id: string }[]
      if (!linhas.length) throw new Error('Nada foi gravado (sem permissão ou cupom inexistente).')

      if (f.request_id) {
        const { data: ped, error: pe } = await supabase
          .from('affiliate_coupon_requests')
          .update({ status: 'approved', coupon_id: linhas[0].id, decided_at: new Date().toISOString(), decided_by: user?.id ?? null } as never)
          .eq('id', f.request_id)
          .eq('status', 'pending')
          .select('id')
        if (pe || !ped?.length) throw new Error('Cupom criado, mas o pedido não foi marcado como aprovado: ' + (pe ? erroDe(pe) : 'pedido já decidido'))
      }
    },
    onSuccess: (_, f) => {
      toast.success(f.id ? 'Cupom atualizado.' : f.request_id ? 'Cupom criado e pedido aprovado.' : 'Cupom criado.')
      setForm(null)
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      queryClient.invalidateQueries({ queryKey: ['admin-coupon-requests'] })
    },
    onError: e => {
      toast.error('Não foi possível salvar: ' + erroDe(e))
      // cupom criado mas pedido não marcado: fecha o formulário, senão salvar de novo criaria
      // um 2º cupom (o pedido segue pendente na aba de pedidos, para recusar ou refazer)
      if (erroDe(e).startsWith('Cupom criado')) setForm(null)
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      queryClient.invalidateQueries({ queryKey: ['admin-coupon-requests'] })
    },
  })

  const recusar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data, error: e } = await supabase
        .from('affiliate_coupon_requests')
        .update({ status: 'rejected', admin_notes: motivo, decided_at: new Date().toISOString(), decided_by: user?.id ?? null } as never)
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
      if (e) throw e
      if (!data?.length) throw new Error('Nada foi alterado (pedido já decidido ou sem permissão).')
    },
    onSuccess: () => {
      toast.success('Pedido recusado.')
      queryClient.invalidateQueries({ queryKey: ['admin-coupon-requests'] })
    },
    onError: e => toast.error('Não foi possível recusar: ' + erroDe(e)),
  })

  const alternar = useMutation({
    mutationFn: async (c: Coupon) => {
      const { data, error: e } = await supabase.from('coupons').update({ is_active: !c.is_active, updated_at: new Date().toISOString() } as never).eq('id', c.id).is('producer_id', null).select('id')
      if (e) throw e
      if (!data?.length) throw new Error('Nada foi alterado (sem permissão).')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
    onError: e => toast.error('Não foi possível alterar: ' + erroDe(e)),
  })

  const excluir = useMutation({
    mutationFn: async (c: Coupon) => {
      // Cupom já usado fica no histórico: só desativar
      const { data, error: e } = await supabase.from('coupons').delete().eq('id', c.id).is('producer_id', null).eq('uses', 0).select('id')
      if (e) {
        if (e.code === '23503') throw new Error('Este cupom está ligado a um pedido de afiliado ou a uma compra. Desative em vez de excluir.')
        throw e
      }
      if (!data?.length) throw new Error('Nada foi excluído (cupom já usado ou sem permissão). Desative em vez de excluir.')
    },
    onSuccess: () => {
      toast.success('Cupom excluído.')
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    },
    onError: e => toast.error(erroDe(e)),
  })

  const abrirEdicao = (c: Coupon) => {
    const tipo = tipoDe(c)
    const dias = c.valid_from && c.valid_until ? Math.round((new Date(c.valid_until).getTime() - new Date(c.valid_from).getTime()) / DIA_MS) : 30
    setForm({
      id: c.id,
      tipo,
      code: c.code,
      description: c.description || '',
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      valid_from: paraInput(c.valid_from),
      valid_until: paraInput(c.valid_until),
      valid_days: String(Math.min(Math.max(dias, 1), 30)),
      max_uses: c.max_uses != null ? String(c.max_uses) : '',
      max_uses_per_user: c.max_uses_per_user != null ? String(c.max_uses_per_user) : '',
      audience: (c.audience as Audience) in AUDIENCE_LABEL ? (c.audience as Audience) : 'all',
      plans: c.plans || [],
      upgrade_from: c.upgrade_from || [],
      affiliate_id: c.affiliate_id || '',
      request_id: null,
      duration: c.duration || 'once',
      duration_months: c.duration_months != null ? String(c.duration_months) : '3',
      is_active: c.is_active,
    })
  }

  const criarDoPedido = (p: Pedido) => setForm({
    ...vazio,
    tipo: 'afiliado',
    affiliate_id: p.affiliate_id,
    discount_value: String(p.discount_percent),
    valid_days: String(p.valid_days),
    plans: p.plans || [],
    audience: 'private',
    description: p.prospect ? `Pedido do afiliado — ${p.prospect}` : 'Pedido do afiliado',
    code: `${p.affiliate?.referral_code || 'AF'}${p.discount_percent}`.slice(0, 30),
    request_id: p.id,
  })

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const msg = validar(form)
    if (msg) { toast.error(msg); return }
    salvar.mutate(form)
  }

  const duracaoTexto = (c: Coupon) =>
    c.duration === 'repeating' ? `nos primeiros ${c.duration_months} meses` : c.duration ? DURACAO_LABEL[c.duration].toLowerCase() : ''

  const deAdmin = cupons.filter(c => !c.producer_id)
  const deProdutor = cupons.filter(c => !!c.producer_id)
  const lista = filtro === 'planos' ? deAdmin : deProdutor
  const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary'

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-foreground flex items-center gap-2"><TicketPercent className="w-7 h-7 text-primary" aria-hidden="true" /> Cupons</h1>
          <p className="text-sm text-muted-foreground mt-1">Cupons dos planos que a Evokaa vende aos produtores: plano, upgrade e afiliado. Cupom de evento é criado e pago pelo próprio produtor.</p>
        </div>
        {filtro === 'planos' && (
          <button
            type="button"
            onClick={() => setForm({ ...vazio })}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> Novo cupom
          </button>
        )}
      </div>

      <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex gap-3">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <strong>Os cupons ainda não são aplicados em nenhuma cobrança.</strong> A cobrança dos planos ainda não existe (gateway de pagamento em definição); quando for ligada, estes cupons passam a valer, com a validação feita no servidor. Por enquanto esta área cadastra e organiza os cupons e os pedidos dos afiliados.
        </div>
      </div>

      {isError && (
        <div role="alert" className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
          Não foi possível carregar os cupons: {erroDe(error)}. Se a mensagem citar uma coluna ou relação inexistente, falta aplicar <span className="font-mono">docs/sql/20260929_afiliados_v2.sql</span>.
        </div>
      )}

      <div className="flex flex-wrap bg-card p-1 border border-border rounded-xl gap-1 w-fit mb-4" role="tablist" aria-label="Tipo de cupom">
        {([
          ['planos', `Cupons da Evokaa (${deAdmin.length})`],
          ['pedidos', `Pedidos dos afiliados (${pendentes.length})`],
          ['eventos', `Cupons de evento dos produtores (${deProdutor.length})`],
        ] as const).map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={filtro === v}
            onClick={() => setFiltro(v)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${filtro === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {filtro === 'eventos' && (
        <p className="mb-4 text-xs text-muted-foreground">Somente leitura: o produtor cria, edita e paga os cupons dos próprios eventos.</p>
      )}

      {filtro === 'pedidos' ? (
        pedidos.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">Nenhum pedido de cupom dos afiliados.</div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-2xl bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Afiliado</th>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3 hidden md:table-cell">Para quem / motivo</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3 text-foreground">
                      {nomeAfiliado(p.affiliate)}
                      <div className="text-[11px] text-muted-foreground">{dataBr(p.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {Number(p.discount_percent)}% por {p.valid_days} dia(s)
                      <div className="text-[11px] text-muted-foreground">{p.plans?.length ? p.plans.map(x => PLANOS.find(y => y.id === x)?.nome || x).join(', ') : 'todos os planos pagos'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-xs">
                      {p.prospect && <div className="text-foreground">{p.prospect}</div>}
                      {p.reason}
                      {p.admin_notes && <div className="mt-1 italic">Evokaa: {p.admin_notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.status === 'pending' ? <span className="text-amber-700">Pendente</span> : p.status === 'approved' ? <span className="text-green-700">Aprovado</span> : <span className="text-muted-foreground">Recusado</span>}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => criarDoPedido(p)} className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1" aria-label={`Criar cupom para o pedido de ${nomeAfiliado(p.affiliate)}`}>
                            <Check className="w-3.5 h-3.5" aria-hidden="true" /> Criar cupom
                          </button>
                          <button
                            type="button"
                            disabled={recusar.isPending}
                            onClick={() => {
                              const motivo = window.prompt('Motivo da recusa (o afiliado verá este texto):')
                              if (motivo === null) return
                              if (!motivo.trim()) { toast.error('Informe o motivo da recusa.'); return }
                              recusar.mutate({ id: p.id, motivo: motivo.trim().slice(0, 500) })
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-red-600 flex items-center gap-1 disabled:opacity-40"
                            aria-label={`Recusar pedido de ${nomeAfiliado(p.affiliate)}`}
                          >
                            <Ban className="w-3.5 h-3.5" aria-hidden="true" /> Recusar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" aria-label="Carregando" /></div>
      ) : lista.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          {filtro === 'eventos' ? 'Nenhum produtor criou cupom ainda.' : 'Nenhum cupom cadastrado. Clique em "Novo cupom".'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-2xl bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3 hidden lg:table-cell">{filtro === 'planos' ? 'Planos / tipo' : 'Produtor / evento'}</th>
                <th className="px-4 py-3 hidden md:table-cell">Validade</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3">Situação</th>
                {filtro === 'planos' && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {lista.map(c => {
                const s = situacao(c)
                const tipo = tipoDe(c)
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-foreground">{c.code}</div>
                      {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                      {filtro === 'planos' && <div className="text-[11px] text-muted-foreground mt-0.5">{AUDIENCE_LABEL[c.audience as Audience] || c.audience}</div>}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {c.discount_type === 'percent' ? `${c.discount_value}%` : brl(Number(c.discount_value))}
                      {c.duration && <div className="text-[11px] text-muted-foreground">{duracaoTexto(c)}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {filtro === 'planos' ? (
                        <>
                          <span className="inline-block px-1.5 py-0.5 mb-1 rounded border border-border text-[10px] font-semibold text-foreground">{TIPO_LABEL[tipo]}</span>
                          <div>{c.plans?.length ? c.plans.map(p => PLANOS.find(x => x.id === p)?.nome || p).join(', ') : 'Todos os planos pagos'}</div>
                          {tipo === 'upgrade' && <div>vindo de: {(c.upgrade_from || []).map(p => ORIGENS.find(x => x.id === p)?.nome || p).join(', ')}</div>}
                          {tipo === 'afiliado' && <div>{nomeAfiliado(c.affiliate)}</div>}
                        </>
                      ) : `${c.producer?.full_name || 'Produtor'}${c.event?.title ? ` — ${c.event.title}` : ' — todos os eventos dele'}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {c.valid_from ? <>de {dataBr(c.valid_from)}<br /></> : null}
                      {c.valid_until ? <>até {dataBr(c.valid_until)}</> : 'sem fim'}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {c.uses}{c.max_uses != null ? ` / ${c.max_uses}` : ''}
                      {c.max_uses_per_user != null && filtro === 'planos' && <div className="text-[11px] text-muted-foreground">{c.max_uses_per_user} por produtor</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>
                    </td>
                    {filtro === 'planos' && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => abrirEdicao(c)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" aria-label={`Editar cupom ${c.code}`}>
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => alternar.mutate(c)} disabled={alternar.isPending} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label={`${c.is_active ? 'Desativar' : 'Ativar'} cupom ${c.code}`}>
                            <Power className="w-4 h-4" />
                          </button>
                          {c.uses === 0 && (
                            <button
                              type="button"
                              onClick={() => { if (window.confirm(`Excluir o cupom ${c.code}? Isso não pode ser desfeito.`)) excluir.mutate(c) }}
                              disabled={excluir.isPending}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 disabled:opacity-40"
                              aria-label={`Excluir cupom ${c.code}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="cupom-titulo" onKeyDown={e => { if (e.key === 'Escape') setForm(null) }}>
          <form onSubmit={enviar} className="w-full max-w-2xl my-8 bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 id="cupom-titulo" className="font-serif text-xl text-foreground">
                {form.id ? `Editar ${form.code}` : form.request_id ? 'Criar cupom do pedido do afiliado' : 'Novo cupom'}
              </h2>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>

            <fieldset className="space-y-1.5">
              <legend className="text-sm font-semibold text-foreground">Tipo de cupom</legend>
              <div className="flex flex-wrap gap-4">
                {(Object.keys(TIPO_LABEL) as Tipo[]).map(t => (
                  <label key={t} className={`flex items-center gap-2 text-sm ${form.id || form.request_id ? 'text-muted-foreground' : 'text-foreground cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="tipo-cupom"
                      checked={form.tipo === t}
                      disabled={!!form.id || !!form.request_id}
                      onChange={() => setForm(f => (f ? { ...f, tipo: t, ...(t === 'afiliado' ? { discount_type: 'percent' as const, max_uses_per_user: '1', audience: 'private' as Audience } : {}) } : f))}
                    />
                    {TIPO_LABEL[t]}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {form.tipo === 'plano' && 'Desconto nos planos para qualquer produtor que atenda às regras.'}
                {form.tipo === 'upgrade' && 'Só vale para quem já está num plano de origem e sobe para um dos planos marcados.'}
                {form.tipo === 'afiliado' && 'Criado a pedido do afiliado: só 5, 10, 15, 20 ou 25%; validade de até 30 dias; cada produtor usa uma vez.'}
              </p>
            </fieldset>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Código *</span>
                <input autoFocus className={`${inputCls} font-mono uppercase`} value={form.code} onChange={e => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="EX: PRO3MESES" maxLength={30} required />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Descrição interna</span>
                <input className={inputCls} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: campanha de lançamento" maxLength={120} />
              </label>
            </section>

            {form.tipo === 'afiliado' && (
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-muted-foreground">Afiliado *</span>
                <select className={inputCls} value={form.affiliate_id} onChange={e => set('affiliate_id', e.target.value)} disabled={!!form.request_id || !!form.id}>
                  <option value="">Escolha o afiliado…</option>
                  {afiliados.map(a => <option key={a.id} value={a.id}>{a.user?.full_name || a.user?.email} ({a.referral_code})</option>)}
                  {form.affiliate_id && !afiliados.some(a => a.id === form.affiliate_id) && <option value={form.affiliate_id}>Afiliado não ativo</option>}
                </select>
              </label>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Desconto</h3>
              {form.tipo === 'afiliado' ? (
                <label className="space-y-1 block sm:w-1/2">
                  <span className="text-xs font-semibold text-muted-foreground">Faixa *</span>
                  <select className={inputCls} value={form.discount_value} onChange={e => set('discount_value', e.target.value)}>
                    <option value="">Escolha…</option>
                    {FAIXAS.map(v => <option key={v} value={String(v)}>{v}%</option>)}
                  </select>
                </label>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Tipo *</span>
                    <select className={inputCls} value={form.discount_type} onChange={e => set('discount_type', e.target.value as 'percent' | 'fixed')}>
                      <option value="percent">Percentual (%)</option>
                      <option value="fixed">Valor fixo (R$)</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Valor *</span>
                    <input className={inputCls} inputMode="decimal" value={form.discount_value} onChange={e => set('discount_value', e.target.value)} placeholder={form.discount_type === 'percent' ? '20' : '50,00'} required />
                  </label>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Duração do desconto na assinatura</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Por quanto tempo *</span>
                  <select className={inputCls} value={form.duration} onChange={e => set('duration', e.target.value as Duracao)}>
                    {(Object.keys(DURACAO_LABEL) as Duracao[]).map(d => <option key={d} value={d}>{DURACAO_LABEL[d]}</option>)}
                  </select>
                </label>
                {form.duration === 'repeating' && (
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Número de meses *</span>
                    <input className={inputCls} inputMode="numeric" value={form.duration_months} onChange={e => set('duration_months', e.target.value.replace(/\D/g, ''))} placeholder="3" />
                  </label>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Validade e limites</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Pode ser usado a partir de</span>
                  <input type="datetime-local" className={inputCls} value={form.valid_from} onChange={e => set('valid_from', e.target.value)} />
                </label>
                {form.tipo === 'afiliado' ? (
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Válido por (dias, até 30) *</span>
                    <input className={inputCls} inputMode="numeric" value={form.valid_days} onChange={e => set('valid_days', e.target.value.replace(/\D/g, ''))} placeholder="30" />
                  </label>
                ) : (
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Pode ser usado até</span>
                    <input type="datetime-local" className={inputCls} value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
                  </label>
                )}
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Limite total de usos</span>
                  <input className={inputCls} inputMode="numeric" value={form.max_uses} onChange={e => set('max_uses', e.target.value.replace(/\D/g, ''))} placeholder="sem limite" />
                </label>
                {form.tipo === 'afiliado' ? (
                  <p className="text-xs text-muted-foreground self-end pb-2">Usos por produtor: <strong>1</strong> (regra do cupom de afiliado)</p>
                ) : (
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Usos por produtor</span>
                    <input className={inputCls} inputMode="numeric" value={form.max_uses_per_user} onChange={e => set('max_uses_per_user', e.target.value.replace(/\D/g, ''))} placeholder="sem limite" />
                  </label>
                )}
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-semibold text-foreground">{form.tipo === 'upgrade' ? 'Para os planos' : 'Planos'} <span className="text-xs font-normal text-muted-foreground">({form.plans.length === 0 ? 'todos os pagos' : `${form.plans.length} selecionado(s)`})</span></legend>
                {PLANOS.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.plans.includes(p.id)}
                      onChange={e => set('plans', e.target.checked ? [...form.plans, p.id] : form.plans.filter(x => x !== p.id))}
                    />
                    {p.nome}
                  </label>
                ))}
              </fieldset>
              {form.tipo === 'upgrade' ? (
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-semibold text-foreground">Vindo do plano *</legend>
                  {ORIGENS.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.upgrade_from.includes(p.id)}
                        onChange={e => set('upgrade_from', e.target.checked ? [...form.upgrade_from, p.id] : form.upgrade_from.filter(x => x !== p.id))}
                      />
                      {p.nome}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <label className="space-y-1">
                  <span className="text-sm font-semibold text-foreground">Público</span>
                  <select className={inputCls} value={form.audience} onChange={e => set('audience', e.target.value as Audience)}>
                    {(Object.keys(AUDIENCE_LABEL) as Audience[]).map(a => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
                  </select>
                </label>
              )}
            </section>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
              Cupom ativo
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground">Cancelar</button>
              <button type="submit" disabled={salvar.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                {salvar.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {form.id ? 'Salvar alterações' : form.request_id ? 'Criar cupom e aprovar pedido' : 'Criar cupom'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
