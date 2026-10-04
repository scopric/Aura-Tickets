import { useRef, useEffect, useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState, PageHeader, Stat, chipAviso, chipErro, chipNeutro, chipOk } from '@/components/producer/ui'
import { Tabela, alertaErro, painel, th } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { useAdminEvents, useApproveEvent, useEventoModeracao, useToggleFeaturedCarousel, type AdminEvent } from '../../hooks/useEvents'
import { toast } from 'sonner'
import { naFilaDeModeracao, noAr } from '../../lib/eventoProdutor'
import { CLASSIFICACOES, ESTILOS, LOCAL_MODOS, TEMAS, rotuloFormato } from '../../lib/tipoEvento'
import { dominioDaTransmissao, seloIngressosAlterados } from '../../lib/moderacaoEvento'

// A página pública do evento fica no site (www); o alpha não tem a rota /event.
// lib/appHost.ts só tem appUrl() (app.*); a Fase 2 do front está criando siteUrl() lá — trocar por ela quando estiver no main.
// ponytail: cópia local de 4 linhas para não conflitar com esse PR.
function publicEventUrl(idOrSlug: string, loc: Pick<Location, 'hostname' | 'protocol' | 'port'> = window.location) {
  if (loc.hostname.endsWith('evokaa.com.br')) return `https://www.evokaa.com.br/event/${idOrSlug}`
  if (loc.hostname === 'localhost' || loc.hostname.endsWith('.localhost')) return `${loc.protocol}//localhost:${loc.port}/event/${idOrSlug}`
  return `/event/${idOrSlug}`
}

const statusCfg: Record<string, { label: string, cls: string }> = {
  published: { label: 'Publicado', cls: chipOk },
  draft: { label: 'Rascunho', cls: chipAviso },
  cancelled: { label: 'Cancelado', cls: chipErro },
  ended: { label: 'Finalizado', cls: chipNeutro },
}

const approvalStatusCfg: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Aprovado', cls: chipOk },
  pending: { label: 'Pendente', cls: chipAviso },
  rejected: { label: 'Rejeitado', cls: chipErro },
}

// Botões de ícone da tabela: o ícone ganha a cor do significado (aprovar, revogar, rejeitar)
const acaoOk = 'text-[var(--ev-success)] hover:text-[var(--ev-success)]'
const acaoAviso = 'text-[var(--ev-warning)] hover:text-[var(--ev-warning)]'
const acaoErro = 'text-destructive hover:text-destructive'

const rotulos = (valores: string[] | null | undefined, lista: readonly { valor: string; rotulo: string }[]) =>
  valores?.length ? valores.map(v => lista.find(i => i.valor === v)?.rotulo ?? v).join(', ') : null

const fmtDateTime = (s?: string | null) => { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }

