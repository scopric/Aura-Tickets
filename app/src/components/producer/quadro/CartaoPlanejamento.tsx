import { useId, useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { selectNativo } from '@/components/producer/ui'
import { mensagemSegura, type CamposCartao } from '../../../hooks/useCartao'
import type { ColunaQuadro, DbTask } from '../../../hooks/useProducerTools'
import { useBotoes, useConfigAcoes, useGerarRecorrente, type ResultadoBotao } from '../../../hooks/useQuadroAcoes'
import { ResultadoDoBotao } from './BotoesQuadro'
import { Secao } from './CartaoSecoes'

const alvo = 'min-h-11 sm:min-h-8'
const aoErro = (e: Error) => toast.error(mensagemSegura(e))
const REPETICOES: [number, string][] = [[0, 'Não repete'], [1, 'Todo dia'], [7, 'Toda semana'], [14, 'A cada 14 dias'], [30, 'Todo mês']]
const dataBr = (v: string) => v.slice(0, 10).split('-').reverse().join('/')

/** Verso do cartão: botões do quadro, repetição e "checklist que move". Sem o SQL da 2C a seção não aparece */
export default function CartaoPlanejamento({ tarefa, boardId, colunas, temChecklist, gravar }: {
  tarefa: DbTask; boardId: string; colunas: ColunaQuadro[]; temChecklist: boolean
  gravar: (campos: CamposCartao) => void
}) {
  const { config } = useConfigAcoes(boardId)
  const botoes = useBotoes(boardId)
  const gerar = useGerarRecorrente()
  const [copiar, setCopiar] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBotao | null>(null)
  const idMove = useId()
  const pode = config.podeEditar
  const doCartao = botoes.botoes.filter(b => b.scope === 'card')
  const temRepetir = tarefa.ck_move !== undefined // recur_days já existe desde a 2A; ck_move só vem no select * depois do SQL da 2C
  const temMover = tarefa.ck_move !== undefined
  if (!botoes.disponivel && !temRepetir && !temMover) return null
  const revisao = colunas.find(c => c.id === config.revisaoId)

  return (
    <>
      {botoes.disponivel && (
        <Secao titulo="Botões" icone={<I.Raio />}>
          {doCartao.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum botão de cartão. {pode ? 'Crie em Menu do quadro, Botões.' : ''}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {doCartao.map(b => pode ? (
                <Button key={b.id} variant="outline" size="sm" className={alvo} disabled={botoes.rodar.isPending}
                  onClick={() => botoes.rodar.mutate({ button: b.id, task: tarefa.id }, { onError: aoErro, onSuccess: setResultado })}>{b.name}</Button>
              ) : <span key={b.id} className="rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground">{b.name}</span>)}
            </div>
          )}
          {resultado && <ResultadoDoBotao r={resultado} />}
        </Secao>
      )}

      {(temRepetir || temMover) && (
        <Secao titulo="Repetir e revisão" icone={<I.Atualizar />}>
          {temRepetir && (
            <div className="grid gap-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Repetir</span>
                <select className={`${selectNativo} text-base sm:text-sm sm:max-w-xs`} disabled={!pode} value={tarefa.recur_days ?? 0}
                  onChange={e => gravar({ recur_days: Number(e.target.value) || null })}>
                  {REPETICOES.map(([n, t]) => <option key={n} value={n}>{t}</option>)}
                </select>
              </label>
              {!!tarefa.recur_days && (
                <div className="flex flex-wrap items-center gap-3">
                  {tarefa.recur_next && <span className="text-xs text-muted-foreground">Próxima cópia em {dataBr(tarefa.recur_next)}. Ela nasce na primeira coluna, com o checklist zerado.</span>}
                  {pode && <Button variant="outline" size="sm" className={alvo} loading={gerar.isPending}
                    onClick={() => setCopiar(true)}>Gerar cópia agora</Button>}
                </div>
              )}
            </div>
          )}
          {temMover && temChecklist && (revisao ? (
            <div className="grid gap-1">
             <div className="flex items-start gap-3">
              <Switch id={idMove} aria-describedby={`${idMove}-dica`} disabled={!pode} checked={!!tarefa.ck_move} onCheckedChange={v => gravar({ ck_move: v })} />
              <label htmlFor={idMove} className="text-sm">Mover para a coluna de revisão (<b className="font-medium">{revisao.name}</b>) quando o checklist fechar</label>
             </div>
             <p id={`${idMove}-dica`} className="text-xs text-muted-foreground">O cartão só muda de coluna quando você MARCA um item e todos ficam marcados. Apagar o último item aberto ou criar um item já marcado não move. Lista vazia não bloqueia nada.</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Para o checklist mover o cartão sozinho, o dono do quadro escolhe a “Coluna de revisão” no Menu do quadro.</p>
          ))}
        </Secao>
      )}

      <AlertDialog open={copiar} onOpenChange={setCopiar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar a cópia agora?</AlertDialogTitle>
            <AlertDialogDescription>A cópia nasce na primeira coluna, com o checklist zerado. Só é possível gerar uma cópia manual por cartão por dia.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => gerar.mutate(tarefa.id, { onError: aoErro, onSuccess: () => toast.success('Cópia criada na primeira coluna.') })}>Gerar cópia</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
