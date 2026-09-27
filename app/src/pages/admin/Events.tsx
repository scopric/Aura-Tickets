import { useRef, useEffect, useState } from 'react'
import { Calendar, DollarSign, Clock, CheckCircle, Loader2, Check, X, Star, Eye, Info } from 'lucide-react'
import gsap from 'gsap'
import { useAdminEvents, useApproveEvent, useToggleFeaturedCarousel, type AdminEvent } from '../../hooks/useEvents'
import { toast } from 'sonner'

// A página pública do evento fica no site (www); o alpha não tem a rota /event.
// lib/appHost.ts só tem appUrl() (app.*); a Fase 2 do front está criando siteUrl() lá — trocar por ela quando estiver no main.
// ponytail: cópia local de 4 linhas para não conflitar com esse PR.
function publicEventUrl(idOrSlug: string, loc: Pick<Location, 'hostname' | 'protocol' | 'port'> = window.location) {
  if (loc.hostname.endsWith('evokaa.com.br')) return `https://www.evokaa.com.br/event/${idOrSlug}`
  if (loc.hostname === 'localhost' || loc.hostname.endsWith('.localhost')) return `${loc.protocol}//localhost:${loc.port}/event/${idOrSlug}`
  return `/event/${idOrSlug}`
}

const statusCfg: Record<string, { label: string, cls: string }> = {
  published: { label: 'Publicado', cls: 'bg-green-50 text-green-600 border-green-100' },
  draft: { label: 'Rascunho', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-50 text-red-500 border-red-100' },
  ended: { label: 'Finalizado', cls: 'bg-gray-50 text-gray-500 border-gray-100' },
}

const approvalStatusCfg: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Aprovado', cls: 'bg-green-100 text-green-700 border-green-200' },
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-100 text-red-700 border-red-200' },
}

const fmtDateTime = (s?: string | null) => { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }

