import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TicketPercent, Plus, Pencil, Trash2, Power, Loader2, X, Info } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type Audience = 'all' | 'first_purchase' | 'newsletter' | 'private'

interface Coupon {
  id: string
  producer_id: string | null
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  max_discount: number | null
  min_order_value: number | null
  valid_from: string | null
  valid_until: string | null
  max_uses: number | null
  max_uses_per_user: number | null
  uses: number
  audience: Audience
  event_ids: string[] | null
  producer_ids: string[] | null
  categories: string[] | null
  is_active: boolean
  created_at: string
  producer?: { full_name: string | null } | null
}

interface Opcao { id: string; nome: string }

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'Qualquer comprador',
  first_purchase: 'Só na primeira compra',
  newsletter: 'Só assinantes da newsletter',
  private: 'Código privado (quem recebeu o código)',
}

const CODE_RE = /^[A-Z0-9_-]{3,30}$/

const vazio = {
  id: null as string | null,
  code: '',
  description: '',
  discount_type: 'percent' as 'percent' | 'fixed',
  discount_value: '',
  max_discount: '',
  min_order_value: '',
  valid_from: '',
  valid_until: '',
  max_uses: '',
  max_uses_per_user: '1',
  audience: 'all' as Audience,
  event_ids: [] as string[],
  producer_ids: [] as string[],
  categories: [] as string[],
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
  if (v == null || !(v > 0)) return 'Informe o valor do desconto (maior que zero).'
  if (f.discount_type === 'percent' && v > 100) return 'Desconto percentual não pode passar de 100%.'
  // teto só existe (e só é gravado) no percentual; no banco é > 0
  if (f.discount_type === 'percent' && f.max_discount.trim() !== '') {
    const t = num(f.max_discount)
    if (t == null || Number.isNaN(t) || t <= 0) return 'Teto do desconto: informe um valor maior que zero, ou deixe vazio.'
  }
  for (const [campo, rotulo] of [['min_order_value', 'Compra mínima'], ['max_uses', 'Limite total de usos'], ['max_uses_per_user', 'Limite por cliente']] as const) {
    const n = num(f[campo])
    if (f[campo].trim() !== '' && (n == null || Number.isNaN(n) || n < 0)) return `${rotulo}: valor inválido.`
  }
  if ((num(f.max_uses) ?? 1) < 1 || (num(f.max_uses_per_user) ?? 1) < 1) return 'Limites de uso precisam ser pelo menos 1 (ou vazio = sem limite).'
  if (f.valid_from && f.valid_until && new Date(f.valid_until) <= new Date(f.valid_from)) return 'O fim da validade precisa ser depois do início.'
  return null
}

