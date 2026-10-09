import type { ReactNode } from 'react'
import { useArrastar } from '../../../hooks/useArrastar'
import type { ColunaQuadro, DbTask } from '../../../hooks/useProducerTools'
import { corPrazo, posicaoNaColuna } from '../../../lib/tarefas'
import { diaBR } from '../../../lib/visaoEvento'
import * as I from '@/components/icones/evokaa16'
import { cn } from '@/lib/utils'
import MenuMover from './MenuMover'

const corDoPrazo = { neutro: 'text-muted-foreground', aviso: 'font-medium text-[var(--ev-warning)]', erro: 'font-medium text-destructive' }
const dataBr = (iso: string) => diaBR(iso).split('-').reverse().join('/')

interface Props {
  tarefas: DbTask[]
  colunas: ColunaQuadro[]
  /** Em que coluna o cartão está (coluna do banco no modo novo; o status no modo por status) */
  colunaDe: (t: DbTask) => string
  /** Modo novo: a ordem é a position do cartão e Subir/Descer existem. Modo por status: ordem por prazo e criação */
  ordenavel: boolean
  /** posicao só vem no modo novo */
  onMover: (t: DbTask, colunaId: string, posicao?: number) => void
  /** Detalhes extras do cartão (prioridade, evento) que a tela escolhe */
  extras?: (t: DbTask) => ReactNode
}

const porPrazo = (a: DbTask, b: DbTask) =>
  (a.due_date ?? '9').localeCompare(b.due_date ?? '9') || a.created_at.localeCompare(b.created_at)
const porPosicao = (a: DbTask, b: DbTask) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.created_at.localeCompare(b.created_at)

export default function Quadro({ tarefas, colunas, colunaDe, ordenavel, onMover, extras }: Props) {
  const nome = (id: string) => colunas.find(c => c.id === id)?.name ?? ''
  const hoje = diaBR(new Date())
  const noCartao = (colunaId: string) => tarefas.filter(t => colunaDe(t) === colunaId).sort(ordenavel ? porPosicao : porPrazo)

  // Soltar/mover para outra coluna: vai para o fim dela
  const para = (t: DbTask, colunaId: string) => {
    if (colunaDe(t) === colunaId || colunas.find(c => c.id === colunaId)?.dica) return
    const fim = noCartao(colunaId).map(x => x.position ?? 0)
    onMover(t, colunaId, ordenavel ? posicaoNaColuna(fim, fim.length) : undefined)
  }
  // Subir/Descer dentro da coluna: encaixa entre os vizinhos do destino (as posições dos outros cartões, sem este)
  const dentro = (t: DbTask, lista: DbTask[], delta: number) => {
    const i = lista.findIndex(x => x.id === t.id)
    const outras = lista.filter(x => x.id !== t.id).map(x => x.position ?? 0)
    onMover(t, colunaDe(t), posicaoNaColuna(outras, i + delta))
  }

  const arrastar = useArrastar(
    colunas.filter(c => !c.dica).map(c => c.id),
    (cartao, coluna) => { const t = tarefas.find(x => x.id === cartao); if (t) para(t, coluna) },
    nome,
  )

  return (
    <>
      <p role="status" className="sr-only">{arrastar.aviso}</p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {colunas.map(col => {
          const lista = noCartao(col.id)
          return (
            <section
              key={col.id}
              aria-label={col.name}
              className={cn('flex w-72 shrink-0 flex-col rounded-[10px] border bg-card', arrastar.alvo === col.id ? 'border-primary' : 'border-border')}
              {...(col.dica ? {} : arrastar.propsColuna(col.id))}
            >
              <h2 className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-sm font-medium text-foreground">
                <span className="truncate">{col.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{lista.length}</span>
              </h2>
              <ul className="max-h-[500px] min-h-16 space-y-2 overflow-y-auto p-2">
                {lista.map((t, i) => {
                  const cor = corPrazo(t.due_date, col.kind, hoje)
                  return (
                    <li key={t.id} {...arrastar.propsCartao(t.id, col.id)} aria-label={`${t.title}, coluna ${col.name}`}
                      className={cn('flex items-start gap-1 rounded-md border border-border bg-background p-3 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring', arrastar.pegado === t.id && 'opacity-60')}>
                      <div className="min-w-0 flex-1">
                        <h3 className={cn('break-words text-sm font-medium', col.kind === 'done' ? 'text-muted-foreground line-through' : 'text-foreground')}>{t.title}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className={cn('flex items-center gap-1', corDoPrazo[cor])}>
                            <I.Eventos size={16} aria-hidden="true" />
                            {t.due_date ? `${dataBr(t.due_date)}${cor === 'erro' ? ' (atrasada)' : ''}` : 'Sem prazo'}
                          </span>
                          {extras?.(t)}
                        </div>
                      </div>
                      <MenuMover
                        titulo={t.title}
                        ordenavel={ordenavel}
                        podeSubir={i > 0}
                        podeDescer={i < lista.length - 1}
                        onSubir={() => dentro(t, lista, -1)}
                        onDescer={() => dentro(t, lista, 1)}
                        destinos={colunas.filter(c => c.id !== col.id && !c.dica)}
                        onPara={id => para(t, id)}
                      />
                    </li>
                  )
                })}
                {lista.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">{col.dica ?? 'Arraste cartões para cá'}</li>}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
