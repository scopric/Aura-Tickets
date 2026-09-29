import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Handshake, Plus, Pencil, Loader2, X, Info, UserPlus, Unlink, Search } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

// Afiliados Evokaa = quem revende a PLATAFORMA aos produtores (Decisão 64).
// Não confundir com os afiliados de evento que o produtor cadastra (tabela `affiliates`).

type Status = 'active' | 'paused' | 'ended'

interface Afiliado {
  id: string
  user_id: string
  referral_code: string
  recurring_percent: number
  status: Status
  agreement_date: string
  notes: string | null
  created_at: string
  user?: { full_name: string | null; email: string } | null
}

interface Vinculo {
  producer_id: string
  affiliate_id: string
  source: string
  linked_at: string
  producer?: { full_name: string | null; email: string } | null
}

interface Pessoa { id: string; full_name: string | null; email: string; role: string }

const STATUS: Record<Status, { label: string; cls: string }> = {
  active: { label: 'Ativo', cls: 'bg-green-500/10 text-green-700 border-green-500/20' },
  paused: { label: 'Pausado', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  ended: { label: 'Encerrado', cls: 'bg-muted text-muted-foreground border-border' },
}

const CODE_RE = /^[A-Z0-9_-]{3,30}$/
const RECORRENCIAS = Array.from({ length: 11 }, (_, i) => 15 + i) // 15% a 25%

const vazio = {
  id: null as string | null,
  email: '',
  pessoa: null as Pessoa | null,
  referral_code: '',
  recurring_percent: 15,
  status: 'active' as Status,
  agreement_date: '',
  notes: '',
}
type Form = typeof vazio

const hojeLocal = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso do navegador
const erroDe = (e: unknown) => (e as { message?: string } | null)?.message || 'erro desconhecido'
const dataBr = (s: string) => new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('pt-BR')
const sugerirCodigo = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || ''

export default function AdminPlatformAffiliates() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [form, setForm] = useState<Form | null>(null)
  const [aberto, setAberto] = useState<string | null>(null) // afiliado com a carteira aberta
  const [produtorNovo, setProdutorNovo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-platform-affiliates'],
    queryFn: async () => {
      const [af, vi, pr] = await Promise.all([
        supabase.from('platform_affiliates').select('*, user:profiles!platform_affiliates_user_id_fkey(full_name, email)').order('created_at', { ascending: false }),
        supabase.from('platform_affiliate_producers').select('*, producer:profiles!platform_affiliate_producers_producer_id_fkey(full_name, email)').order('linked_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, role').eq('role', 'producer').order('full_name').limit(1000),
      ])
      if (af.error) throw af.error
      if (vi.error) throw vi.error
      if (pr.error) throw pr.error
      return {
        afiliados: (af.data || []) as unknown as Afiliado[],
        vinculos: (vi.data || []) as unknown as Vinculo[],
        produtores: (pr.data || []) as Pessoa[],
      }
    },
  })
  const afiliados = data?.afiliados ?? []
  const vinculos = data?.vinculos ?? []
  const produtores = data?.produtores ?? []

  const buscarConta = async () => {
    if (!form) return
    const email = form.email.trim().toLowerCase()
    if (!email.includes('@')) { toast.error('Informe o e-mail da conta do afiliado.'); return }
    setBuscando(true)
    const { data: p, error: e } = await supabase.from('profiles').select('id, full_name, email, role').eq('email', email).maybeSingle() // exato: "_" no e-mail seria curinga num ilike
    setBuscando(false)
    if (e) { toast.error('Erro ao buscar: ' + erroDe(e)); return }
    if (!p) { toast.error('Nenhuma conta com esse e-mail. O afiliado precisa se cadastrar na Evokaa antes.'); return }
    const pessoa = p as Pessoa
    if (afiliados.some(a => a.user_id === pessoa.id)) { toast.error('Essa conta já é afiliada.'); return }
    setForm(f => (f && f.email.trim().toLowerCase() === email ? { ...f, pessoa, referral_code: f.referral_code || sugerirCodigo(pessoa.full_name || pessoa.email.split('@')[0]) } : f))
  }

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const payload = {
        referral_code: f.referral_code,
        recurring_percent: f.recurring_percent,
        status: f.status,
        agreement_date: f.agreement_date,
        notes: f.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }
      const q = f.id
        ? supabase.from('platform_affiliates').update(payload as never).eq('id', f.id).select('id')
        : supabase.from('platform_affiliates').insert({ ...payload, user_id: f.pessoa!.id, created_by: user?.id ?? null } as never).select('id')
      const { data: d, error: e } = await q
      if (e) {
        if (e.code === '23505') throw new Error('Código de indicação ou conta já usados por outro afiliado.')
        throw e
      }
      // `.select('id')`: RLS barrando volta "sucesso" com zero linhas (Decisão 62)
      if (!d?.length) throw new Error('Nada foi gravado (sem permissão).')
    },
    onSuccess: (_, f) => {
      toast.success(f.id ? 'Afiliado atualizado.' : 'Afiliado cadastrado.')
      setForm(null)
      queryClient.invalidateQueries({ queryKey: ['admin-platform-affiliates'] })
    },
    onError: e => toast.error('Não foi possível salvar: ' + erroDe(e)),
  })

  const vincular = useMutation({
    mutationFn: async ({ affiliateId, producerId }: { affiliateId: string; producerId: string }) => {
      const { data: d, error: e } = await supabase
        .from('platform_affiliate_producers')
        .insert({ producer_id: producerId, affiliate_id: affiliateId, source: 'manual', linked_by: user?.id ?? null } as never)
        .select('producer_id')
      if (e) {
        if (e.code === '23505') throw new Error('Esse produtor já está na carteira de um afiliado.')
        throw e
      }
      if (!d?.length) throw new Error('Nada foi gravado (sem permissão).')
    },
    onSuccess: () => {
      toast.success('Produtor adicionado à carteira.')
      setProdutorNovo('')
      queryClient.invalidateQueries({ queryKey: ['admin-platform-affiliates'] })
    },
    onError: e => toast.error(erroDe(e)),
  })

  const desvincular = useMutation({
    mutationFn: async (producerId: string) => {
      const { data: d, error: e } = await supabase.from('platform_affiliate_producers').delete().eq('producer_id', producerId).select('producer_id')
      if (e) throw e
      if (!d?.length) throw new Error('Nada foi removido (sem permissão).')
    },
    onSuccess: () => {
      toast.success('Produtor retirado da carteira.')
      queryClient.invalidateQueries({ queryKey: ['admin-platform-affiliates'] })
    },
    onError: e => toast.error(erroDe(e)),
  })

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    if (!form.id && !form.pessoa) { toast.error('Busque a conta do afiliado pelo e-mail primeiro.'); return }
    if (!CODE_RE.test(form.referral_code)) { toast.error('Código de indicação: 3 a 30 caracteres, só letras, números, "-" e "_".'); return }
    if (form.recurring_percent < 15 || form.recurring_percent > 25) { toast.error('Recorrência: entre 15% e 25%.'); return }
    salvar.mutate(form)
  }

  const vinculados = new Set(vinculos.map(v => v.producer_id))
  const semAfiliado = produtores.filter(p => !vinculados.has(p.id))
  const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary'

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-foreground flex items-center gap-2"><Handshake className="w-7 h-7 text-primary" aria-hidden="true" /> Afiliados Evokaa</h1>
          <p className="text-sm text-muted-foreground mt-1">Quem revende a plataforma aos produtores. (Os afiliados de evento são cadastrados pelos próprios produtores.)</p>
        </div>
        <button type="button" onClick={() => setForm({ ...vazio, agreement_date: hojeLocal() })} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" aria-hidden="true" /> Novo afiliado
        </button>
      </div>

      <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex gap-3">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <strong>Comissão:</strong> 50% do valor do plano na primeira venda e recorrência de 15% a 25% conforme o acordo de cada afiliado.
          {' '}<strong>Nenhuma comissão é calculada ainda:</strong> a cobrança dos planos não existe; quando for ligada, as vendas dos produtores da carteira passam a gerar comissão. O cupom do afiliado (5% a 25%) entra na etapa seguinte.
        </div>
      </div>

      {isError && (
        <div role="alert" className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
          Não foi possível carregar: {erroDe(error)}. Se a mensagem citar uma tabela inexistente, falta aplicar <span className="font-mono">docs/sql/20260929_afiliados_evokaa.sql</span>.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Afiliados ativos', value: afiliados.filter(a => a.status === 'active').length },
          { label: 'Produtores em carteiras', value: vinculos.length },
          { label: 'Produtores sem afiliado', value: semAfiliado.length },
        ].map(k => (
          <div key={k.label} className="p-4 rounded-2xl bg-card border border-border">
            <div className="text-[11px] uppercase text-muted-foreground font-semibold">{k.label}</div>
            <div className="font-serif text-2xl text-foreground mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" aria-label="Carregando" /></div>
      ) : afiliados.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">Nenhum afiliado cadastrado. Clique em "Novo afiliado".</div>
      ) : (
        <div className="space-y-3">
          {afiliados.map(a => {
            const carteira = vinculos.filter(v => v.affiliate_id === a.id)
            const expandido = aberto === a.id
            return (
              <div key={a.id} className="border border-border rounded-2xl bg-card">
                <div className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                  <div>
                    <div className="font-semibold text-foreground">{a.user?.full_name || a.user?.email || 'Conta removida'}</div>
                    <div className="text-xs text-muted-foreground">{a.user?.email} · código <span className="font-mono font-bold">{a.referral_code}</span> · acordo de {dataBr(a.agreement_date)}</div>
                    {a.notes && <div className="text-xs text-muted-foreground mt-1">{a.notes}</div>}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-foreground">1ª venda <strong>50%</strong> · recorrência <strong>{Number(a.recurring_percent)}%</strong></span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>
                    <button
                      type="button"
                      onClick={() => { setAberto(expandido ? null : a.id); setProdutorNovo('') }}
                      aria-expanded={expandido}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted"
                    >
                      Carteira ({carteira.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...vazio, id: a.id, email: a.user?.email || '', referral_code: a.referral_code, recurring_percent: Number(a.recurring_percent), status: a.status, agreement_date: a.agreement_date, notes: a.notes || '' })}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                      aria-label={`Editar afiliado ${a.referral_code}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandido && (
                  <div className="border-t border-border p-4 space-y-3">
                    {a.status !== 'active' && (
                      <p className="text-xs text-amber-700">Afiliado {STATUS[a.status].label.toLowerCase()}: não recebe produtores novos. Reative o acordo para adicionar.</p>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="sr-only" htmlFor={`add-${a.id}`}>Adicionar produtor à carteira</label>
                      <select id={`add-${a.id}`} className={inputCls} value={produtorNovo} onChange={e => setProdutorNovo(e.target.value)}>
                        <option value="">Adicionar produtor sem afiliado…</option>
                        {semAfiliado.filter(p => p.id !== a.user_id).map(p => <option key={p.id} value={p.id}>{p.full_name || p.email} ({p.email})</option>)}
                      </select>
                      <button
                        type="button"
                        disabled={a.status !== 'active' || !produtorNovo || vincular.isPending}
                        onClick={() => vincular.mutate({ affiliateId: a.id, producerId: produtorNovo })}
                        className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" aria-hidden="true" /> Adicionar
                      </button>
                    </div>
                    {carteira.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhum produtor na carteira.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {carteira.map(v => (
                          <li key={v.producer_id} className="py-2 flex items-center justify-between gap-2 text-sm">
                            <span className="text-foreground">{v.producer?.full_name || v.producer?.email} <span className="text-xs text-muted-foreground">desde {dataBr(v.linked_at)}</span></span>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm('Retirar este produtor da carteira? A recorrência futura deixa de ir para este afiliado.')) desvincular.mutate(v.producer_id) }}
                              disabled={desvincular.isPending}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 disabled:opacity-40"
                              aria-label={`Retirar ${v.producer?.email} da carteira`}
                            >
                              <Unlink className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="afiliado-titulo" onKeyDown={e => { if (e.key === 'Escape') setForm(null) }}>
          <form onSubmit={enviar} className="w-full max-w-lg my-8 bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="afiliado-titulo" className="font-serif text-xl text-foreground">{form.id ? 'Editar afiliado' : 'Novo afiliado'}</h2>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>

            {form.id ? (
              <p className="text-sm text-muted-foreground">Conta: <strong className="text-foreground">{form.email}</strong></p>
            ) : (
              <div className="space-y-1">
                <label htmlFor="af-email" className="text-xs font-semibold text-muted-foreground">E-mail da conta do afiliado *</label>
                <div className="flex gap-2">
                  <input id="af-email" autoFocus type="email" className={inputCls} value={form.email} onChange={e => setForm(f => (f ? { ...f, email: e.target.value, pessoa: null } : f))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarConta() } }} placeholder="afiliado@email.com" />
                  <button type="button" onClick={buscarConta} disabled={buscando} className="px-3 rounded-lg border border-border text-sm flex items-center gap-1.5 disabled:opacity-50">
                    {buscando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />} Buscar
                  </button>
                </div>
                {form.pessoa && <p className="text-xs text-green-700">Conta encontrada: {form.pessoa.full_name || form.pessoa.email}</p>}
                <p className="text-[11px] text-muted-foreground">O afiliado precisa ter conta na Evokaa. Ele continua podendo ser participante ou produtor.</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Código de indicação *</span>
                <input autoFocus={!!form.id} className={`${inputCls} font-mono uppercase`} value={form.referral_code} onChange={e => set('referral_code', e.target.value.toUpperCase().replace(/\s/g, ''))} maxLength={30} placeholder="EX: JOAO" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Recorrência (acordo) *</span>
                <select className={inputCls} value={form.recurring_percent} onChange={e => set('recurring_percent', Number(e.target.value))}>
                  {RECORRENCIAS.map(p => <option key={p} value={p}>{p}%</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Data do acordo *</span>
                <input type="date" className={inputCls} value={form.agreement_date} onChange={e => set('agreement_date', e.target.value)} required />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Situação</span>
                <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value as Status)}>
                  {(Object.keys(STATUS) as Status[]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">Primeira venda: 50% do valor do plano (regra geral da Evokaa).</p>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground">Observações do acordo</span>
              <textarea className={inputCls} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={500} placeholder="Ex: região, metas, contrato assinado em..." />
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground">Cancelar</button>
              <button type="submit" disabled={salvar.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                {salvar.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {form.id ? 'Salvar alterações' : 'Cadastrar afiliado'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
