import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TicketPercent, Plus, Pencil, Trash2, Power, Loader2, X, Info } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

// Cupom do admin = cupom dos PLANOS vendidos aos produtores (decisão de 29/09/2026).
// Cupom de evento é do produtor, criado e pago por ele, na área do produtor.

type Plano = 'starter' | 'pro' | 'enterprise'
type Audience = 'all' | 'first_subscription' | 'private'
type Duracao = 'once' | 'repeating' | 'forever'

interface Coupon {
  id: string
  producer_id: string | null
  event_id: string | null
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
  duration: Duracao | null
  duration_months: number | null
  is_active: boolean
  created_at: string
  producer?: { full_name: string | null } | null
  event?: { title: string | null } | null
}

const PLANOS: { id: Plano; nome: string }[] = [
  { id: 'starter', nome: 'Starter' },
  { id: 'pro', nome: 'Pro' },
  { id: 'enterprise', nome: 'Enterprise' },
]

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

const CODE_RE = /^[A-Z0-9_-]{3,30}$/

const vazio = {
  id: null as string | null,
  code: '',
  description: '',
  discount_type: 'percent' as 'percent' | 'fixed',
  discount_value: '',
  valid_from: '',
  valid_until: '',
  max_uses: '',
  max_uses_per_user: '1',
  audience: 'all' as Audience,
  plans: [] as Plano[],
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
  for (const [campo, rotulo] of [['max_uses', 'Limite total de usos'], ['max_uses_per_user', 'Usos por produtor']] as const) {
    const n = num(f[campo])
    if (f[campo].trim() !== '' && (n == null || !Number.isInteger(n) || n < 1)) return `${rotulo}: pelo menos 1, ou vazio para sem limite.`
  }
  if (f.duration === 'repeating') {
    const m = num(f.duration_months)
    if (m == null || !Number.isInteger(m) || m < 1 || m > 36) return 'Número de meses: de 1 a 36.'
  }
  if (f.valid_from && f.valid_until && new Date(f.valid_until) <= new Date(f.valid_from)) return 'O fim da validade precisa ser depois do início.'
  return null
}

