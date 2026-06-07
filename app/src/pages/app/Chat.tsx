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
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
        <p className="text-white/60 text-sm">Carregando conversas...</p>
      </div>
    )
  }

  if (eventConversations.length === 0) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-white mb-6">Chat</h1>
        <div className="text-center py-16 bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-3xl">
          <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-sm mb-2">Você ainda não tem conversas.</p>
          <p className="text-white/30 text-xs">Adquira um ingresso para conversar com os produtores.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl flex flex-col h-[calc(100vh-140px)]">
      <h1 className="text-3xl font-bold text-white mb-4">Chat</h1>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar — lista de conversas */}
        <div className="w-64 flex-shrink-0 bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-white/[0.06]">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Conversas</p>
          </div>
          <div className="overflow-y-auto flex-1">
            {eventConversations.map((conv) => (
              <button
                key={conv.eventId}
                onClick={() => setSelectedEventId(conv.eventId)}
                className={`w-full text-left p-3.5 border-b border-white/[0.04] transition-colors ${
                  activeEventId === conv.eventId ? 'bg-purple-500/10' : 'hover:bg-white/[0.02]'
                }`}
              >
                <p className={`text-sm font-semibold truncate ${activeEventId === conv.eventId ? 'text-purple-400' : 'text-white/95'}`}>
                  {conv.eventTitle}
                </p>
                <p className="text-[11px] text-white/40 truncate mt-0.5">Produtor</p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-3.5 border-b border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <User className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/90">Produtor</p>
              <p className="text-[11px] text-white/40">
                {eventConversations.find((c) => c.eventId === activeEventId)?.eventTitle || 'Evento'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingChat ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Inicie uma conversa com o produtor.</p>
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
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-white'
                    }`}
                  >
                    <User className="w-4 h-4" />
                  </div>
                  <div
                    className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                      msg.sender_id === user?.id
                        ? 'bg-purple-600 text-white rounded-tr-sm shadow-md'
                        : 'bg-white/[0.05] border border-white/[0.08] text-white rounded-tl-sm shadow-md'
                    }`}
                  >
                    <p className="leading-relaxed">{msg.content}</p>
                    <span
                      className={`text-[9px] mt-1.5 block ${
                        msg.sender_id === user?.id ? 'text-white/60' : 'text-white/40'
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
          <div className="p-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Escreva uma mensagem..."
                disabled={sendMessage.isPending}
                className="flex-1 px-4 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/30 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={sendMessage.isPending || !message.trim()}
                className="p-2.5 bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] hover:from-[#2573d9] hover:to-[#9d47ff] text-white rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