function Multi({ label, opcoes, valor, onChange, vazioTexto }: { label: string; opcoes: Opcao[]; valor: string[]; onChange: (v: string[]) => void; vazioTexto: string }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold text-muted-foreground">{label} <span className="font-normal">({valor.length === 0 ? 'todos' : `${valor.length} selecionado(s)`})</span></legend>
      {opcoes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{vazioTexto}</p>
      ) : (
        <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1 bg-background">
          {opcoes.map(o => (
            <label key={o.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={valor.includes(o.id)}
                onChange={e => onChange(e.target.checked ? [...valor, o.id] : valor.filter(x => x !== o.id))}
              />
              {o.nome}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}

export default function AdminCoupons() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [filtro, setFiltro] = useState<'plataforma' | 'produtores' | 'todos'>('plataforma')
  const [form, setForm] = useState<Form | null>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))

  const { data: cupons = [], isLoading, isError, error } = useQuery<Coupon[]>({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from('coupons')
        .select('*, producer:profiles!coupons_producer_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(500)
      if (e) throw e
      return (data || []) as unknown as Coupon[]
    },
  })

  // Listas para "onde vale": eventos aprovados, produtores e categorias existentes
  const { data: opcoes } = useQuery({
    queryKey: ['admin-coupons-opcoes'],
    queryFn: async () => {
      const [ev, pr] = await Promise.all([
        supabase.from('events').select('id, title, category, date').eq('approval_status', 'approved').order('date', { ascending: false }).limit(300),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'producer').order('full_name').limit(500),
      ])
      if (ev.error) throw ev.error
      if (pr.error) throw pr.error
      const eventos = (ev.data || []) as { id: string; title: string; category: string | null; date: string | null }[]
      const produtores = (pr.data || []) as { id: string; full_name: string | null; email: string }[]
      return {
        eventos: eventos.map(e => ({ id: e.id, nome: `${e.title}${e.date ? ` (${new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR')})` : ''}` })),
        produtores: produtores.map(p => ({ id: p.id, nome: p.full_name || p.email })),
        categorias: [...new Set(eventos.map(e => e.category).filter(Boolean) as string[])].sort().map(c => ({ id: c, nome: c })),
      }
    },
  })

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const payload = {
        code: f.code,
        description: f.description.trim() || null,
        discount_type: f.discount_type,
        discount_value: num(f.discount_value),
        max_discount: f.discount_type === 'percent' ? num(f.max_discount) : null,
        min_order_value: num(f.min_order_value),
        valid_from: f.valid_from ? new Date(f.valid_from).toISOString() : null,
        valid_until: f.valid_until ? new Date(f.valid_until).toISOString() : null,
        max_uses: num(f.max_uses),
        max_uses_per_user: num(f.max_uses_per_user),
        audience: f.audience,
        event_ids: f.event_ids.length ? f.event_ids : null,
        producer_ids: f.producer_ids.length ? f.producer_ids : null,
        categories: f.categories.length ? f.categories : null,
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
      // Cupom já usado fica no histórico dos pedidos (orders.coupon_id): só desativar
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
    max_discount: c.max_discount != null ? String(c.max_discount) : '',
    min_order_value: c.min_order_value != null ? String(c.min_order_value) : '',
    valid_from: paraInput(c.valid_from),
    valid_until: paraInput(c.valid_until),
    max_uses: c.max_uses != null ? String(c.max_uses) : '',
    max_uses_per_user: c.max_uses_per_user != null ? String(c.max_uses_per_user) : '',
    audience: c.audience,
    event_ids: c.event_ids || [],
    producer_ids: c.producer_ids || [],
    categories: c.categories || [],
    is_active: c.is_active,
  })

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const msg = validar(form)
    if (msg) { toast.error(msg); return }
    salvar.mutate(form)
  }

  const nomes = (ids: string[] | null, lista: Opcao[] | undefined) =>
    (ids || []).map(id => lista?.find(o => o.id === id)?.nome || 'removido').join(', ')

  const ondeVale = (c: Coupon) => {
    if (c.producer_id) return `Cupom do produtor ${c.producer?.full_name || ''}`.trim()
    const partes = [
      c.event_ids?.length ? `Eventos: ${nomes(c.event_ids, opcoes?.eventos)}` : '',
      c.producer_ids?.length ? `Produtores: ${nomes(c.producer_ids, opcoes?.produtores)}` : '',
      c.categories?.length ? `Categorias: ${c.categories.join(', ')}` : '',
    ].filter(Boolean)
    return partes.length ? partes.join(' · ') : 'Toda a plataforma'
  }

  const lista = cupons.filter(c => (filtro === 'todos' ? true : filtro === 'plataforma' ? !c.producer_id : !!c.producer_id))
  const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary'

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-foreground flex items-center gap-2"><TicketPercent className="w-7 h-7 text-primary" aria-hidden="true" /> Cupons</h1>
          <p className="text-sm text-muted-foreground mt-1">Cupons de desconto da plataforma, com regras de validade, uso, alcance e público.</p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...vazio })}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Novo cupom
        </button>
      </div>

      <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex gap-3">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <strong>Os cupons ainda não são aplicados na compra.</strong> O checkout passa a aceitar cupom junto com a ativação do pagamento (Fase 4), com a validação feita no servidor. Por enquanto esta área cadastra e organiza os cupons; a próxima etapa liga a newsletter a esta lista, para ela só oferecer cupom cadastrado aqui (hoje o campo de cupom da newsletter ainda é texto livre).
          {' '}<strong>Quem paga o desconto</strong> (Evokaa ou produtor) ainda está em definição.
        </div>
      </div>

      {isError && (
        <div role="alert" className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
          Não foi possível carregar os cupons: {erroDe(error)}. Se a mensagem citar uma coluna inexistente, falta aplicar <span className="font-mono">docs/sql/20260929_cupons_admin.sql</span>.
        </div>
      )}

      <div className="flex bg-card p-1 border border-border rounded-xl gap-1 w-fit mb-4" role="tablist" aria-label="Filtrar cupons">
        {([['plataforma', 'Da plataforma'], ['produtores', 'Dos produtores'], ['todos', 'Todos']] as const).map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={filtro === v}
            onClick={() => setFiltro(v)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${filtro === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {l} ({cupons.filter(c => (v === 'todos' ? true : v === 'plataforma' ? !c.producer_id : !!c.producer_id)).length})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" aria-label="Carregando" /></div>
      ) : lista.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
          {filtro === 'produtores' ? 'Nenhum produtor criou cupom ainda.' : 'Nenhum cupom cadastrado. Clique em "Novo cupom".'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-2xl bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3 hidden lg:table-cell">Onde vale</th>
                <th className="px-4 py-3 hidden md:table-cell">Validade</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(c => {
                const s = situacao(c)
                const daPlataforma = !c.producer_id
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-foreground">{c.code}</div>
                      {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                      <div className="text-[11px] text-muted-foreground mt-0.5">{AUDIENCE_LABEL[c.audience] || c.audience}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {c.discount_type === 'percent' ? `${c.discount_value}%` : brl(Number(c.discount_value))}
                      {c.max_discount != null && <div className="text-[11px] text-muted-foreground">teto {brl(Number(c.max_discount))}</div>}
                      {c.min_order_value != null && <div className="text-[11px] text-muted-foreground">mínimo {brl(Number(c.min_order_value))}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell max-w-xs">{ondeVale(c)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {c.valid_from ? <>de {dataBr(c.valid_from)}<br /></> : null}
                      {c.valid_until ? <>até {dataBr(c.valid_until)}</> : 'sem fim'}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {c.uses}{c.max_uses != null ? ` / ${c.max_uses}` : ''}
                      {c.max_uses_per_user != null && <div className="text-[11px] text-muted-foreground">{c.max_uses_per_user} por cliente</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>
                      {!daPlataforma && <div className="text-[11px] text-muted-foreground mt-1">do produtor (só leitura)</div>}
                    </td>
                    <td className="px-4 py-3">
                      {daPlataforma && (
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
                      )}
                    </td>
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
              <h2 id="cupom-titulo" className="font-serif text-xl text-foreground">{form.id ? `Editar ${form.code}` : 'Novo cupom'}</h2>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Código *</span>
                <input autoFocus className={`${inputCls} font-mono uppercase`} value={form.code} onChange={e => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="EX: BLACK10" maxLength={30} required />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Descrição interna</span>
                <input className={inputCls} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: campanha de lançamento" maxLength={120} />
              </label>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Desconto</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Tipo *</span>
                  <select className={inputCls} value={form.discount_type} onChange={e => set('discount_type', e.target.value as 'percent' | 'fixed')}>
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Valor *</span>
                  <input className={inputCls} inputMode="decimal" value={form.discount_value} onChange={e => set('discount_value', e.target.value)} placeholder={form.discount_type === 'percent' ? '10' : '20,00'} required />
                </label>
                {form.discount_type === 'percent' && (
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Teto do desconto (R$)</span>
                    <input className={inputCls} inputMode="decimal" value={form.max_discount} onChange={e => set('max_discount', e.target.value)} placeholder="sem teto" />
                  </label>
                )}
              </div>
              <label className="space-y-1 block sm:w-1/3">
                <span className="text-xs font-semibold text-muted-foreground">Compra mínima (R$)</span>
                <input className={inputCls} inputMode="decimal" value={form.min_order_value} onChange={e => set('min_order_value', e.target.value)} placeholder="sem mínimo" />
              </label>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Validade e limites</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Começa em</span>
                  <input type="datetime-local" className={inputCls} value={form.valid_from} onChange={e => set('valid_from', e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Termina em</span>
                  <input type="datetime-local" className={inputCls} value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Limite total de usos</span>
                  <input className={inputCls} inputMode="numeric" value={form.max_uses} onChange={e => set('max_uses', e.target.value.replace(/\D/g, ''))} placeholder="sem limite" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Usos por cliente</span>
                  <input className={inputCls} inputMode="numeric" value={form.max_uses_per_user} onChange={e => set('max_uses_per_user', e.target.value.replace(/\D/g, ''))} placeholder="sem limite" />
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Público</h3>
              <select className={inputCls} value={form.audience} onChange={e => set('audience', e.target.value as Audience)} aria-label="Público do cupom">
                {(Object.keys(AUDIENCE_LABEL) as Audience[]).map(a => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
              </select>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Onde vale</h3>
              <p className="text-xs text-muted-foreground">Sem nada marcado, vale para toda a plataforma. Marcando mais de um grupo, o pedido precisa atender a todos.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Multi label="Eventos" opcoes={opcoes?.eventos || []} valor={form.event_ids} onChange={v => set('event_ids', v)} vazioTexto="Nenhum evento aprovado." />
                <Multi label="Produtores" opcoes={opcoes?.produtores || []} valor={form.producer_ids} onChange={v => set('producer_ids', v)} vazioTexto="Nenhum produtor." />
                <Multi label="Categorias" opcoes={opcoes?.categorias || []} valor={form.categories} onChange={v => set('categories', v)} vazioTexto="Nenhuma categoria." />
              </div>
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
