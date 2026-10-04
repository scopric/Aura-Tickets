import type { DbTask } from '../hooks/useProducerTools'

// Prazo da tarefa (producer_tasks.due_date é timestamptz): o <input type="date"> grava ao meio-dia de Brasília
// (como eventoProdutor.ts), e o "dia" lido de volta é sempre o de America/Sao_Paulo, nunca o do UTC.
// ponytail: fuso fixo -03:00 (Brasil sem horário de verão desde 2019).
export const prazoDoDia = (dia: string) => `${dia}T12:00:00-03:00`

/** AAAA-MM-DD do instante, em America/Sao_Paulo */
export const diaEmSP = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

/** Não concluída e com prazo em dia anterior ao de hoje (comparando o dia de Brasília) */
export const atrasada = (t: Pick<DbTask, 'status' | 'due_date'>, hoje = diaEmSP(new Date())) =>
  t.status !== 'done' && !!t.due_date && diaEmSP(t.due_date) < hoje