export default function AdminEvents() {
  const ref = useRef<HTMLDivElement>(null)
  const { data: allEvents = [], isLoading, isError, error } = useAdminEvents()
  const approveMutation = useApproveEvent()
  const toggleFeaturedMutation = useToggleFeaturedCarousel()
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  // Painel de detalhes: guarda só o id e deriva da lista, para refletir aprovação/rejeição/destaque sem cópia velha
  const [detailId, setDetailId] = useState<string | null>(null)
  const openerRef = useRef<HTMLElement | null>(null) // botão que abriu o painel: recebe o foco de volta ao fechar
  const detail: AdminEvent | null = detailId ? allEvents.find(e => e.id === detailId) ?? null : null

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

  useEffect(() => {
    if (!isLoading) {
      const ctx = gsap.context(() => {
        gsap.fromTo('.evt-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' })
      }, ref)
      return () => ctx.revert()
    }
  }, [isLoading, activeTab]) // animar ao mudar de aba também

  const handleApprove = async (eventId: string) => {
    try {
      await approveMutation.mutateAsync({ eventId, status: 'approved' })
      toast.success('Evento aprovado com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao aprovar evento: ' + err.message)
    }
  }

  const handleReject = async (eventId: string) => {
    const reason = window.prompt('Informe o motivo da rejeição do evento:')
    if (reason === null) return // clicou em cancelar
    if (!reason.trim()) {
      toast.error('É necessário informar um motivo para rejeitar o evento.')
      return
    }

    try {
      await approveMutation.mutateAsync({ eventId, status: 'rejected', rejectionReason: reason })
      toast.success('Evento rejeitado com sucesso.')
    } catch (err: any) {
      toast.error('Erro ao rejeitar evento: ' + err.message)
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

  const approved = allEvents.filter(e => e.status === 'published' && e.approval_status === 'approved')
  const pending = allEvents.filter(e => e.approval_status === 'pending' || !e.approval_status)
  
  const totalRevenue = approved.reduce((s, e) => {
    const eventRevenue = (e.ticket_types || []).reduce((sum, t) => sum + (Number(t.price) || 0) * (Number(t.sold) || 0), 0)
    return s + eventRevenue
  }, 0)

  const filteredEvents = allEvents.filter(e => {
    const appStatus = e.approval_status || 'pending'
    if (activeTab === 'all') return true
    return appStatus === activeTab
  })

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Eventos</h1>
        <p className="text-sm text-espresso/50 mt-1">Gerencie e modere todos os eventos da plataforma</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: allEvents.length.toString(), icon: Calendar },
          { label: 'Aprovados', value: approved.length.toString(), icon: CheckCircle },
          { label: 'Pendentes', value: pending.length.toString(), icon: Clock },
          { label: 'Receita', value: `R$ ${(totalRevenue / 1000).toFixed(1)}K`, icon: DollarSign },
        ].map(k => (
          <div key={k.label} className="evt-card p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Abas de filtro */}
      <div className="flex gap-2 mb-6 border-b border-espresso/10 pb-px">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-semibold capitalize border-b-2 transition-all ${
              activeTab === tab 
                ? 'border-plum text-plum font-bold' 
                : 'border-transparent text-espresso/50 hover:text-espresso'
            }`}
          >
            {tab === 'all' ? 'Todos' : tab === 'pending' ? 'Pendentes' : tab === 'approved' ? 'Aprovados' : 'Rejeitados'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-plum animate-spin" />
        </div>
      )}

      {/* Erro real na tela, em vez de "0 eventos" silencioso */}
      {isError && (
        <div role="alert" className="evt-card mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300">
          Não foi possível carregar os eventos: {(error as Error)?.message || 'erro desconhecido'}
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        <div className="evt-card bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-espresso/5">
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Evento</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Data</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Produtor</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Publicação</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Moderação</th>
                  <th className="text-center px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Destaque</th>
                  <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Receita</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-espresso/30 italic">
                      Nenhum evento nesta categoria.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map(e => {
                    const eventRevenue = (e.ticket_types || []).reduce((sum, t) => sum + (Number(t.price) || 0) * (Number(t.sold) || 0), 0)
                    const pubStatus = statusCfg[e.status] || { label: e.status, cls: 'bg-slate-50 text-slate-500 border-slate-100' }
                    const appStatus = approvalStatusCfg[e.approval_status || 'pending']
                    const formattedDate = e.date
                      ? new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Data a definir'

                    return (
                      <tr key={e.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                              <img src={e.cover_image || '/images/hero-bg.jpg'} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <div className="text-sm text-espresso font-medium">{e.title}</div>
                              <div className="text-[10px] text-espresso/30">{e.venue_city || e.venue_name || 'Local a definir'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="text-xs text-espresso/50">{formattedDate}</div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="text-xs text-espresso/50">{e.profiles?.full_name || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${pubStatus.cls}`}>{pubStatus.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${appStatus.cls}`}>{appStatus.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleFeatured(e.id, !!e.featured_carousel)}
                            disabled={e.approval_status !== 'approved'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              e.approval_status !== 'approved'
                                ? 'opacity-30 cursor-not-allowed'
                                : e.featured_carousel
                                ? 'text-amber-500 hover:bg-amber-500/10'
                                : 'text-espresso/20 hover:text-amber-500 hover:bg-amber-500/10'
                            }`}
                            title={e.featured_carousel ? "Remover do carrossel" : "Destacar no carrossel"}
                          >
                            <Star className="w-4 h-4 fill-current" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          <div className="text-sm font-serif text-espresso">
                            {eventRevenue > 0 ? `R$ ${eventRevenue.toLocaleString()}` : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={ev => { openerRef.current = ev.currentTarget; setDetailId(e.id) }}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Ver detalhes do evento"
                              aria-label="Ver detalhes do evento"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                            {(e.approval_status === 'pending' || !e.approval_status) && (
                              <>
                                <button
                                  onClick={() => handleApprove(e.id)}
                                  className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600 transition-colors"
                                  title="Aprovar"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleReject(e.id)}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-colors"
                                  title="Rejeitar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {e.status === 'published' && e.approval_status === 'approved' ? (
                              <a
                                href={publicEventUrl(e.slug || e.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg hover:bg-canvas text-espresso/30 hover:text-espresso/60 transition-colors"
                                title="Ver página pública"
                                aria-label="Ver página pública"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span className="p-1.5 text-espresso/15 cursor-not-allowed" title="Só eventos publicados e aprovados têm página pública" aria-label="Sem página pública">
                                <Eye className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Painel lateral de detalhes (mesmo padrão do "Gerenciar" de Users.tsx) */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailId(null)} />
          <aside role="dialog" aria-modal="true" aria-label={`Detalhes do evento ${detail.title}`} className="relative w-full max-w-lg h-full bg-card text-foreground border-l border-border shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-border flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg text-foreground">{detail.title}</h3>
                {detail.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{detail.subtitle}</p>}
              </div>
              <button autoFocus onClick={() => setDetailId(null)} aria-label="Fechar detalhes" className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-sm">
              {detail.cover_image && <img src={detail.cover_image} alt="" className="w-full aspect-video object-cover rounded-xl bg-muted" />}

              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${(statusCfg[detail.status] || { cls: 'bg-slate-50 text-slate-500 border-slate-100' }).cls}`}>
                  Publicação: {statusCfg[detail.status]?.label || detail.status}
                </span>
                <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${approvalStatusCfg[detail.approval_status || 'pending'].cls}`}>
                  Moderação: {approvalStatusCfg[detail.approval_status || 'pending'].label}
                </span>
                {detail.featured_carousel && <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-amber-50 text-amber-700 border-amber-100">Em destaque</span>}
              </div>

              {detail.description && <p className="text-muted-foreground whitespace-pre-line">{detail.description}</p>}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {([
                  ['Categoria', detail.category],
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
                ] as [string, string | number | null | undefined][]).map(([l, v]) => (
                  <div key={l}>
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</dt>
                    <dd className="text-foreground mt-0.5 break-words">{v ?? '—'}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Ingressos</h4>
                {!detail.ticket_types?.length ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum tipo de ingresso cadastrado.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-2 font-medium">Nome</th>
                        <th className="py-1 pr-2 font-medium">Preço</th>
                        <th className="py-1 pr-2 font-medium">Qtd.</th>
                        <th className="py-1 pr-2 font-medium">Vendidos</th>
                        <th className="py-1 font-medium">Ativo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.ticket_types.map(t => (
                        <tr key={t.id} className="border-t border-border">
                          <td className="py-1.5 pr-2 text-foreground">{t.name}</td>
                          <td className="py-1.5 pr-2 text-foreground">{Number(t.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td className="py-1.5 pr-2 text-foreground">{t.quantity_total ?? t.capacity ?? '—'}</td>
                          <td className="py-1.5 pr-2 text-foreground">{t.sold ?? 0}</td>
                          <td className="py-1.5 text-foreground">{t.is_active ? 'Sim' : 'Não'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                {(detail.approval_status === 'pending' || !detail.approval_status) && (
                  <>
                    <button onClick={() => handleApprove(detail.id)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-300 transition-colors">
                      <Check className="w-3.5 h-3.5" /> Aprovar
                    </button>
                    <button onClick={() => handleReject(detail.id)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 transition-colors">
                      <X className="w-3.5 h-3.5" /> Rejeitar
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleToggleFeatured(detail.id, !!detail.featured_carousel)}
                  disabled={detail.approval_status !== 'approved'}
                  title={detail.approval_status !== 'approved' ? 'Só eventos aprovados podem ser destacados' : undefined}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:border-amber-400 hover:text-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Star className={`w-3.5 h-3.5 ${detail.featured_carousel ? 'fill-current text-amber-500' : ''}`} />
                  {detail.featured_carousel ? 'Remover destaque' : 'Destacar no carrossel'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
