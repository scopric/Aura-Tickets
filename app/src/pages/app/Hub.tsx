import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { siteUrl } from '../../lib/appHost'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { usePublicEvents } from '../../hooks/useEvents'
import { useUserTickets } from '../../hooks/useCheckout'
import { useAuth } from '../../hooks/useAuth'
import TicketQRCode from '../../components/TicketQRCode'
import { useEventMenuItems } from '../../hooks/useMenuItems'
import { useChat } from '../../hooks/useChat'
import Chip from '../../components/Chip'
import EventoCapa from '../../components/EventoCapa'
import EventoLinha from '../../components/EventoLinha'

export default function AppHub() {
  const [activeTab, setActiveTab] = useState<'ingressos' | 'eventos' | 'cardapio' | 'chat'>('ingressos')
  const [showQR, setShowQR] = useState<string | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [menuCategory, setMenuCategory] = useState<string>('Todos')
  
  const { user } = useAuth()
  const { data: dbEvents = [], isLoading: isLoadingEvents } = usePublicEvents()
  const { data: dbTickets = [], isLoading: isLoadingTickets } = useUserTickets()

  // Evento ativo para o cardápio e chat (primeiro evento dos ingressos do usuário)
  const activeEventId = useMemo(() => {
    const activeTicket = dbTickets.find(t => t.status === 'active')
    return activeTicket?.events?.id || null
  }, [dbTickets])

  const activeEventName = useMemo(() => {
    const activeTicket = dbTickets.find(t => t.status === 'active')
    return activeTicket?.events?.title || 'Evento'
  }, [dbTickets])

  const { data: dbMenuItems = [], isLoading: isLoadingMenu } = useEventMenuItems(activeEventId || undefined)
  const { messages: chatMessages, isLoading: isLoadingChat, sendMessage, markAsRead } = useChat(activeEventId)

  // Marcar mensagens como lidas quando abrir a aba de chat
  useEffect(() => {
    if (activeTab === 'chat' && activeEventId) {
      markAsRead.mutate()
    }
  }, [activeTab, activeEventId])

  // Mapear tickets do DB para o formato do layout
  const myTickets = (dbTickets || []).map(t => {
    const eventDate = t.events?.date
      ? new Date(t.events.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Data a definir'
    return {
      id: t.id,
      eventId: t.events?.id || t.event_id || '',
      eventName: t.events?.title || 'Evento',
      capa: t.events,
      date: eventDate,
      time: t.events?.time || '--:--',
      location: t.events?.venue_name || 'Local a definir',
      type: t.ticket_types?.name || 'Ingresso',
      seat: t.seat_info || 'Livre',
      price: t.ticket_types?.price || 0,
      qr: t.code || t.qr_code || '',
      status: t.status === 'active' ? 'ativo' : t.status === 'used' ? 'usado' : t.status === 'cancelled' ? 'cancelado' : 'transferido',
    }
  })

  const handleSendChat = () => {
    if (!chatMessage.trim()) return
    sendMessage.mutate(chatMessage, {
      onSuccess: () => setChatMessage(''),
      onError: (err: any) => toast.error(err.message || 'Erro ao enviar mensagem'),
    })
  }

  const tabs = [
    { id: 'ingressos' as const, label: 'Meus Ingressos', count: myTickets.length > 0 ? myTickets.length : undefined },
    { id: 'eventos' as const, label: 'Eventos', count: dbEvents.length > 0 ? dbEvents.length : undefined },
    { id: 'cardapio' as const, label: 'Cardápio', count: undefined },
    { id: 'chat' as const, label: 'Chat', count: undefined },
  ]

  const filteredEvents = dbEvents.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.venue_name || e.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const tituloSecao = 'text-[15px] font-semibold leading-5'
  const diaCurto = (data: string | null) => data ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : 'Data a definir'

  const renderStats = () => (
    <dl className="grid grid-cols-2 divide-x divide-border border-y border-border py-3 text-center">
      <div className="flex flex-col-reverse">
        <dt className="text-xs leading-4 text-muted-foreground">Ingressos</dt>
        <dd className="font-display text-[28px] font-semibold leading-8 tracking-[-0.01em] tabular-nums">{isLoadingTickets ? '–' : myTickets.length}</dd>
      </div>
      <div className="flex flex-col-reverse">
        <dt className="text-xs leading-4 text-muted-foreground">Eventos</dt>
        <dd className="font-display text-[28px] font-semibold leading-8 tracking-[-0.01em] tabular-nums">{dbEvents.length}</dd>
      </div>
    </dl>
  )

  const renderTickets = () => (
    <div className="space-y-4">
      <h2 className={tituloSecao}>Meus Ingressos</h2>
      {isLoadingTickets ? (
        <div aria-busy="true" className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-[132px] w-full rounded-ev-lg" />)}
        </div>
      ) : myTickets.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-4">
          <I.Ingressos size={40} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-base font-semibold">Você ainda não tem ingressos.</p>
          <p className="text-[13px] leading-[18px] text-muted-foreground">Explore eventos e faça sua primeira compra!</p>
          <Button variant="outline" onClick={() => setActiveTab('eventos')}>Explorar Eventos</Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {myTickets.map(ticket => (
            <li key={ticket.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex gap-3">
                {ticket.capa && <EventoCapa evento={ticket.capa} tamanho="mini" className="!size-14" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs leading-4 text-muted-foreground">{ticket.date} · {ticket.time}</p>
                  <p className="line-clamp-2 font-display text-lg font-extrabold leading-[22px] tracking-[-0.01em] wide">{ticket.eventName}</p>
                  <p className="truncate text-[13px] leading-[18px] text-muted-foreground">{ticket.location}</p>
                </div>
                <span className={`flex-none text-xs font-semibold leading-4 ${ticket.status === 'ativo' ? 'text-[var(--ev-success)]' : 'text-[var(--ev-warning)]'}`}>
                  {{ ativo: 'Ativo', usado: 'Usado', cancelado: 'Cancelado', transferido: 'Transferido' }[ticket.status]}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] leading-[18px] text-muted-foreground">
                <I.Lugar size={16} aria-hidden="true" className="flex-none" />
                <span className="truncate">{ticket.type} · {ticket.seat}</span>
              </p>
              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                <Button className="flex-1" onClick={() => setShowQR(ticket.qr)} aria-label={`Ver QR Code de ${ticket.eventName}`}>
                  <I.Qr aria-hidden="true" /> Ver QR Code
                </Button>
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(siteUrl(`/event/${ticket.eventId}`)); toast.success('Link do evento copiado!') }} aria-label={`Copiar link do evento ${ticket.eventName}`} title="Copiar link do evento">
                  <I.Compartilhar aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const renderNextEvents = () => (
    <div className="space-y-4">
      <h2 className={`${tituloSecao} mt-6`}>Próximos Eventos</h2>
      {isLoadingEvents ? (
        <div aria-busy="true" className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-[120px] w-full rounded-ev-lg" />)}
        </div>
      ) : dbEvents.length > 0 ? (
        <ul className="divide-y divide-border">
          {dbEvents.slice(0, 2).map(event => (
            <EventoLinha key={event.id} evento={event} to={`/event/${event.id}`} linha={`${diaCurto(event.date)} · ${event.venue_name || event.location || 'Local a definir'}`} />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] leading-[18px] text-muted-foreground">Nenhum evento agendado no momento.</p>
      )}
    </div>
  )

  const renderEventosList = () => (
    <div className="space-y-4">
      <h2 className={tituloSecao}>Descobrir Eventos</h2>
      <label className="relative block">
        <span className="sr-only">Buscar eventos</span>
        <I.Buscar size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar eventos..."
          className="h-11 rounded-ev-lg bg-card pl-10 text-base"
        />
      </label>

      {isLoadingEvents ? (
        <div aria-busy="true" className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-[120px] w-full rounded-ev-lg" />)}
        </div>
      ) : filteredEvents.length > 0 ? (
        <ul className="divide-y divide-border">
          {filteredEvents.map(event => {
            const formattedDate = event.date
              ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Data a definir'
            return (
              <EventoLinha key={event.id} evento={event} to={`/event/${event.id}`} linha={`${formattedDate} · ${event.venue_name || event.location || 'Local a definir'}`} />
            )
          })}
        </ul>
      ) : (
        <p className="py-12 text-center text-[13px] leading-[18px] text-muted-foreground">Nenhum evento encontrado.</p>
      )}
    </div>
  )

  const renderCardapio = () => (
    <div className="space-y-4">
      <h2 className={tituloSecao}>Cardápio do Evento</h2>
      <p className="text-[13px] leading-[18px] text-[var(--ev-warning)]">Pedidos pelo app em breve: por enquanto, o cardápio é só para consulta.</p>
      {activeEventId ? (
        <>
          <div>
            <h3 className="truncate text-sm font-semibold">{activeEventName}</h3>
            <p className="text-xs leading-4 text-muted-foreground">Consulte os itens e preços do evento</p>
          </div>

          {/* Categories */}
          <div role="group" aria-label="Categorias do cardápio" className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {['Todos', 'bebida', 'comida', 'combo', 'servico'].map((cat) => (
              <Chip key={cat} marcado={menuCategory === cat} onClick={() => setMenuCategory(cat)}>
                {cat === 'Todos' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Chip>
            ))}
          </div>

          {/* Menu items */}
          {isLoadingMenu ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-5" />
            </div>
          ) : dbMenuItems.length === 0 ? (
            <p className="py-8 text-center text-[13px] leading-[18px] text-muted-foreground">Cardápio não disponível para este evento.</p>
          ) : (
            <ul className="max-h-[300px] divide-y divide-border overflow-y-auto">
              {dbMenuItems
                .filter(item => menuCategory === 'Todos' || item.category === menuCategory)
                .map(item => {
                  const icons: Record<string, I.IconeEvokaa> = { bebida: I.Cardapio, comida: I.Talheres, combo: I.Pacote, merchandise: I.Pacote, servico: I.Destaque }
                  const Icon = icons[item.category] || I.Pacote
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-ev-md bg-secondary text-muted-foreground">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="truncate text-xs leading-4 text-muted-foreground">{item.description}</div>
                      </div>
                      <div className="flex-none font-display text-sm font-semibold tabular-nums">R$ {item.price}</div>
                    </li>
                  )
                })}
            </ul>
          )}
        </>
      ) : (
        <div className="space-y-1 py-8 text-center">
          <p className="text-sm font-semibold">Você não tem ingressos ativos</p>
          <p className="text-[13px] leading-[18px] text-muted-foreground">Compre um ingresso para ver o cardápio do evento</p>
        </div>
      )}
    </div>
  )

  const renderChat = () => (
    <div className="space-y-4">
      <h2 className={tituloSecao}>Chat com o Produtor</h2>
      {!activeEventId ? (
        <div className="space-y-1 py-8 text-center">
          <p className="text-sm font-semibold">Chat disponível para eventos ativos</p>
          <p className="text-[13px] leading-[18px] text-muted-foreground">Adquira um ingresso para conversar com o produtor</p>
        </div>
      ) : (
        <>
          {/* Producer info */}
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-full bg-secondary text-muted-foreground">
                <I.Conta size={16} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Produtor</div>
                <div className="truncate text-xs leading-4 text-muted-foreground">{activeEventName}</div>
              </div>
            </div>
            <div className="flex flex-none items-center gap-1.5">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--ev-success)]" />
              <span className="text-xs font-medium text-[var(--ev-success)]">Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex h-[220px] flex-col justify-between overflow-y-auto rounded-ev-lg border border-border p-3">
            {isLoadingChat ? (
              <div className="flex h-full items-center justify-center">
                <Spinner className="size-5" />
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="my-auto space-y-1 py-8 text-center">
                <p className="text-sm font-semibold">Nenhuma mensagem ainda</p>
                <p className="text-[13px] leading-[18px] text-muted-foreground">Envie uma mensagem para o produtor!</p>
              </div>
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      msg.sender_id === user?.id
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm bg-secondary text-foreground'
                    }`}>
                      <p className="text-sm leading-5">{msg.content}</p>
                      <span className={`mt-0.5 block text-right text-[11px] leading-4 ${msg.sender_id === user?.id ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2">
            <Input
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              aria-label="Mensagem para o produtor"
              placeholder="Escreva uma mensagem..."
              disabled={sendMessage.isPending}
              className="h-11 flex-1 rounded-ev-lg bg-card text-base"
            />
            <Button
              size="icon-lg"
              onClick={handleSendChat}
              disabled={!chatMessage.trim()}
              loading={sendMessage.isPending}
              aria-label="Enviar mensagem"
            >
              <I.Enviar aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="w-full pb-8 text-foreground">
      {/* Welcome */}
      <div className="max-w-lg lg:max-w-7xl mx-auto px-4 py-4 lg:py-6">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-10 flex-none place-items-center rounded-full bg-secondary text-muted-foreground">
            <I.Conta size={20} />
          </span>
          <div>
            <p className="text-[13px] leading-[18px] text-muted-foreground">Olá,</p>
            <h1 className="text-2xl font-semibold leading-8 tracking-[-0.015em]">{user?.full_name || user?.name || 'Participante'}</h1>
          </div>
        </div>
      </div>

      {/* Layout Responsivo: Grid no Desktop / Abas no Mobile */}
      <div className="max-w-lg lg:max-w-7xl mx-auto px-4">
        {/* Seletor de Abas (Visível apenas no Mobile) */}
        <div role="group" aria-label="Seções do Hub" className="lg:hidden mb-6 flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(t => (
            <Chip key={t.id} marcado={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <>{' '}<span className="ml-0.5 font-display tabular-nums">{t.count}</span></>
              )}
            </Chip>
          ))}
        </div>

        {/* Visualização Mobile (Abas): o conteúdo entra pelo lado, 8 px, e só esmaece com "reduzir movimento" (aba-entra, index.css) */}
        <div key={activeTab} className="lg:hidden space-y-4 animate-[aba-entra_var(--mov-rapido)_var(--curva-sai)]">
          {activeTab === 'ingressos' && (
            <div className="space-y-6">
              {renderStats()}
              {renderTickets()}
              {renderNextEvents()}
            </div>
          )}
          {activeTab === 'eventos' && renderEventosList()}
          {activeTab === 'cardapio' && renderCardapio()}
          {activeTab === 'chat' && renderChat()}
        </div>

        {/* Visualização Desktop (Grid Completo de 3 Colunas) */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-10">
          {/* Coluna 1: Ingressos & Stats (4 colunas) */}
          <div className="lg:col-span-4 space-y-6">
            {renderStats()}
            {renderTickets()}
            {renderNextEvents()}
          </div>

          {/* Coluna 2: Busca & Descobrir Eventos (4 colunas) */}
          <div className="lg:col-span-4 space-y-6">
            {renderEventosList()}
          </div>

          {/* Coluna 3: Interação Local - Cardápio & Chat do Evento Ativo (4 colunas): seções separadas por fio, sem caixa */}
          <div className="lg:col-span-4 space-y-6">
            {renderCardapio()}
            <div className="border-t border-border pt-6">
              {renderChat()}
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-backdrop" onClick={() => setShowQR(null)}>
          <div className="w-full max-w-xs rounded-ev-xl border border-border bg-card p-8 text-center text-card-foreground shadow-ev-2" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2 text-xl font-semibold tracking-[-0.015em]">Ingresso</h3>
            <p className="mb-6 text-[13px] leading-[18px] text-muted-foreground">Apresente na entrada do evento</p>
            <div className="mx-auto mb-4 size-48">
              <TicketQRCode code={showQR} size={192} className="rounded-ev-lg" />
            </div>
            <p className="break-all font-mono text-xs text-muted-foreground">{showQR}</p>
            <Button variant="outline" className="mt-6 w-full" onClick={() => setShowQR(null)}>Fechar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
