import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react'

interface Message {
  id: string
  session_id: string
  sender_type: 'visitor' | 'agent'
  sender_id: string
  sender_name: string
  content: string
  created_at: string
  read_at: string | null
}

export default function SupportChatWidget() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [visitorId, setVisitorId] = useState<string>('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. Inicializar ou carregar o visitor_id do localStorage
  useEffect(() => {
    let localVisitorId = localStorage.getItem('evokaa_visitor_id')
    if (!localVisitorId) {
      localVisitorId = crypto.randomUUID()
      localStorage.setItem('evokaa_visitor_id', localVisitorId)
    }
    setVisitorId(localVisitorId)
  }, [])

  // 1b. Sessão ativa do usuário logado. As regras de acesso (RLS) de support_sessions e
  // support_messages só liberam linhas com user_id = auth.uid() ou para admin; visitante
  // anônimo não consegue abrir sessão, por isso o chat pede login.
  useEffect(() => {
    if (!user?.id) return
    const userId = user.id
    let cancelled = false

    async function fetchActiveSession() {
      try {
        const { data, error } = await supabase
          .from('support_sessions')
          .select('id')
          .eq('user_id', userId)
          .neq('status', 'closed')
          .order('created_at', { ascending: false })
          .limit(1)

        if (cancelled) return
        if (error) throw error
        setSessionId(data?.[0]?.id ?? null)
      } catch (err) {
        console.error('[SupportChat] Erro ao buscar sessao ativa:', err)
      }
    }

    fetchActiveSession()
    // Ao trocar de usuário ou deslogar, nada da conta anterior fica na tela
    return () => {
      cancelled = true
      setSessionId(null)
      setMessages([])
      setUnreadCount(0)
    }
  }, [user?.id])

  // 2. Tocar áudio de notificação usando a Web Audio API
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)

      oscillator.type = 'sine'
      // Acorde de duas notas para som amigável
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime) // C5
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime)
      oscillator.start()
      
      oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.08) // G5
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.08)
      
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
      oscillator.stop(audioCtx.currentTime + 0.3)
    } catch (e) {
      console.warn('[SupportChat] AudioContext bloqueado pelo navegador ou nao suportado:', e)
    }
  }

  // 3. Buscar mensagens quando a sessão for identificada
  useEffect(() => {
    if (!sessionId || !visitorId) return
    const sid = sessionId

    async function fetchMessages() {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('session_id', sid)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setMessages(data as Message[])
        // Conta mensagens não lidas do agente
        const unreads = data.filter(m => m.sender_type === 'agent' && !m.read_at).length
        if (!isOpen) {
          setUnreadCount(unreads)
        } else if (unreads > 0) {
          markMessagesAsRead(data)
        }
      }
      setIsLoading(false)
    }

    fetchMessages()

    // 4. Inscrever-se em novas mensagens via Supabase Realtime
    const channel = supabase
      .channel(`support-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages((prev) => {
            if (prev.some(m => m.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })

          if (newMessage.sender_type === 'agent') {
            if (!isOpen) {
              setUnreadCount(prev => prev + 1)
              playNotificationSound()
            } else {
              markMessageAsReadLocal(newMessage.id)
            }
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [sessionId, visitorId, isOpen])

  // Rolar para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Marcar mensagens da conversa como lidas
  const markMessagesAsRead = async (msgList: Message[]) => {
    if (!sessionId || !visitorId) return
    const unreadIds = msgList.filter(m => m.sender_type === 'agent' && !m.read_at).map(m => m.id)
    if (unreadIds.length === 0) return

    try {
      await supabase
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)

      setMessages(prev =>
        prev.map(m => (unreadIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m))
      )
    } catch (err) {
      console.error('[SupportChat] Erro ao marcar mensagens como lidas:', err)
    }
  }

  // Marcar uma única mensagem recebida em tempo real como lida
  const markMessageAsReadLocal = async (msgId: string) => {
    if (!visitorId) return
    try {
      await supabase
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', msgId)
    } catch (err) {
      console.error('[SupportChat] Erro ao marcar mensagem realtime como lida:', err)
    }
  }

  // Limpar contagem de não lidas ao abrir o chat
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      setUnreadCount(0)
      markMessagesAsRead(messages)
    }
  }, [isOpen])

  // Enviar Mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !visitorId || !user) return

    const messageText = inputValue.trim()
    setInputValue('')
    let currentSessionId = sessionId

    try {
      // 1. Criar sessão se não existir
      if (!currentSessionId) {
        setIsLoading(true)
        const { data: newSession, error: sessionError } = await supabase
          .from('support_sessions')
          .insert({
            visitor_id: visitorId,
            user_id: user.id,
            status: 'open'
          })
          .select('id')
          .single()

        if (sessionError) throw sessionError
        currentSessionId = newSession.id
        setSessionId(currentSessionId)
      }

      // 2. Inserir a mensagem no banco
      const { error: msgError } = await supabase
        .from('support_messages')
        .insert({
          session_id: currentSessionId,
          sender_type: 'visitor',
          sender_id: user.id,
          sender_name: user.full_name || user.email || 'Cliente',
          content: messageText
        })

      if (msgError) throw msgError
    } catch (err) {
      console.error('[SupportChat] Erro ao enviar mensagem:', err)
      setInputValue((v) => (v ? `${messageText} ${v}` : messageText))
      toast.error('Não foi possível enviar a mensagem. Tente de novo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Janela de Conversa (Chat Box) */}
      {isOpen && (
        <div className="mb-4 w-[360px] max-w-[calc(100vw-2rem)] h-[480px] bg-void/90 backdrop-blur-xl border border-cream/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-plum/60 to-espresso/80 border-b border-cream/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-plum/40 border border-cream/20 flex items-center justify-center text-cream">
                  <Sparkles className="w-5 h-5 text-plum animate-pulse" />
                </div>
                {/* Indicador Online */}
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-void rounded-full"></span>
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Suporte Evokaa</h3>
                <p className="text-xs text-cream/60 flex items-center gap-1.5">
                  Estamos online para te ajudar!
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Fechar chat de suporte"
              className="p-1 rounded-lg hover:bg-cream/10 text-cream/70 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-cream/10">
            {messages.length === 0 && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="p-3 bg-plum/10 rounded-full">
                  <MessageCircle className="w-8 h-8 text-plum" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Como podemos te ajudar hoje?</h4>
                  <p className="text-xs text-cream/50 mt-1 max-w-[220px]">
                    {user
                      ? 'Envie uma mensagem abaixo e nossa equipe responderá em minutos.'
                      : 'Entre na sua conta para conversar com a equipe, ou use o formulário de contato.'}
                  </p>
                </div>
              </div>
            )}

            {isLoading && messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-plum" />
              </div>
            ) : (
              messages.map((msg) => {
                const isVisitor = msg.sender_type === 'visitor'
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isVisitor ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-md transition-all ${
                        isVisitor
                          ? 'bg-plum text-white rounded-tr-none'
                          : 'bg-cream/5 border border-cream/10 text-cream rounded-tl-none'
                      }`}
                    >
                      {!isVisitor && (
                        <p className="text-[10px] text-plum font-semibold mb-0.5">
                          {msg.sender_name}
                        </p>
                      )}
                      <p className="leading-relaxed break-words">{msg.content}</p>
                      <span className="block text-[9px] text-cream/40 text-right mt-1.5">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de Envio (só para usuário logado) */}
          {!user ? (
            <div className="p-3 bg-espresso/50 border-t border-cream/10 flex items-center gap-2">
              <Link
                to="/auth/login"
                className="flex-1 py-2 bg-plum hover:brightness-110 text-white text-sm text-center rounded-xl transition-all"
              >
                Entrar
              </Link>
              <Link
                to="/contato"
                className="flex-1 py-2 bg-cream/5 border border-cream/10 text-cream text-sm text-center rounded-xl hover:bg-cream/10 transition-all"
              >
                Formulário de contato
              </Link>
            </div>
          ) : (
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-espresso/50 border-t border-cream/10 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite sua mensagem..."
              aria-label="Mensagem para o suporte"
              className="flex-1 bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-sm text-white placeholder-cream/40 focus:outline-none focus:border-plum/50 focus:ring-1 focus:ring-plum/50 transition-all"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="p-2.5 bg-plum hover:brightness-110 text-white rounded-xl disabled:opacity-50 disabled:hover:brightness-100 transition-all flex items-center justify-center shadow-md active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          )}
        </div>
      )}

      {/* Botão de abrir/fechar flutuante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Fechar chat de suporte' : 'Abrir chat de suporte'}
        className="relative group p-4 bg-plum hover:brightness-110 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 border border-cream/20 hover:border-cream/30"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        
        {/* Badge de mensagens não lidas */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[11px] font-bold w-5.5 h-5.5 flex items-center justify-center rounded-full ring-2 ring-void animate-bounce">
            {unreadCount}
          </span>
        )}

        {/* Efeito Glow no Hover */}
        <span className="absolute inset-0 rounded-full bg-plum/20 filter blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"></span>
      </button>
    </div>
  )
}
