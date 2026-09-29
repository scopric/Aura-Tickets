import { useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { useUserNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../hooks/useNotifications'

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60],
]

/** "há 5 minutos", "ontem"… (pt-BR, sem dependência) */
export function tempoRelativo(iso: string, agora = Date.now()) {
  const s = Math.round((new Date(iso).getTime() - agora) / 1000)
  for (const [unidade, seg] of UNIDADES) if (Math.abs(s) >= seg) return rtf.format(Math.trunc(s / seg), unidade)
  return 'agora'
}

/** Sino da barra de topo do produtor: lista as notificações do próprio usuário (tema claro e escuro). */
export default function NotificationsTopButton({ className }: { className: string }) {
  const [aberto, setAberto] = useState(false)
  const { data: notificacoes = [], isLoading, isError } = useUserNotifications()
  const marcarUma = useMarkNotificationRead()
  const marcarTodas = useMarkAllNotificationsRead()
  const naoLidas = notificacoes.filter((n) => !n.is_read).length

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`Notificações (${naoLidas} não lidas)`} className={`relative ${className}`}>
              <Bell className="h-5 w-5" aria-hidden="true" />
              {naoLidas > 0 && (
                <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-purple-500 ring-2 ring-[#f8fafc] dark:ring-[#0a0b10]" />
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Notificações</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1.5rem)] overflow-hidden p-0 text-espresso">
        <div className="flex items-center justify-between border-b border-slate-900/10 p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Notificações</h3>
          <button
            type="button"
            onClick={() => marcarTodas.mutate()}
            disabled={marcarTodas.isPending || naoLidas === 0}
            className="rounded text-xs font-medium text-purple-700 hover:text-purple-900 disabled:opacity-50 dark:text-purple-300 dark:hover:text-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            {marcarTodas.isPending ? <Loader2 className="h-3 w-3 animate-spin" aria-label="Marcando" /> : 'Marcar todas como lidas'}
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center" role="status">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-500" aria-label="Carregando notificações" />
            </div>
          ) : isError ? (
            <p role="alert" className="p-6 text-center text-sm text-rose-700 dark:text-rose-300">
              Não foi possível carregar as notificações agora. Tente de novo mais tarde.
            </p>
          ) : notificacoes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <img src="/evo/evo-corpo-celular.webp" alt="" width={37} height={64} className="h-16 w-auto" />
              <p className="text-sm text-slate-700 dark:text-slate-300">Nenhuma notificação por enquanto</p>
            </div>
          ) : (
            <ul>
              {notificacoes.map((n) => (
                <li key={n.id} className={`border-b border-slate-900/5 last:border-0 dark:border-white/5 ${n.is_read ? '' : 'bg-purple-500/10'}`}>
                  <button
                    type="button"
                    // lida continua focável (dá para ler pelo teclado); só a não lida marca ao clicar
                    onClick={() => !n.is_read && !marcarUma.isPending && marcarUma.mutate(n.id)}
                    className="w-full p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500"
                  >
                    <span className="block text-sm font-medium">{n.title}{!n.is_read && <span className="sr-only"> (não lida)</span>}</span>
                    {n.message && <span className="mt-0.5 block text-xs text-slate-700 dark:text-slate-300">{n.message}</span>}
                    <span className="mt-1 block text-[11px] text-slate-600 dark:text-slate-400">{tempoRelativo(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
