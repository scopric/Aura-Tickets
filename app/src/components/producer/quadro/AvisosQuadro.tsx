import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { quando } from '../../../hooks/useConversas'
import { mensagemSegura } from '../../../hooks/useCartao'
import { urlDoAviso, useMarkNotificationRead, type DbNotification } from '../../../hooks/useNotifications'
import { TIPOS_AVISO, tipoDoAviso, useMarcarAvisos, usePrefsAvisos, useSalvarPrefs, type PrefsAviso, type TipoAviso } from '../../../hooks/useQuadroAvisos'

/** Sino da tela de tarefas: só os avisos do quadro. Clicar marca como lido e abre o cartão pelo link do aviso (?cartao=) */
export function SinoQuadro({ avisos, naoLidos, onPreferencias }: { avisos: DbNotification[]; naoLidos: number; onPreferencias: () => void }) {
  const [aberto, setAberto] = useState(false)
  const navigate = useNavigate()
  const { prefs } = usePrefsAvisos()
  const salvar = useSalvarPrefs()
  const marcarUma = useMarkNotificationRead()
  const marcarTodos = useMarcarAvisos()

  const abrir = (n: DbNotification) => {
    if (!n.is_read) marcarUma.mutate(n.id, { onError: e => toast.error(mensagemSegura(e)) })
    const url = urlDoAviso(n) // nunca endereço de fora: só caminho interno
    if (url) { setAberto(false); navigate(url) }
  }
  const nome = naoLidos > 0 ? `Avisos do quadro, ${naoLidos} não lido${naoLidos > 1 ? 's' : ''}` : 'Avisos do quadro'
  const somLigado = prefs.sound

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-foreground/5 hover:text-foreground" aria-label={nome}>
          <I.Notificacoes aria-hidden="true" />
          {naoLidos > 0 && (
            <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-[var(--brand-violet)] px-1 text-[10px] font-semibold leading-4 text-white">{naoLidos > 9 ? '9+' : naoLidos}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
          <h2 className="text-sm font-semibold">Avisos do quadro</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-pressed={somLigado} aria-label={somLigado ? 'Bipe ligado. Desligar' : 'Bipe desligado. Ligar'}
              onClick={() => salvar.mutate({ ...prefs, sound: !somLigado }, { onError: e => toast.error(mensagemSegura(e)) })}>
              {somLigado ? <I.Som aria-hidden="true" /> : <I.Mudo aria-hidden="true" />}
            </Button>
            <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-8" disabled={naoLidos === 0 || marcarTodos.isPending}
              onClick={() => marcarTodos.mutate(avisos.filter(a => !a.is_read).map(a => a.id), { onError: e => toast.error(mensagemSegura(e)) })}>Marcar todos como lidos</Button>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {avisos.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nada por aqui. Quando alguém marcar você, mencionar ou mandar mensagem, aparece neste sino.</p>
          ) : (
            <ul>
              {avisos.map(n => {
                const tipo = tipoDoAviso(n)
                return (
                  <li key={n.id} className={cn('border-b border-border last:border-0', !n.is_read && 'bg-[var(--ev-brand-soft)]')}>
                    <button type="button" onClick={() => abrir(n)} className="w-full p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <span className="block text-sm font-medium">{n.title}{!n.is_read && <span className="sr-only"> (não lido)</span>}</span>
                      {n.body && <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>}
                      <span className="mt-1 block text-[11px] text-muted-foreground">{quando(n.created_at)}{tipo && ` · ${TIPOS_AVISO.find(t => t.chave === tipo)?.titulo}`}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" className="min-h-11 w-full sm:min-h-8" onClick={() => { setAberto(false); onPreferencias() }}>Preferências de aviso</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Preferências de aviso da própria pessoa: geral, bipe e, por tipo, "No app" e "E-mail" (o envio por e-mail é da fatia seguinte) */
export function PrefsAvisos() {
  const { prefs, isPending } = usePrefsAvisos()
  const salvar = useSalvarPrefs()
  const gravar = (p: PrefsAviso) => salvar.mutate(p, { onError: e => toast.error(mensagemSegura(e)) })
  const tipo = (chave: TipoAviso, campo: 'app', v: boolean) => gravar({ ...prefs, types: { ...prefs.types, [chave]: { ...prefs.types[chave], [campo]: v } } })
  const linha = 'flex items-center justify-between gap-3 rounded-md border border-border p-3'
  return (
    <div className="grid gap-3" aria-busy={isPending}>
      <div className={linha}>
        <div><p className="text-sm font-medium" id="pref-geral">Receber avisos do quadro</p><p className="text-xs text-muted-foreground">Desligado, nada chega ao sino.</p></div>
        <Switch aria-labelledby="pref-geral" checked={prefs.general} disabled={isPending} onCheckedChange={v => gravar({ ...prefs, general: v })} />
      </div>
      <div className={linha}>
        <div><p className="text-sm font-medium" id="pref-som">Bipe de aviso</p><p className="text-xs text-muted-foreground">Um sinal curto quando chega um aviso novo, com a aba aberta.</p></div>
        <Switch aria-labelledby="pref-som" checked={prefs.sound} disabled={isPending || !prefs.general} onCheckedChange={v => gravar({ ...prefs, sound: v })} />
      </div>
      <div className="grid gap-1">
        <div className="grid grid-cols-[1fr_4rem_5rem] items-center gap-2 px-1 text-xs text-muted-foreground" aria-hidden="true">
          <span>Quais avisos receber</span><span>No app</span><span>E-mail</span>
        </div>
        {TIPOS_AVISO.map(t => (
          <div key={t.chave} className="grid grid-cols-[1fr_4rem_5rem] items-center gap-2 rounded-md border border-border p-3">
            <div><p className="text-sm font-medium">{t.titulo}</p><p className="text-xs text-muted-foreground">{t.dica}</p></div>
            <Switch aria-label={`${t.titulo}: no app`} checked={prefs.types[t.chave].app} disabled={isPending || !prefs.general} onCheckedChange={v => tipo(t.chave, 'app', v)} />
            <div className="flex flex-col items-start gap-0.5">
              <Switch aria-label={`${t.titulo}: e-mail (em breve)`} checked={prefs.types[t.chave].email} disabled />
              <span className="text-[10px] text-muted-foreground">em breve</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