export default function AdminCoupons() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [filtro, setFiltro] = useState<'planos' | 'eventos'>('planos')
  const [form, setForm] = useState<Form | null>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))

  const { data: cupons = [], isLoading, isError, error } = useQuery<Coupon[]>({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('coupons')
        .select('*, producer:profiles!coupons_producer_id_fkey(full_name), event:events!coupons_event_id_fkey(title)')
        .order('created_at', { ascending: false })
        .limit(500)
      if (e) throw e
      return (data || []) as unknown as Coupon[]
    },
  })

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const payload = {
        code: f.code,
        description: f.description.trim() || null,
        discount_type: f.discount_type,
        discount_value: num(f.discount_value),
        valid_from: f.valid_from ? new Date(f.valid_from).toISOString() : null,
        valid_until: f.valid_until ? new Date(f.valid_until).toISOString() : null,
        max_uses: num(f.max_uses),
        max_uses_per_user: num(f.max_uses_per_user),
        audience: f.audience,
        plans: f.plans.length ? f.plans : null,
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
        throw e
      }
      if (!data?.length) throw new Error('Nada foi gravado (sem permissão ou cupom inexistente).')
    },
    onSuccess: (_, f) => {
      toast.success(f.id ? 'Cupom atualizado.' : 'Cupom criado.')
      setForm(null)
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    },
    onError: e => toast.error('Não foi possível salvar: ' + erroDe(e)),
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
      if (e) throw e
      if (!data?.length) throw new Error('Nada foi excluído (cupom já usado ou sem permissão). Desative em vez de excluir.')
    },
    onSuccess: () => {
      toast.success('Cupom excluído.')
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    },
    onError: e => toast.error(erroDe(e)),
  })

  const abrirEdicao = (c: Coupon) => setForm({
    id: c.id,
    code: c.code,
    description: c.description || '',
    discount_type: c.discount_type,
    discount_value: String(c.discount_value),
    valid_from: paraInput(c.valid_from),
    valid_until: paraInput(c.valid_until),
    max_uses: c.max_uses != null ? String(c.max_uses) : '',
    max_uses_per_user: c.max_uses_per_user != null ? String(c.max_uses_per_user) : '',
    audience: (c.audience as Audience) in AUDIENCE_LABEL ? (c.audience as Audience) : 'all',
    plans: c.plans || [],
    duration: c.duration || 'once',
    duration_months: c.duration_months != null ? String(c.duration_months) : '3',
    is_active: c.is_active,
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
          <p className="text-sm text-muted-foreground mt-1">Cupons de desconto dos planos que a Evokaa vende aos produtores. Cupom de evento é criado e pago pelo próprio produtor.</p>
        </div>
        {filtro === 'planos' && (
          <button
            type="button"
            onClick={() => setForm({ ...vazio })}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> Novo cupom de plano
          </button>
        )}
      </div>

      <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex gap-3">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <strong>Os cupons ainda não são aplicados em nenhuma cobrança.</strong> A cobrança dos planos ainda não existe; quando for ligada (Stripe), estes cupons passam a valer, com a validação feita no servidor. A duração segue o mesmo formato do Stripe. Por enquanto esta área cadastra e organiza os cupons.
        </div>
      </div>

      {isError && (
        <div role="alert" className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
          Não foi possível carregar os cupons: {erroDe(error)}. Se a mensagem citar uma coluna inexistente, falta aplicar <span className="font-mono">docs/sql/20260929_cupons_admin.sql</span>.
        </div>
      )}

      <div className="flex bg-card p-1 border border-border rounded-xl gap-1 w-fit mb-4" role="tablist" aria-label="Tipo de cupom">
        {([['planos', `Cupons de plano (${deAdmin.length})`], ['eventos', `Cupons de evento dos produtores (${deProdutor.length})`]] as const).map(([v, l]) => (
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

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" aria-label="Carregando" /></div>
      ) : lista.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          {filtro === 'eventos' ? 'Nenhum produtor criou cupom ainda.' : 'Nenhum cupom de plano cadastrado. Clique em "Novo cupom de plano".'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-2xl bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3 hidden lg:table-cell">{filtro === 'planos' ? 'Planos' : 'Produtor / evento'}</th>
                <th className="px-4 py-3 hidden md:table-cell">Validade</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3">Situação</th>
                {filtro === 'planos' && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {lista.map(c => {
                const s = situacao(c)
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
                      {filtro === 'planos'
                        ? (c.plans?.length ? c.plans.map(p => PLANOS.find(x => x.id === p)?.nome || p).join(', ') : 'Todos os planos pagos')
                        : `${c.producer?.full_name || 'Produtor'}${c.event?.title ? ` — ${c.event.title}` : ' — todos os eventos dele'}`}
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
              <h2 id="cupom-titulo" className="font-serif text-xl text-foreground">{form.id ? `Editar ${form.code}` : 'Novo cupom de plano'}</h2>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>

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

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Desconto</h3>
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
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Pode ser usado até</span>
                  <input type="datetime-local" className={inputCls} value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Limite total de usos</span>
                  <input className={inputCls} inputMode="numeric" value={form.max_uses} onChange={e => set('max_uses', e.target.value.replace(/\D/g, ''))} placeholder="sem limite" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Usos por produtor</span>
                  <input className={inputCls} inputMode="numeric" value={form.max_uses_per_user} onChange={e => set('max_uses_per_user', e.target.value.replace(/\D/g, ''))} placeholder="sem limite" />
                </label>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-semibold text-foreground">Planos <span className="text-xs font-normal text-muted-foreground">({form.plans.length === 0 ? 'todos os pagos' : `${form.plans.length} selecionado(s)`})</span></legend>
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
              <label className="space-y-1">
                <span className="text-sm font-semibold text-foreground">Público</span>
                <select className={inputCls} value={form.audience} onChange={e => set('audience', e.target.value as Audience)}>
                  {(Object.keys(AUDIENCE_LABEL) as Audience[]).map(a => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
                </select>
              </label>
            </section>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
              Cupom ativo
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground">Cancelar</button>
              <button type="submit" disabled={salvar.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                {salvar.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {form.id ? 'Salvar alterações' : 'Criar cupom'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
