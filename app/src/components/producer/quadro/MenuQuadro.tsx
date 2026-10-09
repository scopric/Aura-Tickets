import { useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { mensagemSegura } from '../../../hooks/useCartao'
import type { ConfigRecibos } from '../../../hooks/useQuadroAvisos'
import type { DbTask } from '../../../hooks/useProducerTools'
import { PrefsAvisos } from './AvisosQuadro'
import { FRASE_PRIVACIDADE } from './Recibos'
import RoteiroLocais from './RoteiroLocais'

export type PaginaQuadro = 'prefs' | 'rota' | null

interface Props {
  pagina: PaginaQuadro
  onPagina: (p: PaginaQuadro) => void
  /** Banco com o SQL da 2B: sem ele, só o roteiro aparece */
  avisosDisponivel: boolean
  config: ConfigRecibos
  alterarRecibos: (ligado: boolean, onErro: (e: Error) => void) => void
  tarefas: DbTask[]
  concluida: (t: DbTask) => boolean
}

/** Menu do quadro: preferências de aviso, roteiro com locais e (só para o dono) "Mostrar quem viu" */
export default function MenuQuadro({ pagina, onPagina, avisosDisponivel, config, alterarRecibos, tarefas, concluida }: Props) {
  const [aberto, setAberto] = useState(false)
  const ir = (p: PaginaQuadro) => { setAberto(false); onPagina(p) }
  return (
    <>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground" aria-label="Menu do quadro"><I.Menu aria-hidden="true" /></Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="grid w-80 max-w-[calc(100vw-1.5rem)] gap-1 p-2">
          {avisosDisponivel && <Button variant="ghost" size="sm" className="min-h-11 justify-start sm:min-h-8" onClick={() => ir('prefs')}><I.Notificacoes aria-hidden="true" />Notificações e sons</Button>}
          <Button variant="ghost" size="sm" className="min-h-11 justify-start sm:min-h-8" onClick={() => ir('rota')}><I.Local aria-hidden="true" />Roteiro com locais</Button>
          {config.disponivel && config.dono && (
            <div className="mt-1 grid gap-1 border-t border-border p-2 pt-3">
              <div className="flex items-center justify-between gap-3">
                <span id="mostrar-quem-viu" className="text-sm font-medium">Mostrar quem viu</span>
                <Switch aria-labelledby="mostrar-quem-viu" aria-describedby="mostrar-quem-viu-dica" checked={config.ligado}
                  onCheckedChange={v => alterarRecibos(v, e => toast.error(mensagemSegura(e)))} />
              </div>
              <p id="mostrar-quem-viu-dica" className="text-xs text-muted-foreground">Mostra a confirmação de leitura nas mensagens e o “Visto por” nos cartões. {FRASE_PRIVACIDADE}</p>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={pagina !== null} onOpenChange={o => { if (!o) onPagina(null) }}>
        {pagina && (
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{pagina === 'prefs' ? 'Notificações e sons' : 'Roteiro com locais'}</DialogTitle>
              <DialogDescription>{pagina === 'prefs' ? 'Cada pessoa escolhe o que quer receber. Estas são as suas preferências.' : 'Junte os cartões com local em uma única rota de visitas.'}</DialogDescription>
            </DialogHeader>
            {pagina === 'prefs' ? <PrefsAvisos /> : <RoteiroLocais tarefas={tarefas} concluida={concluida} />}
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
