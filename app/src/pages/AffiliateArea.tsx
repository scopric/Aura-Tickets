import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Handshake, Loader2, Send, Info, Copy, Link2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { siteUrl } from '../lib/appHost'
import { PAID_PLANS, type PlanId } from '../lib/plans'

// Área do Afiliado Evokaa (Decisão 64): o afiliado vê o acordo, os produtores indicados e os
// cupons dele, e PEDE cupom à Evokaa — quem cria é o admin. Qualquer conta logada abre a página;
// só mostra conteúdo para quem tem cadastro em platform_affiliates (RLS: lê só o próprio).

type Plano = Exclude<PlanId, 'free'>
const PLANOS = PAID_PLANS.map(p => ({ id: p.id as Plano, nome: p.name }))
const FAIXAS = [5, 10, 15, 20, 25]

interface Afiliado {
  id: string
  referral_code: string
  recurring_percent: number
  status: 'active' | 'paused' | 'ended'
  agreement_date: string
  payout_account_id: string | null
}
interface Cupom { id: string; code: string; discount_value: number; valid_from: string | null; valid_until: string | null; uses: number; max_uses: number | null; plans: Plano[] | null; is_active: boolean }
interface Pedido { id: string; discount_percent: number; valid_days: number; plans: Plano[] | null; prospect: string | null; status: 'pending' | 'approved' | 'rejected'; admin_notes: string | null; created_at: string }

interface Indicado { full_name: string | null; linked_at: string; ended_at: string | null; source: string; producer_since: string | null; link_slug: string | null }
interface LinkAf { id: string; slug: string; label: string | null; clicks: number; is_active: boolean; created_at: string }
const slugDe = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
const ORIGEM: Record<string, string> = { manual: 'Evokaa', link: 'Seu link', code: 'Seu código no cadastro', coupon: 'Cupom' }

