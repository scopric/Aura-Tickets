import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, PageHeader, Stat, chipAviso, chipNeutro, chipOk, selectNativo } from '@/components/producer/ui'
import { Tabela, alertaAviso, alertaErro, painel, th } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { searchAddressByPostalCode } from '../../lib/cepService'
import { cpfValido, maiorDeIdade, UFS } from '../../lib/formatters'

// Afiliados Evokaa = quem revende a PLATAFORMA aos produtores (Decisão 64).
// Não confundir com os afiliados de evento que o produtor cadastra (tabela `affiliates`).
// Dados pessoais (CPF, nascimento, endereço): só admin e o próprio afiliado leem (RLS); na
// lista o CPF aparece mascarado. Finalidade: contrato, pagamento da comissão e obrigação fiscal.

type Status = 'active' | 'paused' | 'ended'

interface Afiliado {
  id: string
  user_id: string
  referral_code: string
  recurring_percent: number
  status: Status
  agreement_date: string
  notes: string | null
  payout_account_id: string | null
  full_name: string | null
  cpf: string | null
  birth_date: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  cep: string | null
  street: string | null
  street_number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  created_at: string
  user?: { full_name: string | null; email: string } | null
}

interface Vinculo {
  id: string
  producer_id: string
  affiliate_id: string
  source: 'manual' | 'link' | 'code' | 'coupon'
  linked_at: string
  ref_first_seen_at: string | null
  ended_at: string | null
  end_reason: string | null
  producer?: { full_name: string | null; email: string; created_at: string } | null
}

interface Pessoa { id: string; full_name: string | null; email: string; role: string }

const STATUS: Record<Status, { label: string; cls: string }> = {
  active: { label: 'Ativo', cls: chipOk },
  paused: { label: 'Pausado', cls: chipAviso },
  ended: { label: 'Encerrado', cls: chipNeutro },
}

const ORIGEM: Record<Vinculo['source'], string> = {
  manual: 'Admin',
  link: 'Link do afiliado',
  code: 'Código no cadastro',
  coupon: 'Cupom',
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
  payout_account_id: '',
  full_name: '',
  cpf: '',
  birth_date: '',
  contact_email: '',
  phone: '',
  whatsapp: '',
  cep: '',
  street: '',
  street_number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}
type Form = typeof vazio

const hojeLocal = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso do navegador
const erroDe = (e: unknown) => (e as { message?: string } | null)?.message || 'erro desconhecido'
const dataBr = (s: string) => new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('pt-BR')
const digitos = (s: string) => s.replace(/\D/g, '')
const sugerirCodigo = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || ''

const fmtCpf = (s: string) => digitos(s).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, '$1.$2.$3-$4')
const mascararCpf = (s: string | null) => (s && s.length === 11 ? `***.${s.slice(3, 6)}.${s.slice(6, 9)}-**` : '—')
const fmtTel = (s: string | null) => {
  const d = digitos(s || '')
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return d || '—'
}
const fmtCep = (s: string) => digitos(s).replace(/(\d{5})(\d{0,3}).*/, '$1-$2')

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

function validar(f: Form): string | null {
  if (!f.id && !f.pessoa) return 'Busque a conta do afiliado pelo e-mail primeiro.'
  if (f.full_name.trim().length < 3) return 'Informe o nome completo.'
  if (!cpfValido(f.cpf)) return 'CPF inválido.'
  if (!f.birth_date || !maiorDeIdade(f.birth_date)) return 'Data de nascimento inválida (o afiliado precisa ter 18 anos ou mais).'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contact_email.trim())) return 'E-mail de contato inválido.'
  if (!/^\d{10,11}$/.test(digitos(f.phone))) return 'Telefone: DDD + número (10 ou 11 dígitos).'
  if (!/^\d{10,11}$/.test(digitos(f.whatsapp))) return 'WhatsApp: DDD + número (10 ou 11 dígitos).'
  if (!/^\d{8}$/.test(digitos(f.cep))) return 'CEP: 8 dígitos.'
  if (!f.street.trim() || !f.street_number.trim() || !f.neighborhood.trim() || !f.city.trim()) return 'Endereço incompleto (rua, número, bairro e cidade).'
  if (!UFS.includes(f.state)) return 'Escolha o estado (UF).'
  if (!CODE_RE.test(f.referral_code)) return 'Código de indicação: 3 a 30 caracteres, só letras, números, "-" e "_".'
  if (f.recurring_percent < 15 || f.recurring_percent > 25) return 'Recorrência: entre 15% e 25%.'
  return null
}

