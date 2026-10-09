import { useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { mensagemSegura } from '../../../hooks/useCartao'
import type { ConfigRecibos } from '../../../hooks/useQuadroAvisos'
import type { ColunaQuadro, DbTask } from '../../../hooks/useProducerTools'
import { useBotoes, useConfigAcoes, useModelos, usePapeis } from '../../../hooks/useQuadroAcoes'
import { PrefsAvisos } from './AvisosQuadro'
import PaginaBotoes from './BotoesQuadro'
import { ColunaRevisao, PaginaModelos, PaginaPapeis } from './ModelosPapeis'
import { FRASE_PRIVACIDADE } from './Recibos'
import RoteiroLocais from './RoteiroLocais'

export type PaginaQuadro = 'prefs' | 'rota' | 'botoes' | 'modelos' | 'papeis' | null

const TEXTOS: Record<NonNullable<PaginaQuadro>, [string, string]> = {
  prefs: ['Notificações e sons', 'Cada pessoa escolhe o que quer receber. Estas são as suas preferências.'],
  rota: ['Roteiro com locais', 'Junte os cartões com local em uma única rota de visitas.'],
  botoes: ['Botões', 'Sequências de passos que agem em um cartão ou em uma coluna inteira.'],
  modelos: ['Modelos por tipo de evento', 'Crie de uma vez os cartões que cada tipo de evento costuma pedir.'],
  papeis: ['Papéis', 'Quem responde por Portaria, Divulgação e os demais papéis neste quadro.'],
}

interface Props {
  pagina: PaginaQuadro
  onPagina: (p: PaginaQuadro) => void
  /** Banco com o SQL da 2B: sem ele, só o roteiro aparece */
  avisosDisponivel: boolean
  config: ConfigRecibos
  alterarRecibos: (ligado: boolean, onErro: (e: Error) => void) => void
  boardId: string
  colunas: ColunaQuadro[]
  /** false = quadro da produtora, sem evento: o modelo não tem data de referência */
  temEvento: boolean
  tarefas: DbTask[]
  concluida: (t: DbTask) => boolean
}

/** Menu do quadro: preferências de aviso, roteiro com locais e (só para o dono) "Mostrar quem viu" */
export default function MenuQuadro({ pagina, onPagina, avisosDisponivel, config, alterarRecibos, boardId, colunas, temEvento, tarefas, concluida }: Props) {
  const { config: acoes } = useConfigAcoes(boardId)
  // modo antigo (sem o SQL da 2C): as entradas novas nem aparecem
  const temBotoes = useBotoes(boardId).disponivel, temModelos = useModelos(boardId).disponivel, temPapeis = usePapeis(boardId).disponivel
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
          {temBotoes && <Button variant="ghost" size="sm" className="min-h-11 justify-start sm:min-h-8" onClick={() => ir('botoes')}><I.Raio aria-hidden="true" />Botões</Button>}
          {temModelos && <Button variant="ghost" size="sm" className="min-h-11 justify-start sm:min-h-8" onClick={() => ir('modelos')}><I.Estrela aria-hidden="true" />Modelos por tipo de evento</Button>}
          {temPapeis && <Button variant="ghost" size="sm" className="min-h-11 justify-start sm:min-h-8" onClick={() => ir('papeis')}><I.Pessoas aria-hidden="true" />Papéis</Button>}
          <ColunaRevisao boardId={boardId} colunas={colunas} />
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
              <DialogTitle>{TEXTOS[pagina][0]}</DialogTitle>
              <DialogDescription>{TEXTOS[pagina][1]}</DialogDescription>
            </DialogHeader>
            {pagina === 'prefs' ? <PrefsAvisos />
              : pagina === 'rota' ? <RoteiroLocais tarefas={tarefas} concluida={concluida} />
              : pagina === 'botoes' ? <PaginaBotoes boardId={boardId} colunas={colunas} pode={acoes.podeEditar} />
              : pagina === 'modelos' ? <PaginaModelos boardId={boardId} pode={acoes.podeEditar} temEvento={temEvento} />
              : <PaginaPapeis boardId={boardId} pode={acoes.podeEditar} />}
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
