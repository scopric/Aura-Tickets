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
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border border-blue-500/20', label: 'Info' },
  sale: { icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20', label: 'Venda' },
  reminder: { icon: Clock, color: 'text-purple-400', bg: 'bg-purple-500/10 border border-purple-500/20', label: 'Lembrete' },
  promo: { icon: Ticket, color: 'text-amber-400', bg: 'bg-amber-500/10 border border-amber-500/20', label: 'Promoção' },
  system: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10 border border-rose-500/20', label: 'Sistema' },
  evento: { icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/10 border border-purple-500/20', label: 'Evento' },
  pagamento: { icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20', label: 'Pagamento' },
  lembrete: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10 border border-blue-500/20', label: 'Lembrete' },
  promocao: { icon: Ticket, color: 'text-amber-400', bg: 'bg-amber-500/10 border border-amber-500/20', label: 'Promoção' },
  alerta: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10 border border-rose-500/20', label: 'Alerta' },
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'Agora mesmo'
  if (mins < 60) return `Há ${mins} min`
  if (hours < 24) return `Há ${hours}h`
  if (days === 1) return 'Ontem'
  return `Há ${days} dias`
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
      toast.error('Erro ao marcar notificações')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification.mutateAsync(id)
      toast.success('Notificação removida')
    } catch {
      toast.error('Erro ao remover notificação')
    }
  }

  const filtered = notifications.filter((n) => (filter === 'all' ? true : !n.is_read))
  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (isLoading) {
    return (
      <div className="max-w-3xl flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
        <p className="text-white/60 text-sm">Carregando notificações...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Notificações</h1>
          <p className="text-sm text-white/40 mt-1">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] text-white shadow-lg shadow-purple-500/10 border border-purple-500/20'
                : 'bg-white/[0.02] border border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === 'unread'
                ? 'bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] text-white shadow-lg shadow-purple-500/10 border border-purple-500/20'
                : 'bg-white/[0.02] border border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Não lidas
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.02] border border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.04] transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Marcar todas</span>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-3xl">
          <Bell className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-sm">
            {filter === 'unread' ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação ainda.'}
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
                className={`p-4 rounded-2xl border transition-all duration-200 ${
                  n.is_read
                    ? 'bg-white/[0.01] border-white/[0.04]'
                    : 'bg-white/[0.03] border-white/[0.08] shadow-sm shadow-purple-500/5 hover:border-purple-500/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm ${n.is_read ? 'text-white/60' : 'text-white font-semibold'}`}>
                        {n.title}
                      </h3>
                      <span className="text-[10px] text-white/40 flex-shrink-0">{formatTimeAgo(n.created_at)}</span>
                    </div>
                    {n.message && (
                      <p className="text-xs text-white/40 mt-1">{n.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-white/[0.04]">
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      disabled={markAsRead.isPending}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      <span>Marcar como lida</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    disabled={deleteNotification.isPending}
                    className="text-[10px] text-white/40 hover:text-rose-400 font-semibold flex items-center gap-1 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover</span>
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
