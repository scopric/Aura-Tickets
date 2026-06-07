import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { 
  MessageSquare, 
  User, 
  CheckCircle, 
  UserCheck, 
  Send, 
  Loader2, 
  Clock, 
  AlertCircle,
  Inbox,
  Lock
} from 'lucide-react'
import { toast } from 'sonner'

interface Session {
  id: string
  visitor_id: string
  user_id: string | null
  status: 'open' | 'assigned' | 'closed'
  assigned_agent_id: string | null
  created_at: string
  updated_at: string
  // Relações adicionadas em tempo real ou localmente
  user_email?: string
  user_name?: string
  unread_count?: number
  last_message?: string
}

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

export default function SupportChat() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Tocar áudio de notificação usando a Web Audio API
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)

      oscillator.type = 'sine'
      // Tom do admin (dois tons rápidos e alegres)
      oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime) // E5
      gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime)
      oscillator.start()
      
      oscillator.frequency.setValueAtTime(987.77, audioCtx.currentTime + 0.08) // B5
      gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime + 0.08)
      
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
      oscillator.stop(audioCtx.currentTime + 0.3)
    } catch (e) {
      console.warn('[AdminSupportChat] Erro ao reproduzir audio:', e)
    }
  }

  // 1. Carregar sessões de suporte abertas ou atribuídas
  const fetchSessions = async () => {
    setIsLoadingSessions(true)
    try {
      // Buscar sessões de suporte
      const { data: sessionData, error: sessionError } = await supabase
        .from('support_sessions')
        .select(`
          *,
          user:user_id (
            email,
            full_name
          )
        `)
        .neq('status', 'closed')
        .order('updated_at', { ascending: false })

      if (sessionError) throw sessionError

      // Mapear dados do usuário para as sessões
      const formattedSessions: Session[] = (sessionData || []).map((s: any) => ({
        ...s,
        user_email: s.user?.email || undefined,
        user_name: s.user?.full_name || undefined,
        unread_count: 0,
        last_message: ''
      }))

      // Buscar última mensagem e contagem de não lidas para cada sessão
      for (const session of formattedSessions) {
        // Última mensagem
        const { data: msgData } = await supabase
          .from('support_messages')
          .select('content')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (msgData && msgData.length > 0) {
          session.last_message = msgData[0].content
        }

        // Não lidas
        const { count } = await supabase
          .from('support_messages')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .eq('sender_type', 'visitor')
          .is('read_at', null)

        session.unread_count = count || 0
      }

      setSessions(formattedSessions)
    } catch (err: any) {
      console.error('[AdminSupportChat] Erro ao carregar sessoes:', err)
      toast.error('Erro ao carregar lista de atendimentos')
    } finally {
      setIsLoadingSessions(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  // 2. Ouvir mudanças nas sessões via Supabase Realtime
  useEffect(() => {
    const sessionChannel = supabase
      .channel('admin-support-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_sessions'
        },
        async (payload) => {
          // Atualiza lista de sessões no painel
          if (payload.eventType === 'INSERT') {
            const newSess = payload.new as Session
            
            // Buscar informações do usuário vinculado, se houver
            let user_email = undefined
            let user_name = undefined
            if (newSess.user_id) {
              const { data } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', newSess.user_id)
                .single()
              if (data) {
                user_email = data.email
                user_name = data.full_name
              }
            }

            const formattedNewSess: Session = {
              ...newSess,
              user_email,
              user_name,
              unread_count: 1, // Novo chat inicia com pelo menos a msg inicial
              last_message: 'Novo atendimento iniciado...'
            }

            setSessions(prev => [formattedNewSess, ...prev])
            playNotificationSound()
            toast.info('Novo visitante aguardando suporte!')
          } else if (payload.eventType === 'UPDATE') {
            const updatedSess = payload.new as Session
            if (updatedSess.status === 'closed') {
              // Remove da lista ativa
              setSessions(prev => prev.filter(s => s.id !== updatedSess.id))
              if (activeSessionId === updatedSess.id) {
                setActiveSessionId(null)
                setMessages([])
                toast.success('Atendimento encerrado')
              }
            } else {
              setSessions(prev =>
                prev.map(s => (s.id === updatedSess.id ? { ...s, ...updatedSess } : s))
              )
            }
          }
        }
      )
      .subscribe()

    return () => {
      sessionChannel.unsubscribe()
    }
  }, [activeSessionId])

  // 3. Ouvir novas mensagens em tempo real
  useEffect(() => {
    const messageChannel = supabase
      .channel('admin-support-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages'
        },
        (payload) => {
          const newMsg = payload.new as Message
          
          // Se for mensagem da conversa ativa, adiciona
          if (newMsg.session_id === activeSessionId) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })

            // Se for do visitante, marcar como lida e tocar som
            if (newMsg.sender_type === 'visitor') {
              playNotificationSound()
              markMessageAsRead(newMsg.id)
            }
          } else {
            // Se for de outra sessão, incrementa o badge de não lidas e atualiza última mensagem
            setSessions(prev =>
              prev.map(s => {
                if (s.id === newMsg.session_id) {
                  return {
                    ...s,
                    last_message: newMsg.content,
                    unread_count: (s.unread_count || 0) + (newMsg.sender_type === 'visitor' ? 1 : 0),
                    updated_at: newMsg.created_at
                  }
                }
                return s
              }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            )

            if (newMsg.sender_type === 'visitor') {
              playNotificationSound()
            }
          }
        }
      )
      .subscribe()

    return () => {
      messageChannel.unsubscribe()
    }
  }, [activeSessionId])

  // Rolar para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 4. Carregar mensagens de uma sessão ao selecionar
  useEffect(() => {
    if (!activeSessionId) return

    const fetchMessages = async () => {
      setIsLoadingMessages(true)
      try {
        const { data, error } = await supabase
          .from('support_messages')
          .select('*')
          .eq('session_id', activeSessionId)
          .order('created_at', { ascending: true })

        if (error) throw error
        setMessages(data || [])

        // Limpar contagem de não lidas e marcar como lidas no banco
        setSessions(prev =>
          prev.map(s => (s.id === activeSessionId ? { ...s, unread_count: 0 } : s))
        )

        const unreadIds = (data || [])
          .filter(m => m.sender_type === 'visitor' && !m.read_at)
          .map(m => m.id)

        if (unreadIds.length > 0) {
          await supabase
            .from('support_messages')
            .update({ read_at: new Date().toISOString() })
            .in('id', unreadIds)
        }
      } catch (err) {
        console.error('[AdminSupportChat] Erro ao carregar mensagens:', err)
        toast.error('Erro ao abrir historico de mensagens')
      } finally {
        setIsLoadingMessages(false)
      }
    }

    fetchMessages()
  }, [activeSessionId])

  // Marcar uma mensagem específica como lida
  const markMessageAsRead = async (msgId: string) => {
    try {
      await supabase
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', msgId)
    } catch (err) {
      console.error('[AdminSupportChat] Erro ao marcar mensagem como lida:', err)
    }
  }

  // Enviar Mensagem do Admin
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !activeSessionId || !user) return

    const text = inputValue.trim()
    setInputValue('')
    setIsSending(true)

    try {
      const activeSess = sessions.find(s => s.id === activeSessionId)
      
      // Auto-assumir o chat caso esteja 'open' ao responder
      if (activeSess && activeSess.status === 'open') {
        await handleAssignSession(activeSessionId)
      }

      const { error } = await supabase
        .from('support_messages')
        .insert({
          session_id: activeSessionId,
          sender_type: 'agent',
          sender_id: user.id,
          sender_name: user.full_name || user.email || 'Suporte Evokaa',
          content: text
        })

      if (error) throw error
    } catch (err) {
      console.error('[AdminSupportChat] Erro ao enviar mensagem:', err)
      toast.error('Erro ao enviar mensagem')
    } finally {
      setIsSending(false)
    }
  }

  // Atribuir sessão ao admin atual
  const handleAssignSession = async (sessId: string) => {
    if (!user) return
    try {
      const { error } = await supabase
        .from('support_sessions')
        .update({
          status: 'assigned',
          assigned_agent_id: user.id
        })
        .eq('id', sessId)

      if (error) throw error

      setSessions(prev =>
        prev.map(s =>
          s.id === sessId ? { ...s, status: 'assigned', assigned_agent_id: user.id } : s
        )
      )
      toast.success('Você assumiu este atendimento!')
    } catch (err) {
      console.error('[AdminSupportChat] Erro ao atribuir atendimento:', err)
      toast.error('Erro ao assumir atendimento')
    }
  }

  // Encerrar a sessão de suporte
  const handleCloseSession = async (sessId: string) => {
    try {
      const { error } = await supabase
        .from('support_sessions')
        .update({ status: 'closed' })
        .eq('id', sessId)

      if (error) throw error
    } catch (err) {
      console.error('[AdminSupportChat] Erro ao fechar atendimento:', err)
      toast.error('Erro ao fechar atendimento')
    }
  }

  const activeSession = sessions.find(s => s.id === activeSessionId)

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-void/50 border border-white/[0.05] rounded-3xl overflow-hidden shadow-2xl">
      
      {/* 1. PAINEL ESQUERDO: Lista de Atendimentos */}
      <div className="w-80 border-r border-white/[0.05] bg-[#07080c]/50 flex flex-col h-full">
        <div className="p-4 border-b border-white/[0.05]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Inbox className="w-5 h-5 text-purple-400" />
            Suporte em Fila
          </h2>
          <p className="text-xs text-white/50 mt-1">Gerencie e responda os visitantes do portal</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-dark-scroll">
          {isLoadingSessions ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-white/40 space-y-2">
              <MessageSquare className="w-8 h-8 opacity-40" />
              <span className="text-xs">Nenhum atendimento na fila. Bom trabalho!</span>
            </div>
          ) : (
            sessions.map((sess) => {
              const isSelected = sess.id === activeSessionId
              const isAssignedToMe = sess.assigned_agent_id === user?.id
              
              return (
                <button
                  key={sess.id}
                  onClick={() => setActiveSessionId(sess.id)}
                  className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 flex flex-col gap-1.5 border relative ${
                    isSelected
                      ? 'bg-purple-500/10 border-purple-500/30 text-white shadow-lg'
                      : 'bg-white/[0.02] border-transparent text-white/70 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-xs truncate">
                        {sess.user_name || `Visitante #${sess.visitor_id.substring(0, 4)}`}
                      </span>
                      {sess.status === 'open' ? (
                        <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase">Fila</span>
                      ) : isAssignedToMe ? (
                        <span className="text-[9px] font-bold bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20 uppercase">Meu</span>
                      ) : (
                        <span className="text-[9px] font-bold bg-white/10 text-white/60 px-1.5 py-0.5 rounded border border-white/10 uppercase">Outro</span>
                      )}
                    </div>
                    <span className="text-[10px] text-white/40 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(sess.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-white/50 truncate w-full">
                    {sess.last_message || 'Nenhuma mensagem.'}
                  </p>

                  {/* Badge de não lidas */}
                  {(sess.unread_count || 0) > 0 && (
                    <span className="absolute bottom-3 right-3 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ring-2 ring-[#07080c]">
                      {sess.unread_count}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* 2. PAINEL CENTRAL: Área da Conversa */}
      <div className="flex-1 flex flex-col h-full bg-[#07080c]/20">
        {activeSessionId ? (
          <>
            {/* Header da conversa */}
            <div className="p-4 border-b border-white/[0.05] bg-[#07080c]/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">
                    {activeSession?.user_name || `Visitante #${activeSession?.visitor_id.substring(0, 8)}`}
                  </h4>
                  {activeSession?.user_email && (
                    <p className="text-xs text-white/40">{activeSession.user_email}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeSession?.status === 'open' && (
                  <button
                    onClick={() => handleAssignSession(activeSessionId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-xl transition-all shadow-md"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Assumir Chat
                  </button>
                )}
                <button
                  onClick={() => handleCloseSession(activeSessionId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold rounded-xl transition-all"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Encerrar Atendimento
                </button>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-dark-scroll">
              {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : (
                messages.map((msg) => {
                  const isAgent = msg.sender_type === 'agent'
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${
                          isAgent
                            ? 'bg-purple-500/25 border border-purple-500/30 text-white rounded-tr-none'
                            : 'bg-white/[0.04] border border-white/[0.08] text-white/90 rounded-tl-none'
                        }`}
                      >
                        {isAgent && (
                          <p className="text-[10px] text-purple-400 font-semibold mb-0.5">
                            {msg.sender_name}
                          </p>
                        )}
                        <p className="leading-relaxed break-words">{msg.content}</p>
                        <span className="block text-[9px] text-white/30 text-right mt-1.5">
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

            {/* Input para envio */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 bg-[#07080c]/50 border-t border-white/[0.05] flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Digite sua resposta..."
                className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/40 transition-all"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isSending}
                className="p-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl disabled:opacity-50 disabled:hover:bg-purple-500 transition-all shadow-lg flex items-center justify-center"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-xl">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Central de Atendimento</h3>
              <p className="text-xs text-white/40 mt-1 max-w-[280px]">
                Selecione uma sessão de chat na barra lateral para iniciar o atendimento ao cliente.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. PAINEL DIREITO: Informações Adicionais */}
      {activeSessionId && activeSession && (
        <div className="w-72 border-l border-white/[0.05] bg-[#07080c]/50 p-4 space-y-6 hidden xl:block">
          <div>
            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Detalhes da Sessão
            </h4>
            <div className="space-y-3">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-[10px] text-white/40 block mb-0.5">ID do Atendimento</span>
                <span className="text-xs text-white font-mono break-all">{activeSession.id}</span>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-[10px] text-white/40 block mb-0.5">ID do Visitante</span>
                <span className="text-xs text-white font-mono break-all">{activeSession.visitor_id}</span>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-[10px] text-white/40 block mb-0.5">Início do Contato</span>
                <span className="text-xs text-white">
                  {new Date(activeSession.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Agente Atribuído
            </h4>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-300">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                {activeSession.assigned_agent_id ? (
                  <>
                    <span className="text-xs text-white font-semibold block">
                      {activeSession.assigned_agent_id === user?.id ? 'Você mesmo' : 'Outro agente'}
                    </span>
                    <span className="text-[10px] text-purple-400">Em andamento</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-white/50 block font-medium">Nenhum agente</span>
                    <span className="text-[10px] text-amber-400">Aguardando na fila</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Atalho Rápido
            </h4>
            <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/60 leading-relaxed">
                Toda mensagem enviada para uma conversa não assumida associará você automaticamente ao atendimento.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
