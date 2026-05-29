import { useState } from 'react'
import { Bell, Check, Clock, Calendar, DollarSign, Ticket, AlertTriangle, Trash2, CheckCircle2, Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'
import {
  useUserNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '../../hooks/useNotifications'

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Info' },
  sale: { icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50', label: 'Venda' },
  reminder: { icon: Clock, color: 'text-plum', bg: 'bg-plum/10', label: 'Lembrete' },
  promo: { icon: Ticket, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Promocao' },
  system: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', label: 'Sistema' },
  evento: { icon: Calendar, color: 'text-plum', bg: 'bg-plum/10', label: 'Evento' },
  pagamento: { icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50', label: 'Pagamento' },
  lembrete: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Lembrete' },
  promocao: { icon: Ticket, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Promocao' },
  alerta: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', label: 'Alerta' },
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'Agora mesmo'
  if (mins < 60) return `Ha ${mins} min`
  if (hours < 24) return `Ha ${hours}h`
  if (days === 1) return 'Ontem'
  return `Ha ${days} dias`
}

export default function ParticipantNotifications() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { data: notifications = [], isLoading } = useUserNotifications()
  const markAsRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const deleteNotification = useDeleteNotification()

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead.mutateAsync(id)
    } catch {
      toast.error('Erro ao marcar como lida')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync()
      toast.success('Todas marcadas como lidas')
    } catch {
      toast.error('Erro ao marcar notificacoes')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification.mutateAsync(id)
      toast.success('Notificacao removida')
    } catch {
      toast.error('Erro ao remover notificacao')
    }
  }

  const filtered = notifications.filter((n) => (filter === 'all' ? true : !n.is_read))
  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (isLoading) {
    return (
      <div className="max-w-3xl flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando notificacoes...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Notificacoes</h1>
          <p className="text-sm text-espresso/50 mt-1">
            {unreadCount > 0 ? `${unreadCount} nao lida${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === 'all' ? 'bg-plum text-cream' : 'bg-white/60 text-espresso/50 hover:bg-white'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === 'unread' ? 'bg-plum text-cream' : 'bg-white/60 text-espresso/50 hover:bg-white'
            }`}
          >
            Nao lidas
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/60 text-espresso/50 hover:bg-white transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3 h-3" />
              Marcar todas
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white/60 border border-white/60 rounded-3xl">
          <Bell className="w-12 h-12 text-espresso/10 mx-auto mb-4" />
          <p className="text-espresso/40 text-sm">
            {filter === 'unread' ? 'Nenhuma notificacao nao lida.' : 'Nenhuma notificacao ainda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const cfg = typeConfig[n.type] || typeConfig.info
            const Icon = cfg.icon

            return (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition-all ${
                  n.is_read
                    ? 'bg-white/40 border-white/40'
                    : 'bg-white/60 border-white/60 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm ${n.is_read ? 'text-espresso/60' : 'text-espresso font-medium'}`}>
                        {n.title}
                      </h3>
                      <span className="text-[10px] text-espresso/30 flex-shrink-0">{formatTimeAgo(n.created_at)}</span>
                    </div>
                    {n.message && (
                      <p className="text-xs text-espresso/40 mt-0.5">{n.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3">
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      disabled={markAsRead.isPending}
                      className="text-[10px] text-plum hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      Marcar como lida
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    disabled={deleteNotification.isPending}
                    className="text-[10px] text-espresso/30 hover:text-red-500 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remover
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