export default function AdminPlatformAffiliates() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [form, setForm] = useState<Form | null>(null)
  const [aberto, setAberto] = useState<string | null>(null) // afiliado com os indicados abertos
  const [produtorNovo, setProdutorNovo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-platform-affiliates'],
    queryFn: async () => {
      const [af, vi, pr] = await Promise.all([
        supabase.from('platform_affiliates').select('*, user:profiles!platform_affiliates_user_id_fkey(full_name, email)').order('created_at', { ascending: false }),
        supabase.from('platform_affiliate_producers').select('*, producer:profiles!platform_affiliate_producers_producer_id_fkey(full_name, email, created_at)').order('linked_at', { ascending: false }),
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
    setForm(f => (f && f.email.trim().toLowerCase() === email ? {
      ...f,
      pessoa,
      full_name: f.full_name || pessoa.full_name || '',
      contact_email: f.contact_email || pessoa.email,
      referral_code: f.referral_code || sugerirCodigo(pessoa.full_name || pessoa.email.split('@')[0]),
    } : f))
  }

  const buscarCep = async () => {
    if (!form) return
    const cep = digitos(form.cep)
    if (cep.length !== 8) return
    setBuscandoCep(true)
    const r = await searchAddressByPostalCode(cep, 'BR')
    setBuscandoCep(false)
    if (!r || r.error) { toast.error(r?.error || 'CEP não encontrado.'); return }
    setForm(f => (f && digitos(f.cep) === cep ? {
      ...f,
      street: r.logradouro || f.street,
      neighborhood: r.bairro || f.neighborhood,
      city: r.localidade || f.city,
      state: UFS.includes(r.uf) ? r.uf : f.state,
    } : f))
  }

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const payload = {
        referral_code: f.referral_code,
        recurring_percent: f.recurring_percent,
        status: f.status,
        agreement_date: f.agreement_date,
        notes: f.notes.trim() || null,
        payout_account_id: f.payout_account_id.trim() || null,
        full_name: f.full_name.trim(),
        cpf: digitos(f.cpf),
        birth_date: f.birth_date,
        email: f.contact_email.trim().toLowerCase(),
        phone: digitos(f.phone),
        whatsapp: digitos(f.whatsapp),
        cep: digitos(f.cep),
        street: f.street.trim(),
        street_number: f.street_number.trim(),
        complement: f.complement.trim() || null,
        neighborhood: f.neighborhood.trim(),
        city: f.city.trim(),
        state: f.state,
        updated_at: new Date().toISOString(),
      }
      const q = f.id
        ? supabase.from('platform_affiliates').update(payload as never).eq('id', f.id).select('id')
        : supabase.from('platform_affiliates').insert({ ...payload, user_id: f.pessoa!.id, created_by: user?.id ?? null } as never).select('id')
      const { data: d, error: e } = await q
      if (e) {
        if (e.code === '23505') throw new Error('CPF, código de indicação, conta Evokaa ou conta de recebimento já usados por outro afiliado.')
        if (e.code === '23514') throw new Error('O banco recusou algum dado (CPF, data, telefone, CEP ou UF). Confira o formulário.')
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
        .select('id')
      if (e) {
        if (e.code === '23505') throw new Error('Esse produtor já é indicado de um afiliado.')
        throw e
      }
      if (!d?.length) throw new Error('Nada foi gravado (sem permissão).')
    },
    onSuccess: () => {
      toast.success('Produtor adicionado aos indicados.')
      setProdutorNovo('')
      queryClient.invalidateQueries({ queryKey: ['admin-platform-affiliates'] })
    },
    onError: e => toast.error(erroDe(e)),
  })

  // Encerrar não apaga: o vínculo fica no histórico com data e motivo
  const encerrar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data: d, error: e } = await supabase
        .from('platform_affiliate_producers')
        .update({ ended_at: new Date().toISOString(), ended_by: user?.id ?? null, end_reason: motivo } as never)
        .eq('id', id)
        .is('ended_at', null)
        .select('id')
      if (e) throw e
      if (!d?.length) throw new Error('Nada foi alterado (vínculo já encerrado ou sem permissão).')
    },
    onSuccess: () => {
      toast.success('Vínculo encerrado. Ele continua no histórico.')
      queryClient.invalidateQueries({ queryKey: ['admin-platform-affiliates'] })
    },
    onError: e => toast.error(erroDe(e)),
  })

  const abrirEdicao = (a: Afiliado) => setForm({
    ...vazio,
    id: a.id,
    email: a.user?.email || '',
    referral_code: a.referral_code,
    recurring_percent: Number(a.recurring_percent),
    status: a.status,
    agreement_date: a.agreement_date,
    notes: a.notes || '',
    payout_account_id: a.payout_account_id || '',
    full_name: a.full_name || a.user?.full_name || '',
    cpf: a.cpf ? fmtCpf(a.cpf) : '',
    birth_date: a.birth_date || '',
    contact_email: a.email || a.user?.email || '',
    phone: a.phone || '',
    whatsapp: a.whatsapp || '',
    cep: a.cep ? fmtCep(a.cep) : '',
    street: a.street || '',
    street_number: a.street_number || '',
    complement: a.complement || '',
    neighborhood: a.neighborhood || '',
    city: a.city || '',
    state: a.state || '',
  })

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const msg = validar(form)
    if (msg) { toast.error(msg); return }
    salvar.mutate(form)
  }

  const ativos = vinculos.filter(v => !v.ended_at)
  const comAfiliadoAtivo = new Set(ativos.map(v => v.producer_id))
  const semAfiliado = produtores.filter(p => !comAfiliadoAtivo.has(p.id))
  const rotulo = 'text-xs font-semibold text-muted-foreground'

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <PageHeader
        title="Afiliados Evokaa"
        description="Quem revende a plataforma aos produtores. (Os afiliados de evento são cadastrados pelos próprios produtores.)"
        actions={
          <Button type="button" onClick={() => setForm({ ...vazio, agreement_date: hojeLocal() })}>
            <I.Criar aria-hidden="true" /> Novo afiliado
          </Button>
        }
      />

      <div className={cn(alertaAviso, 'mb-6 gap-3 p-4')}>
        <I.Info size={16} className="text-[var(--ev-warning)]" aria-hidden="true" />
        <div>
          <strong>Comissão:</strong> 50% do valor fechado do plano na primeira venda e recorrência de 15% a 25% conforme o acordo, paga direto na conta de recebimento do afiliado pelo split do gateway (gateway ainda não definido).
          {' '}<strong>Nenhuma comissão é calculada ainda:</strong> a cobrança dos planos não está ligada.
          {' '}<strong>Indicação:</strong> o produtor fica ligado ao afiliado quando chega pelo link dele (<span className="font-mono">?ref=CÓDIGO</span>) ou digita o código no cadastro; o admin também pode adicionar à mão.
        </div>
      </div>

      {isError && (
        <div role="alert" className={cn(alertaErro, 'mb-6')}>
          Não foi possível carregar: {erroDe(error)}. Se a mensagem citar uma coluna inexistente, falta aplicar <span className="font-mono">docs/sql/20260929_afiliados_v2.sql</span>.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Afiliados ativos" value={afiliados.filter(a => a.status === 'active').length} />
        <Stat label="Indicados ativos" value={ativos.length} />
        <Stat label="Vínculos encerrados" value={vinculos.length - ativos.length} />
        <Stat label="Produtores sem afiliado" value={semAfiliado.length} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="size-8 text-primary" aria-label="Carregando" /></div>
      ) : afiliados.length === 0 ? (
        <EmptyState title={'Nenhum afiliado cadastrado. Clique em "Novo afiliado".'} />
      ) : (
        <div className="space-y-3">
          {afiliados.map(a => {
            const historico = vinculos.filter(v => v.affiliate_id === a.id)
            const ativosDele = historico.filter(v => !v.ended_at)
            const expandido = aberto === a.id
            return (
              <div key={a.id} className={painel}>
                <div className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                  <div>
                    <div className="font-semibold text-foreground">{a.full_name || a.user?.full_name || a.user?.email || 'Conta removida'}</div>
                    <div className="text-xs text-muted-foreground">
                      CPF {mascararCpf(a.cpf)} · {a.city && a.state ? `${a.city}/${a.state}` : 'sem endereço'} · WhatsApp {fmtTel(a.whatsapp)}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.email || a.user?.email} · código <span className="font-mono font-bold">{a.referral_code}</span> · acordo de {dataBr(a.agreement_date)}</div>
                    {!a.cpf && <div className="mt-1 text-xs text-[var(--ev-warning)]">Cadastro incompleto: faltam os dados pessoais.</div>}
                    <div className={`mt-1 text-xs ${a.payout_account_id ? 'text-muted-foreground' : 'text-[var(--ev-warning)]'}`}>{a.payout_account_id ? 'Conta de recebimento informada' : 'Sem conta de recebimento: informar quando o gateway for definido'}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-foreground">1ª venda <strong>50%</strong> · recorrência <strong>{Number(a.recurring_percent)}%</strong></span>
                    <Badge variant="secondary" className={STATUS[a.status].cls}>{STATUS[a.status].label}</Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setAberto(expandido ? null : a.id); setProdutorNovo('') }}
                      aria-expanded={expandido}
                    >
                      Indicados ({ativosDele.length} ativos · {historico.length} no total)
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => abrirEdicao(a)} aria-label={`Editar afiliado ${a.referral_code}`}>
                      <I.Editar aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {expandido && (
                  <div className="border-t border-border p-4 space-y-3">
                    {a.status !== 'active' && (
                      <p className="text-xs text-[var(--ev-warning)]">Afiliado {STATUS[a.status].label.toLowerCase()}: não recebe produtores novos. Reative o acordo para adicionar.</p>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="sr-only" htmlFor={`add-${a.id}`}>Adicionar produtor indicado</label>
                      <select id={`add-${a.id}`} className={selectNativo} value={produtorNovo} onChange={e => setProdutorNovo(e.target.value)}>
                        <option value="">Adicionar produtor sem afiliado…</option>
                        {semAfiliado.filter(p => p.id !== a.user_id).map(p => <option key={p.id} value={p.id}>{p.full_name || p.email} ({p.email})</option>)}
                      </select>
                      <Button
                        type="button"
                        disabled={a.status !== 'active' || !produtorNovo}
                        loading={vincular.isPending}
                        onClick={() => vincular.mutate({ affiliateId: a.id, producerId: produtorNovo })}
                      >
                        <I.PessoaMais aria-hidden="true" /> Adicionar
                      </Button>
                    </div>
                    {historico.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhum produtor indicado.</p>
                    ) : (
                      <Tabela label="Histórico de produtores indicados">
                        <caption className="sr-only">Histórico de produtores indicados</caption>
                        <thead className="border-b border-border">
                          <tr>
                            <th className={th}>Produtor</th>
                            <th className={th}>Origem</th>
                            <th className={th}>Indicado em</th>
                            <th className={th}>Na plataforma</th>
                            <th className={th}>Situação</th>
                            <th className={cn(th, 'text-right')}><span className="sr-only">Ações</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {historico.map(v => (
                            <tr key={v.id} className="border-b border-border last:border-0 align-top">
                              <td className="px-4 py-3 text-sm text-foreground">{v.producer?.full_name || '—'}<div className="text-xs text-muted-foreground">{v.producer?.email}</div></td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {ORIGEM[v.source] || v.source}
                                {v.ref_first_seen_at && <div>link aberto em {dataBr(v.ref_first_seen_at)}</div>}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{dataBr(v.linked_at)}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{v.producer?.created_at ? <>desde {dataBr(v.producer.created_at)}<div>{tempoDesde(v.producer.created_at)}</div></> : '—'}</td>
                              <td className="px-4 py-3 text-xs">
                                {v.ended_at
                                  ? <span className="text-muted-foreground">Encerrado em {dataBr(v.ended_at)}{v.end_reason ? ` — ${v.end_reason}` : ''}</span>
                                  : <span className="text-[var(--ev-success)]">Ativo {tempoDesde(v.linked_at)}</span>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {!v.ended_at && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                      const motivo = window.prompt('Motivo do encerramento do vínculo (fica no histórico). A recorrência futura deixa de ir para este afiliado.')
                                      if (motivo === null) return
                                      if (!motivo.trim()) { toast.error('Informe o motivo.'); return }
                                      encerrar.mutate({ id: v.id, motivo: motivo.trim().slice(0, 500) })
                                    }}
                                    disabled={encerrar.isPending}
                                    className="hover:text-destructive"
                                    aria-label={`Encerrar vínculo de ${v.producer?.email}`}
                                  >
                                    <I.LinkQuebrado aria-hidden="true" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Tabela>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 glass-backdrop" role="dialog" aria-modal="true" aria-labelledby="afiliado-titulo" onKeyDown={e => { if (e.key === 'Escape') setForm(null) }}>
          <form onSubmit={enviar} className="glass-panel w-full max-w-2xl my-8 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 id="afiliado-titulo" className="text-lg font-semibold leading-6 tracking-normal text-foreground">{form.id ? 'Editar afiliado' : 'Novo afiliado'}</h2>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setForm(null)} aria-label="Fechar"><I.Fechar aria-hidden="true" /></Button>
            </div>

            {form.id ? (
              <p className="text-sm text-muted-foreground">Conta na Evokaa: <strong className="text-foreground">{form.email}</strong></p>
            ) : (
              <div className="space-y-1">
                <label htmlFor="af-email" className={rotulo}>E-mail da conta do afiliado na Evokaa *</label>
                <div className="flex gap-2">
                  <Input id="af-email" autoFocus type="email" value={form.email} onChange={e => setForm(f => (f ? { ...f, email: e.target.value, pessoa: null } : f))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarConta() } }} placeholder="afiliado@email.com" />
                  <Button type="button" variant="outline" onClick={buscarConta} loading={buscando}>
                    <I.Buscar aria-hidden="true" /> Buscar
                  </Button>
                </div>
                {form.pessoa && <p className="text-xs text-[var(--ev-success)]">Conta encontrada: {form.pessoa.full_name || form.pessoa.email}</p>}
                <p className="text-[11px] text-muted-foreground">O afiliado precisa ter conta na Evokaa (é por ela que ele entra na Área do Afiliado). Ele continua podendo ser participante ou produtor.</p>
              </div>
            )}

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">Dados pessoais</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1 sm:col-span-2">
                  <span className={rotulo}>Nome completo *</span>
                  <Input autoFocus={!!form.id} value={form.full_name} onChange={e => set('full_name', e.target.value)} maxLength={150} autoComplete="off" />
                </label>
                <label className="space-y-1">
                  <span className={rotulo}>CPF *</span>
                  <Input className="font-mono" inputMode="numeric" value={form.cpf} onChange={e => set('cpf', fmtCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} autoComplete="off" />
                </label>
                <label className="space-y-1">
                  <span className={rotulo}>Data de nascimento *</span>
                  <Input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} max={hojeLocal()} />
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">Contato</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="space-y-1 sm:col-span-3">
                  <span className={rotulo}>E-mail de contato *</span>
                  <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} autoComplete="off" />
                </label>
                <label className="space-y-1">
                  <span className={rotulo}>Telefone *</span>
                  <Input inputMode="tel" value={form.phone} onChange={e => set('phone', digitos(e.target.value).slice(0, 11))} placeholder="DDD + número" />
                </label>
                <label className="space-y-1">
                  <span className={rotulo}>WhatsApp *</span>
                  <Input inputMode="tel" value={form.whatsapp} onChange={e => set('whatsapp', digitos(e.target.value).slice(0, 11))} placeholder="DDD + número" />
                </label>
                <div className="flex items-end pb-2">
                  <Button type="button" variant="link" size="xs" onClick={() => set('whatsapp', form.phone)} className="px-0">WhatsApp igual ao telefone</Button>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">Endereço</legend>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <label className="space-y-1">
                  <span className={rotulo}>CEP *</span>
                  <Input inputMode="numeric" value={form.cep} onChange={e => set('cep', fmtCep(e.target.value))} onBlur={buscarCep} placeholder="00000-000" maxLength={9} />
                  {buscandoCep && <span className="text-[11px] text-muted-foreground">buscando…</span>}
                </label>
                <label className="space-y-1 sm:col-span-3">
                  <span className={rotulo}>Rua *</span>
                  <Input value={form.street} onChange={e => set('street', e.target.value)} maxLength={150} />
                </label>
                <label className="space-y-1">
                  <span className={rotulo}>Número *</span>
                  <Input value={form.street_number} onChange={e => set('street_number', e.target.value)} maxLength={20} />
                </label>
                <label className="space-y-1">
                  <span className={rotulo}>Complemento</span>
                  <Input value={form.complement} onChange={e => set('complement', e.target.value)} maxLength={80} />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className={rotulo}>Bairro *</span>
                  <Input value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)} maxLength={100} />
                </label>
                <label className="space-y-1 sm:col-span-3">
                  <span className={rotulo}>Cidade *</span>
                  <Input value={form.city} onChange={e => set('city', e.target.value)} maxLength={100} />
                </label>
                <label className="space-y-1">
                  <span className={rotulo}>UF *</span>
                  <select className={selectNativo} value={form.state} onChange={e => set('state', e.target.value)}>
                    <option value="">—</option>
                    {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">Acordo com a Evokaa</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className={rotulo}>Código de indicação *</span>
                  <Input className="font-mono uppercase" value={form.referral_code} onChange={e => set('referral_code', e.target.value.toUpperCase().replace(/\s/g, ''))} maxLength={30} placeholder="EX: JOAO" />
                  <span className="text-[11px] text-muted-foreground block">Link: app.evokaa.com.br/auth/register?ref={form.referral_code || 'CODIGO'}</span>
                </label>
                <label className="space-y-1">
                  <span className={rotulo}>Recorrência (acordo) *</span>
                  <select className={selectNativo} value={form.recurring_percent} onChange={e => set('recurring_percent', Number(e.target.value))}>
                    {RECORRENCIAS.map(p => <option key={p} value={p}>{p}%</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={rotulo}>Data do acordo *</span>
                  <Input type="date" value={form.agreement_date} onChange={e => set('agreement_date', e.target.value)} required />
                </label>
                <label className="space-y-1">
                  <span className={rotulo}>Situação</span>
                  <select className={selectNativo} value={form.status} onChange={e => set('status', e.target.value as Status)}>
                    {(Object.keys(STATUS) as Status[]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">Primeira venda: 50% do valor fechado do plano (regra geral da Evokaa).</p>
              <label className="space-y-1 block">
                <span className={rotulo}>Conta de recebimento do afiliado no gateway (para o split)</span>
                <Input className="font-mono" value={form.payout_account_id} onChange={e => set('payout_account_id', e.target.value.trim())} maxLength={80} placeholder="deixe em branco até definir o gateway" />
                <span className="text-[11px] text-muted-foreground block">O gateway de pagamento ainda não foi escolhido. Quando for, é o identificador da conta do afiliado nele (ex.: walletId no Asaas); a comissão cai direto nela pelo split, sem passar pela Evokaa.</span>
              </label>
              <label className="space-y-1 block">
                <span className={rotulo}>Observações do acordo</span>
                <Textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={500} placeholder="Ex: região, metas, contrato assinado em..." />
              </label>
            </fieldset>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
              <Button type="submit" loading={salvar.isPending}>
                {form.id ? 'Salvar alterações' : 'Cadastrar afiliado'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
