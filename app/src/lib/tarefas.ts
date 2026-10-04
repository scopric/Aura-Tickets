import type { DbTask } from '../hooks/useProducerTools'
import { diaBR } from './visaoEvento'

// Prazo da tarefa (producer_tasks.due_date é timestamptz): o <input type="date"> grava ao meio-dia de Brasília
// (como eventoProdutor.ts), e o "dia" lido de volta (diaBR) é sempre o de America/Sao_Paulo, nunca o do UTC.
// ponytail: fuso fixo -03:00 (Brasil sem horário de verão desde 2019).
export const prazoDoDia = (dia: string) => `${dia}T12:00:00-03:00`

/** Não concluída e com prazo em dia anterior ao de hoje (comparando o dia de Brasília) */
export const atrasada = (t: Pick<DbTask, 'status' | 'due_date'>, hoje = diaBR(new Date())) =>
  t.status !== 'done' && !!t.due_date && diaBR(t.due_date) < hoje