// "há 2 anos e 3 meses", "há 12 dias"
function tempoDesde(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (dias < 31) return `há ${dias} dia${dias === 1 ? '' : 's'}`
  const meses = Math.floor(dias / 30.44)
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  return `há ${anos} ano${anos === 1 ? '' : 's'}${resto ? ` e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : ''}`
}

const STATUS_AF: Record<Afiliado['status'], string> = { active: 'Ativo', paused: 'Pausado', ended: 'Encerrado' }
const dataBr = (s: string | null) => (s ? new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('pt-BR') : '—')
const erroDe = (e: unknown) => (e as { message?: string } | null)?.message || 'erro desconhecido'
const planosTexto = (p: Plano[] | null) => (p?.length ? p.map(x => PLANOS.find(y => y.id === x)?.nome || x).join(', ') : 'todos os planos pagos')

export default function AffiliateArea() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [faixa, setFaixa] = useState('')
  const [dias, setDias] = useState('30')
  const [planos, setPlanos] = useState<Plano[]>([])
  const [prospect, setProspect] = useState('')
  const [motivo, setMotivo] = useState('')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['affiliate-area', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: af, error: e } = await supabase
        .from('platform_affiliates')
        .select('id, referral_code, recurring_percent, status, agreement_date, payout_account_id')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (e) throw e
      if (!af) return { afiliado: null, indicados: [], cupons: [], pedidos: [], links: [] }
      const afiliado = af as Afiliado
      const [ind, cup, ped, lin] = await Promise.all([
        supabase.rpc('affiliate_my_producers'),
        supabase.from('coupons').select('id, code, discount_value, valid_from, valid_until, uses, max_uses, plans, is_active').eq('affiliate_id', afiliado.id).order('created_at', { ascending: false }),
        supabase.from('affiliate_coupon_requests').select('id, discount_percent, valid_days, plans, prospect, status, admin_notes, created_at').eq('affiliate_id', afiliado.id).order('created_at', { ascending: false }),
        supabase.from('affiliate_links').select('id, slug, label, clicks, is_active, created_at').eq('affiliate_id', afiliado.id).order('created_at', { ascending: false }),
      ])
      if (lin.error) throw lin.error
      if (ind.error) throw ind.error
      if (cup.error) throw cup.error
      if (ped.error) throw ped.error
      return {
        afiliado,
        indicados: (ind.data || []) as Indicado[],
        cupons: (cup.data || []) as Cupom[],
        pedidos: (ped.data || []) as Pedido[],
        links: (lin.data || []) as LinkAf[],
      }
    },
  })

  const pedir = useMutation({
    mutationFn: async () => {
      const af = data?.afiliado
      if (!af) throw new Error('Cadastro de afiliado não encontrado.')
      const d = Number(dias)
      if (!FAIXAS.includes(Number(faixa))) throw new Error('Escolha a faixa de desconto.')
      if (!Number.isInteger(d) || d < 1 || d > 30) throw new Error('Validade: de 1 a 30 dias.')
      const { data: ins, error: e } = await supabase
        .from('affiliate_coupon_requests')
        .insert({
          affiliate_id: af.id,
          discount_percent: Number(faixa),
          valid_days: d,
          plans: planos.length ? planos : null,
          prospect: prospect.trim().slice(0, 200) || null,
          reason: motivo.trim().slice(0, 1000) || null,
        } as never)
        .select('id')
      if (e) throw e
      if (!ins?.length) throw new Error('O pedido não foi gravado (cadastro inativo ou sem permissão).')
    },
    onSuccess: () => {
      toast.success('Pedido enviado à Evokaa. Você verá aqui quando o cupom for criado.')
      setFaixa(''); setDias('30'); setPlanos([]); setProspect(''); setMotivo('')
      queryClient.invalidateQueries({ queryKey: ['affiliate-area'] })
    },
    onError: e => toast.error('Não foi possível enviar: ' + erroDe(e)),
  })

  const [nomeLink, setNomeLink] = useState('')
  const criarLink = useMutation({
    mutationFn: async () => {
      const af = data?.afiliado
      if (!af) throw new Error('Cadastro de afiliado não encontrado.')
      const slug = slugDe(nomeLink)
      if (slug.length < 2) throw new Error('Dê um nome ao link (ex.: instagram, grupo-whatsapp).')
      const { data: ins, error: e } = await supabase
        .from('affiliate_links')
        .insert({ affiliate_id: af.id, slug, label: nomeLink.trim().slice(0, 80) } as never)
        .select('id')
      if (e) {
        if (e.code === '23505') throw new Error(`Você já tem um link chamado "${slug}".`)
        throw e
      }
      if (!ins?.length) throw new Error('O link não foi criado (cadastro inativo ou sem permissão).')
    },
    onSuccess: () => {
      toast.success('Link criado.')
      setNomeLink('')
      queryClient.invalidateQueries({ queryKey: ['affiliate-area'] })
    },
    onError: e => toast.error(erroDe(e)),
  })
  const alternarLink = useMutation({
    mutationFn: async (l: LinkAf) => {
      const { data: d, error: e } = await supabase.from('affiliate_links').update({ is_active: !l.is_active } as never).eq('id', l.id).select('id')
      if (e) throw e
      if (!d?.length) throw new Error('Nada foi alterado.')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['affiliate-area'] }),
    onError: e => toast.error(erroDe(e)),
  })
  const copiar = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copiado.') } catch { toast.error('Não foi possível copiar; selecione o link e copie.') }
  }

  const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary'

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-primary animate-spin" aria-label="Carregando" /></div>
  }

  if (isError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <p role="alert" className="p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">Não foi possível carregar a área do afiliado: {erroDe(error)}</p>
      </div>
    )
  }

  const af = data?.afiliado
  if (!af) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <Handshake className="w-10 h-10 text-primary mx-auto mb-4" aria-hidden="true" />
        <h1 className="font-serif text-2xl text-foreground mb-2">Área do Afiliado Evokaa</h1>
        <p className="text-sm text-muted-foreground">Esta área é para quem revende a Evokaa aos produtores. Quer ser afiliado? Fale com <a className="underline" href="mailto:contato@evokaa.com.br">contato@evokaa.com.br</a>.</p>
      </div>
    )
  }

  const ativo = af.status === 'active'

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground flex items-center gap-2"><Handshake className="w-7 h-7 text-primary" aria-hidden="true" /> Área do Afiliado</h1>
        <p className="text-sm text-muted-foreground mt-1">Código <span className="font-mono font-bold text-foreground">{af.referral_code}</span> · acordo de {dataBr(af.agreement_date)} · situação: {STATUS_AF[af.status]}</p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="text-[11px] uppercase text-muted-foreground font-semibold">1ª venda</div>
          <div className="font-serif text-2xl text-foreground mt-1">50%</div>
          <div className="text-[11px] text-muted-foreground">do valor fechado do plano</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="text-[11px] uppercase text-muted-foreground font-semibold">Recorrência</div>
          <div className="font-serif text-2xl text-foreground mt-1">{Number(af.recurring_percent)}%</div>
          <div className="text-[11px] text-muted-foreground">conforme seu acordo</div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="text-[11px] uppercase text-muted-foreground font-semibold">Indicados ativos</div>
          <div className="font-serif text-2xl text-foreground mt-1">{data!.indicados.filter(p => !p.ended_at).length}</div>
          <div className="text-[11px] text-muted-foreground">{data!.indicados.length} no histórico</div>
        </div>
      </section>

      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex gap-3">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          A comissão cai direto na sua conta de recebimento pelo split do gateway de pagamento, sem passar pela Evokaa.
          {' '}{af.payout_account_id ? 'Sua conta de recebimento está informada.' : 'Sua conta de recebimento será pedida quando a Evokaa definir o gateway de pagamento.'}
          {' '}A cobrança dos planos ainda não está ligada; nenhuma comissão foi gerada até agora.
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-serif text-xl text-foreground flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" aria-hidden="true" /> Meus links</h2>
        <p className="text-xs text-muted-foreground">Crie um link para cada canal (Instagram, grupo de WhatsApp, e-mail…). Quem abrir cai direto nos planos da Evokaa e, ao se cadastrar como produtor, fica ligado a você.</p>
        {ativo && (
          <form onSubmit={e => { e.preventDefault(); criarLink.mutate() }} className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="nome-link" className="sr-only">Nome do link</label>
            <input id="nome-link" className={inputCls} value={nomeLink} onChange={e => setNomeLink(e.target.value)} maxLength={80} placeholder="Nome do link (ex.: instagram)" />
            <button type="submit" disabled={criarLink.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {criarLink.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />} Criar link
            </button>
          </form>
        )}
        {nomeLink.trim() && <p className="text-[11px] text-muted-foreground">Vai ficar: <span className="font-mono">{siteUrl(`/p/${af.referral_code}/${slugDe(nomeLink) || 'nome'}`)}</span></p>}
        {data!.links.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum link criado ainda.</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-2xl bg-card">
            {data!.links.map(l => {
              const url = siteUrl(`/p/${af.referral_code}/${l.slug}`)
              const cadastros = data!.indicados.filter(p => p.link_slug === l.slug).length
              return (
                <li key={l.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{l.label || l.slug} {!l.is_active && <span className="text-xs font-normal text-muted-foreground">(desativado)</span>}</div>
                    <div className="text-xs font-mono text-muted-foreground truncate">{url}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{l.clicks} clique(s) · {cadastros} cadastro(s)</span>
                    <button type="button" onClick={() => copiar(url)} disabled={!l.is_active} className="px-2.5 py-1.5 rounded-lg border border-border text-xs flex items-center gap-1 disabled:opacity-40" aria-label={`Copiar link ${l.label || l.slug}`}>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copiar
                    </button>
                    <button type="button" onClick={() => alternarLink.mutate(l)} disabled={alternarLink.isPending} className="text-xs text-muted-foreground underline disabled:opacity-40">
                      {l.is_active ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl text-foreground">Pedir cupom à Evokaa</h2>
        <p className="text-xs text-muted-foreground">Faixas de 5 a 25%, validade de até 30 dias, cada produtor usa uma vez. A Evokaa analisa e cria o cupom.</p>
        {!ativo ? (
          <p className="text-sm text-amber-700">Seu cadastro está {STATUS_AF[af.status].toLowerCase()}: novos pedidos estão bloqueados.</p>
        ) : (
          <form
            onSubmit={e => { e.preventDefault(); pedir.mutate() }}
            className="p-4 rounded-2xl bg-card border border-border grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Desconto *</span>
              <select className={inputCls} value={faixa} onChange={e => setFaixa(e.target.value)} required>
                <option value="">Escolha a faixa…</option>
                {FAIXAS.map(v => <option key={v} value={String(v)}>{v}%</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Validade (dias, até 30) *</span>
              <input className={inputCls} inputMode="numeric" value={dias} onChange={e => setDias(e.target.value.replace(/\D/g, ''))} required />
            </label>
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-semibold text-muted-foreground">Planos ({planos.length === 0 ? 'todos os pagos' : `${planos.length} marcado(s)`})</legend>
              {PLANOS.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={planos.includes(p.id)} onChange={e => setPlanos(e.target.checked ? [...planos, p.id] : planos.filter(x => x !== p.id))} />
                  {p.nome}
                </label>
              ))}
            </fieldset>
            <div className="space-y-4">
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-muted-foreground">Para quem (empresa ou produtor)</span>
                <input className={inputCls} value={prospect} onChange={e => setProspect(e.target.value)} maxLength={200} />
              </label>
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-muted-foreground">Motivo</span>
                <textarea className={inputCls} rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={1000} />
              </label>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={pedir.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                {pedir.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                Enviar pedido
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl text-foreground">Meus pedidos</h2>
        {data!.pedidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-2xl bg-card">
            {data!.pedidos.map(p => (
              <li key={p.id} className="p-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-foreground">{Number(p.discount_percent)}% por {p.valid_days} dia(s) · {planosTexto(p.plans)}{p.prospect ? ` · ${p.prospect}` : ''}</span>
                <span className="text-xs">
                  {p.status === 'pending' && <span className="text-amber-700">Em análise</span>}
                  {p.status === 'approved' && <span className="text-green-700">Aprovado — cupom abaixo</span>}
                  {p.status === 'rejected' && <span className="text-muted-foreground">Recusado{p.admin_notes ? `: ${p.admin_notes}` : ''}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl text-foreground">Meus cupons</h2>
        {data!.cupons.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cupom criado para você ainda.</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-2xl bg-card">
            {data!.cupons.map(c => {
              const expirado = c.valid_until && new Date(c.valid_until).getTime() < Date.now()
              return (
                <li key={c.id} className="p-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span><span className="font-mono font-bold text-foreground">{c.code}</span> <span className="text-muted-foreground">· {Number(c.discount_value)}% · {planosTexto(c.plans)}</span></span>
                  <span className="text-xs text-muted-foreground">
                    {!c.is_active ? 'Desativado' : expirado ? 'Expirado' : `Válido até ${dataBr(c.valid_until)}`} · {c.uses} uso(s)
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl text-foreground">Histórico de produtores indicados</h2>
        <p className="text-xs text-muted-foreground">Seu código para o produtor digitar no cadastro: <span className="font-mono text-foreground">{af.referral_code}</span></p>
        {data!.indicados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produtor indicado ainda.</p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-2xl bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Histórico de produtores indicados</caption>
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-3 py-2">Produtor</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Indicado em</th>
                  <th className="px-3 py-2">Na plataforma</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {data!.indicados.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{p.full_name || 'Produtor'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{ORIGEM[p.source] || p.source}{p.link_slug ? ` (${p.link_slug})` : ''}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{dataBr(p.linked_at)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.producer_since ? tempoDesde(p.producer_since) : '—'}</td>
                    <td className="px-3 py-2 text-xs">{p.ended_at ? <span className="text-muted-foreground">Encerrado em {dataBr(p.ended_at)}</span> : <span className="text-green-700">Ativo</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