export default function AdminEvents() {
  const { data: allEvents = [], isLoading, isError, error } = useAdminEvents()
  const approveMutation = useApproveEvent()
  const toggleFeaturedMutation = useToggleFeaturedCarousel()
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  // Painel de detalhes: guarda só o id e deriva da lista, para refletir aprovação/rejeição/destaque sem cópia velha
  const [detailId, setDetailId] = useState<string | null>(null)
  const openerRef = useRef<HTMLElement | null>(null) // botão que abriu o painel: recebe o foco de volta ao fechar
  const detail: AdminEvent | null = detailId ? allEvents.find(e => e.id === detailId) ?? null : null
  const extras = useEventoModeracao(detail?.id ?? null)
  const galeria: string[] = Array.isArray(detail?.gallery) ? detail.gallery.filter((g: unknown): g is string => typeof g === 'string' && !!g) : []

  useEffect(() => {
    if (!detailId) return
    // painel modal: Esc fecha, a página de fundo não rola e o foco volta ao botão que abriu
    const opener = openerRef.current
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setDetailId(null) }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; opener?.focus?.() }
  }, [detailId])

  const handleApprove = async (eventId: string, updatedAt: string) => {
    try {
      await approveMutation.mutateAsync({ eventId, status: 'approved', updatedAt })
      toast.success('Evento aprovado com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao aprovar evento: ' + err.message)
    }
  }

  const handleReject = async (eventId: string, updatedAt: string) => {
    const reason = window.prompt('Informe o motivo da rejeição do evento:')
    if (reason === null) return // clicou em cancelar
    if (!reason.trim()) {
      toast.error('É necessário informar um motivo para rejeitar o evento.')
      return
    }

    try {
      await approveMutation.mutateAsync({ eventId, status: 'rejected', rejectionReason: reason, updatedAt })
      toast.success('Evento rejeitado com sucesso.')
    } catch (err: any) {
      toast.error('Erro ao rejeitar evento: ' + err.message)
    }
  }

  const handleSuspend = async (eventId: string, title: string, updatedAt: string) => {
    if (!window.confirm(`Revogar a aprovação de "${title}"?\n\nO evento sai do ar e dos destaques e volta a rascunho até o produtor reenviá-lo para aprovação. A aprovação não coloca o evento no ar sozinha.`)) return

    try {
      await approveMutation.mutateAsync({ eventId, status: 'pending', updatedAt })
      toast.success('Aprovação revogada. O evento voltou a rascunho até o produtor reenviar.')
    } catch (err: any) {
      toast.error('Erro ao revogar aprovação: ' + err.message)
    }
  }

  const handleToggleFeatured = async (eventId: string, currentFeatured: boolean) => {
    try {
      await toggleFeaturedMutation.mutateAsync({ eventId, featured: !currentFeatured })
      toast.success(!currentFeatured ? 'Adicionado aos destaques do carrossel.' : 'Removido dos destaques.')
    } catch (err: any) {
      toast.error('Erro ao atualizar destaque: ' + err.message)
    }
  }

  const approved = allEvents.filter(e => noAr(e))
  const aprovadosNoTotal = allEvents.filter(e => e.approval_status === 'approved').length
  const pending = allEvents.filter(naFilaDeModeracao)
  
  const filteredEvents = allEvents.filter(e => {
    if (activeTab === 'all') return true
    if (activeTab === 'pending') return naFilaDeModeracao(e)
    return (e.approval_status || 'pending') === activeTab
  })

  const filtros = [['all', 'Todos'], ['pending', 'Pendentes'], ['approved', 'Aprovados (todos)'], ['rejected', 'Rejeitados']] as const

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <PageHeader title="Eventos" description="Gerencie e modere todos os eventos da plataforma" />

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total" value={allEvents.length.toString()} />
        <Stat label="No ar" value={approved.length.toString()} hint={`${aprovadosNoTotal} aprovados no total`} />
        <Stat label="Pendentes" value={pending.length.toString()} />
        {/* ponytail: '—' até a Fase 4; usar vendas reais (useVendidosPorEvento), não ticket_types.sold */}
        <Stat label="Receita" value="—" hint="sem venda confirmada (Fase 4)" />
      </div>

      {/* Abas de filtro */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border sm:gap-2">
        {filtros.map(([tab, rotulo]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4',
              activeTab === tab ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner className="size-6 text-primary" />
        </div>
      )}

      {/* Erro real na tela, em vez de "0 eventos" silencioso */}
      {isError && (
        <div role="alert" className={cn(alertaErro, 'mb-6')}>
          Não foi possível carregar os eventos: {(error as Error)?.message || 'erro desconhecido'}
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filteredEvents.length === 0 && <EmptyState title="Nenhum evento nesta categoria." />}
      {!isLoading && !isError && filteredEvents.length > 0 && (
        <div className={`${painel} overflow-hidden`}>
          <Tabela label="Lista de eventos">
            <thead>
              <tr className="border-b border-border">
                <th className={cn(th, 'px-2 sm:px-4')}>Evento</th>
                <th className={cn(th, 'hidden px-2 sm:px-4 md:table-cell')}>Data</th>
                <th className={cn(th, 'hidden px-2 sm:px-4 lg:table-cell')}>Produtor</th>
                <th className={cn(th, 'hidden px-2 sm:table-cell sm:px-4')}>Publicação</th>
                <th className={cn(th, 'hidden px-2 sm:table-cell sm:px-4')}>Moderação</th>
                <th className={cn(th, 'px-2 text-center sm:px-4')}>Destaque</th>
                <th className="px-2 py-3 sm:px-4"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map(e => {
                const pubStatus = statusCfg[e.status] || { label: e.status, cls: chipNeutro }
                const appStatus = approvalStatusCfg[e.approval_status || 'pending']
                const formattedDate = e.date
                  ? new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Data a definir'
                const emAnalise = naFilaDeModeracao(e) // rascunho não enviado não tem Aprovar nem Rejeitar

                return (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-[var(--ev-tint-hover)]">
                    <td className="px-2 py-3 sm:px-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <img src={e.cover_image || '/images/hero-bg.jpg'} alt="" className="size-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">{e.title}</div>
                          <div className="text-xs text-muted-foreground">{e.venue_city || e.venue_name || 'Local a definir'}</div>
                          {seloIngressosAlterados(e) && (
                            <Badge variant="secondary" className={cn(chipAviso, 'mt-1 whitespace-normal')}>{seloIngressosAlterados(e)}</Badge>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                            <Badge variant="secondary" className={pubStatus.cls}>{pubStatus.label}</Badge>
                            <Badge variant="secondary" className={appStatus.cls}>{appStatus.label}</Badge>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-2 py-3 sm:px-4 md:table-cell">
                      <div className="text-xs text-muted-foreground">{formattedDate}</div>
                    </td>
                    <td className="hidden px-2 py-3 sm:px-4 lg:table-cell">
                      <div className="text-xs text-muted-foreground">{e.profiles?.full_name || '—'}</div>
                    </td>
                    <td className="hidden px-2 py-3 sm:table-cell sm:px-4">
                      <Badge variant="secondary" className={pubStatus.cls}>{pubStatus.label}</Badge>
                    </td>
                    <td className="hidden px-2 py-3 sm:table-cell sm:px-4">
                      <Badge variant="secondary" className={appStatus.cls}>{appStatus.label}</Badge>
                    </td>
                    <td className="px-2 py-3 text-center sm:px-4">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleFeatured(e.id, !!e.featured_carousel)}
                        disabled={e.approval_status !== 'approved'}
                        aria-pressed={!!e.featured_carousel}
                        aria-label="Destaque no carrossel"
                        title={e.featured_carousel ? 'Remover do carrossel' : 'Destacar no carrossel'}
                        className={e.featured_carousel ? 'text-primary hover:text-primary' : undefined}
                      >
                        <I.Estrela ativo={!!e.featured_carousel} />
                      </Button>
                    </td>
                    <td className="px-2 py-3 text-right sm:px-4">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={ev => { openerRef.current = ev.currentTarget; setDetailId(e.id) }}
                          title="Ver detalhes do evento"
                          aria-label="Ver detalhes do evento"
                        >
                          <I.Info />
                        </Button>
                        {emAnalise && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleApprove(e.id, e.updated_at)}
                            disabled={approveMutation.isPending}
                            className={acaoOk}
                            title="Aprovar"
                            aria-label="Aprovar evento"
                          >
                            <I.Check />
                          </Button>
                        )}
                        {e.approval_status === 'approved' && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleSuspend(e.id, e.title, e.updated_at)}
                            disabled={approveMutation.isPending}
                            className={acaoAviso}
                            title="Revogar aprovação (suspender)"
                            aria-label="Revogar aprovação do evento"
                          >
                            <I.Desfazer />
                          </Button>
                        )}
                        {(emAnalise || e.approval_status === 'approved') && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleReject(e.id, e.updated_at)}
                            disabled={approveMutation.isPending}
                            className={acaoErro}
                            title="Rejeitar"
                            aria-label="Rejeitar evento"
                          >
                            <I.Fechar />
                          </Button>
                        )}
                        {e.status === 'published' && e.approval_status === 'approved' ? (
                          <Button asChild variant="ghost" size="icon-sm">
                            <a
                              href={publicEventUrl(e.slug || e.id)}
                              target="_blank"
                              rel="noreferrer"
                              title="Ver página pública"
                              aria-label="Ver página pública"
                            >
                              <I.Olho />
                            </a>
                          </Button>
                        ) : (
                          <span role="img" className="inline-flex size-8 cursor-not-allowed items-center justify-center text-[var(--ev-disabled-fg)]" title="Só eventos publicados e aprovados têm página pública" aria-label="Sem página pública">
                            <I.Olho size={16} aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        </div>
      )}

      {/* Painel lateral de detalhes (mesmo padrão do "Gerenciar" de Users.tsx) */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setDetailId(null)} />
          <div role="dialog" aria-modal="true" aria-label={`Detalhes do evento ${detail.title}`} className="glass-panel relative w-full max-w-lg h-full text-foreground overflow-y-auto rounded-r-none border-y-0 border-r-0">
            <div className="p-6 border-b border-border flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold leading-6 text-foreground">{detail.title}</h3>
                {detail.subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{detail.subtitle}</p>}
              </div>
              <Button autoFocus variant="ghost" size="icon" onClick={() => setDetailId(null)} aria-label="Fechar detalhes">
                <I.Fechar />
              </Button>
            </div>

            <div className="p-6 space-y-6 text-sm">
              {detail.cover_image && <img src={detail.cover_image} alt="" className="w-full aspect-video object-cover rounded-xl bg-muted" />}

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className={(statusCfg[detail.status] || { cls: chipNeutro }).cls}>
                  Publicação: {statusCfg[detail.status]?.label || detail.status}
                </Badge>
                <Badge variant="secondary" className={approvalStatusCfg[detail.approval_status || 'pending'].cls}>
                  Moderação: {approvalStatusCfg[detail.approval_status || 'pending'].label}
                </Badge>
                {detail.featured_carousel && <Badge variant="secondary" className={chipAviso}>Em destaque</Badge>}
                {seloIngressosAlterados(detail) && <Badge variant="secondary" className={cn(chipAviso, 'whitespace-normal')}>{seloIngressosAlterados(detail)}</Badge>}
              </div>

              {detail.description && <p className="text-muted-foreground whitespace-pre-line">{detail.description}</p>}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {([
                  ['Categoria', rotuloFormato(detail.category) || null],
                  ['Classificação', CLASSIFICACOES.find(c => c.valor === detail.classificacao)?.rotulo ?? detail.classificacao],
                  ['Temas', rotulos(detail.temas, TEMAS)],
                  ['Estilos', rotulos(detail.estilos, ESTILOS)],
                  ['Modo do local', LOCAL_MODOS.find(m => m.valor === detail.local_modo)?.rotulo ?? detail.local_modo],
                  ['Data', detail.date ? new Date(detail.date + 'T00:00:00').toLocaleDateString('pt-BR') : null],
                  ['Horário', detail.time?.slice(0, 5)],
                  ['Início', fmtDateTime(detail.start_date)],
                  ['Fim', fmtDateTime(detail.end_date)],
                  ['Local', detail.venue_name],
                  ['Endereço', detail.venue_address],
                  ['Cidade/UF', [detail.venue_city, detail.venue_state].filter(Boolean).join('/')],
                  ['Capacidade', detail.capacity],
                  ['Produtor', detail.profiles ? `${detail.profiles.full_name || 'Sem nome'} · ${detail.profiles.email}` : null],
                  ['Aprovado em', fmtDateTime(detail.approved_at)],
                  ['Motivo da rejeição', detail.rejection_reason],
                  ['Criado em', fmtDateTime(detail.created_at)],
                  ['Transmissão (domínio)', extras.data?.onlineUrl ? dominioDaTransmissao(extras.data.onlineUrl) : null],
                  ['Último aceite do produtor', extras.isError ? 'não foi possível ler'
                    : extras.data?.aceite ? `versão ${extras.data.aceite.versao}, em ${fmtDateTime(extras.data.aceite.aceitoEm)} — ${extras.data.aceite.hashConfere === null ? 'hash não conferido' : extras.data.aceite.hashConfere ? 'hash confere' : 'hash não confere'}`
                    : extras.isLoading ? 'carregando…' : null],
                ] as [string, string | number | null | undefined][]).map(([l, v]) => (
                  <div key={l}>
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</dt>
                    <dd className="text-foreground mt-0.5 break-words">{v ?? '—'}</dd>
                  </div>
                ))}
              </dl>

              {galeria.length > 0 && (
                <div>
                  <h4 className="mb-2 text-[15px] font-semibold leading-5 text-foreground">Galeria</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {galeria.map((img, i) => <img key={i} src={img} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-muted object-cover" />)}
                  </div>
                </div>
              )}

              <div>
                <h4 className="mb-2 text-[15px] font-semibold leading-5 text-foreground">Ingressos</h4>
                {!detail.ticket_types?.length ? (
                  <p className="text-xs text-muted-foreground">Nenhum tipo de ingresso cadastrado.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-1 pr-2 font-medium">Nome</th>
                          <th className="py-1 pr-2 font-medium">Preço</th>
                          <th className="py-1 pr-2 font-medium">Qtd.</th>
                          <th className="py-1 font-medium">Ativo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.ticket_types.map(t => (
                          <tr key={t.id} className="border-t border-border">
                            <td className="py-1.5 pr-2 text-foreground">{t.name}</td>
                            <td className="py-1.5 pr-2 tabular-nums text-foreground">{Number(t.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="py-1.5 pr-2 tabular-nums text-foreground">{t.quantity_total ?? t.capacity ?? '—'}</td>
                            <td className="py-1.5 text-foreground">{t.is_active ? 'Sim' : 'Não'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                {naFilaDeModeracao(detail) && (
                  <Button size="sm" onClick={() => handleApprove(detail.id, detail.updated_at)} disabled={approveMutation.isPending}>
                    <I.Check /> Aprovar
                  </Button>
                )}
                {detail.approval_status === 'approved' && (
                  <Button size="sm" variant="outline" onClick={() => handleSuspend(detail.id, detail.title, detail.updated_at)} disabled={approveMutation.isPending}>
                    <I.Desfazer /> Revogar aprovação
                  </Button>
                )}
                {(naFilaDeModeracao(detail) || detail.approval_status === 'approved') && (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleReject(detail.id, detail.updated_at)} disabled={approveMutation.isPending}>
                    <I.Fechar /> Rejeitar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleFeatured(detail.id, !!detail.featured_carousel)}
                  disabled={detail.approval_status !== 'approved'}
                  title={detail.approval_status !== 'approved' ? 'Só eventos aprovados podem ser destacados' : undefined}
                >
                  <I.Estrela ativo={!!detail.featured_carousel} className={detail.featured_carousel ? 'text-primary' : undefined} />
                  {detail.featured_carousel ? 'Remover destaque' : 'Destacar no carrossel'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
