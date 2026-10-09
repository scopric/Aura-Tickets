import type { DbTask } from '../hooks/useProducerTools'
import { diaBR } from './visaoEvento'

// Prazo da tarefa (producer_tasks.due_date é timestamptz): o <input type="date"> grava ao meio-dia de Brasília
// (como eventoProdutor.ts), e o "dia" lido de volta (diaBR) é sempre o de America/Sao_Paulo, nunca o do UTC.
// ponytail: fuso fixo -03:00 (Brasil sem horário de verão desde 2019).
export const prazoDoDia = (dia: string) => `${dia}T12:00:00-03:00`

/** Não concluída e com prazo em dia anterior ao de hoje (comparando o dia de Brasília) */
export const atrasada = (t: Pick<DbTask, 'status' | 'due_date'>, hoje = diaBR(new Date())) =>
  t.status !== 'done' && !!t.due_date && diaBR(t.due_date) < hoje

/** Valor de ?eventId= que filtra as tarefas da produtora (sem evento) */
export const PRODUTORA = 'produtora'

export type KindColuna = 'todo' | 'doing' | 'done'

/**
 * Cor do prazo no cartão: erro = vencido e fora de uma coluna Feito; aviso = vence em até 3 dias (hoje incluso);
 * neutro = o resto (sem prazo, longe, ou concluído). Compara dias de Brasília (diaBR), como atrasada().
 */
export function corPrazo(due: string | null, kind: KindColuna, hoje = diaBR(new Date())): 'neutro' | 'aviso' | 'erro' {
  if (!due || kind === 'done') return 'neutro'
  const dia = diaBR(due)
  if (dia < hoje) return 'erro'
  const dias = (Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000
  return dias <= 3 ? 'aviso' : 'neutro'
}

/**
 * Posição (numeric no banco) para encaixar um cartão na coluna: `outras` são as posições dos OUTROS cartões da coluna,
 * em ordem; `indice` é o lugar de destino (0 = topo, outras.length = fim). Fica no meio dos vizinhos, então mover
 * um cartão grava só uma linha. ponytail: ~50 encaixes seguidos no mesmo ponto esgotam a precisão do número;
 * reindexar a coluna (1000, 2000, ...) quando isso acontecer.
 */
export function posicaoNaColuna(outras: number[], indice: number): number {
  const antes = outras[indice - 1]
  const depois = outras[indice]
  if (antes === undefined && depois === undefined) return 1000
  if (antes === undefined) return depois / 2
  if (depois === undefined) return antes + 1000
  return (antes + depois) / 2
}
