import { useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import Chip from '../../components/Chip'
import {
  useUserNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '../../hooks/useNotifications'

// Cor pelo significado (contrato 2.1): venda e pagamento verdes, sistema e alerta vermelhos, o resto neutro
const neutro = 'text-muted-foreground'
const typeConfig: Record<string, { icon: I.IconeEvokaa; color: string; label: string }> = {
  info: { icon: I.Info, color: neutro, label: 'Info' },
  sale: { icon: I.Financeiro, color: 'text-[var(--ev-success)]', label: 'Venda' },
  reminder: { icon: I.Horario, color: neutro, label: 'Lembrete' },
  promo: { icon: I.Cupom, color: neutro, label: 'Promoção' },
  system: { icon: I.Alerta, color: 'text-destructive', label: 'Sistema' },
  evento: { icon: I.Eventos, color: neutro, label: 'Evento' },
  pagamento: { icon: I.Financeiro, color: 'text-[var(--ev-success)]', label: 'Pagamento' },
  lembrete: { icon: I.Horario, color: neutro, label: 'Lembrete' },
  promocao: { icon: I.Cupom, color: neutro, label: 'Promoção' },
  alerta: { icon: I.Alerta, color: 'text-destructive', label: 'Alerta' },
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
      <div className="max-w-3xl py-20 text-center text-foreground">
        <Spinner className="mx-auto size-6" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando notificações...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl text-foreground">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.015em]">Notificações</h1>
          <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
          </p>
        </div>
        <div role="group" aria-label="Filtro" className="flex flex-wrap items-center gap-2">
          <Chip marcado={filter === 'all'} onClick={() => setFilter('all')}>Todas</Chip>
          <Chip marcado={filter === 'unread'} onClick={() => setFilter('unread')}>Não lidas</Chip>
          {unreadCount > 0 && (
            <Button variant="outline" className="rounded-ev-pill" onClick={handleMarkAllRead} loading={markAllRead.isPending}>
              <I.CheckDuplo aria-hidden="true" />
              <span>Marcar todas</span>
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div role="status" className="flex max-w-sm flex-col items-start gap-3 py-8">
          <I.Notificacoes size={40} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-lg font-semibold">
            {filter === 'unread' ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação ainda.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((n) => {
            const cfg = typeConfig[n.type] || typeConfig.info
            const Icon = cfg.icon

            return (
              <li key={n.id} className="py-4 first:pt-0">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className={`grid size-9 flex-none place-items-center rounded-ev-md bg-secondary ${cfg.color}`}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className={`text-[15px] leading-5 ${n.is_read ? 'font-medium text-muted-foreground' : 'font-semibold text-foreground'}`}>
                        {!n.is_read && <span className="sr-only">Não lida: </span>}
                        {n.title}
                      </h2>
                      <span className="flex-none text-xs leading-5 text-muted-foreground">{formatTimeAgo(n.created_at)}</span>
                    </div>
                    {n.message && (
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{n.message}</p>
                    )}
                    <div className="-ml-3 mt-2 flex items-center gap-1">
                      {!n.is_read && (
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => handleMarkRead(n.id)} disabled={markAsRead.isPending}>
                          <I.Check aria-hidden="true" />
                          <span>Marcar como lida</span>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(n.id)} disabled={deleteNotification.isPending}>
                        <I.Lixeira aria-hidden="true" />
                        <span>Remover</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
