import { useState, useRef, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '../../hooks/useAuth'
import { useUserTickets } from '../../hooks/useUserTickets'
import { useChat } from '../../hooks/useChat'

export default function AppChat() {
  const { user } = useAuth()
  const { data: tickets = [], isLoading: isLoadingTickets } = useUserTickets()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Agrupar tickets por evento para mostrar lista de conversas
  const eventConversations = useMemo(() => {
    const map = new Map<string, { eventId: string; eventTitle: string; lastMessage: string; unread: number }>()
    for (const t of tickets) {
      if (!map.has(t.event_id)) {
        map.set(t.event_id, {
          eventId: t.event_id,
          eventTitle: t.event_title || 'Evento',
          lastMessage: '',
          unread: 0,
        })
      }
    }
    return Array.from(map.values())
  }, [tickets])

  const activeEventId = selectedEventId || eventConversations[0]?.eventId || null

  const { messages: chatMessages = [], isLoading: isLoadingChat, sendMessage } = useChat(activeEventId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = () => {
    if (!message.trim() || !activeEventId) return
    sendMessage.mutate(message.trim(), {
      onSuccess: () => setMessage(''),
      onError: () => toast.error('Erro ao enviar mensagem'),
    })
  }

  if (isLoadingTickets) {
    return (
      <div className="max-w-3xl py-20 text-center text-foreground">
        <Spinner className="mx-auto size-6" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando conversas...</p>
      </div>
    )
  }

  if (eventConversations.length === 0) {
    return (
      <div className="max-w-3xl text-foreground">
        <h1 className="mb-6 text-2xl font-semibold tracking-[-0.015em]">Chat</h1>
        <div role="status" className="flex max-w-sm flex-col items-start gap-3">
          <I.Conversa size={40} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-lg font-semibold">Você ainda não tem conversas.</p>
          <p className="text-[15px] text-muted-foreground">Adquira um ingresso para conversar com os produtores.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-18rem)] min-h-[26rem] max-w-3xl flex-col text-foreground lg:h-[calc(100vh-140px)]">
      <h1 className="mb-4 text-2xl font-semibold tracking-[-0.015em]">Chat</h1>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* Lista de conversas: fileira que rola no celular, coluna a partir de md */}
        <nav aria-label="Conversas" className="flex flex-none gap-2 overflow-x-auto py-1 [scrollbar-width:none] md:w-64 md:flex-col md:gap-0 md:overflow-y-auto md:overflow-x-visible md:rounded-ev-lg md:border md:border-border md:bg-card md:p-0 [&::-webkit-scrollbar]:hidden">
          <p className="hidden border-b border-border p-3.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground md:block">Conversas</p>
          {eventConversations.map((conv) => (
            <button
              key={conv.eventId}
              type="button"
              aria-current={activeEventId === conv.eventId ? 'true' : undefined}
              onClick={() => setSelectedEventId(conv.eventId)}
              className={`max-w-[16rem] flex-none rounded-ev-lg px-4 py-2 text-left transition-colors duration-rapido focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none md:max-w-none md:rounded-none md:border-b md:border-border md:p-3.5 md:last:border-b-0 ${
                activeEventId === conv.eventId
                  ? 'bg-[var(--ev-brand-soft)] text-primary'
                  : 'text-foreground shadow-[inset_0_0_0_1px_hsl(var(--input))] hover:bg-[var(--ev-tint-hover)] md:shadow-none'
              }`}
            >
              <p className="truncate text-sm font-semibold">{conv.eventTitle}</p>
              <p className={`truncate text-xs leading-4 ${activeEventId === conv.eventId ? 'text-primary' : 'text-muted-foreground'}`}>Produtor</p>
            </button>
          ))}
        </nav>

        {/* Chat Area */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-ev-lg border border-border bg-card text-card-foreground">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border p-3.5">
            <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-full bg-secondary text-muted-foreground">
              <I.Conta size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Produtor</p>
              <p className="truncate text-xs leading-4 text-muted-foreground">
                {eventConversations.find((c) => c.eventId === activeEventId)?.eventTitle || 'Evento'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {isLoadingChat ? (
              <div className="flex items-center justify-center py-10">
                <Spinner className="size-6" />
              </div>
            ) : chatMessages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Inicie uma conversa com o produtor.</p>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.sender_id === user?.id
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm bg-secondary text-foreground'
                    }`}
                  >
                    <p className="leading-relaxed">{msg.content}</p>
                    <span
                      className={`mt-1 block text-right text-[11px] leading-4 ${
                        msg.sender_id === user?.id ? 'text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                aria-label="Mensagem para o produtor"
                placeholder="Escreva uma mensagem..."
                disabled={sendMessage.isPending}
                className="h-11 flex-1 rounded-ev-lg text-base"
              />
              <Button
                size="icon-lg"
                onClick={handleSend}
                disabled={!message.trim()}
                loading={sendMessage.isPending}
                aria-label="Enviar mensagem"
              >
                <I.Enviar aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
