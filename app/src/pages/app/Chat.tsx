import { useState, useRef, useEffect, useMemo } from 'react'
import { MessageSquare, Send, User, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
      <div className="max-w-3xl flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando conversas...</p>
      </div>
    )
  }

  if (eventConversations.length === 0) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-serif text-3xl text-espresso mb-6">Chat</h1>
        <div className="text-center py-16 bg-white/60 border border-white/60 rounded-3xl">
          <MessageSquare className="w-12 h-12 text-espresso/10 mx-auto mb-4" />
          <p className="text-espresso/40 text-sm mb-2">Voce ainda nao tem conversas.</p>
          <p className="text-espresso/30 text-xs">Adquira um ingresso para conversar com os produtores.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl flex flex-col h-[calc(100vh-120px)]">
      <h1 className="font-serif text-3xl text-espresso mb-4">Chat</h1>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar — lista de conversas */}
        <div className="w-64 flex-shrink-0 bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-espresso/5">
            <p className="text-xs font-medium text-espresso/40 uppercase">Conversas</p>
          </div>
          <div className="overflow-y-auto">
            {eventConversations.map((conv) => (
              <button
                key={conv.eventId}
                onClick={() => setSelectedEventId(conv.eventId)}
                className={`w-full text-left p-3 border-b border-espresso/5 transition-colors ${
                  activeEventId === conv.eventId ? 'bg-plum/10' : 'hover:bg-white/40'
                }`}
              >
                <p className={`text-sm font-medium truncate ${activeEventId === conv.eventId ? 'text-plum' : 'text-espresso'}`}>
                  {conv.eventTitle}
                </p>
                <p className="text-[11px] text-espresso/30 truncate">Produtor</p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-espresso/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-plum/20 flex items-center justify-center">
              <User className="w-4 h-4 text-plum" />
            </div>
            <div>
              <p className="text-sm font-medium text-espresso">Produtor</p>
              <p className="text-[11px] text-espresso/30">
                {eventConversations.find((c) => c.eventId === activeEventId)?.eventTitle || 'Evento'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingChat ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-plum animate-spin" />
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare className="w-10 h-10 text-espresso/10 mx-auto mb-3" />
                <p className="text-espresso/40 text-sm">Inicie uma conversa com o produtor.</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender_id === user?.id ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.sender_id === user?.id
                        ? 'bg-plum text-cream'
                        : 'bg-espresso/10 text-espresso'
                    }`}
                  >
                    <User className="w-4 h-4" />
                  </div>
                  <div
                    className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                      msg.sender_id === user?.id
                        ? 'bg-plum text-cream rounded-tr-sm'
                        : 'bg-white text-espresso rounded-tl-sm'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <span
                      className={`text-[10px] mt-1 block ${
                        msg.sender_id === user?.id ? 'text-cream/50' : 'text-espresso/30'
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
          <div className="p-3 border-t border-espresso/5">
            <div className="flex items-center gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Escreva uma mensagem..."
                disabled={sendMessage.isPending}
                className="flex-1 px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={sendMessage.isPending || !message.trim()}
                className="p-2.5 bg-plum text-cream rounded-xl hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
