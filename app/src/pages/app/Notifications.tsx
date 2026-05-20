import { useState } from 'react'
import { Bell, Check, Clock, Calendar, DollarSign, Ticket, AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface Notification {
  id: string
  title: string
  message: string
  type: 'evento' | 'pagamento' | 'lembrete' | 'promocao' | 'alerta'
  date: string
  read: boolean
  action?: string
}

const mockNotifications: Notification[] = [
  { id: 'n1', title: 'Noite Eletro em 2h!', message: 'Seu evento comeca as 21h. Nao se esqueca!', type: 'lembrete', date: '10 min', read: false, action: 'Ver Ingresso' },
  { id: 'n2', title: 'Ingresso VIP confirmado', message: 'Pagamento de R$ 150 aprovado. Codigo: AUR-VIP-001', type: 'pagamento', date: '1h', read: false, action: 'Ver Detalhes' },
  { id: 'n3', title: 'Jazz Sunset - Novo horario', message: 'O evento foi antecipado para 18h. Confira!', type: 'evento', date: '3h', read: false, action: 'Ver Evento' },
  { id: 'n4', title: 'Promocao! 30% OFF', message: 'Cupom ELETRO30 valido por 24h para eventos selecionados', type: 'promocao', date: '5h', read: true, action: 'Ver Ofertas' },
  { id: 'n5', title: 'Reembolso processado', message: 'R$ 180 reembolsados para sua conta PIX', type: 'pagamento', date: '1 dia', read: true, action: 'Ver Extrato' },
  { id: 'n6', title: 'Evento cancelado', message: 'Show de Rock foi cancelado. Reembolso automatico em ate 7 dias.', type: 'alerta', date: '2 dias', read: true, action: 'Saiba Mais' },
  { id: 'n7', title: 'Novo evento em Sao Paulo', message: 'Feira de Gastronomia - 15 Jun. Ingressos a partir de R$ 40', type: 'evento', date: '3 dias', read: true, action: 'Explorar' },
  { id: 'n8', title: 'Lembrete: Mesa Coletiva', message: 'Responda o questionario de perfil para sua mesa!', type: 'lembrete', date: '4 dias', read: true, action: 'Responder' },
  { id: 'n9', title: 'Fatura do plano Pro', message: 'Sua assinatura foi renovada. R$ 149 cobrados no cartao ****4242', type: 'pagamento', date: '7 dias', read: true, action: 'Ver Fatura' },
]

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  evento: { icon: Calendar, color: 'text-plum', bg: 'bg-plum/10' },
  pagamento: { icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
  lembrete: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  promocao: { icon: Ticket, color: 'text-amber-600', bg: 'bg-amber-50' },
  alerta: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
}

export default function ParticipantNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const markAsRead = (id: string) => { setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n)) }
  const markAllRead = () => { setNotifications(notifications.map(n => ({ ...n, read: true }))); toast.success('Todas marcadas como lidas') }
  const clearAll = () => { setNotifications([]); toast.success('Notificacoes limpas') }

  const filtered = notifications.filter(n => filter === 'all' || !n.read)
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Notificacoes</h1>
          <p className="text-sm text-espresso/50 mt-1">{unreadCount} nao lidas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={markAllRead} className="px-4 py-2 text-xs text-espresso/40 hover:text-plum transition-colors flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Marcar lidas</button>
          <button onClick={clearAll} className="px-4 py-2 text-xs text-espresso/40 hover:text-red-500 transition-colors flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Limpar</button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-full w-fit mb-6">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filter === 'all' ? 'bg-plum text-cream' : 'text-espresso/40'}`}>Todas ({notifications.length})</button>
        <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filter === 'unread' ? 'bg-plum text-cream' : 'text-espresso/40'}`}>Nao lidas ({unreadCount})</button>
      </div>

      <div className="space-y-2">
        {filtered.map(n => {
          const tc = typeConfig[n.type]
          const Icon = tc.icon
          return (
            <div key={n.id} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${!n.read ? 'bg-white/60 border-plum/20' : 'bg-white/30 border-white/60 opacity-60'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tc.bg}`}>
                <Icon className={`w-4 h-4 ${tc.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className={`text-sm ${!n.read ? 'font-medium text-espresso' : 'text-espresso/50'}`}>{n.title}</h3>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-plum flex-shrink-0" />}
                </div>
                <p className="text-xs text-espresso/40 mb-1.5">{n.message}</p>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-espresso/20">{n.date}</span>
                  {n.action && <button onClick={() => markAsRead(n.id)} className="text-[10px] text-plum hover:underline">{n.action}</button>}
                  {!n.read && <button onClick={() => markAsRead(n.id)} className="text-[10px] text-espresso/20 hover:text-espresso/50 transition-colors flex items-center gap-0.5"><Check className="w-3 h-3" /> Lida</button>}
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div className="py-16 text-center text-sm text-espresso/20">Nenhuma notificacao</div>}
      </div>
    </div>
  )
}
